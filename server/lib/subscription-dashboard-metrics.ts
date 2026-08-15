import { percentage } from "./subscription-formulas";

export const RECEIVED_SUBSCRIPTION_PAYMENT_STATUSES = new Set(["completed", "renewal_completed", "advance_available", "advance_applied"]);

export function isReceivedSubscriptionPayment(status: string | null | undefined) {
  return RECEIVED_SUBSCRIPTION_PAYMENT_STATUSES.has(status ?? "");
}

export function individualUtilizationPct(
  subscription: { totalConsumedKg?: unknown; totalConsumedPieces?: unknown; totalOrdersUsed?: unknown },
  plan: { includedWeightKg?: unknown; includedPieces?: unknown; maxOrders?: unknown },
) {
  if (plan.includedWeightKg != null) return percentage(Number(subscription.totalConsumedKg ?? 0), Number(plan.includedWeightKg));
  if (plan.includedPieces != null) return percentage(Number(subscription.totalConsumedPieces ?? 0), Number(plan.includedPieces));
  return percentage(Number(subscription.totalOrdersUsed ?? 0), Number(plan.maxOrders ?? 0));
}
