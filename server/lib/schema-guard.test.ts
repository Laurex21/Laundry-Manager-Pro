import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const auth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const moneyMigration = readFileSync(join(root, "migrations/20260807_order_money_foundation.sql"), "utf8");
const orderMoney = readFileSync(join(root, "server/lib/order-money.ts"), "utf8");
const postgresHarness = readFileSync(join(root, "scripts/test-stain-postgres.ts"), "utf8");

[
  "last_visit_at",
  "avg_days_between_visits",
  "visit_count",
  "expected_next_visit_date",
  "segment",
  "churn_risk_score",
  "total_revenue",
  "avg_deposit_hour",
  "ready_at",
  "delivered_at",
  "cancelled_at",
].forEach((column) => {
  assert.match(auth, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
});

[
  "idx_clients_last_visit",
  "idx_orders_site_status_ready",
  "idx_orders_created_at",
  "idx_orders_delivered_at",
].forEach((indexName) => {
  assert.match(auth, new RegExp(`CREATE INDEX IF NOT EXISTS ${indexName}`));
});

assert.doesNotMatch(schema, /orderId: integer\("order_id"\)\.notNull\(\)\.references\(\(\) => orders\.id\),\n  collectedByEmployeeId/);
assert.match(schema, /payments_order_tenant_fkey/);
for (const source of [auth, moneyMigration]) {
  assert.match(source, /array_length\(c\.conkey,1\)=1/);
  assert.match(source, /ALTER TABLE payments DROP CONSTRAINT/);
}

const fixtureOrders = postgresHarness.match(/CREATE TABLE orders\(([\s\S]*?)\);/)?.[1];
assert.ok(fixtureOrders, "PostgreSQL harness must define its orders fixture");
for (const column of ["total_amount", "original_price", "discount_amount", "discount", "pickup_cost"]) {
  assert.match(orderMoney, new RegExp(`\\b${column}\\b`), `production order-money query must still expose ${column}`);
  assert.match(fixtureOrders, new RegExp(`\\b${column}\\b`), `PostgreSQL harness orders fixture is missing queried column ${column}`);
}
assert.match(postgresHarness, /allocations, \[\{ target:"service",amount:"5\.00" \}\]/);

console.log("schema guard regression tests passed");
