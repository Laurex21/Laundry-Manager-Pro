import type { SaasEntitlementV4 } from "./saas-entitlement-v4";

const DAY_MS = 24 * 60 * 60 * 1000;

export function localIsoDateV4(now: Date, timeZone: string): string {
  if (!Number.isFinite(now.getTime())) throw new RangeError("Invalid current time");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function trialNoticeCandidateV4(entitlement: SaasEntitlementV4 | null, isOwner: boolean,
  now: Date, timeZone: string): { kind: "trial_reminder" | "trial_expired"; localDate: string; remainingMs: number } | null {
  if (!isOwner || !entitlement?.trialStartedAt || !entitlement.trialEndsAt ||
      entitlement.state === "active" || entitlement.state === "past_due") return null;
  const start = entitlement.trialStartedAt.getTime();
  const end = entitlement.trialEndsAt.getTime();
  const current = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(current) || end <= start) return null;
  if (current >= end) {
    return { kind: "trial_expired", localDate: localIsoDateV4(now, timeZone), remainingMs: 0 };
  }
  if (entitlement.state !== "trialing" || current < start + 23 * DAY_MS) return null;
  return { kind: "trial_reminder", localDate: localIsoDateV4(now, timeZone), remainingMs: end - current };
}
