import { effectiveSaasPlanV4, type SaasEntitlementV4 } from "./saas-entitlement-v4";
import { SAAS_PLANS_V4, type SaasPlanV4 } from "./saas-plan-v4";

export type PaidSaasPlanV4 = Exclude<SaasPlanV4, "starter">;

export function nextMonthlyAnniversaryUtcV4(start: Date): Date {
  const time = start.getTime();
  if (!Number.isFinite(time)) throw new RangeError("Invalid cycle start");
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const lastDayNextMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  return new Date(Date.UTC(year, month + 1, Math.min(start.getUTCDate(), lastDayNextMonth),
    start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds()));
}

// Call only from a transaction that has verified and locked an immutable
// provider payment intent. This function does not verify PawaPay itself.
export function confirmedPaidPlanSwitchV4(previous: SaasEntitlementV4 | null,
  target: PaidSaasPlanV4, confirmedAt: Date): { entitlement: SaasEntitlementV4; fullPlanPriceXaf: number } {
  if (target !== "pro" && target !== "business") throw new RangeError("Only paid plans can be purchased");
  const confirmedTime = confirmedAt.getTime();
  if (!Number.isFinite(confirmedTime)) throw new RangeError("Invalid payment confirmation time");
  const effective = effectiveSaasPlanV4(previous, confirmedAt);
  if (previous?.state === "active" && effective === target) {
    throw new Error("EARLY_SAME_PLAN_RENEWAL_NOT_DEFINED");
  }
  return {
    entitlement: {
      planSlug: target, state: "active",
      trialStartedAt: previous?.trialStartedAt ?? null,
      trialEndsAt: previous?.trialEndsAt ?? null,
      cycleStartedAt: new Date(confirmedTime),
      cycleEndsAt: nextMonthlyAnniversaryUtcV4(confirmedAt),
    },
    fullPlanPriceXaf: SAAS_PLANS_V4[target].monthlyXaf,
  };
}
