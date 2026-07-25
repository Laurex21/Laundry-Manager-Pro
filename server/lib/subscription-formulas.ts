export type MembershipBillingCycle = "weekly" | "monthly" | "quarterly" | "annual";

export function monthlyEquivalent(recurringPrice: number, billingCycle: MembershipBillingCycle): number {
  if (billingCycle === "weekly") return recurringPrice * 4.33;
  if (billingCycle === "quarterly") return recurringPrice / 3;
  if (billingCycle === "annual") return recurringPrice / 12;
  return recurringPrice;
}

export function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export function usageThresholdCrossed(beforeRemaining: number, afterRemaining: number, allowance: number): "usage_80" | "usage_100" | null {
  if (allowance <= 0) return null;
  const beforeUsage = percentage(Math.max(0, allowance - beforeRemaining), allowance);
  const afterUsage = percentage(Math.max(0, allowance - afterRemaining), allowance);
  if (beforeUsage < 100 && afterUsage >= 100) return "usage_100";
  if (beforeUsage < 80 && afterUsage >= 80) return "usage_80";
  return null;
}

export function subscriptionExpiryState(expiryDate: string, reminderDays: number, today: string): "expired" | "reminder" | null {
  const expiry = new Date(`${expiryDate}T00:00:00Z`).getTime();
  const current = new Date(`${today}T00:00:00Z`).getTime();
  const daysUntilExpiry = Math.round((expiry - current) / 86_400_000);
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= Math.max(0, reminderDays)) return "reminder";
  return null;
}
