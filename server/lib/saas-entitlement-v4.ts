import type { SaasPlanV4 } from "./saas-plan-v4";

export const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export type SaasEntitlementV4 = {
  planSlug: SaasPlanV4;
  state: "trialing" | "active" | "starter" | "past_due";
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  cycleStartedAt: Date | null;
  cycleEndsAt: Date | null;
};

export function newOrganisationTrialV4(activatedAt: Date): SaasEntitlementV4 {
  const start = activatedAt.getTime();
  if (!Number.isFinite(start)) throw new RangeError("Invalid trial activation time");
  return {
    planSlug: "pro", state: "trialing",
    trialStartedAt: new Date(start), trialEndsAt: new Date(start + TRIAL_DURATION_MS),
    cycleStartedAt: null, cycleEndsAt: null,
  };
}

// This is an access-time projection, not a database mutation. A late scheduler
// cannot extend paid/trial rights, and no browser response can create them.
export function effectiveSaasPlanV4(entitlement: SaasEntitlementV4 | null, now: Date): SaasPlanV4 {
  const currentTime = now.getTime();
  if (!Number.isFinite(currentTime)) throw new RangeError("Invalid current time");
  if (!entitlement) return "starter";
  if (entitlement.state === "trialing") {
    const end = entitlement.trialEndsAt?.getTime();
    return end !== undefined && Number.isFinite(end) && currentTime < end ? "pro" : "starter";
  }
  if (entitlement.state === "active") {
    const start = entitlement.cycleStartedAt?.getTime();
    const end = entitlement.cycleEndsAt?.getTime();
    return start !== undefined && end !== undefined &&
      Number.isFinite(start) && Number.isFinite(end) &&
      start <= currentTime && currentTime < end ? entitlement.planSlug : "starter";
  }
  return "starter";
}
