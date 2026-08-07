import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const hook = readFileSync(join(root, "client/src/hooks/use-stain-treatment.ts"), "utf8");
const panel = readFileSync(join(root, "client/src/components/settings/stain-treatment-settings.tsx"), "utf8");
const settings = readFileSync(join(root, "client/src/pages/settings.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");
const editor = readFileSync(join(root, "client/src/components/orders/stain-treatment-editor.tsx"), "utf8");
const orders = readFileSync(join(root, "client/src/pages/orders.tsx"), "utf8");
const orderHook = readFileSync(join(root, "client/src/hooks/use-orders.ts"), "utf8");
const detail = readFileSync(join(root, "client/src/pages/order-detail.tsx"), "utf8");
const analytics = readFileSync(join(root, "client/src/pages/analytics.tsx"), "utf8");
const browserGate = readFileSync(join(root, "e2e/stain-treatment.spec.ts"), "utf8");
const browserSeed = readFileSync(join(root, "scripts/seed-stain-treatment-e2e.ts"), "utf8");

assert.match(hook, /\/api\/stain-treatment\/prices/);
assert.match(hook, /invalidateQueries\(\{ queryKey: STAIN_TREATMENT_SETTINGS_KEY \}\)/);
assert.match(panel, /STAIN_TREATMENT_LEVELS/);
assert.match(panel, /STAIN_TREATMENT_UNITS/);
assert.match(panel, /inputMode="decimal"/);
assert.match(panel, /validateAscendingRates/);
assert.match(panel, /aria-live="polite"/);
assert.match(panel, /aria-live="assertive"/);
assert.match(panel, /focus\(\)/);
assert.match(panel, /type="submit"/);
assert.match(panel, /updatedBy/);
assert.match(panel, /updatedAt/);
assert.doesNotMatch(panel, /type="number"/);
assert.match(settings, /manage_stain_treatment_pricing/);
assert.match(settings, /StainTreatmentSettings/);
assert.match(editor, /<fieldset/);
assert.match(editor, /<legend/);
assert.match(editor, /orderItemIndex/);
assert.match(editor, /treatmentUnit\(selectedService\)/);
assert.match(editor, /STAIN_TREATMENT_LEVELS/);
assert.match(editor, /affected_quantity/);
assert.match(editor, /aria-describedby/);
assert.match(editor, /aria-live="polite"/);
assert.match(editor, /very_intensive_acknowledgement/);
assert.match(editor, /normalizeLocaleDecimal/);
assert.match(editor, /aggregate/);
assert.doesNotMatch(editor, /custom.?rate/i);
assert.match(orders, /StainTreatmentEditor/);
assert.match(orders, /cleaning_subtotal/);
assert.match(orders, /cleaning_discount/);
assert.match(orders, /stain_treatment_subtotal/);
assert.match(orders, /pricingConflict/);
assert.match(orders, /expectedPricingSetVersion/);
assert.match(orderHook, /OrderPostingError/);
assert.match(orderHook, /res\.status/);
assert.match(detail, /stain-treatment-history/);
assert.match(detail, /acknowledgementTextVersion/);
assert.match(detail, /line\.adjustments/);
assert.doesNotMatch(detail, /stain-treatment-history[\s\S]{0,4000}(edit|delete).*treatment/i);
assert.match(analytics, /\/api\/stain-treatment\/report/);
assert.match(analytics, /view_stain_treatment_reports/);
assert.match(analytics, /bookedRevenue/);
assert.match(analytics, /collectedRevenue/);
assert.match(analytics, /acknowledgementExceptions/);
assert.match(browserGate, /postCoveredOrder/);
assert.match(browserGate, /pieceServiceId/);
assert.match(browserGate, /kgServiceId/);
assert.match(browserGate, /level: "standard"/);
assert.match(browserGate, /level: "intensive"/);
assert.match(browserGate, /level: "very_intensive"/);
assert.match(browserGate, /fixed: "5\.00"/);
assert.match(browserGate, /percentage: 10/);
assert.match(browserGate, /advancePayment/);
assert.match(browserGate, /subscriptions\/apply-to-order/);
assert.match(browserGate, /paid-correction/);
assert.match(browserGate, /menu-item-lang-\$\{language\}/);
assert.match(browserGate, /page\.request\.put\("\/api\/stain-treatment\/prices"/);
assert.match(browserGate, /changedPricing\.ok/);
assert.doesNotMatch(browserGate, /if \(await dialog\.count\(\)\)/);
assert.match(browserSeed, /INSERT INTO customer_subscriptions/);
assert.match(browserSeed, /INSERT INTO subscription_plan_services/);

[
  "stain_treatment_settings", "stain_treatment_standard", "stain_treatment_intensive",
  "stain_treatment_very_intensive", "stain_treatment_per_piece", "stain_treatment_per_kg",
  "stain_treatment_currency", "stain_treatment_save", "stain_treatment_saved",
  "stain_treatment_missing", "stain_treatment_permission", "stain_treatment_prices_ascending",
].forEach((key) => assert.equal((i18n.match(new RegExp(`\"${key}\"`, "g")) || []).length, 3, key));

[
  "stain_treatment_report", "stain_treatment_booked", "stain_treatment_collected",
  "stain_treatment_history", "stain_treatment_acknowledgement",
  "stain_treatment_acknowledgement_exceptions",
].forEach((key) => assert.equal((i18n.match(new RegExp(`\"${key}\"`, "g")) || []).length, 3, key));

[
  "stain_treatment_add", "stain_treatment_related_service", "stain_treatment_affected_quantity",
  "stain_treatment_rate_preview", "stain_treatment_subtotal", "stain_treatment_missing_order",
  "stain_treatment_quantity_exceeded", "stain_treatment_very_intensive_acknowledgement",
  "stain_treatment_price_changed", "stain_treatment_review_prices", "stain_treatment_resubmit",
  "cleaning_subtotal", "cleaning_discount",
].forEach((key) => assert.equal((i18n.match(new RegExp(`\"${key}\"`, "g")) || []).length, 3, key));

console.log("stain treatment settings UI regression tests passed");
