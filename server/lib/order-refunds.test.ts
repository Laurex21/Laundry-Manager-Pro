import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const a = fingerprintRequest({ amount: "1.0", method: "cash", allocations: [{ target: "service", amount: "1" }] });
const b = fingerprintRequest({ allocations: [{ amount: "1.00", target: "service" }], method: "cash", amount: "1.00" });
assert.equal(a, b);
assert.notEqual(a, fingerprintRequest({ amount: "2", method: "cash" }));

assert.equal(hasStainCapability("owner", []), true);
assert.equal(hasStainCapability("manager", ["manage_stain_treatment_pricing"]), true);
assert.equal(hasStainCapability("manager", []), false);
assert.equal(hasStainCapability("operator", ["manage_stain_treatment_pricing"]), false);

const root = process.cwd();
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const migration = readFileSync(join(root, "migrations/20260807_order_money_foundation.sql"), "utf8");
const auth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");
const authRoutes = readFileSync(join(root, "server/replit_integrations/auth/routes.ts"), "utf8");
const currencyHook = readFileSync(join(root, "client/src/hooks/use-currency.ts"), "utf8");
const corrections = readFileSync(join(root, "server/lib/order-corrections.ts"), "utf8");

assert.match(schema, /currency: varchar\("currency", \{ length: 10 \}\)\.notNull\(\)\.default\("FCFA"\)/);
assert.match(schema, /manage_stain_treatment_pricing/);
assert.match(schema, /view_stain_treatment_reports/);
assert.match(migration, /UPDATE organisations SET currency = 'FCFA'/);
assert.match(migration, /order_refunds/);
assert.match(migration, /order_payment_allocations/);
assert.match(migration, /order_refund_allocations/);
assert.match(migration, /request_fingerprint/);
assert.match(migration, /FOR UPDATE/);
assert.match(migration, /num_nonnulls\(/);
assert.match(migration, /UNIQUE \(id, organisation_id, site_id\)/);
assert.doesNotMatch(migration, /DELETE FROM payments|UPDATE payments SET|DROP TABLE|TRUNCATE/i);
assert.match(auth, /20260807_order_money_foundation/);
assert.match(authRoutes, /currency/);
assert.doesNotMatch(currencyHook, /setCurrency/);
assert.doesNotMatch(currencyHook, /persist\(/);
assert.match(corrections, /approved_internal_refund/);
assert.doesNotMatch(corrections, /fetch\(|axios|resend|stripe/i);

console.log("Order money foundation regression checks passed");
