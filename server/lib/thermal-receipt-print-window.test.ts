import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const receipt = readFileSync(join(root, "client/src/lib/receipt.ts"), "utf8");
const payments = readFileSync(join(root, "client/src/pages/payments.tsx"), "utf8");
const orderDetail = readFileSync(join(root, "client/src/pages/order-detail.tsx"), "utf8");

assert.match(receipt, /export function reserveReceiptPrintWindow/);
assert.match(receipt, /export function renderReceiptInPrintWindow/);
const thermalReceiptBuilder = receipt.slice(receipt.indexOf("function buildThermalReceiptHtml"), receipt.indexOf("function openReceiptPrintWindow"));
assert.doesNotMatch(thermalReceiptBuilder, /onclick="window\.print\(\)"/);
assert.match(receipt, /getElementById\("receipt-print-button"\)/);
assert.match(receipt, /printButton\.addEventListener\("click", \(\) => win\.print\(\)\)/);
assert.match(payments, /const receiptWindow = action === "thermal" \? reserveReceiptPrintWindow\(\) : null/);
assert.ok(payments.indexOf("reserveReceiptPrintWindow()") < payments.indexOf("await fetch(`/api/orders/${successPayment.orderId}`"));
assert.ok(orderDetail.indexOf("const receiptWindow = reserveReceiptPrintWindow()") < orderDetail.indexOf("await fetch(`/api/orders/${orderId}/subscriber-receipt?format=thermal80`"));
assert.doesNotMatch(orderDetail, /receiptWindow\.print\(\)/);
assert.match(orderDetail, /renderReceiptInPrintWindow\(receiptWindow, await subscriberReceipt\.text\(\)\)/);

console.log("thermal receipt print-window regression tests passed");
