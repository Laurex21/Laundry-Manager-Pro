import fs from "node:fs";
import assert from "node:assert/strict";

const orders = fs.readFileSync("client/src/pages/orders.tsx", "utf8");
const payments = fs.readFileSync("client/src/pages/payments.tsx", "utf8");

assert.match(orders, /data-testid="orders-page-redesign"/);
assert.match(orders, /bg-\[#082D5B\] text-xs font-semibold uppercase/);
assert.match(orders, /StatusBadge status=\{order\.paymentStatus\}/);
assert.match(orders, /STATUS_SELECT_COLORS/);

assert.match(payments, /data-testid="payments-page-redesign"/);
assert.match(payments, /data-testid="payment-ledger-redesign"/);
assert.match(payments, /bg-\[#082D5B\] text-white/);
assert.match(payments, /paymentStatus === "paid"/);
assert.match(payments, /recordPayment\("credit"\)/);

console.log("Orders and payments visual redesign regression checks passed.");
