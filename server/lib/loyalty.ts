import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  businessSettings,
  customers,
  loyaltyPoints,
  loyaltyProgram,
  orders,
  organisations,
  sites,
} from "@shared/schema";
import { computeOrderPoints, computeTier, LOYALTY_TIERS, type LoyaltyTier } from "./loyalty-formulas";

export async function expireLoyaltyPoints(now = new Date()) {
  const due = await db.select({
    id: loyaltyPoints.id,
    organisationId: loyaltyPoints.organisationId,
    clientId: loyaltyPoints.clientId,
    points: loyaltyPoints.points,
  }).from(loyaltyPoints)
    .innerJoin(customers, eq(loyaltyPoints.clientId, customers.id))
    .innerJoin(sites, and(eq(customers.siteId, sites.id), eq(sites.organisationId, loyaltyPoints.organisationId)))
    .where(and(isNull(loyaltyPoints.expiredAt), lte(loyaltyPoints.expiresAt, now)));

  let expired = 0;
  for (const entry of due) {
    const processed = await db.transaction(async (tx) => {
      const [marked] = await tx.update(loyaltyPoints).set({ expiredAt: now })
        .where(and(eq(loyaltyPoints.id, entry.id), isNull(loyaltyPoints.expiredAt)))
        .returning({ id: loyaltyPoints.id });
      if (!marked) return false;
      const [customer] = await tx.update(customers).set({
        loyaltyPoints: sql`greatest(0, ${customers.loyaltyPoints} - ${entry.points})`,
      }).where(eq(customers.id, entry.clientId)).returning();
      if (!customer) throw new Error("Loyalty expiry customer update failed");
      const tier = computeTier(customer.loyaltyPoints);
      if (tier !== customer.loyaltyTier) {
        await tx.update(customers).set({ loyaltyTier: tier }).where(eq(customers.id, entry.clientId));
      }
      return true;
    });
    if (processed) expired += 1;
  }
  return { expired };
}

export async function awardOrderPoints(orderId: number, organisationId: number) {
  const [context] = await db.select({
    order: orders,
    customer: customers,
    program: loyaltyProgram,
  }).from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(sites, and(eq(orders.siteId, sites.id), eq(sites.organisationId, organisationId)))
    .innerJoin(organisations, eq(organisations.id, organisationId))
    .innerJoin(businessSettings, and(
      eq(businessSettings.userId, organisations.ownerId),
      eq(businessSettings.loyaltyProgramEnabled, true),
    ))
    .innerJoin(loyaltyProgram, and(
      eq(loyaltyProgram.organisationId, organisationId),
      eq(loyaltyProgram.isActive, true),
    ))
    .where(and(eq(orders.id, orderId), eq(customers.siteId, orders.siteId)))
    .limit(1);

  if (!context) return null;
  const tier = (context.customer.loyaltyTier in LOYALTY_TIERS
    ? context.customer.loyaltyTier
    : "bronze") as LoyaltyTier;
  const points = computeOrderPoints(
    Number(context.order.totalAmount),
    context.program.pointsPerOrder,
    context.program.pointsPerFcfa == null ? null : Number(context.program.pointsPerFcfa),
    tier,
  );
  const expiresAt = context.program.pointExpireDays
    ? new Date(Date.now() + context.program.pointExpireDays * 86_400_000)
    : null;

  return db.transaction(async (tx) => {
    const inserted = await tx.insert(loyaltyPoints).values({
      organisationId,
      clientId: context.customer.id,
      points,
      reason: "order",
      orderId,
      expiresAt,
    }).onConflictDoNothing().returning();
    if (!inserted.length) return null;

    const [customer] = await tx.update(customers).set({
      loyaltyPoints: sql`${customers.loyaltyPoints} + ${points}`,
    }).where(and(eq(customers.id, context.customer.id), eq(customers.siteId, context.order.siteId!))).returning();
    if (!customer) throw new Error("Loyalty customer update failed");

    const newTier = computeTier(customer.loyaltyPoints);
    if (newTier !== customer.loyaltyTier) {
      await tx.update(customers).set({ loyaltyTier: newTier })
        .where(and(eq(customers.id, customer.id), eq(customers.siteId, context.order.siteId!)));
    }
    return { points, tier: newTier };
  });
}

export async function awardReferralPoints(orderId: number, organisationId: number) {
  const [context] = await db.select({
    referredClientId: customers.id,
    referrerClientId: customers.referredByCustomerId,
    siteId: orders.siteId,
    referralBonus: loyaltyProgram.referralBonus,
    expireDays: loyaltyProgram.pointExpireDays,
  }).from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(sites, and(eq(orders.siteId, sites.id), eq(sites.organisationId, organisationId)))
    .innerJoin(organisations, eq(organisations.id, organisationId))
    .innerJoin(businessSettings, and(
      eq(businessSettings.userId, organisations.ownerId),
      eq(businessSettings.loyaltyProgramEnabled, true),
    ))
    .innerJoin(loyaltyProgram, and(
      eq(loyaltyProgram.organisationId, organisationId),
      eq(loyaltyProgram.isActive, true),
    ))
    .where(and(eq(orders.id, orderId), eq(orders.status, "delivered")))
    .limit(1);
  if (!context?.referrerClientId || !context.siteId || context.referralBonus <= 0) return null;

  const [referrer] = await db.select({ id: customers.id }).from(customers)
    .innerJoin(sites, and(eq(customers.siteId, sites.id), eq(sites.organisationId, organisationId)))
    .where(and(eq(customers.id, context.referrerClientId), eq(customers.siteId, context.siteId)))
    .limit(1);
  if (!referrer) return null;

  const expiresAt = context.expireDays
    ? new Date(Date.now() + context.expireDays * 86_400_000)
    : null;
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(loyaltyPoints).values({
      organisationId,
      clientId: referrer.id,
      points: context.referralBonus,
      reason: "referral",
      referredClientId: context.referredClientId,
      expiresAt,
    }).onConflictDoNothing().returning();
    if (!inserted.length) return null;
    const [customer] = await tx.update(customers).set({
      loyaltyPoints: sql`${customers.loyaltyPoints} + ${context.referralBonus}`,
    }).where(eq(customers.id, referrer.id)).returning();
    if (!customer) throw new Error("Loyalty referral customer update failed");
    const tier = computeTier(customer.loyaltyPoints);
    if (tier !== customer.loyaltyTier) {
      await tx.update(customers).set({ loyaltyTier: tier }).where(eq(customers.id, referrer.id));
    }
    return { points: context.referralBonus, tier };
  });
}

export async function awardRenewalPoints(
  subscriptionPaymentId: number,
  customerId: number,
  organisationId: number,
) {
  const [context] = await db.select({
    customer: customers,
    program: loyaltyProgram,
  }).from(customers)
    .innerJoin(sites, and(eq(customers.siteId, sites.id), eq(sites.organisationId, organisationId)))
    .innerJoin(organisations, eq(organisations.id, organisationId))
    .innerJoin(businessSettings, and(
      eq(businessSettings.userId, organisations.ownerId),
      eq(businessSettings.loyaltyProgramEnabled, true),
    ))
    .innerJoin(loyaltyProgram, and(
      eq(loyaltyProgram.organisationId, organisationId),
      eq(loyaltyProgram.isActive, true),
    ))
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!context || context.program.renewalBonus <= 0) return null;
  const points = context.program.renewalBonus;
  const expiresAt = context.program.pointExpireDays
    ? new Date(Date.now() + context.program.pointExpireDays * 86_400_000)
    : null;

  return db.transaction(async (tx) => {
    const inserted = await tx.insert(loyaltyPoints).values({
      organisationId,
      clientId: customerId,
      points,
      reason: "renewal",
      subscriptionPaymentId,
      expiresAt,
    }).onConflictDoNothing().returning();
    if (!inserted.length) return null;

    const [customer] = await tx.update(customers).set({
      loyaltyPoints: sql`${customers.loyaltyPoints} + ${points}`,
    }).where(eq(customers.id, customerId)).returning();
    if (!customer) throw new Error("Loyalty renewal customer update failed");

    const newTier = computeTier(customer.loyaltyPoints);
    if (newTier !== customer.loyaltyTier) {
      await tx.update(customers).set({ loyaltyTier: newTier })
        .where(eq(customers.id, customerId));
    }
    return { points, tier: newTier };
  });
}
