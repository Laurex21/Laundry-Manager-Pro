import Decimal from "decimal.js-light";

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export const MONEY_MAX = "99999999.99";
export type MoneyString = string;
export type FoundationAllocationTarget = "service" | "treatment" | "pickup_delivery" | "unallocated";
type DecimalValue = string | number | Decimal;

function decimal(value: DecimalValue): Decimal {
  let parsed: Decimal;
  try { parsed = new Decimal(value); } catch { throw new Error("Invalid money value"); }
  return parsed;
}

export function canonicalMoney(value: DecimalValue): MoneyString {
  const rounded = decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (rounded.isNegative() || rounded.greaterThan(MONEY_MAX)) throw new Error("Money value is outside numeric(10,2) bounds");
  return rounded.toFixed(2);
}

export function multiplyMoney(left: DecimalValue, right: DecimalValue): MoneyString {
  return canonicalMoney(decimal(left).times(decimal(right)));
}

export function sumMoney(values: DecimalValue[]): MoneyString {
  return canonicalMoney(values.reduce<Decimal>((sum, value) => sum.plus(decimal(value)), new Decimal(0)));
}

export function compareMoney(left: DecimalValue, right: DecimalValue) {
  return decimal(left).comparedTo(decimal(right));
}

export function calculateOrderTotals(lines: Array<{ price: DecimalValue; quantity: DecimalValue }>, discountPercent: DecimalValue, fixedDiscount: DecimalValue, pickupDelivery: DecimalValue) {
  const subtotal = sumMoney(lines.map((line) => multiplyMoney(line.price, line.quantity)));
  const pct = decimal(discountPercent);
  const requestedDiscount = pct.greaterThan(0) ? eligibleServiceDiscount(subtotal, pct) : canonicalMoney(fixedDiscount);
  if (compareMoney(requestedDiscount, subtotal) > 0) throw new Error("Discount must be between zero and the order subtotal");
  const afterDiscount = decimal(subtotal).minus(decimal(requestedDiscount));
  return { subtotal, discount: requestedDiscount, pickupDelivery: canonicalMoney(pickupDelivery), total: canonicalMoney(afterDiscount.plus(decimal(pickupDelivery))) };
}

export function subtractMoney(left: DecimalValue, right: DecimalValue): MoneyString {
  const result = decimal(left).minus(decimal(right));
  return canonicalMoney(result.isNegative() ? 0 : result);
}

export function eligibleServiceDiscount(serviceAmount: DecimalValue, percent: DecimalValue): MoneyString {
  const pct = decimal(percent);
  if (pct.isNegative() || pct.greaterThan(100)) throw new Error("Discount percentage is outside bounds");
  return canonicalMoney(decimal(serviceAmount).times(pct).dividedBy(100));
}

export function composeMembershipAmount(serviceAmount: DecimalValue, coveredAmount: DecimalValue, discountPercent: DecimalValue) {
  const service = decimal(canonicalMoney(serviceAmount));
  const requestedCoverage = decimal(canonicalMoney(coveredAmount));
  const covered = requestedCoverage.greaterThan(service) ? service : requestedCoverage;
  const remaining = service.minus(covered);
  const discount = decimal(eligibleServiceDiscount(remaining, discountPercent));
  return { covered: canonicalMoney(covered), discount: canonicalMoney(discount), due: canonicalMoney(remaining.minus(discount)) };
}

type AllocatedMoney<T> = T extends { amount: DecimalValue }
  ? Omit<T, "amount"> & { amount: MoneyString }
  : never;

export function allocateMoney<T extends { target: FoundationAllocationTarget; amount: DecimalValue }>(total: DecimalValue, requested: T[]) {
  let remaining = decimal(canonicalMoney(total));
  const result: Array<AllocatedMoney<T> | { target: "unallocated"; amount: MoneyString }> = [];
  for (const allocation of requested) {
    if (remaining.isZero()) break;
    const requestedAmount = decimal(canonicalMoney(allocation.amount));
    const amount = requestedAmount.greaterThan(remaining) ? remaining : requestedAmount;
    if (amount.isZero()) continue;
    result.push({ ...allocation, amount: canonicalMoney(amount) });
    remaining = remaining.minus(amount);
  }
  if (remaining.greaterThan(0)) result.push({ target: "unallocated", amount: canonicalMoney(remaining) });
  return result;
}

export function moneyBalance(total: DecimalValue, payments: DecimalValue[], refunds: DecimalValue[] = []): MoneyString {
  const paid = payments.reduce<Decimal>((sum, value) => sum.plus(decimal(value)), new Decimal(0));
  const refunded = refunds.reduce<Decimal>((sum, value) => sum.plus(decimal(value)), new Decimal(0));
  const result = decimal(total).minus(paid).plus(refunded);
  return canonicalMoney(result.isNegative() ? 0 : result);
}

export function correctionOutcome(oldTotal: DecimalValue, newTotal: DecimalValue): "balance" | "customer_credit" | "balanced" {
  const comparison = decimal(newTotal).comparedTo(decimal(oldTotal));
  return comparison > 0 ? "balance" : comparison < 0 ? "customer_credit" : "balanced";
}

export const STAIN_CAPABILITIES = ["manage_stain_treatment_pricing", "view_stain_treatment_reports"] as const;
export type StainCapability = typeof STAIN_CAPABILITIES[number];

export function hasStainCapability(role: string, capabilities: readonly string[], capability: StainCapability = "manage_stain_treatment_pricing") {
  if (role === "owner") return true;
  if (role === "operator") return false;
  return role === "manager" && capabilities.includes(capability);
}
