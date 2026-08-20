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
  let cycle: "initial" | "renewal" = "initial";
  let paid = 0;
  let appliedAdvance = 0;

  for (const payment of payments) {
    const amount = Math.max(0, Number(payment.amount ?? 0));
    const status = payment.status ?? "";
    if (status === "advance_applied") { appliedAdvance += amount; continue; }
    if (INITIAL_STATUSES.has(status) && cycle === "initial") { paid += amount; continue; }
    if (!RENEWAL_STATUSES.has(status)) continue;
    const cycleCost = cycle === "initial" ? initialCost : renewalCost;
    if (cycle === "initial" || paid >= cycleCost) {
      cycle = "renewal";
      paid = appliedAdvance;
      appliedAdvance = 0;
    }
    paid += amount;
  }

  const cost = Math.max(0, cycle === "initial" ? initialCost : renewalCost);
  return {
    cycle,
    cost,
    paid: Math.min(cost, paid),
    due: Math.max(0, cost - paid),
    nextPaymentStatus: cycle === "initial" ? "partial" as const : "renewal_partial" as const,
    completedPaymentStatus: cycle === "initial" ? "completed" as const : "renewal_completed" as const,
  };
}
