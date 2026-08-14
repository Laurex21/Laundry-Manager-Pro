import assert from "node:assert/strict";
import { NOTIFICATION_TEMPLATES } from "./subscription-notification-templates";
import { computeOrderPoints, computeTier } from "./loyalty-formulas";

assert.equal(computeTier(0), "bronze");
assert.equal(computeTier(499), "bronze");
assert.equal(computeTier(500), "silver");
assert.equal(computeTier(1500), "gold");
assert.equal(computeTier(3000), "platinum");
assert.equal(computeTier(5000), "diamond");

assert.equal(computeOrderPoints(10_000, 10, null, "bronze"), 10);
assert.equal(computeOrderPoints(10_000, 10, 500, "bronze"), 30);
assert.equal(computeOrderPoints(10_000, 10, 500, "silver"), 33);
assert.equal(computeOrderPoints(10_000, 10, 500, "diamond"), 45);
assert.equal(
  computeOrderPoints(24_000, 10, 2_000, "bronze"),
  22,
  "FCFA 24,000 with a FCFA 2,000-per-point rule must award 10 base + 12 spend points",
);

const paymentMessage = NOTIFICATION_TEMPLATES.payment_confirmed("Awa", "Premium", 12_500, "GNF", "XPress");
assert.match(paymentMessage, /12[^\d]?500 GNF/);
assert.doesNotMatch(paymentMessage, /FCFA/);

console.log("loyalty formula tests passed");
