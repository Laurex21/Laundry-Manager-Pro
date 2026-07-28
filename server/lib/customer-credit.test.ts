import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const service = readFileSync(join(root, "server/lib/customer-credit.ts"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const migration = readFileSync(join(root, "migrations/20260728_customer_credit.sql"), "utf8");
const paymentsPage = readFileSync(join(root, "client/src/pages/payments.tsx"), "utf8");
const creditTab = readFileSync(join(root, "client/src/components/customer-credit-tab.tsx"), "utf8");

assert.match(schema, /creditBalance: decimal\("credit_balance"/);
assert.match(schema, /export const creditTransactions = pgTable\("credit_transactions"/);
assert.match(schema, /idempotencyKey: varchar\("idempotency_key"/);
assert.doesNotMatch(schema, /creditTransactions[\s\S]{0,300}onDelete: "cascade"/);

assert.match(migration, /CHECK \(amount > 0\)/);
assert.match(migration, /balance_after = balance_before \+ amount/);
assert.match(migration, /balance_after = balance_before - amount/);
assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_idempotency/);
assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM|UPDATE customers SET/i);

assert.match(service, /await client\.query\("BEGIN"\)/);
assert.match(service, /FOR UPDATE OF o/);
assert.match(service, /FOR UPDATE OF c/);
assert.match(service, /await client\.query\("ROLLBACK"\)/);
assert.match(service, /customer_organisation_id !== input\.organisationId/);
assert.match(service, /credit_balance >= \$1::numeric/);
assert.match(service, /idempotentReplay: true/);
assert.doesNotMatch(service, /parseFloat|toFixed/);

assert.match(routes, /recordPaymentWithCredit/);
assert.match(routes, /requireSiteRole\(req, res, siteId, \["owner", "manager"\]\)/);
assert.match(routes, /JOIN sites s ON s\.id = c\.site_id[\s\S]*s\.organisation_id = \$1/);
assert.match(routes, /app\.get\("\/api\/customers\/:id\/credit"/);
assert.match(routes, /app\.post\("\/api\/customers\/:id\/credit"/);

assert.match(paymentsPage, /input-credit-to-apply/);
assert.match(paymentsPage, /payment-surplus-panel/);
assert.match(paymentsPage, /surplusDisposition/);
assert.match(creditTab, /userRole === "owner" \|\| userRole === "manager"/);
assert.match(creditTab, /credit-transaction-/);

console.log("Customer credit regression checks passed");
