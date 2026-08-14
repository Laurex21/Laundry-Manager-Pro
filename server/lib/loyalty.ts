import { and, asc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  businessSettings,
  creditTransactions,
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
    points: sql<number>`greatest(${loyaltyPoints.points} - ${loyaltyPoints.redeemedPoints}, 0)::int`,
  }).from(loyaltyPoints)
    .innerJoin(customers, eq(loyaltyPoints.clientId, customers.id))
    .innerJoin(sites, and(eq(customers.siteId, sites.id), eq(sites.organisationId, loyaltyPoints.organisationId)))
    .where(and(
      isNull(loyaltyPoints.expiredAt),
      lte(loyaltyPoints.expiresAt, now),
      gt(loyaltyPoints.points, loyaltyPoints.redeemedPoints),
    ));

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
    Number(context.program.spendAmountPerPoint),
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

export class LoyaltyRedemptionError extends Error {
  constructor(message: string, public statusCode = 400) { super(message); }
}

export async function redeemLoyaltyReward(input: {
  customerId: number;
  organisationId: number;
  siteId: number;
  actorUserId: string | null;
  idempotencyKey: string;
}) {
  return db.transaction(async (tx) => {
    // Lock the balance row so two cashier taps cannot spend the same points.
    await tx.execute(sql`select id from customers where id = ${input.customerId} for update`);
    const [existing] = await tx.select().from(creditTransactions)
      .where(and(
        eq(creditTransactions.idempotencyKey, input.idempotencyKey),
        eq(creditTransactions.organisationId, input.organisationId),
        eq(creditTransactions.customerId, input.customerId),
      )).limit(1);
    if (existing) return { transaction: existing, idempotentReplay: true };

    const [context] = await tx.select({ customer: customers, program: loyaltyProgram })
      .from(customers)
      .innerJoin(sites, and(eq(customers.siteId, sites.id), eq(sites.organisationId, input.organisationId)))
      .innerJoin(organisations, eq(organisations.id, input.organisationId))
      .innerJoin(businessSettings, and(
        eq(businessSettings.userId, organisations.ownerId),
        eq(businessSettings.loyaltyProgramEnabled, true),
      ))
      .innerJoin(loyaltyProgram, and(
        eq(loyaltyProgram.organisationId, input.organisationId),
        eq(loyaltyProgram.isActive, true),
      ))
      .where(and(eq(customers.id, input.customerId), eq(customers.siteId, input.siteId)))
      .limit(1);
    if (!context) throw new LoyaltyRedemptionError("Active loyalty programme not found", 404);

    const pointsRequired = context.program.rewardPointsRequired;
    const rewardValue = Number(context.program.rewardValue);
    if (pointsRequired <= 0 || rewardValue <= 0) throw new LoyaltyRedemptionError("Loyalty reward is not configured", 409);
    if (context.customer.loyaltyPoints < pointsRequired) {
      throw new LoyaltyRedemptionError(`Customer needs ${pointsRequired - context.customer.loyaltyPoints} more points`, 409);
    }

    const balanceBefore = Number(context.customer.creditBalance);
    const balanceAfter = balanceBefore + rewardValue;
    const remainingPoints = context.customer.loyaltyPoints - pointsRequired;
    const tier = computeTier(remainingPoints);
    const earningEntries = await tx.select().from(loyaltyPoints)
      .where(and(
        eq(loyaltyPoints.organisationId, input.organisationId),
        eq(loyaltyPoints.clientId, input.customerId),
        isNull(loyaltyPoints.expiredAt),
        gt(loyaltyPoints.points, loyaltyPoints.redeemedPoints),
      ))
      .orderBy(asc(loyaltyPoints.createdAt), asc(loyaltyPoints.id));
    let pointsToConsume = pointsRequired;
    for (const entry of earningEntries) {
      if (pointsToConsume <= 0) break;
      const available = entry.points - entry.redeemedPoints;
      const consumed = Math.min(available, pointsToConsume);
      await tx.update(loyaltyPoints).set({ redeemedPoints: entry.redeemedPoints + consumed })
        .where(eq(loyaltyPoints.id, entry.id));
      pointsToConsume -= consumed;
    }
    if (pointsToConsume > 0) throw new LoyaltyRedemptionError("Loyalty point ledger is inconsistent; redemption stopped", 409);
    await tx.insert(loyaltyPoints).values({
      organisationId: input.organisationId,
      clientId: input.customerId,
      points: -pointsRequired,
      reason: "redemption",
    });
    const [transaction] = await tx.insert(creditTransactions).values({
      organisationId: input.organisationId,
      siteId: input.siteId,
      customerId: input.customerId,
      type: "credit",
      amount: String(rewardValue),
      reason: "loyalty_reward",
      balanceBefore: String(balanceBefore),
      balanceAfter: String(balanceAfter),
      notes: `${pointsRequired} loyalty points redeemed`,
      createdBy: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
    }).returning();
    await tx.update(customers).set({
      loyaltyPoints: remainingPoints,
      loyaltyTier: tier,
      creditBalance: String(balanceAfter),
      totalCreditAdded: sql`${customers.totalCreditAdded} + ${rewardValue}`,
    }).where(and(eq(customers.id, input.customerId), eq(customers.siteId, input.siteId)));
    return { transaction, idempotentReplay: false, remainingPoints, tier, rewardValue, pointsRequired };
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
