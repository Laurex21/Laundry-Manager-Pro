import { canonicalMoney, compareMoney, sumMoney } from "./order-money";

export function membershipFinancialComposition(input: {
  eligibleServiceAmount: string;
  coveredServiceAmount: string;
  uncoveredServiceAmount: string;
  treatmentAmount: string;
  pickupDeliveryAmount: string;
}) {
  const values = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, canonicalMoney(value)])) as typeof input;
  if (compareMoney(values.coveredServiceAmount, values.eligibleServiceAmount) > 0) throw new Error("Covered service amount exceeds eligible service amount");
  return { ...values, finalAmount: sumMoney([values.uncoveredServiceAmount, values.treatmentAmount, values.pickupDeliveryAmount]) };
}
