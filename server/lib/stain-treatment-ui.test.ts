import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const hook = readFileSync(join(root, "client/src/hooks/use-stain-treatment.ts"), "utf8");
const panel = readFileSync(join(root, "client/src/components/settings/stain-treatment-settings.tsx"), "utf8");
const settings = readFileSync(join(root, "client/src/pages/settings.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");

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

[
  "stain_treatment_settings", "stain_treatment_standard", "stain_treatment_intensive",
  "stain_treatment_very_intensive", "stain_treatment_per_piece", "stain_treatment_per_kg",
  "stain_treatment_currency", "stain_treatment_save", "stain_treatment_saved",
  "stain_treatment_missing", "stain_treatment_permission", "stain_treatment_prices_ascending",
].forEach((key) => assert.equal((i18n.match(new RegExp(`\"${key}\"`, "g")) || []).length, 3, key));

console.log("stain treatment settings UI regression tests passed");
