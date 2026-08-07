import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const service = readFileSync(join(root, "server/lib/order-corrections.ts"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const migration = readFileSync(join(root, "migrations/20260730_controlled_order_corrections.sql"), "utf8");
const component = readFileSync(join(root, "client/src/components/order-correction-actions.tsx"), "utf8");
const translations = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");
const orderDetail = readFileSync(join(root, "client/src/pages/order-detail.tsx"), "utf8");
const auth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");

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
assert.match(service, /to_regclass\('public\.production_cycle_orders'\)/);
assert.match(service, /available\.production_cycle_orders && available\.production_cycles/);
assert.match(service, /enabled \? `EXISTS\(\$\{sql\}\)` : "false"/);
assert.match(service, /before_snapshot, after_snapshot/);
assert.match(service, /existingPrices\.get\(Number\(service\.id\)\) \?\? String\(service\.price\)/);
assert.match(service, /calculateOrderTotals/);
assert.match(service, /Replaced by corrected order/);
assert.match(
  service,
  /order\.customer_id, actorEmployeeId, "received", order\.total_amount/,
  "A corrected replacement must restart at the received stage",
);
assert.doesNotMatch(service, /DELETE FROM orders/);

assert.match(routes, /\/api\/orders\/:id\/correction-eligibility/);
assert.match(routes, /Order correction eligibility failed/);
assert.match(routes, /Reference: \$\{reference\}/);
assert.match(routes, /\/api\/orders\/:id\/correct"/);
assert.match(routes, /\/api\/orders\/:id\/corrected-copy/);
assert.match(routes, /\/api\/orders\/:id\/paid-correction/);
assert.match(routes, /recordPaidCorrectionOutcome\(pool/);
assert.match(routes, /requireSiteRole\(req, res, order\.siteId, \["owner", "manager"\]\)/);

assert.match(component, /<fieldset/);
assert.match(component, /correction_audit_notice/);
assert.match(component, /paid_order_correction_locked/);
assert.match(component, /data-testid="button-correct-order"/);
assert.match(component, /data-testid="order-correction-loading"/);
assert.match(component, /data-testid="order-correction-error"/);
assert.match(component, /data-testid="order-correction-role-restricted"/);
assert.match(component, /refetchEligibility/);
assert.match(component, /eligibility\?\.canEdit/);
assert.match(translations, /order_correction_check_failed:/);
assert.match(translations, /retry:/);
assert.match(translations, /unknown_error:/);
assert.match(orderDetail, /OrderCorrectionActions/);
assert.match(orderDetail, /data-testid="order-correction-history"/);
assert.match(orderDetail, /correctionSummary/);
assert.match(auth, /CREATE TABLE IF NOT EXISTS production_cycles/);
assert.match(auth, /CREATE TABLE IF NOT EXISTS production_cycle_orders/);

console.log("Controlled order correction regression checks passed");
