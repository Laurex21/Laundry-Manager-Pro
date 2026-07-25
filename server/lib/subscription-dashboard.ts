import type { Express } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { users } from "@shared/models/auth";
import {
  customerSubscriptions, customers, membershipSubscriptionPayments,
  subscriptionPlans, subscriptionTransactions,
} from "@shared/schema";
import { monthlyEquivalent, percentage, type MembershipBillingCycle } from "./subscription-formulas";
import { rateLimit } from "./rate-limit";

const periodSchema = z.enum(["month", "quarter", "year"]);
const exportSchema = z.enum(["csv", "excel", "pdf"]);

type DashboardCacheEntry = { expiresAt: number; value: unknown };
const dashboardCache = new Map<string, DashboardCacheEntry>();

function dateOnly(value: Date) { return value.toISOString().slice(0, 10); }
function startFor(period: "month" | "quarter" | "year", now: Date) {
  if (period === "year") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  if (period === "quarter") return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
function asDate(value: string | Date | null | undefined) { return value ? new Date(typeof value === "string" ? `${value}T00:00:00Z` : value) : null; }
function inRange(value: string | Date | null | undefined, start: Date, end: Date) { const date = asDate(value); return !!date && date >= start && date <= end; }
function csvCell(value: unknown) { const text = String(value ?? ""); return `"${text.replaceAll('"', '""')}"`; }

async function organisationIdFor(req: any): Promise<number | null> {
  const [user] = await db.select({ organisationId: users.organisationId }).from(users).where(eq(users.id, req.userId)).limit(1);
  return user?.organisationId ?? null;
}

async function buildDashboard(organisationId: number, period: "month" | "quarter" | "year", allowedSiteIds: number[]) {
  const now = new Date();
  const periodStart = startFor(period, now);
  const all = await db.select({ subscription: customerSubscriptions, plan: subscriptionPlans, client: customers })
    .from(customerSubscriptions)
    .innerJoin(subscriptionPlans, and(
      eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id),
      eq(subscriptionPlans.organisationId, organisationId),
    ))
    .innerJoin(customers, eq(customerSubscriptions.customerId, customers.id))
    .where(and(eq(customerSubscriptions.organisationId, organisationId), inArray(customers.siteId, allowedSiteIds)));

  const ownedSubscriptionIds = all.map((row) => row.subscription.id);
  const payments = ownedSubscriptionIds.length
    ? await db.select().from(membershipSubscriptionPayments)
      .where(and(eq(membershipSubscriptionPayments.organisationId, organisationId), inArray(membershipSubscriptionPayments.subscriptionId, ownedSubscriptionIds)))
    : [];
  const transactions = ownedSubscriptionIds.length
    ? await db.execute(sql`
        select st.* from subscription_transactions st
        join customer_subscriptions cs on cs.id = st.customer_subscription_id
        where cs.organisation_id = ${organisationId}
          and cs.id in (${sql.join(ownedSubscriptionIds.map((id) => sql`${id}`), sql`, `)})
      `).then((result: any) => Array.from(result.rows ?? result) as any[])
    : [];

  const active = all.filter((row) => row.subscription.status === "active");
  const planRevenue = new Map<number, { planId: number; planName: string; subscriberCount: number; monthlyRevenue: number }>();
  for (const row of active) {
    const value = planRevenue.get(row.plan.id) ?? { planId: row.plan.id, planName: row.plan.name, subscriberCount: 0, monthlyRevenue: 0 };
    value.subscriberCount += 1;
    value.monthlyRevenue += monthlyEquivalent(Number(row.plan.recurringPrice), row.plan.billingCycle as MembershipBillingCycle);
    planRevenue.set(row.plan.id, value);
  }
  const mrr = [...planRevenue.values()].reduce((sum, plan) => sum + plan.monthlyRevenue, 0);
  const cancelledThisPeriod = all.filter((row) => inRange(row.subscription.cancelledAt, periodStart, now)).length;
  const activeAtStart = all.filter((row) => {
    const started = asDate(row.subscription.startDate)!;
    const cancelled = asDate(row.subscription.cancelledAt);
    return started < periodStart && (!cancelled || cancelled >= periodStart);
  }).length;
  const expiringSoonRows = active.filter((row) => {
    const expiry = asDate(row.subscription.expiryDate)!;
    return expiry >= now && expiry <= new Date(now.getTime() + 7 * 86_400_000);
  });
  const expiredThisPeriod = all.filter((row) => inRange(row.subscription.expiryDate, periodStart, now)).length;
  const paymentCounts = new Map<number, number>();
  for (const payment of payments) paymentCounts.set(payment.subscriptionId, (paymentCounts.get(payment.subscriptionId) ?? 0) + 1);
  const renewalsThisPeriod = payments.filter((payment) => inRange(payment.paymentDate, periodStart, now) && (paymentCounts.get(payment.subscriptionId) ?? 0) > 1).length;

  const revenueByPlan = [...planRevenue.values()].map((plan) => ({
    ...plan,
    monthlyRevenue: Number(plan.monthlyRevenue.toFixed(2)),
    pctOfTotal: Number(percentage(plan.monthlyRevenue, mrr).toFixed(2)),
  })).sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);

  const utilizationByPlan = [...new Map(active.map((row) => [row.plan.id, row.plan])).values()].map((plan) => {
    const subscriptions = active.filter((row) => row.plan.id === plan.id);
    const utilization = subscriptions.map((row) => {
      if (plan.includedWeightKg != null) return percentage(Number(row.subscription.totalConsumedKg ?? 0), Number(plan.includedWeightKg));
      if (plan.includedPieces != null) return percentage(Number(row.subscription.totalConsumedPieces ?? 0), Number(plan.includedPieces));
      return percentage(Number(row.subscription.totalOrdersUsed ?? 0), Number(plan.maxOrders ?? 0));
    });
    return {
      planId: plan.id, planName: plan.name,
      avgUtilizationPct: Number((utilization.reduce((sum, value) => sum + value, 0) / Math.max(1, utilization.length)).toFixed(2)),
      totalKgConsumed: subscriptions.reduce((sum, row) => sum + Number(row.subscription.totalConsumedKg ?? 0), 0),
      totalPiecesConsumed: subscriptions.reduce((sum, row) => sum + Number(row.subscription.totalConsumedPieces ?? 0), 0),
    };
  });
  const avgPlanUtilization = utilizationByPlan.length
    ? utilizationByPlan.reduce((sum, plan) => sum + plan.avgUtilizationPct, 0) / utilizationByPlan.length : 0;
  const spendBySubscription = new Map<number, number>();
  for (const payment of payments.filter((item) => item.status === "completed")) spendBySubscription.set(payment.subscriptionId, (spendBySubscription.get(payment.subscriptionId) ?? 0) + Number(payment.amount));
  const utilizationById = new Map(active.map((row) => {
    const plan = utilizationByPlan.find((item) => item.planId === row.plan.id);
    return [row.subscription.id, plan?.avgUtilizationPct ?? 0];
  }));

  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));
    const label = date.toISOString().slice(0, 7);
    const monthRows = all.filter((row) => asDate(row.subscription.startDate)! <= end && (!row.subscription.cancelledAt || asDate(row.subscription.cancelledAt)! > end));
    const monthMrr = monthRows.reduce((sum, row) => sum + monthlyEquivalent(Number(row.plan.recurringPrice), row.plan.billingCycle as MembershipBillingCycle), 0);
    const created = all.filter((row) => inRange(row.subscription.startDate, date, end)).length;
    const cancelled = all.filter((row) => inRange(row.subscription.cancelledAt, date, end)).length;
    const expired = all.filter((row) => inRange(row.subscription.expiryDate, date, end)).length;
    const renewed = payments.filter((payment) => inRange(payment.paymentDate, date, end) && (paymentCounts.get(payment.subscriptionId) ?? 0) > 1).length;
    return { month: label, mrr: Number(monthMrr.toFixed(2)), new: created, cancelled, net: created - cancelled, renewalRate: Number(percentage(renewed, expired).toFixed(2)) };
  });
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(now.getTime() - (7 - index) * 7 * 86_400_000); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 7 * 86_400_000 - 1);
    const scoped = transactions.filter((transaction) => inRange(transaction.transaction_date ?? transaction.transactionDate, start, end));
    return { week: dateOnly(start), kgConsumed: scoped.reduce((sum, row) => sum + Number(row.kg_consumed ?? row.kgConsumed ?? 0), 0), piecesConsumed: scoped.reduce((sum, row) => sum + Number(row.pieces_consumed ?? row.piecesConsumed ?? 0), 0) };
  });

  return {
    mrr: Number(mrr.toFixed(2)), arr: Number((mrr * 12).toFixed(2)), activeSubscribers: active.length,
    newSubscribersThisPeriod: all.filter((row) => inRange(row.subscription.startDate, periodStart, now)).length,
    renewalsThisPeriod, renewalRate: Number(percentage(renewalsThisPeriod, expiredThisPeriod).toFixed(2)),
    expiringSoon: expiringSoonRows.length, cancelledThisPeriod,
    churnRate: Number(percentage(cancelledThisPeriod, activeAtStart).toFixed(2)),
    avgRevenuePerSubscriber: Number((active.length ? mrr / active.length : 0).toFixed(2)),
    avgPlanUtilization: Number(avgPlanUtilization.toFixed(2)),
    mostPopularPlan: revenueByPlan.slice().sort((a, b) => b.subscriberCount - a.subscriberCount)[0] ?? null,
    revenueByPlan, utilizationByPlan,
    topSubscribers: all.map((row) => ({
      clientId: row.client.id, clientName: row.client.name, planName: row.plan.name,
      totalSpend: spendBySubscription.get(row.subscription.id) ?? 0,
      subscriptionsSince: row.subscription.startDate,
      utilizationPct: utilizationById.get(row.subscription.id) ?? 0,
    })).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10),
    expiringSoonList: expiringSoonRows.map((row) => {
      const daysUntilExpiry = Math.max(0, Math.ceil((asDate(row.subscription.expiryDate)!.getTime() - now.getTime()) / 86_400_000));
      const message = `Bonjour ${row.client.name.split(" ")[0]}, votre abonnement ${row.plan.name} expire dans ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? "s" : ""}. Renouvelez maintenant pour conserver vos avantages.`;
      return { clientId: row.client.id, clientName: row.client.name, clientPhone: row.client.phone, planName: row.plan.name, membershipNumber: row.subscription.membershipNumber, expiryDate: row.subscription.expiryDate, daysUntilExpiry, whatsappUrl: `https://wa.me/${row.client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` };
    }),
    mrrTrend: months.map(({ month, mrr }) => ({ month, mrr })),
    subscriptionGrowth: months.map(({ month, new: created, cancelled, net }) => ({ month, new: created, cancelled, net })),
    renewalRateTrend: months.map(({ month, renewalRate }) => ({ month, renewalRate })),
    planDistribution: revenueByPlan.map((plan) => ({ planName: plan.planName, count: plan.subscriberCount, pct: Number(percentage(plan.subscriberCount, active.length).toFixed(2)) })),
    consumptionTrend: weeks,
  };
}

function dashboardCsv(data: Awaited<ReturnType<typeof buildDashboard>>) {
  const rows: unknown[][] = [
    ["Metric", "Value"], ["MRR", data.mrr], ["ARR", data.arr], ["Active subscribers", data.activeSubscribers], ["Churn rate", data.churnRate], [],
    ["Revenue by plan"], ["Plan", "Subscribers", "Monthly revenue", "% total"],
    ...data.revenueByPlan.map((row) => [row.planName, row.subscriberCount, row.monthlyRevenue, row.pctOfTotal]), [],
    ["Top subscribers"], ["Client", "Plan", "Total spend", "Utilization %"],
    ...data.topSubscribers.map((row) => [row.clientName, row.planName, row.totalSpend, row.utilizationPct]), [],
    ["Expiring soon"], ["Client", "Phone", "Plan", "Expiry date", "Days left"],
    ...data.expiringSoonList.map((row) => [row.clientName, row.clientPhone, row.planName, row.expiryDate, row.daysUntilExpiry]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function invalidateSubscriptionDashboard(organisationId: number) {
  for (const key of dashboardCache.keys()) if (key.startsWith(`${organisationId}:`)) dashboardCache.delete(key);
}

export function registerSubscriptionDashboardRoutes(app: Express) {
  const dashboardLimiter = rateLimit({
    name: "subscription-dashboard",
    windowMs: 60_000,
    max: 30,
    key: (req) => String(req.user?.organisationId ?? req.organisationId ?? req.userId ?? "anonymous"),
    keyOnly: true,
  });
  app.get("/api/subscriptions/dashboard", isAuthenticated, dashboardLimiter, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    const parsed = periodSchema.safeParse(req.query.period ?? "month");
    if (!parsed.success) return res.status(400).json({ message: "Invalid period" });
    const allowedSiteIds = Array.isArray(req.siteScope) ? req.siteScope.filter(Number.isInteger) : [];
    if (!allowedSiteIds.length) return res.status(403).json({ message: "Site access required" });
    const scopeKey = [...allowedSiteIds].sort((a, b) => a - b).join(",");
    const key = `${organisationId}:${scopeKey}:${parsed.data}`;
    const cached = dashboardCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);
    const value = await buildDashboard(organisationId, parsed.data, allowedSiteIds);
    dashboardCache.set(key, { expiresAt: Date.now() + 10 * 60_000, value });
    res.json(value);
  });

  app.get("/api/subscriptions/dashboard/export", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    const allowedSiteIds = Array.isArray(req.siteScope) ? req.siteScope.filter(Number.isInteger) : [];
    if (!allowedSiteIds.length) return res.status(403).json({ message: "Site access required" });
    const period = periodSchema.safeParse(req.query.period ?? "month");
    const format = exportSchema.safeParse(req.query.format ?? "csv");
    if (!period.success || !format.success) return res.status(400).json({ message: "Invalid export request" });
    if (format.data !== "csv") return res.status(501).json({ message: "Only CSV export is available in this release" });
    const value = await buildDashboard(organisationId, period.data, allowedSiteIds);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="subscription-dashboard-${period.data}.csv"`);
    res.send(`\uFEFF${dashboardCsv(value)}`);
  });
}
