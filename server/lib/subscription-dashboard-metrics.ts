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

export function currentCycleFinancials(
  subscription: { status?: string | null },
  plan: { recurringPrice?: unknown; activationFee?: unknown },
  receivedAmount: number,
  hasCompletedRenewal = false,
) {
  const recurringCost = Math.max(0, Number(plan.recurringPrice ?? 0));
  const activationFee = Math.max(0, Number(plan.activationFee ?? 0));
  const status = subscription.status ?? "pending";

  if (status === "active") {
    const subscriptionCost = recurringCost + (hasCompletedRenewal ? 0 : activationFee);
    const amountPaid = Math.min(subscriptionCost, Math.max(0, receivedAmount));
    return {
      subscriptionCost: Number(subscriptionCost.toFixed(2)),
      amountPaid: Number(amountPaid.toFixed(2)),
      paymentDue: Number(Math.max(0, subscriptionCost - amountPaid).toFixed(2)),
    };
  }
  if (status === "expired") {
    return { subscriptionCost: recurringCost, amountPaid: 0, paymentDue: recurringCost };
  }
  if (status === "cancelled" || status === "suspended") {
    return { subscriptionCost: recurringCost, amountPaid: 0, paymentDue: 0 };
  }

  const subscriptionCost = recurringCost + activationFee;
  const amountPaid = Math.min(subscriptionCost, Math.max(0, receivedAmount));
  return {
    subscriptionCost: Number(subscriptionCost.toFixed(2)),
    amountPaid: Number(amountPaid.toFixed(2)),
    paymentDue: Number(Math.max(0, subscriptionCost - amountPaid).toFixed(2)),
  };
}
