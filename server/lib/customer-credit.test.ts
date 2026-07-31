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
const ordersPage = readFileSync(join(root, "client/src/pages/orders.tsx"), "utf8");
const paymentHooks = readFileSync(join(root, "client/src/hooks/use-payments.ts"), "utf8");
const receipt = readFileSync(join(root, "client/src/lib/receipt.ts"), "utf8");
const orderDetail = readFileSync(join(root, "client/src/pages/order-detail.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");

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
assert.match(paymentsPage, /selectedOrder as any\)\?\.customer\?\.creditBalance/);
assert.match(paymentsPage, /aria-live="polite"[\s\S]*customer-credit-panel/);
assert.match(paymentsPage, /payment-surplus-dialog/);
assert.match(paymentsPage, /button-correct-payment-amount/);
assert.match(paymentsPage, /button-return-surplus/);
assert.match(paymentsPage, /button-credit-surplus/);
assert.match(paymentsPage, /recordPayment\("credit"\)/);
assert.match(paymentsPage, /paymentSubmissionLock\.current \|\| isPending/);
assert.match(paymentsPage, /paymentSubmissionLock\.current = true/);
assert.match(paymentsPage, /onError:[\s\S]*paymentSubmissionLock\.current = false/);
assert.match(paymentsPage, /surplusDisposition/);
assert.match(ordersPage, /new-order-customer-credit-alert/);
assert.match(ordersPage, /customer_credit_payment_prompt/);
assert.match(paymentHooks, /query\.queryKey\[2\] === "credit"/);
assert.match(paymentHooks, /analytics\/credit-summary/);
assert.match(receipt, /Available customer credit \(not applied\)/);
assert.match(receipt, /creditApplied: Number\(payment\.creditApplied/);
assert.match(receipt, /creditBalance: Number\(payment\.creditBalance/);
assert.match(orderDetail, /stage-machine-save-hint/);
assert.match(i18n, /machine_assignment_save_hint/);
assert.match(creditTab, /userRole === "owner" \|\| userRole === "manager"/);
assert.match(creditTab, /credit-transaction-/);

console.log("Customer credit regression checks passed");
