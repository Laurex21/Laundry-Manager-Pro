import type { Express } from "express";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { users } from "@shared/models/auth";
import {
  businessSettings, customerSubscriptions, customers, membershipCards, orders, orderItems, organisations, services, sites,
  membershipSubscriptionPayments, subscriptionPlans, subscriptionPlanServices, subscriptionTransactions,
} from "@shared/schema";
import { generateSubscriberReceiptHTML, generateSubscriberThermalReceiptHTML } from "./subscription-receipt";
import { buildMembershipCard } from "./membership-card-generator";

const cycles = ["weekly", "monthly", "quarterly", "annual"] as const;
const statuses = ["active", "inactive", "archived"] as const;

const planInput = z.object({
  name: z.string().trim().min(1).max(100), description: z.string().nullish(),
  status: z.enum(statuses).default("active"), billingCycle: z.enum(cycles),
  durationDays: z.coerce.number().int().positive(), recurringPrice: z.coerce.number().positive(),
  activationFee: z.coerce.number().min(0).optional(), includedWeightKg: z.coerce.number().positive().nullish(),
  includedPieces: z.coerce.number().int().positive().nullish(), maxOrders: z.coerce.number().int().positive().nullish(),
  allowCarryForward: z.boolean().optional(), carryForwardLimit: z.coerce.number().min(0).nullish(),
  overagePricePerKg: z.coerce.number().min(0).nullish(), overagePricePerPiece: z.coerce.number().min(0).nullish(),
  pickupIncluded: z.boolean().optional(), deliveryIncluded: z.boolean().optional(), expressIncluded: z.boolean().optional(),
  priorityQueue: z.boolean().optional(), discountPercentage: z.coerce.number().min(0).max(100).optional(),
  autoRenew: z.boolean().optional(), gracePeriodDays: z.coerce.number().int().min(0).optional(),
  renewalReminderDays: z.coerce.number().int().min(0).optional(), cancellationPolicy: z.string().nullish(),
  serviceIds: z.array(z.coerce.number().int().positive()).default([]),
});

async function organisationIdFor(req: any): Promise<number | null> {
  const [user] = await db.select({ organisationId: users.organisationId }).from(users).where(eq(users.id, req.userId)).limit(1);
  return user?.organisationId ?? null;
}

function selectedSiteId(req: any): number | null {
  return typeof req.siteId === "number" && Number.isInteger(req.siteId) ? req.siteId : null;
}

function siteScope(req: any): number[] {
  return Array.isArray(req.siteScope) ? req.siteScope.filter(Number.isInteger) : [];
}

async function customerInOrganisation(customerId: number, organisationId: number, allowedSiteIds?: number[]) {
  if (allowedSiteIds && allowedSiteIds.length === 0) return null;
  const [row] = await db.select({ customer: customers }).from(customers)
    .innerJoin(sites, eq(customers.siteId, sites.id))
    .where(and(eq(customers.id, customerId), eq(sites.organisationId, organisationId), ...(allowedSiteIds ? [inArray(customers.siteId, allowedSiteIds)] : []))).limit(1);
  return row?.customer ?? null;
}

async function subscriptionInScope(subscriptionId: number, organisationId: number, allowedSiteIds: number[]) {
  if (!allowedSiteIds.length) return false;
  const [row] = await db.select({ id: customerSubscriptions.id }).from(customerSubscriptions)
    .innerJoin(customers, eq(customerSubscriptions.customerId, customers.id))
    .where(and(eq(customerSubscriptions.id, subscriptionId), eq(customerSubscriptions.organisationId, organisationId), inArray(customers.siteId, allowedSiteIds))).limit(1);
  return !!row;
}

async function requirePlanManager(req: any, res: any, organisationId: number): Promise<boolean> {
  const [org] = await db.select({ ownerId: organisations.ownerId }).from(organisations).where(eq(organisations.id, organisationId)).limit(1);
  if (org?.ownerId === req.userId) return true;
  const allowedSites = Array.isArray(req.authorizedSiteIds) ? req.authorizedSiteIds : [];
  if (!allowedSites.length) { res.status(403).json({ message: "Insufficient permissions" }); return false; }
  const { siteMembers } = await import("@shared/schema");
  const [membership] = await db.select({ id: siteMembers.id }).from(siteMembers)
    .where(and(eq(siteMembers.userId, req.userId), eq(siteMembers.role, "manager"), inArray(siteMembers.siteId, allowedSites))).limit(1);
  if (!membership) { res.status(403).json({ message: "Insufficient permissions" }); return false; }
  return true;
}

async function membershipCardContext(subscriptionId: number, organisationId: number, allowedSiteIds?: number[]) {
  if (allowedSiteIds && allowedSiteIds.length === 0) return null;
  const [row] = await db.select({
    subscription: customerSubscriptions,
    plan: subscriptionPlans,
    customer: customers,
    card: membershipCards,
    organisation: organisations,
  }).from(customerSubscriptions)
    .innerJoin(subscriptionPlans, and(eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id), eq(subscriptionPlans.organisationId, organisationId)))
    .innerJoin(customers, eq(customerSubscriptions.customerId, customers.id))
    .innerJoin(sites, and(eq(customers.siteId, sites.id), eq(sites.organisationId, organisationId)))
    .innerJoin(organisations, eq(organisations.id, organisationId))
    .leftJoin(membershipCards, eq(membershipCards.customerSubscriptionId, customerSubscriptions.id))
    .where(and(eq(customerSubscriptions.id, subscriptionId), eq(customerSubscriptions.organisationId, organisationId), ...(allowedSiteIds ? [inArray(customers.siteId, allowedSiteIds)] : [])))
    .limit(1);
  if (!row) return null;
  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.userId, row.organisation.ownerId)).limit(1);
  return { ...row, settings: settings ?? { businessName: row.organisation.name, logoBase64: null } };
}

async function persistMembershipCard(subscriptionId: number, organisationId: number, allowedSiteIds?: number[]) {
  const context = await membershipCardContext(subscriptionId, organisationId, allowedSiteIds);
  if (!context) return null;
  const generated = await buildMembershipCard(organisationId, context.customer, context.subscription, context.plan, context.settings);
  const values = {
    cardNumber: context.subscription.membershipNumber,
    qrCode: generated.qrCode,
    barcode: generated.qrContent,
    expiryDate: context.subscription.expiryDate,
    digitalCardImage: generated.digitalCardImage,
  };
  const [card] = context.card
    ? await db.update(membershipCards).set(values).where(eq(membershipCards.id, context.card.id)).returning()
    : await db.insert(membershipCards).values({ customerSubscriptionId: subscriptionId, ...values }).returning();
  return { card, generated, context };
}

async function servicesBelongToOrganisation(serviceIds: number[], organisationId: number) {
  if (!serviceIds.length) return true;
  const rows = await db.select({ id: services.id }).from(services).innerJoin(sites, eq(services.siteId, sites.id))
    .where(and(inArray(services.id, serviceIds), eq(sites.organisationId, organisationId)));
  return new Set(rows.map((row) => row.id)).size === new Set(serviceIds).size;
}

function dateOnly(value: Date) { return value.toISOString().slice(0, 10); }
function addDays(value: string | Date, days: number) {
  const date = new Date(typeof value === "string" ? `${value}T00:00:00Z` : value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

type CoverageItem = { serviceId: number; quantity: number | string; unitPrice: number | string; serviceName: string; unit: string | null };

function computeCoverage(row: { subscription: typeof customerSubscriptions.$inferSelect; plan: typeof subscriptionPlans.$inferSelect; order?: typeof orders.$inferSelect }, included: Set<number>, items: CoverageItem[]) {
  let kgLeft = row.subscription.remainingKg == null ? null : Number(row.subscription.remainingKg);
  let piecesLeft = row.subscription.remainingPieces;
  let coveredAmount = 0, extraAmount = 0, kgToDeduct = 0, piecesToDeduct = 0;
  const orderLimitAvailable = row.subscription.remainingOrders == null || row.subscription.remainingOrders > 0;
  const coverageBreakdown = items.map(item => {
    const quantity = Number(item.quantity); const lineAmount = quantity * Number(item.unitPrice);
    let coveredQty = 0;
    if (orderLimitAvailable && included.has(item.serviceId)) {
      if (item.unit === "kg") coveredQty = kgLeft == null ? quantity : Math.min(quantity, Math.max(0, kgLeft));
      else coveredQty = piecesLeft == null ? quantity : Math.min(quantity, Math.max(0, piecesLeft));
    }
    const extraQty = quantity - coveredQty; const lineCovered = coveredQty * Number(item.unitPrice);
    const overageRate = item.unit === "kg" ? Number(row.plan.overagePricePerKg ?? item.unitPrice) : Number(row.plan.overagePricePerPiece ?? item.unitPrice);
    const lineExtra = extraQty * overageRate;
    coveredAmount += lineCovered; extraAmount += lineExtra;
    if (item.unit === "kg") { kgToDeduct += coveredQty; if (kgLeft != null) kgLeft -= coveredQty; }
    else { piecesToDeduct += coveredQty; if (piecesLeft != null) piecesLeft -= coveredQty; }
    return { serviceId: item.serviceId, serviceName: item.serviceName, coveredQty, extraQty, coveredAmount: lineCovered, extraAmount: lineExtra, originalAmount: lineAmount };
  });
  const discount = orderLimitAvailable ? extraAmount * (Number(row.plan.discountPercentage ?? 0) / 100) : 0;
  extraAmount = Math.max(0, extraAmount - discount);
  const ordersToDeduct = row.subscription.remainingOrders == null || !orderLimitAvailable ? 0 : 1;
  return { coveredAmount, extraAmount, discount, kgToDeduct, piecesToDeduct, ordersToDeduct, coverageBreakdown, remainingAfter: { kg: kgLeft, pieces: piecesLeft, orders: row.subscription.remainingOrders == null ? null : Math.max(0, row.subscription.remainingOrders - ordersToDeduct) }, savingsAchieved: coveredAmount + discount, subscription: row.subscription, plan: row.plan, order: row.order };
}

async function calculateCoverage(organisationId: number, subscriptionId: number, orderId: number, siteId: number) {
  const [row] = await db.select({ subscription: customerSubscriptions, plan: subscriptionPlans, order: orders })
    .from(customerSubscriptions)
    .innerJoin(subscriptionPlans, and(eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id), eq(subscriptionPlans.organisationId, organisationId)))
    .innerJoin(orders, eq(orders.id, orderId))
    .innerJoin(sites, and(eq(orders.siteId, sites.id), eq(sites.organisationId, organisationId)))
    .where(and(eq(customerSubscriptions.id, subscriptionId), eq(customerSubscriptions.organisationId, organisationId), eq(customerSubscriptions.status, "active"), eq(customerSubscriptions.customerId, orders.customerId), eq(orders.siteId, siteId)))
    .limit(1);
  if (!row) return null;
  const included = new Set((await db.select({ serviceId: subscriptionPlanServices.serviceId }).from(subscriptionPlanServices).innerJoin(subscriptionPlans, and(eq(subscriptionPlanServices.subscriptionPlanId, subscriptionPlans.id), eq(subscriptionPlans.organisationId, organisationId))).where(eq(subscriptionPlanServices.subscriptionPlanId, row.plan.id))).map(x => x.serviceId));
  const items = await db.select({ serviceId: orderItems.serviceId, quantity: orderItems.quantity, unitPrice: orderItems.priceAtOrder, serviceName: services.name, unit: services.unit }).from(orderItems).innerJoin(services, eq(orderItems.serviceId, services.id)).innerJoin(sites, and(eq(services.siteId, sites.id), eq(sites.organisationId, organisationId))).where(eq(orderItems.orderId, orderId));
  return computeCoverage(row, included, items);
}

async function calculateDraftCoverage(organisationId: number, subscriptionId: number, customerId: number, siteId: number, draftItems: Array<{ serviceId: number; quantity: number }>) {
  const [row] = await db.select({ subscription: customerSubscriptions, plan: subscriptionPlans })
    .from(customerSubscriptions)
    .innerJoin(subscriptionPlans, and(eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id), eq(subscriptionPlans.organisationId, organisationId)))
    .innerJoin(customers, eq(customerSubscriptions.customerId, customers.id))
    .innerJoin(sites, and(eq(customers.siteId, sites.id), eq(sites.organisationId, organisationId)))
    .where(and(eq(customerSubscriptions.id, subscriptionId), eq(customerSubscriptions.organisationId, organisationId), eq(customerSubscriptions.customerId, customerId), eq(customerSubscriptions.status, "active"))).limit(1);
  if (!row) return null;
  const included = new Set((await db.select({ serviceId: subscriptionPlanServices.serviceId }).from(subscriptionPlanServices).where(eq(subscriptionPlanServices.subscriptionPlanId, row.plan.id))).map(x => x.serviceId));
  const serviceIds = [...new Set(draftItems.map(item => item.serviceId))];
  const serviceRows = serviceIds.length ? await db.select({ serviceId: services.id, unitPrice: services.price, serviceName: services.name, unit: services.unit }).from(services).where(and(inArray(services.id, serviceIds), eq(services.siteId, siteId))) : [];
  if (serviceRows.length !== serviceIds.length) return null;
  const byId = new Map(serviceRows.map(service => [service.serviceId, service]));
  const items = draftItems.map(item => ({ ...byId.get(item.serviceId)!, quantity: item.quantity }));
  return computeCoverage(row, included, items);
}

export function registerMembershipRoutes(app: Express) {
  app.get("/api/subscriptions/:id/card", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id);
    if (!organisationId || !Number.isInteger(id)) return res.status(400).json({ message: "Invalid subscription" });
    let context = await membershipCardContext(id, organisationId, siteScope(req));
    if (!context) return res.status(404).json({ message: "Subscription not found" });
    if (!context.card?.digitalCardImage || !context.card.qrCode) {
      const created = await persistMembershipCard(id, organisationId, siteScope(req));
      if (!created) return res.status(404).json({ message: "Subscription not found" });
      context = { ...created.context, card: created.card };
    }
    res.json({
      cardNumber: context.card!.cardNumber,
      qrCode: context.card!.qrCode,
      issueDate: context.card!.issueDate,
      expiryDate: context.card!.expiryDate,
      digitalCardImage: context.card!.digitalCardImage,
    });
  });

  app.post("/api/subscriptions/:id/card/regenerate", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id);
    if (!organisationId || !Number.isInteger(id)) return res.status(400).json({ message: "Invalid subscription" });
    const generated = await persistMembershipCard(id, organisationId, siteScope(req));
    if (!generated) return res.status(404).json({ message: "Subscription not found" });
    res.json({ cardNumber: generated.card.cardNumber, qrCode: generated.card.qrCode, issueDate: generated.card.issueDate, expiryDate: generated.card.expiryDate, digitalCardImage: generated.card.digitalCardImage });
  });

  app.get("/api/subscriptions/:id/card/download", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id);
    if (!organisationId || !Number.isInteger(id)) return res.status(400).json({ message: "Invalid subscription" });
    const generated = await persistMembershipCard(id, organisationId, siteScope(req));
    if (!generated) return res.status(404).json({ message: "Subscription not found" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="membership-${generated.context.subscription.membershipNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.png"`);
    res.send(generated.generated.png);
  });

  app.get("/api/customers/:id/subscription/active", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const customerId = Number(req.params.id);
    if (!organisationId || !(await customerInOrganisation(customerId, organisationId, siteScope(req)))) return res.status(404).json({ message: "Customer not found" });
    const [row] = await db.select({ subscription: customerSubscriptions, plan: subscriptionPlans }).from(customerSubscriptions).innerJoin(subscriptionPlans, and(eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id), eq(subscriptionPlans.organisationId, organisationId))).where(and(eq(customerSubscriptions.organisationId, organisationId), eq(customerSubscriptions.customerId, customerId), eq(customerSubscriptions.status, "active"))).orderBy(desc(customerSubscriptions.createdAt)).limit(1);
    if (!row || new Date(`${row.subscription.expiryDate}T23:59:59Z`) < new Date()) return res.json(null);
    const serviceIds = (await db.select({ serviceId: subscriptionPlanServices.serviceId }).from(subscriptionPlanServices).innerJoin(subscriptionPlans, and(eq(subscriptionPlanServices.subscriptionPlanId, subscriptionPlans.id), eq(subscriptionPlans.organisationId, organisationId))).where(eq(subscriptionPlanServices.subscriptionPlanId, row.plan.id))).map(x=>x.serviceId);
    res.json({ ...row.subscription, planName: row.plan.name, serviceIds, benefits: { pickupIncluded: row.plan.pickupIncluded, deliveryIncluded: row.plan.deliveryIncluded, expressIncluded: row.plan.expressIncluded, priorityQueue: row.plan.priorityQueue, discountPercentage: row.plan.discountPercentage } });
  });

  app.post("/api/subscriptions/calculate-coverage", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    const input = z.object({
      customerSubscriptionId: z.coerce.number().int().positive(),
      orderId: z.coerce.number().int().positive().optional(),
      customerId: z.coerce.number().int().positive().optional(),
      items: z.array(z.object({ serviceId: z.coerce.number().int().positive(), quantity: z.coerce.number().positive() })).optional(),
    }).refine(value => !!value.orderId || (!!value.customerId && !!value.items?.length), { message: "Provide orderId or customerId with items" }).parse(req.body);
    if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    const siteId = selectedSiteId(req);
    if (!siteId) return res.status(400).json({ message: "Select a specific site before calculating subscription coverage" });
    const coverage = input.orderId
      ? await calculateCoverage(organisationId, input.customerSubscriptionId, input.orderId, siteId)
      : await calculateDraftCoverage(organisationId, input.customerSubscriptionId, input.customerId!, siteId, input.items!);
    if (!coverage) return res.status(404).json({ message: "Eligible subscription/order not found" });
    if (coverage.subscription.remainingOrders != null && coverage.subscription.remainingOrders <= 0) return res.status(409).json({ message: "Subscription order limit exhausted" });
    const { subscription: _s, plan: _p, order: _o, ...result } = coverage; res.json(result);
  });

  app.post("/api/subscriptions/apply-to-order", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const input = z.object({ customerSubscriptionId: z.coerce.number().int().positive(), orderId: z.coerce.number().int().positive() }).parse(req.body);
    if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    const siteId = selectedSiteId(req);
    if (!siteId) return res.status(400).json({ message: "Select a specific site before applying subscription coverage" });
    let applied;
    try {
      applied = await db.transaction(async tx => {
        await tx.execute(sql`select id from customer_subscriptions where id = ${input.customerSubscriptionId} and organisation_id = ${organisationId} for update`);
        const coverage = await calculateCoverage(organisationId, input.customerSubscriptionId, input.orderId, siteId);
        if (!coverage) return { status: 404 as const, message: "Eligible subscription/order not found" };
        if (coverage.subscription.remainingOrders != null && coverage.subscription.remainingOrders <= 0) return { status: 409 as const, message: "Subscription order limit exhausted" };
        await tx.insert(subscriptionTransactions).values({ customerSubscriptionId: input.customerSubscriptionId, orderId: input.orderId, kgConsumed: String(coverage.kgToDeduct), piecesConsumed: coverage.piecesToDeduct, amountCovered: String(coverage.coveredAmount), extraAmountCharged: String(coverage.extraAmount) });
        const [subscription] = await tx.update(customerSubscriptions).set({ remainingKg: coverage.remainingAfter.kg == null ? null : String(coverage.remainingAfter.kg), remainingPieces: coverage.remainingAfter.pieces, remainingOrders: coverage.remainingAfter.orders, totalConsumedKg: String(Number(coverage.subscription.totalConsumedKg ?? 0) + coverage.kgToDeduct), totalConsumedPieces: Number(coverage.subscription.totalConsumedPieces ?? 0) + coverage.piecesToDeduct, totalOrdersUsed: Number(coverage.subscription.totalOrdersUsed ?? 0) + 1, updatedAt: new Date() }).where(and(eq(customerSubscriptions.id, input.customerSubscriptionId), eq(customerSubscriptions.organisationId, organisationId))).returning();
        return { status: 200 as const, subscription, coverage };
      });
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ message: "Subscription already applied to this order" });
      throw error;
    }
    if (applied.status !== 200) return res.status(applied.status).json({ message: applied.message });
    const { subscription: _s, plan: _p, order: _o, ...result } = applied.coverage; res.json({ subscription: applied.subscription, coverage: result });
  });

  app.get("/api/orders/:id/subscriber-receipt", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const orderId = Number(req.params.id);
    if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    const siteId = selectedSiteId(req);
    if (!siteId) return res.status(400).json({ message: "Select a specific site before opening a subscriber receipt" });
    const [row] = await db.select({ order: orders, customer: customers, transaction: subscriptionTransactions, subscription: customerSubscriptions, plan: subscriptionPlans, card: membershipCards }).from(orders).innerJoin(sites, and(eq(orders.siteId, sites.id), eq(sites.organisationId, organisationId))).innerJoin(customers, eq(orders.customerId, customers.id)).innerJoin(subscriptionTransactions, eq(subscriptionTransactions.orderId, orders.id)).innerJoin(customerSubscriptions, and(eq(subscriptionTransactions.customerSubscriptionId, customerSubscriptions.id), eq(customerSubscriptions.organisationId, organisationId))).innerJoin(subscriptionPlans, and(eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id), eq(subscriptionPlans.organisationId, organisationId))).leftJoin(membershipCards, eq(membershipCards.customerSubscriptionId, customerSubscriptions.id)).where(and(eq(orders.id, orderId), eq(orders.siteId, siteId))).limit(1);
    if (!row) return res.status(404).json({ message: "No subscription coverage for this order; use the standard receipt" });
    const items = await db.select({ serviceName: services.name, quantity: orderItems.quantity, unitPrice: orderItems.priceAtOrder }).from(orderItems).innerJoin(services, eq(orderItems.serviceId, services.id)).innerJoin(sites, and(eq(services.siteId, sites.id), eq(sites.organisationId, organisationId))).where(eq(orderItems.orderId, orderId));
    const [org] = await db.select({ ownerId: organisations.ownerId }).from(organisations).where(eq(organisations.id, organisationId)).limit(1);
    const [settings] = org ? await db.select().from(businessSettings).where(eq(businessSettings.userId, org.ownerId)).limit(1) : [];
    const coverage = { coveredAmount: Number(row.transaction.amountCovered ?? 0), extraAmount: Number(row.transaction.extraAmountCharged ?? 0), savingsAchieved: Number(row.transaction.amountCovered ?? 0) };
    const format = z.enum(["a4", "thermal58", "thermal80"]).catch("a4").parse(req.query.format);
    const data = { ...row, items, settings, coverage };
    const html = format === "thermal58" ? generateSubscriberThermalReceiptHTML(data, 58) : format === "thermal80" ? generateSubscriberThermalReceiptHTML(data, 80) : generateSubscriberReceiptHTML(data);
    res.type("html").send(html);
  });
  app.get("/api/customer-subscription-summaries", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    const allowedSites = siteScope(req);
    if (!allowedSites.length) return res.json({});
    const rows = await db.select({ customerId: customerSubscriptions.customerId, status: customerSubscriptions.status, planName: subscriptionPlans.name, renewalDate: customerSubscriptions.renewalDate, expiryDate: customerSubscriptions.expiryDate, remainingKg: customerSubscriptions.remainingKg, remainingPieces: customerSubscriptions.remainingPieces, remainingOrders: customerSubscriptions.remainingOrders })
      .from(customerSubscriptions).innerJoin(subscriptionPlans, eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id)).innerJoin(customers, eq(customerSubscriptions.customerId, customers.id))
      .where(and(eq(customerSubscriptions.organisationId, organisationId), eq(subscriptionPlans.organisationId, organisationId), inArray(customers.siteId, allowedSites)))
      .orderBy(desc(customerSubscriptions.createdAt));
    const latest = new Map<number, typeof rows[number]>();
    for (const row of rows) if (!latest.has(row.customerId)) latest.set(row.customerId, row);
    res.json(Object.fromEntries(latest));
  });

  app.get("/api/subscription-plans", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    const status = req.query.status ? z.enum(statuses).parse(req.query.status) : null;
    const plans = await db.select().from(subscriptionPlans).where(and(
      eq(subscriptionPlans.organisationId, organisationId), isNull(subscriptionPlans.deletedAt),
      ...(status ? [eq(subscriptionPlans.status, status)] : []),
    )).orderBy(desc(subscriptionPlans.createdAt));
    const result = await Promise.all(plans.map(async (plan) => {
      const included = await db.select({ id: services.id, name: services.name }).from(subscriptionPlanServices)
        .innerJoin(services, eq(subscriptionPlanServices.serviceId, services.id))
        .innerJoin(sites, eq(services.siteId, sites.id))
        .where(and(eq(subscriptionPlanServices.subscriptionPlanId, plan.id), eq(sites.organisationId, organisationId)));
      const [subscriber] = await db.select({ value: count() }).from(customerSubscriptions).where(and(
        eq(customerSubscriptions.organisationId, organisationId), eq(customerSubscriptions.subscriptionPlanId, plan.id),
        eq(customerSubscriptions.status, "active"),
      ));
      return { ...plan, services: included, subscriberCount: subscriber.value };
    }));
    res.json(result);
  });

  app.post("/api/subscription-plans", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    if (!(await requirePlanManager(req, res, organisationId))) return;
    const parsed = planInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input", field: parsed.error.errors[0]?.path.join(".") });
    const input = parsed.data;
    if (!(await servicesBelongToOrganisation(input.serviceIds, organisationId))) return res.status(400).json({ message: "Invalid service selection" });
    const created = await db.transaction(async (tx) => {
      const { serviceIds, ...values } = input;
      const [plan] = await tx.insert(subscriptionPlans).values({ ...values, organisationId, recurringPrice: String(values.recurringPrice), activationFee: String(values.activationFee ?? 0), discountPercentage: String(values.discountPercentage ?? 0), includedWeightKg: values.includedWeightKg == null ? null : String(values.includedWeightKg), carryForwardLimit: values.carryForwardLimit == null ? null : String(values.carryForwardLimit), overagePricePerKg: values.overagePricePerKg == null ? null : String(values.overagePricePerKg), overagePricePerPiece: values.overagePricePerPiece == null ? null : String(values.overagePricePerPiece) }).returning();
      if (serviceIds.length) await tx.insert(subscriptionPlanServices).values(serviceIds.map((serviceId) => ({ subscriptionPlanId: plan.id, serviceId })));
      return plan;
    });
    res.status(201).json(created);
  });

  app.get("/api/subscription-plans/:id", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id);
    const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.organisationId, organisationId ?? -1), isNull(subscriptionPlans.deletedAt))).limit(1);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    const included = await db.select({ id: services.id, name: services.name }).from(subscriptionPlanServices).innerJoin(services, eq(subscriptionPlanServices.serviceId, services.id)).innerJoin(sites, eq(services.siteId, sites.id)).where(and(eq(subscriptionPlanServices.subscriptionPlanId, id), eq(sites.organisationId, organisationId!)));
    const subscribers = await db.select({ subscription: customerSubscriptions, customerName: customers.name }).from(customerSubscriptions).innerJoin(customers, eq(customerSubscriptions.customerId, customers.id)).where(and(eq(customerSubscriptions.organisationId, organisationId!), eq(customerSubscriptions.subscriptionPlanId, id), eq(customerSubscriptions.status, "active")));
    res.json({ ...plan, services: included, subscriberCount: subscribers.length, subscribers, monthlyRevenue: Number(plan.recurringPrice) * subscribers.length });
  });

  app.put("/api/subscription-plans/:id", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id);
    if (!organisationId || !(await requirePlanManager(req, res, organisationId))) return;
    const parsed = planInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input", field: parsed.error.errors[0]?.path.join(".") });
    const input = parsed.data;
    const [existing] = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.organisationId, organisationId ?? -1), isNull(subscriptionPlans.deletedAt))).limit(1);
    if (!existing) return res.status(404).json({ message: "Plan not found" });
    if (!(await servicesBelongToOrganisation(input.serviceIds, organisationId!))) return res.status(400).json({ message: "Invalid service selection" });
    const updated = await db.transaction(async (tx) => {
      const { serviceIds, ...values } = input;
      const [plan] = await tx.update(subscriptionPlans).set({ ...values, recurringPrice: String(values.recurringPrice), activationFee: String(values.activationFee ?? 0), discountPercentage: String(values.discountPercentage ?? 0), includedWeightKg: values.includedWeightKg == null ? null : String(values.includedWeightKg), carryForwardLimit: values.carryForwardLimit == null ? null : String(values.carryForwardLimit), overagePricePerKg: values.overagePricePerKg == null ? null : String(values.overagePricePerKg), overagePricePerPiece: values.overagePricePerPiece == null ? null : String(values.overagePricePerPiece), updatedAt: new Date() }).where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.organisationId, organisationId!))).returning();
      await tx.delete(subscriptionPlanServices).where(eq(subscriptionPlanServices.subscriptionPlanId, id));
      if (serviceIds.length) await tx.insert(subscriptionPlanServices).values(serviceIds.map((serviceId) => ({ subscriptionPlanId: id, serviceId })));
      return plan;
    });
    res.json(updated);
  });

  app.patch("/api/subscription-plans/:id/status", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id); const { status } = z.object({ status: z.enum(statuses) }).parse(req.body);
    if (!organisationId || !(await requirePlanManager(req, res, organisationId))) return;
    if (status === "archived") {
      const [active] = await db.select({ value: count() }).from(customerSubscriptions).where(and(eq(customerSubscriptions.organisationId, organisationId ?? -1), eq(customerSubscriptions.subscriptionPlanId, id), eq(customerSubscriptions.status, "active")));
      if (active.value > 0) return res.status(409).json({ message: "Cannot archive a plan with active subscribers" });
    }
    const [updated] = await db.update(subscriptionPlans).set({ status, updatedAt: new Date() }).where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.organisationId, organisationId ?? -1), isNull(subscriptionPlans.deletedAt))).returning();
    if (!updated) return res.status(404).json({ message: "Plan not found" }); res.json(updated);
  });

  app.post("/api/subscription-plans/:id/duplicate", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id);
    if (!organisationId || !(await requirePlanManager(req, res, organisationId))) return;
    const [original] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.organisationId, organisationId ?? -1), isNull(subscriptionPlans.deletedAt))).limit(1);
    if (!original) return res.status(404).json({ message: "Plan not found" });
    const clone = await db.transaction(async (tx) => {
      const { id: _id, createdAt: _created, updatedAt: _updated, deletedAt: _deleted, ...values } = original;
      const [plan] = await tx.insert(subscriptionPlans).values({ ...values, name: `Copy of ${original.name}` }).returning();
      const links = await tx.select({ serviceId: subscriptionPlanServices.serviceId }).from(subscriptionPlanServices).where(eq(subscriptionPlanServices.subscriptionPlanId, id));
      if (links.length) await tx.insert(subscriptionPlanServices).values(links.map(({ serviceId }) => ({ subscriptionPlanId: plan.id, serviceId })));
      return plan;
    }); res.status(201).json(clone);
  });

  app.delete("/api/subscription-plans/:id", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id);
    if (!organisationId || !(await requirePlanManager(req, res, organisationId))) return;
    const [active] = await db.select({ value: count() }).from(customerSubscriptions).where(and(eq(customerSubscriptions.organisationId, organisationId ?? -1), eq(customerSubscriptions.subscriptionPlanId, id), eq(customerSubscriptions.status, "active")));
    if (active.value > 0) return res.status(409).json({ message: "Cannot delete a plan with active subscribers" });
    const [deleted] = await db.update(subscriptionPlans).set({ deletedAt: new Date(), status: "archived", updatedAt: new Date() }).where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.organisationId, organisationId ?? -1), isNull(subscriptionPlans.deletedAt))).returning();
    if (!deleted) return res.status(404).json({ message: "Plan not found" }); res.json({ success: true });
  });

  app.get("/api/customers/:id/subscription", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const customerId = Number(req.params.id);
    if (!organisationId || !(await customerInOrganisation(customerId, organisationId, siteScope(req)))) return res.status(404).json({ message: "Customer not found" });
    const [row] = await db.select({ subscription: customerSubscriptions, plan: subscriptionPlans, customerName: customers.name, customerPhone: customers.phone }).from(customerSubscriptions).innerJoin(subscriptionPlans, eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id)).innerJoin(customers, eq(customerSubscriptions.customerId, customers.id)).where(and(eq(customerSubscriptions.organisationId, organisationId), eq(customerSubscriptions.customerId, customerId), inArray(customerSubscriptions.status, ["active", "suspended", "pending"]))).orderBy(desc(customerSubscriptions.createdAt)).limit(1);
    if (!row) return res.json(null);
    const payments = await db.select().from(membershipSubscriptionPayments).where(and(eq(membershipSubscriptionPayments.organisationId, organisationId), eq(membershipSubscriptionPayments.subscriptionId, row.subscription.id))).orderBy(desc(membershipSubscriptionPayments.paymentDate));
    res.json({ ...row.subscription, plan: row.plan, customerName: row.customerName, customerPhone: row.customerPhone, payments });
  });

  app.post("/api/customers/:id/subscription", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const customerId = Number(req.params.id);
    if (!organisationId || !(await customerInOrganisation(customerId, organisationId, siteScope(req)))) return res.status(404).json({ message: "Customer not found" });
    const input = z.object({ subscriptionPlanId: z.coerce.number().int().positive(), startDate: z.string().date(), notes: z.string().nullish(), paymentMethod: z.string().optional(), activationFeeAmount: z.coerce.number().min(0).optional() }).parse(req.body);
    const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, input.subscriptionPlanId), eq(subscriptionPlans.organisationId, organisationId), eq(subscriptionPlans.status, "active"), isNull(subscriptionPlans.deletedAt))).limit(1);
    if (!plan) return res.status(400).json({ message: "Invalid subscription plan" });
    const membershipNumber = `XP-${organisationId}-${Date.now()}`; const expiryDate = addDays(input.startDate, plan.durationDays);
    const subscription = await db.transaction(async (tx) => {
      const [created] = await tx.insert(customerSubscriptions).values({ organisationId, customerId, subscriptionPlanId: plan.id, membershipNumber, startDate: input.startDate, expiryDate, renewalDate: expiryDate, nextBillingDate: expiryDate, remainingKg: plan.includedWeightKg, remainingPieces: plan.includedPieces, remainingOrders: plan.maxOrders, autoRenew: plan.autoRenew, notes: input.notes }).returning();
      const fee = input.activationFeeAmount ?? Number(plan.activationFee ?? 0);
      if (fee > 0) await tx.insert(membershipSubscriptionPayments).values({ subscriptionId: created.id, organisationId, amount: String(fee), paymentMethod: input.paymentMethod ?? "cash", status: "completed" });
      await tx.insert(membershipCards).values({ customerSubscriptionId: created.id, cardNumber: membershipNumber, barcode: membershipNumber, expiryDate });
      return created;
    }); res.status(201).json(subscription);
  });

  app.patch("/api/subscriptions/:id/status", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id); const { status } = z.object({ status: z.enum(["suspended", "cancelled", "active"]) }).parse(req.body);
    if (!organisationId || !(await subscriptionInScope(id, organisationId, siteScope(req)))) return res.status(404).json({ message: "Subscription not found" });
    const [updated] = await db.update(customerSubscriptions).set({ status, cancelledAt: status === "cancelled" ? new Date() : null, updatedAt: new Date() }).where(and(eq(customerSubscriptions.id, id), eq(customerSubscriptions.organisationId, organisationId ?? -1))).returning();
    if (!updated) return res.status(404).json({ message: "Subscription not found" }); res.json(updated);
  });

  app.post("/api/subscriptions/:id/renew", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id);
    if (!organisationId || !(await subscriptionInScope(id, organisationId, siteScope(req)))) return res.status(404).json({ message: "Subscription not found" });
    const input = z.object({ paymentMethod: z.string().optional(), amount: z.coerce.number().positive().optional() }).parse(req.body ?? {});
    const [row] = await db.select({ subscription: customerSubscriptions, plan: subscriptionPlans }).from(customerSubscriptions).innerJoin(subscriptionPlans, eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id)).where(and(eq(customerSubscriptions.id, id), eq(customerSubscriptions.organisationId, organisationId ?? -1), eq(subscriptionPlans.organisationId, organisationId ?? -1))).limit(1);
    if (!row) return res.status(404).json({ message: "Subscription not found" });
    const expiryDate = addDays(new Date(row.subscription.expiryDate) > new Date() ? row.subscription.expiryDate : new Date(), row.plan.durationDays);
    const renewed = await db.transaction(async (tx) => {
      const carryKg = row.plan.allowCarryForward ? Math.min(Number(row.subscription.remainingKg ?? 0), Number(row.plan.carryForwardLimit ?? row.subscription.remainingKg ?? 0)) : 0;
      const [updated] = await tx.update(customerSubscriptions).set({ status: "active", expiryDate, renewalDate: expiryDate, nextBillingDate: expiryDate, remainingKg: row.plan.includedWeightKg == null ? null : String(Number(row.plan.includedWeightKg) + carryKg), remainingPieces: row.plan.includedPieces, remainingOrders: row.plan.maxOrders, updatedAt: new Date() }).where(and(eq(customerSubscriptions.id, id), eq(customerSubscriptions.organisationId, organisationId!))).returning();
      await tx.insert(membershipSubscriptionPayments).values({ subscriptionId: id, organisationId: organisationId!, amount: String(input.amount ?? Number(row.plan.recurringPrice)), paymentMethod: input.paymentMethod ?? "cash", status: "completed" }); return updated;
    }); res.json(renewed);
  });

  app.get("/api/subscriptions/:id/history", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id); const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    if (!organisationId || !(await subscriptionInScope(id, organisationId, siteScope(req)))) return res.status(404).json({ message: "Subscription not found" });
    const [owned] = await db.select({ id: customerSubscriptions.id }).from(customerSubscriptions).where(and(eq(customerSubscriptions.id, id), eq(customerSubscriptions.organisationId, organisationId ?? -1))).limit(1);
    if (!owned) return res.status(404).json({ message: "Subscription not found" });
    const transactions = await db.select().from(subscriptionTransactions).where(eq(subscriptionTransactions.customerSubscriptionId, id)).orderBy(desc(subscriptionTransactions.transactionDate)).limit(limit).offset((page - 1) * limit);
    const payments = await db.select().from(membershipSubscriptionPayments).where(and(eq(membershipSubscriptionPayments.subscriptionId, id), eq(membershipSubscriptionPayments.organisationId, organisationId!))).orderBy(desc(membershipSubscriptionPayments.paymentDate)).limit(limit).offset((page - 1) * limit);
    res.json({ transactions, payments, page, limit });
  });

  app.get("/api/customers/:id/subscription/card", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const customerId = Number(req.params.id);
    if (!organisationId || !(await customerInOrganisation(customerId, organisationId, siteScope(req)))) return res.status(404).json({ message: "Customer not found" });
    const [card] = await db.select({ card: membershipCards, membershipNumber: customerSubscriptions.membershipNumber, status: customerSubscriptions.status }).from(membershipCards).innerJoin(customerSubscriptions, eq(membershipCards.customerSubscriptionId, customerSubscriptions.id)).where(and(eq(customerSubscriptions.customerId, customerId), eq(customerSubscriptions.organisationId, organisationId))).orderBy(desc(membershipCards.createdAt)).limit(1);
    if (!card) return res.status(404).json({ message: "Membership card not found" }); res.json(card);
  });
}
