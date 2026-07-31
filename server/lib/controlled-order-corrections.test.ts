import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const service = readFileSync(join(root, "server/lib/order-corrections.ts"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const migration = readFileSync(join(root, "migrations/20260730_controlled_order_corrections.sql"), "utf8");
const component = readFileSync(join(root, "client/src/components/order-correction-actions.tsx"), "utf8");
const orderDetail = readFileSync(join(root, "client/src/pages/order-detail.tsx"), "utf8");

assert.match(schema, /correctedFromOrderId: integer\("corrected_from_order_id"\)/);
assert.match(schema, /export const orderCorrections = pgTable\("order_corrections"/);
assert.match(migration, /before_snapshot jsonb NOT NULL/);
assert.match(migration, /after_snapshot jsonb NOT NULL/);
assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE/i);

assert.match(service, /FOR UPDATE OF o/);
assert.match(service, /order\.status !== "received"/);
assert.match(service, /deps\.has_payments/);
assert.match(service, /deps\.has_credit/);
assert.match(service, /deps\.has_subscription/);
assert.match(service, /deps\.has_cycles/);
assert.match(service, /customer_organisation_id|organisation_id/);
assert.match(service, /INSERT INTO order_corrections/);
assert.match(service, /before_snapshot, after_snapshot/);
assert.match(service, /existingPrices\.get\(Number\(service\.id\)\) \?\? Number\(service\.price\)/);
assert.match(service, /Replaced by corrected order/);
assert.doesNotMatch(service, /DELETE FROM orders/);

assert.match(routes, /\/api\/orders\/:id\/correction-eligibility/);
assert.match(routes, /\/api\/orders\/:id\/correct"/);
assert.match(routes, /\/api\/orders\/:id\/corrected-copy/);
assert.match(routes, /requireSiteRole\(req, res, order\.siteId, \["owner", "manager"\]\)/);

assert.match(component, /<fieldset/);
assert.match(component, /correction_audit_notice/);
assert.match(component, /paid_order_correction_locked/);
assert.match(component, /data-testid="button-correct-order"/);
assert.match(orderDetail, /OrderCorrectionActions/);
assert.match(orderDetail, /data-testid="order-correction-history"/);
assert.match(orderDetail, /correctionSummary/);

console.log("Controlled order correction regression checks passed");
