import assert from "node:assert/strict";
import {
  STAIN_TREATMENT_LEVELS,
  STAIN_TREATMENT_UNITS,
  stainTreatmentDraftInputSchema,
  stainTreatmentPricingInputSchema,
  multiplyTreatmentAmount,
  validateAscendingRates,
  validateNetEffectiveQuantity,
  validateTreatmentQuantity,
} from "../../shared/stain-treatment";

assert.deepEqual(STAIN_TREATMENT_LEVELS, ["standard", "intensive", "very_intensive"]);
assert.deepEqual(STAIN_TREATMENT_UNITS, ["piece", "kg"]);
assert.equal(STAIN_TREATMENT_LEVELS.length * STAIN_TREATMENT_UNITS.length, 6);

const validDraft = {
  orderItemIndex: 0,
  level: "intensive",
  quantity: "3.50",
  idempotencyKey: "stain-draft-1",
};
assert.equal(stainTreatmentDraftInputSchema.safeParse(validDraft).success, true);
assert.equal(stainTreatmentDraftInputSchema.safeParse({ ...validDraft, quantity: "0.00" }).success, false);
assert.equal(stainTreatmentDraftInputSchema.safeParse({ ...validDraft, quantity: "1.001" }).success, false);
assert.equal(multiplyTreatmentAmount("8.25", "3.50"), "28.88");
assert.equal(validateTreatmentQuantity("piece", "2").success, true);
assert.equal(validateTreatmentQuantity("piece", "2.50").success, false);
assert.equal(validateTreatmentQuantity("kg", "2.50").success, true);
assert.equal(validateTreatmentQuantity("kg", "2.501").success, false);
assert.equal(validateTreatmentQuantity("kg", "0").success, false);
assert.equal(stainTreatmentDraftInputSchema.safeParse({ ...validDraft, quantity: "0" }).success, false);

for (const forbidden of ["siteId", "organisationId", "currency", "price", "rate", "total", "lineTotal"]) {
  assert.equal(stainTreatmentDraftInputSchema.safeParse({ ...validDraft, [forbidden]: "1" }).success, false, forbidden);
}
assert.equal(stainTreatmentDraftInputSchema.safeParse({ ...validDraft, idempotencyKey: "x".repeat(120) }).success, true);
assert.equal(stainTreatmentDraftInputSchema.safeParse({ ...validDraft, idempotencyKey: "x".repeat(121) }).success, false);
assert.equal(stainTreatmentDraftInputSchema.safeParse({ ...validDraft, level: "very_intensive" }).success, false);
assert.equal(stainTreatmentDraftInputSchema.safeParse({
  ...validDraft,
  level: "very_intensive",
  acknowledgement: { affirmed: true, textVersion: "stain-warning-v1" },
}).success, true);
assert.equal(stainTreatmentDraftInputSchema.safeParse({
  ...validDraft,
  level: "very_intensive",
  acknowledgement: { affirmed: false, textVersion: "stain-warning-v1" },
}).success, false);
assert.equal(stainTreatmentDraftInputSchema.safeParse({
  ...validDraft,
  level: "very_intensive",
  acknowledgement: { affirmed: true, textVersion: "stain-warning-v1", acknowledgedAt: "2026-08-07" },
}).success, false);

const sixRates = {
  rates: STAIN_TREATMENT_UNITS.flatMap((unit) => [
    { unit, level: "standard" as const, price: "5.00" },
    { unit, level: "intensive" as const, price: "7.50" },
    { unit, level: "very_intensive" as const, price: "10.00" },
  ]),
};
assert.equal(stainTreatmentPricingInputSchema.safeParse(sixRates).success, true);
assert.equal(stainTreatmentPricingInputSchema.safeParse({ rates: sixRates.rates.slice(0, 5) }).success, false);
assert.equal(stainTreatmentPricingInputSchema.safeParse({ ...sixRates, rates: sixRates.rates.map((r, i) => i === 0 ? { ...r, price: "1.001" } : r) }).success, false);
assert.equal(stainTreatmentPricingInputSchema.safeParse({ ...sixRates, rates: sixRates.rates.map((r, i) => i === 0 ? { ...r, price: "0.00" } : r) }).success, false);
assert.equal(validateAscendingRates(sixRates.rates).success, true);
assert.equal(validateAscendingRates(sixRates.rates.map((r, i) => i === 0 ? { ...r, price: "5.001" } : r)).success, false);
assert.equal(validateAscendingRates(sixRates.rates.map((r, i) => i === 1 ? { ...r, price: "5.00" } : r)).success, false);

assert.equal(validateNetEffectiveQuantity("5", "2", "3").success, true);
assert.equal(validateNetEffectiveQuantity("5", "2", "3.01").success, false);
assert.equal(validateNetEffectiveQuantity("5", "2", "-2.01").success, false);

console.log("stain treatment domain tests passed");
