import { db } from "../db";
import { expenditures, orders, payments } from "@shared/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { aggregateBusinessEvolution, type EvolutionGranularity, type EvolutionRow } from "./business-evolution-aggregation";

export async function getBusinessEvolution(
  startDate: Date,
  endDate: Date,
  startDay: string,
  endDay: string,
  granularity: EvolutionGranularity,
  siteIds: number[],
  timeZone: string,
): Promise<EvolutionRow[]> {
  if (!siteIds.length) return aggregateBusinessEvolution({ startDay, endDay, granularity, timeZone, orderRows: [], firstOrders: [], paymentRows: [], expenseRows: [] });
  const siteOrders = inArray(orders.siteId, siteIds);
  const orderRows = await db.select({ customerId: orders.customerId, entryDate: orders.entryDate })
    .from(orders).where(and(siteOrders, ne(orders.status, "cancelled"), sql`${orders.entryDate} >= ${startDate}`, sql`${orders.entryDate} <= ${endDate}`));
  const customerIds = [...new Set(orderRows.map(item => item.customerId))];
  const firstOrders = customerIds.length ? await db.select({ customerId: orders.customerId, firstDate: sql<Date>`min(${orders.entryDate})` })
    .from(orders).where(and(siteOrders, ne(orders.status, "cancelled"), inArray(orders.customerId, customerIds)))
    .groupBy(orders.customerId) : [];
  const paymentRows = await db.select({ date: payments.date, amount: payments.amount })
    .from(payments).innerJoin(orders, eq(payments.orderId, orders.id))
    .where(and(siteOrders, ne(orders.status, "cancelled"), sql`${payments.date} >= ${startDate}`, sql`${payments.date} <= ${endDate}`));
  const expenseRows = await db.select({ date: expenditures.date, amount: expenditures.amount })
    .from(expenditures).where(and(inArray(expenditures.siteId, siteIds), sql`${expenditures.date} >= ${startDate}`, sql`${expenditures.date} <= ${endDate}`));
  return aggregateBusinessEvolution({ startDay, endDay, granularity, timeZone, orderRows, firstOrders, paymentRows, expenseRows });
}
