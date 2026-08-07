import assert from "node:assert/strict";
import {
  allocateMoney,
  canonicalMoney,
  composeMembershipAmount,
  correctionOutcome,
  createOrReplayPayment,
  eligibleServiceDiscount,
  fingerprintRequest,
  hasStainCapability,
  moneyBalance,
  multiplyMoney,
  paidCorrectionOutcome,
  recordPaidCorrectionOutcome,
  resolveStainCapability,
  subtractMoney,
  withMoneyTransaction,
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

assert.notEqual(fingerprintRequest({ reference: "001" }), fingerprintRequest({ reference: "1" }));
assert.notEqual(fingerprintRequest({ amount: "1.0" }), fingerprintRequest({ amount: "1.00" }), "generic strings remain exact");
const moneyFields = { moneyPaths: ["amount", "allocations[].amount"] };
assert.equal(fingerprintRequest({ amount: "1" }, moneyFields), fingerprintRequest({ amount: "1.0" }, moneyFields));
assert.equal(fingerprintRequest({ amount: "1.0" }, moneyFields), fingerprintRequest({ amount: "1.00" }, moneyFields));
const a = fingerprintRequest({ amount: "1.0", method: "cash", allocations: [{ target: "service", amount: "1" }] }, moneyFields);
const b = fingerprintRequest({ allocations: [{ amount: "1.00", target: "service" }], method: "cash", amount: "1.00" }, moneyFields);
assert.equal(a, b);
assert.notEqual(a, fingerprintRequest({ amount: "2", method: "cash" }, moneyFields));
assert.notEqual(
  fingerprintRequest({ allocations: [{ target: "service", amount: "1" }, { target: "pickup_delivery", amount: "2" }] }, moneyFields),
  fingerprintRequest({ allocations: [{ target: "pickup_delivery", amount: "2" }, { target: "service", amount: "1" }] }, moneyFields),
  "array ordering is part of the request contract",
);

assert.equal(hasStainCapability("owner", []), true);
assert.equal(hasStainCapability("manager", ["manage_stain_treatment_pricing"]), true);
assert.equal(hasStainCapability("manager", []), false);
assert.equal(hasStainCapability("operator", ["manage_stain_treatment_pricing"]), false);
for (const [role, capabilities, expected] of [
  ["owner", [], true],
  ["manager", ["manage_stain_treatment_pricing"], true],
  ["manager", [], false],
  ["operator", ["manage_stain_treatment_pricing"], false],
] as const) {
  const resolved = await resolveStainCapability({ async query() { return { rows: [{ role, capabilities }], rowCount: 1 }; } }, { userId: "u", organisationId: 1, siteId: 2 });
  assert.equal(resolved.canManagePricing, expected);
}

const transactionLog: string[] = [];
const transactionSource = {
  async connect() {
    return {
      async query(text: string) {
        transactionLog.push(text);
        if (text.includes("FROM orders") && text.includes("FOR UPDATE")) return { rows: [{ id: 7, service_balance: "4.00", pickup_delivery_balance: "1.00" }], rowCount: 1 };
        if (text.includes("FROM payments") && text.includes("idempotency_key")) return { rows: [], rowCount: 0 };
        if (text.includes("INSERT INTO payments")) return { rows: [{ id: 11, request_fingerprint: "f".repeat(64) }], rowCount: 1 };
        if (text.includes("INSERT INTO order_payment_allocations")) return { rows: [], rowCount: 1 };
        if (text.includes(" AS balance")) return { rows: [{ balance: "5.00" }], rowCount: 1 };
        return { rows: [], rowCount: null };
      },
      release() { transactionLog.push("RELEASE"); },
    };
  },
};
const livePayment = await createOrReplayPayment(transactionSource, {
  organisationId: 1, siteId: 2, orderId: 7, idempotencyKey: "live-payment-test-key",
  amount: "5", method: "cash",
});
assert.equal(livePayment.replayed, false);
assert.ok(transactionLog.includes("BEGIN") && transactionLog.includes("COMMIT"));
assert.ok(transactionLog.some((sql) => sql.includes("request_fingerprint")));
assert.ok(transactionLog.filter((sql) => sql.includes("INSERT INTO order_payment_allocations")).length === 2);
assert.ok(transactionLog.findIndex((sql) => sql.includes("UPDATE orders SET payment_status")) < transactionLog.indexOf("COMMIT"));

const paymentFingerprint = fingerprintRequest({ orderId: 7, amount: "5.00", method: "cash", reference: null, paymentDate: null, isAdvance: false, context: null });
const replayLog: string[] = [];
const replayedPayment = await createOrReplayPayment({ async connect() { return {
  async query(text: string) {
    replayLog.push(text);
    if (text.includes("FROM orders") && text.includes("FOR UPDATE")) return { rows:[{ id:7,service_balance:"4.00",pickup_delivery_balance:"1.00" }],rowCount:1 };
    if (text.includes("FROM payments") && text.includes("idempotency_key")) return { rows:[{ id:11,request_fingerprint:paymentFingerprint }],rowCount:1 };
    if (text.includes(" AS balance")) return { rows:[{ balance:"5.00" }],rowCount:1 };
    return { rows:[],rowCount:null };
  }, release() {},
}; } }, { organisationId:1,siteId:2,orderId:7,idempotencyKey:"live-payment-test-key",amount:"5",method:"cash" });
assert.equal(replayedPayment.replayed,true);
assert.ok(!replayLog.some((sql) => sql.includes("UPDATE orders SET payment_status")),"payment replay must not reapply status");

const atomicLog: string[] = [];
await assert.rejects(createOrReplayPayment({ async connect() { return {
  async query(text: string) {
    atomicLog.push(text);
    if (text.includes("FROM orders") && text.includes("FOR UPDATE")) return { rows:[{ id:7,service_balance:"5.00",pickup_delivery_balance:"0.00" }],rowCount:1 };
    if (text.includes("FROM payments") && text.includes("idempotency_key")) return { rows:[],rowCount:0 };
    if (text.includes("INSERT INTO payments")) return { rows:[{ id:12 }],rowCount:1 };
    if (text.includes("INSERT INTO order_payment_allocations")) return { rows:[],rowCount:1 };
    if (text.includes(" AS balance")) return { rows:[{ balance:"0.00" }],rowCount:1 };
    if (text.includes("UPDATE orders SET payment_status")) throw new Error("status update failed");
    return { rows:[],rowCount:null };
  }, release() {},
}; } }, { organisationId:1,siteId:2,orderId:7,idempotencyKey:"atomic-payment-test",amount:"5",method:"cash" }),/status update failed/);
assert.ok(atomicLog.includes("ROLLBACK") && !atomicLog.includes("COMMIT"));

const rollbackLog: string[] = [];
await assert.rejects(withMoneyTransaction({ async connect() { return {
  async query(text: string) { rollbackLog.push(text); return { rows: [], rowCount: null }; },
  release() { rollbackLog.push("RELEASE"); },
}; } }, async () => { throw new Error("allocation failure"); }), /allocation failure/);
assert.deepEqual(rollbackLog, ["BEGIN", "ROLLBACK", "RELEASE"]);

const correctionSql: string[] = [];
const persistedCorrection = await recordPaidCorrectionOutcome({ async connect() { return {
  async query(text: string) {
    correctionSql.push(text);
    if (text.includes("FROM orders") && text.includes("FOR UPDATE")) return { rows: [{ id: 7 }], rowCount: 1 };
    if (text.includes("FROM order_corrections")) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: text.includes("INSERT INTO order_corrections") ? 1 : null };
  },
  release() {},
}; } }, {
  organisationId: 1, siteId: 2, orderId: 7, idempotencyKey: "paid-correction-key", kind: "balance", amount: "2", reason: "Corrected total increased",
});
assert.deepEqual(persistedCorrection, { kind: "balance", amount: "2.00" });
assert.ok(correctionSql.some((sql) => sql.includes("INSERT INTO order_corrections")));

console.log("Order money foundation regression checks passed");
