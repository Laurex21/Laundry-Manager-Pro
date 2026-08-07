import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findCompositePaymentReplay } from "./composite-payment-idempotency";
import { fingerprintRequest, OrderMoneyConflictError } from "./order-money";

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
assert.match(paymentsPage, /max-w-xl overflow-hidden/);
assert.match(paymentsPage, /sm:grid-cols-3 sm:space-x-0/);
assert.match(paymentsPage, /whitespace-normal/);
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

const basePayment = {
  orderId: 44,
  amountReceived: "6.00",
  method: "cash",
  creditToApply: "4.00",
  surplusDisposition: "return" as const,
  idempotencyKey: "composite-payment-001",
  organisationId: 1,
  siteId: 2,
  actorUserId: "actor-1",
  collectedByEmployeeId: null,
};
function compositeFingerprint(input: typeof basePayment, amount: string, method: string) {
  return fingerprintRequest({
    orderId: input.orderId,
    amount,
    method,
    reference: null,
    paymentDate: null,
    isAdvance: false,
    context: {
      amountReceived: input.amountReceived,
      creditToApply: input.creditToApply,
      surplusDisposition: input.surplusDisposition,
    },
  }, { moneyPaths: ["amount", "context.amountReceived", "context.creditToApply"] });
}
function replayClient(input: typeof basePayment, legs: Array<{ id: number; suffix: "cash" | "credit"; amount: string; method: string }>) {
  return {
    async query(text: string) {
      if (text.includes("FROM payments")) return {
        rows: legs.map((leg) => ({
          id: leg.id,
          amount: leg.amount,
          method: leg.method,
          idempotency_key: `${input.idempotencyKey}:${leg.suffix}`,
          request_fingerprint: compositeFingerprint(input, leg.amount, leg.method),
        })),
        rowCount: legs.length,
      };
      if (text.includes("FROM credit_transactions")) return {
        rows: legs.some((leg) => leg.suffix === "credit") ? [{ type: "debit", amount: input.creditToApply }] : [],
        rowCount: legs.some((leg) => leg.suffix === "credit") ? 1 : 0,
      };
      throw new Error(`Unexpected replay query: ${text}`);
    },
  };
}

const cashOnlyInput = { ...basePayment, amountReceived: "10.00", creditToApply: "0.00" };
const cashReplay = await findCompositePaymentReplay(
  replayClient(cashOnlyInput, [{ id: 1, suffix: "cash", amount: "10.00", method: "cash" }]),
  cashOnlyInput,
  "3.00",
  "paid",
);
assert.equal(cashReplay?.idempotentReplay, true);
assert.equal(cashReplay?.cashApplied, "10.00");

const creditOnlyInput = { ...basePayment, amountReceived: "0.00", creditToApply: "10.00" };
const creditReplay = await findCompositePaymentReplay(
  replayClient(creditOnlyInput, [{ id: 2, suffix: "credit", amount: "10.00", method: "Client Credit" }]),
  creditOnlyInput,
  "15.00",
  "paid",
);
assert.equal(creditReplay?.idempotentReplay, true);
assert.equal(creditReplay?.creditApplied, "10.00");

const mixedReplay = await findCompositePaymentReplay(
  replayClient(basePayment, [
    { id: 3, suffix: "cash", amount: "6.00", method: "cash" },
    { id: 4, suffix: "credit", amount: "4.00", method: "Client Credit" },
  ]),
  basePayment,
  "11.00",
  "paid",
);
assert.equal(mixedReplay?.idempotentReplay, true);
assert.equal(mixedReplay?.cashApplied, "6.00");
assert.equal(mixedReplay?.creditApplied, "4.00");

await assert.rejects(
  findCompositePaymentReplay(
    replayClient(basePayment, [
      { id: 3, suffix: "cash", amount: "6.00", method: "cash" },
      { id: 4, suffix: "credit", amount: "4.00", method: "Client Credit" },
    ]),
    { ...basePayment, amountReceived: "7.00" },
    "11.00",
    "paid",
  ),
  (error: unknown) => error instanceof OrderMoneyConflictError && error.statusCode === 409,
);

console.log("Customer credit regression checks passed");
