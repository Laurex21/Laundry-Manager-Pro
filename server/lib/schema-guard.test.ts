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

// Replit's schema-sync engine applies declarative NOT NULL constraints before
// custom backfills. Legacy payment columns must remain nullable in Drizzle;
// the staged production migration is authoritative for their final NOT NULL
// constraints after tenant/idempotency/fingerprint backfill.
const paymentsSchema = schema.match(/export const payments = pgTable\("payments", \{([\s\S]*?)\n\}, \(table\) => \[/)?.[1];
assert.ok(paymentsSchema, "payments schema block must exist");
for (const column of ["idempotencyKey", "organisationId", "siteId", "requestFingerprint"]) {
  assert.doesNotMatch(
    paymentsSchema,
    new RegExp(`${column}: [^\\n]+\\.notNull\\(\\)`),
    `${column} must not make Replit constrain populated payment rows before backfill`,
  );
}
const paymentBackfill = moneyMigration.indexOf("UPDATE payments SET idempotency_key = 'legacy-payment-'");
const paymentNotNull = moneyMigration.indexOf("ALTER TABLE payments ALTER COLUMN idempotency_key SET NOT NULL");
assert.ok(paymentBackfill >= 0 && paymentNotNull > paymentBackfill, "payment idempotency must be backfilled before NOT NULL");
assert.match(moneyMigration, /UPDATE payments p SET organisation_id = o\.organisation_id, site_id = o\.site_id FROM orders o/);
assert.match(moneyMigration, /cannot safely establish tenant identity for every legacy payment/);

console.log("schema guard regression tests passed");
