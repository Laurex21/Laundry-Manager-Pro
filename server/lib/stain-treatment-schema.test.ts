import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const migration = readFileSync(join(root, "migrations/20260807_stain_treatment_pricing.sql"), "utf8");
const selfHeal = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");
const harness = readFileSync(join(root, "scripts/test-stain-postgres.ts"), "utf8");

for (const source of [schema, migration]) {
  for (const table of ["stain_treatment_pricing_sets", "stain_treatment_price_versions", "order_stain_treatments", "order_stain_treatment_adjustments"]) {
    assert.ok(source.includes(table), `${table} must exist in schema, migration, and self-heal`);
  }
}
for (const column of ["idempotency_key", "request_fingerprint", "posted_at"]) assert.ok(schema.includes(column));
for (const token of ["pricing_set_version", "captured_rate", "line_total", "acknowledgement_text_version", "corrected_from_treatment_id", "treatment_amount"]) {
  assert.ok(schema.includes(token), `missing ${token}`);
  assert.ok(migration.includes(token), `migration missing ${token}`);
}
for (const constraint of [
  "stain_treatment_pricing_sets_organisation_id_site_id_key",
  "stain_treatment_active_rate_key",
  "order_stain_treatments_order_tenant_fkey",
  "order_stain_treatments_item_order_fkey",
  "order_stain_treatments_correction_check",
  "order_stain_treatment_adjustments_action_check",
  "order_payment_allocation_one_target",
  "order_refund_allocation_one_target",
]) assert.ok(migration.includes(constraint), `migration missing ${constraint}`);
assert.ok(migration.includes("WHERE active"));
assert.ok(migration.includes("preserve_order_posted_at"));
assert.ok(migration.includes("order_stain_treatments_corrected_from_tenant_fkey"));
assert.ok(migration.includes("order_stain_treatments_append_only"));
assert.ok(migration.includes("num_nonnulls(service_amount, treatment_amount, pickup_delivery_amount, unallocated_amount) = 1"));
for (const source of [schema, migration]) {
  assert.ok(source.includes("^[A-Z]{3,10}$"), "treatment currencies must accept authoritative values such as FCFA");
}
assert.ok(migration.includes("ALTER COLUMN currency TYPE varchar(10)"), "self-heal must widen existing treatment currency columns");
assert.ok(selfHeal.includes("await ensureStainTreatmentSchema()"));
assert.ok(selfHeal.includes("export async function ensureStainTreatmentSchema"));
assert.ok(selfHeal.includes("applyStainTreatmentSchema"));
assert.ok(selfHeal.includes("CREATE TABLE IF NOT EXISTS"));
assert.ok(selfHeal.includes("CREATE INDEX IF NOT EXISTS"));
assert.ok(selfHeal.includes("DO $$ BEGIN"));
assert.ok(harness.includes("20260807_stain_treatment_pricing.sql"));
assert.ok(harness.includes("TEST_DATABASE_URL is required"));

console.log("Stain treatment schema regression checks passed");
