import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { customers, orders, payments, sites } from "@shared/schema";
import { calculateChurnRiskScore, calculateCustomerSegment } from "./temporal-formulas";

const DAY_MS = 24 * 60 * 60 * 1000;

function nextVisitDate(lastVisitAt: Date | null, avgDaysBetweenVisits: number | null): Date | null {
  if (!lastVisitAt || !avgDaysBetweenVisits || avgDaysBetweenVisits <= 0) return null;
  return new Date(lastVisitAt.getTime() + avgDaysBetweenVisits * DAY_MS);
}

export async function refreshCustomerAnalyticsFromHistory(customerId: number): Promise<void> {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return;

  const customerOrders = await db.select().from(orders)
    .where(and(eq(orders.customerId, customerId), ne(orders.status, "cancelled")))
    .orderBy(orders.createdAt);
  const visitDates = customerOrders
    .map((order) => order.createdAt ? new Date(order.createdAt) : null)
    .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()));
  const visitCount = visitDates.length;
  const lastVisitAt = visitDates[visitDates.length - 1] ?? null;
  const totalRevenue = customerOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const avgDepositHour = visitDates.length
    ? visitDates.reduce((sum, date) => sum + date.getHours() + date.getMinutes() / 60, 0) / visitDates.length
    : null;

  let avgDaysBetweenVisits: number | null = null;
  if (visitDates.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < visitDates.length; i++) {
      intervals.push((visitDates[i].getTime() - visitDates[i - 1].getTime()) / DAY_MS);
    }
    avgDaysBetweenVisits = intervals.reduce((sum, days) => sum + days, 0) / intervals.length;
  }

  const daysSinceLastVisit = lastVisitAt ? Math.floor((Date.now() - lastVisitAt.getTime()) / DAY_MS) : null;
  const firstVisitAt = visitDates[0] ?? null;
  const observedDays = firstVisitAt ? Math.max(1, (Date.now() - firstVisitAt.getTime()) / DAY_MS) : 1;
  const visitsPerMonth = visitCount / (observedDays / 30);
  const churnRiskScore = calculateChurnRiskScore(visitCount, daysSinceLastVisit, avgDaysBetweenVisits);
  const segment = calculateCustomerSegment({
    totalRevenue,
    visitsPerMonth,
    avgDepositHour,
    visitCount,
    avgDaysBetweenVisits,
    daysSinceLastVisit,
    totalOrders: customerOrders.length,
  });

  await db.update(customers).set({
    lastVisitAt,
    avgDaysBetweenVisits: avgDaysBetweenVisits == null ? null : avgDaysBetweenVisits.toFixed(2),
    visitCount,
    expectedNextVisitDate: nextVisitDate(lastVisitAt, avgDaysBetweenVisits),
    segment,
    churnRiskScore,
    totalRevenue: totalRevenue.toFixed(2),
    avgDepositHour: avgDepositHour == null ? null : avgDepositHour.toFixed(2),
  }).where(eq(customers.id, customerId));
}

export async function recalculateCachedCustomerIntelligence(): Promise<void> {
  const siteRows = await db.select({ siteId: sites.id, organisationId: sites.organisationId }).from(sites);
  const siteToOrg = new Map(siteRows.map((site) => [site.siteId, site.organisationId]));
  const orgIds = Array.from(new Set(siteRows.map((site) => site.organisationId)));

  for (const organisationId of orgIds) {
    const orgSiteIds = siteRows.filter((site) => site.organisationId === organisationId).map((site) => site.siteId);
    if (!orgSiteIds.length) continue;
    const rows = await db.select().from(customers)
      .where(and(inArray(customers.siteId, orgSiteIds), sql`${customers.visitCount} >= 3`));

    for (const customer of rows) {
      const lastVisitAt = customer.lastVisitAt ? new Date(customer.lastVisitAt) : null;
      const avgDays = customer.avgDaysBetweenVisits == null ? null : Number(customer.avgDaysBetweenVisits);
      const daysSinceLastVisit = lastVisitAt ? Math.floor((Date.now() - lastVisitAt.getTime()) / DAY_MS) : null;
      const visitsPerMonth = avgDays && avgDays > 0 ? 30 / avgDays : 0;
      const churnRiskScore = calculateChurnRiskScore(customer.visitCount, daysSinceLastVisit, avgDays);
      const segment = calculateCustomerSegment({
        totalRevenue: Number(customer.totalRevenue || 0),
        visitsPerMonth,
        avgDepositHour: customer.avgDepositHour == null ? null : Number(customer.avgDepositHour),
        visitCount: customer.visitCount,
        avgDaysBetweenVisits: avgDays,
        daysSinceLastVisit,
        totalOrders: customer.visitCount,
      });

      await db.update(customers).set({
        expectedNextVisitDate: nextVisitDate(lastVisitAt, avgDays),
        churnRiskScore,
        segment,
      }).where(and(eq(customers.id, customer.id), customer.siteId == null ? sql`false` : eq(customers.siteId, customer.siteId)));
    }
  }
}

export function startTemporalIntelligenceJob(): void {
  recalculateCachedCustomerIntelligence().catch((err) => {
    console.error("[temporal-intelligence] Startup recalculation failed:", err);
  });
  setInterval(() => {
    recalculateCachedCustomerIntelligence().catch((err) => {
      console.error("[temporal-intelligence] Scheduled recalculation failed:", err);
    });
  }, DAY_MS);
}
