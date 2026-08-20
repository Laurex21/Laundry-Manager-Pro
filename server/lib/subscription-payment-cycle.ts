export type SubscriptionPaymentRow = {
  amount: unknown;
  status: string | null | undefined;
  paymentDate?: string | Date | null;
  id?: number;
};

const INITIAL_STATUSES = new Set(["partial", "completed"]);
const RENEWAL_STATUSES = new Set(["renewal_partial", "renewal_completed"]);

export function currentSubscriptionPaymentCycle(rows: SubscriptionPaymentRow[], initialCost: number, renewalCost: number) {
  const payments = [...rows].sort((a, b) => {
    const dateDifference = new Date(a.paymentDate ?? 0).getTime() - new Date(b.paymentDate ?? 0).getTime();
    return dateDifference || Number(a.id ?? 0) - Number(b.id ?? 0);
  });
  const normalizedInitialCost = Math.max(0, initialCost);
  const normalizedRenewalCost = Math.max(0, renewalCost);
  let initialPaid = 0;
  let renewalPaid = 0;
  let renewalStarted = false;
  let appliedAdvance = 0;

  for (const payment of payments) {
    const amount = Math.max(0, Number(payment.amount ?? 0));
    const status = payment.status ?? "";
    if (status === "advance_applied") { appliedAdvance += amount; continue; }

    if (INITIAL_STATUSES.has(status)) {
      if (initialPaid < normalizedInitialCost) initialPaid += amount;
      continue;
    }

    if (!RENEWAL_STATUSES.has(status)) continue;

    // Older versions could record renewal-style statuses before the first
    // subscription cycle was settled. Treat those amounts as payments toward
    // the still-open initial balance rather than allowing them to create
    // renewal credit prematurely.
    if (initialPaid < normalizedInitialCost) {
      initialPaid += amount;
      continue;
    }

    // A renewal status following a completed renewal starts the next renewal
    // cycle. Applied advances are held until that new cycle begins.
    if (!renewalStarted || renewalPaid >= normalizedRenewalCost) {
      renewalStarted = true;
      renewalPaid = appliedAdvance;
      appliedAdvance = 0;
    }
    renewalPaid += amount;
  }

  const cycle = initialPaid < normalizedInitialCost ? "initial" as const : renewalStarted ? "renewal" as const : "initial" as const;
  const cost = cycle === "initial" ? normalizedInitialCost : normalizedRenewalCost;
  const paid = cycle === "initial" ? initialPaid : renewalPaid;
  return {
    cycle,
    cost,
    paid: Math.min(cost, paid),
    due: Math.max(0, cost - paid),
    nextPaymentStatus: cycle === "initial" ? "partial" as const : "renewal_partial" as const,
    completedPaymentStatus: cycle === "initial" ? "completed" as const : "renewal_completed" as const,
  };
}
