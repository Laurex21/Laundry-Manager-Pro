import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const receipt = readFileSync(join(root, "client/src/lib/receipt.ts"), "utf8");
const ordersPage = readFileSync(join(root, "client/src/pages/orders.tsx"), "utf8");
const orderDetailPage = readFileSync(join(root, "client/src/pages/order-detail.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");
const paymentsPage = readFileSync(join(root, "client/src/pages/payments.tsx"), "utf8");
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");

assert.match(receipt, /const displayOrderId = orderDisplayId\(order\);/);
assert.match(receipt, /getReceiptContactLines\(settings, displayOrderId, lang\)/);
assert.match(receipt, /deposit-receipt-order-\$\{displayOrderId\}\.html/);
assert.match(receipt, /Registered by/);
assert.match(receipt, /Payment received by/);
assert.match(receipt, /agentFirstName\(payment\.agentName\)/);
assert.match(receipt, /function garmentItemTotal/);
assert.match(receipt, /Total Registered Items/);
assert.match(receipt, /Unit Cost/);
assert.match(receipt, /Total Cost/);
assert.match(receipt, /colspan="4"/);
assert.match(ordersPage, /watchedGarmentItems/);
assert.match(ordersPage, /totalRegisteredGarments/);
assert.match(ordersPage, /text-total-registered-garments/);
assert.match(orderDetailPage, /text-order-total-registered-garments/);
assert.match(i18n, /total_registered_items/);
assert.match(paymentsPage, /paymentId\?: number/);
assert.match(paymentsPage, /currentPayment\?\.collectedByEmployee\?\.name/);
assert.match(storage, /createdByEmployee: order\.createdByEmployeeId/);
assert.match(storage, /collectedByEmployee: payment\.collectedByEmployeeId/);
assert.match(schema, /PaymentWithEmployee/);
assert.doesNotMatch(receipt, /getReceiptContactLines\(settings, order\.id, lang\)/);
assert.doesNotMatch(receipt, /deposit-receipt-order-\$\{order\.id\}\.html/);

console.log("receipt display id regression tests passed");
