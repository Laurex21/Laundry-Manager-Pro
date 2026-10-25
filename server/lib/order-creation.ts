import { and, eq, sql } from "drizzle-orm";
import type { db } from "../db";
import {
  orders, orderItems, orderStatusHistory, garmentItems, services, payments,
  employeeActivities, employees, machines, machineUsage, sites,
  type InsertOrder, type InsertPayment, type InsertEmployeeActivity,
} from "@shared/schema";
import { createOrderReference } from "./order-reference";
import { compareDecimals } from "@shared/exact-decimal";

type OrderTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type OrderCreationRecords = {
  initialPayment?: Omit<InsertPayment, "orderId">;
  actorUserId?: string | null;
  employeeId?: number | null;
  activities?: Omit<InsertEmployeeActivity, "employeeId" | "actorUserId" | "siteId" | "orderId">[];
  machineUsages?: { machineId: number; weightProcessed?: string; cycleDurationMinutes?: number }[];
};

// The caller owns one transaction for the order and every related write.
export async function insertOrderRecords(
  tx: OrderTransaction,
  insertOrder: InsertOrder & { totalAmount?: string },
  items: { serviceId: number; quantity: string | number }[],
  garments: { itemName: string; quantity: number; color?: string | null; textileReserve?: string | null }[] = [],
  records: OrderCreationRecords = {},
) {
  const advance = records.initialPayment?.amount ?? "0";
  if (compareDecimals(advance, "0") < 0) throw new Error("Advance payment cannot be negative");
  const paymentStatus = compareDecimals(advance, insertOrder.totalAmount ?? "0") >= 0
    ? "paid" : compareDecimals(advance, "0") > 0 ? "partial" : "unpaid";
  const [order] = await tx.insert(orders).values({
    ...insertOrder, paymentStatus, requiresGarmentVerification: !!garments.length,
  }).returning();
  const [site] = order.siteId == null ? [] : await tx.select({ name: sites.name }).from(sites).where(eq(sites.id, order.siteId));
  const reference = createOrderReference(order.id, site?.name ?? "XP", order.createdAt ?? new Date());
  await tx.update(orders).set({ orderReference: reference }).where(eq(orders.id, order.id));
  order.orderReference = reference;
  let orderWithNumber = { ...order, orderNumber: reference };
  await tx.insert(orderStatusHistory).values({ orderId: order.id, status: order.status, notes: "Order created" });
  for (const item of items) {
    const [service] = await tx.select().from(services).where(eq(services.id, item.serviceId));
    if (!service) throw new Error(`Service ${item.serviceId} not found`);
    await tx.insert(orderItems).values({
      orderId: order.id, serviceId: item.serviceId, quantity: String(item.quantity), priceAtOrder: service.price,
    });
  }
  for (const garment of garments) {
    await tx.insert(garmentItems).values({
      orderId: order.id, itemName: garment.itemName, quantity: garment.quantity,
      color: garment.color || null, textileReserve: garment.textileReserve || null,
    });
  }
  for (const usage of records.machineUsages ?? []) {
    const [machine] = await tx.select().from(machines)
      .where(and(eq(machines.id, usage.machineId), eq(machines.siteId, order.siteId!)));
    // Preserve the existing behavior for unavailable or other-site machines.
    if (!machine) continue;
    await tx.insert(machineUsage).values({
      ...usage, orderId: order.id, siteId: order.siteId!,
      weightProcessed: usage.weightProcessed || "0", cycleDurationMinutes: usage.cycleDurationMinutes || 0,
    });
    await tx.update(machines).set({
      cycleCount: sql`${machines.cycleCount} + 1`,
      totalKgProcessed: sql`${machines.totalKgProcessed} + ${usage.weightProcessed || "0"}`,
    }).where(eq(machines.id, machine.id));
  }
  if (records.employeeId != null) {
    for (const activity of records.activities ?? []) {
      await tx.insert(employeeActivities).values({
        ...activity, employeeId: records.employeeId, actorUserId: records.actorUserId,
        siteId: order.siteId!, orderId: order.id,
      });
      if (activity.actionType === "order_created") {
        await tx.update(employees).set({
          ordersHandled: sql`${employees.ordersHandled} + 1`,
          kgProcessed: activity.weightKg != null ? sql`${employees.kgProcessed} + ${activity.weightKg}` : employees.kgProcessed,
        }).where(eq(employees.id, records.employeeId));
      }
    }
  }
  if (records.initialPayment && compareDecimals(advance, "0") > 0) {
    await tx.insert(payments).values({ ...records.initialPayment, orderId: order.id, isAdvance: true });
  }
  return orderWithNumber;
}
