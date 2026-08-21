import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("shared/schema.ts", "utf8");
const bootstrap = readFileSync("server/replit_integrations/auth/replitAuth.ts", "utf8");

for (const table of ["garment_return_cases", "garment_return_events", "garment_return_attachments"]) {
  assert.match(schema, new RegExp(`pgTable\\("${table}"`), `${table} must exist in Drizzle schema`);
  assert.match(bootstrap, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} must be created idempotently at startup`);
}

for (const column of [
  "organisation_id", "site_id", "order_id", "garment_item_id", "complaint_reason",
  "customer_comment", "received_by_user_id", "decided_by_user_id", "resolved_by_user_id",
  "returned_at", "decided_at", "resolved_at",
]) {
  assert.match(bootstrap, new RegExp(column), `return schema must include ${column}`);
}

assert.match(bootstrap, /idx_garment_return_active_case/);
assert.match(bootstrap, /WHERE status NOT IN \('rejected', 'resolved'\)/);
assert.match(bootstrap, /INSERT INTO garment_return_cases[\s\S]*FROM garment_items gi[\s\S]*ON CONFLICT DO NOTHING/);
assert.match(bootstrap, /returned_for_treatment = true OR gi\.resolved_at IS NOT NULL/);
assert.doesNotMatch(bootstrap, /DROP COLUMN[^;]*(returned_for_treatment|return_stage|return_notes|returned_at|resolved_at)/i);

console.log("quality operations schema regression passed");
