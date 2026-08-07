import assert from "node:assert/strict";
import {
  allocateMoney,
  canonicalMoney,
  composeMembershipAmount,
  correctionOutcome,
  eligibleServiceDiscount,
  fingerprintRequest,
  hasStainCapability,
  moneyBalance,
  multiplyMoney,
  paidCorrectionOutcome,
  subtractMoney,
} from "./order-money";

assert.equal(canonicalMoney("1.005"), "1.01");
assert.equal(canonicalMoney("99999999.99"), "99999999.99");
assert.throws(() => canonicalMoney("-0.01"), /bounds/);
assert.throws(() => canonicalMoney("100000000.00"), /bounds/);
assert.throws(() => canonicalMoney("NaN"), /money/);
assert.equal(multiplyMoney("2.335", "3"), "7.01");
assert.equal(subtractMoney("10", "3.456"), "6.54");
assert.equal(eligibleServiceDiscount("100", "12.5"), "12.50");
assert.deepEqual(composeMembershipAmount("100", "30", "10"), { covered: "30.00", discount: "7.00", due: "63.00" });
assert.deepEqual(allocateMoney("12", [{ target: "service", amount: "10" }, { target: "pickup_delivery", amount: "5" }]), [
  { target: "service", amount: "10.00" },
  { target: "pickup_delivery", amount: "2.00" },
]);
assert.equal(moneyBalance("100", ["25", "12.50"], ["2.50"]), "65.00");
assert.equal(correctionOutcome("100", "110"), "balance");
assert.equal(correctionOutcome("100", "90"), "customer_credit");
assert.equal(correctionOutcome("100", "100"), "balanced");
assert.deepEqual(paidCorrectionOutcome("balance", "1.005"), { kind: "balance", amount: "1.01" });
assert.deepEqual(paidCorrectionOutcome("customer_credit", "2"), { kind: "customer_credit", amount: "2.00" });
assert.deepEqual(paidCorrectionOutcome("approved_internal_refund", "3.1"), { kind: "approved_internal_refund", amount: "3.10", externalTransfer: false });
assert.deepEqual(paidCorrectionOutcome("balanced", "99"), { kind: "balanced", amount: "0.00" });
assert.throws(() => paidCorrectionOutcome("balance", "-1"), /bounds/);
assert.throws(() => paidCorrectionOutcome("customer_credit", "100000000"), /bounds/);

const a = fingerprintRequest({ amount: "1.0", method: "cash", allocations: [{ target: "service", amount: "1" }] });
const b = fingerprintRequest({ allocations: [{ amount: "1.00", target: "service" }], method: "cash", amount: "1.00" });
assert.equal(a, b);
assert.notEqual(a, fingerprintRequest({ amount: "2", method: "cash" }));

assert.equal(hasStainCapability("owner", []), true);
assert.equal(hasStainCapability("manager", ["manage_stain_treatment_pricing"]), true);
assert.equal(hasStainCapability("manager", []), false);
assert.equal(hasStainCapability("operator", ["manage_stain_treatment_pricing"]), false);

console.log("Order money foundation regression checks passed");
