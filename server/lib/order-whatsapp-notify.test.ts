import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const orderDetailPage = readFileSync(join(root, "client/src/pages/order-detail.tsx"), "utf8");

assert.match(orderDetailPage, /MessageCircle/);
assert.match(orderDetailPage, /function normalizeWhatsAppPhone/);
assert.match(orderDetailPage, /if \(digits\.startsWith\("237"\)\) return digits/);
assert.match(orderDetailPage, /if \(digits\.startsWith\("6"\)\) return `237\$\{digits\}`/);
assert.match(orderDetailPage, /const canNotifyCustomer = order\.status === "ready"/);
assert.match(orderDetailPage, /data-testid="button-notify-customer-whatsapp"/);
assert.match(orderDetailPage, /generateDepositReceipt\(order, symbol, mergedSettings, "download"\)/);
assert.match(orderDetailPage, /https:\/\/wa\.me\/\$\{readyWhatsAppPhone\}\?text=\$\{encodeURIComponent\(buildReadyWhatsAppMessage\(\)\)\}/);
assert.match(orderDetailPage, /Votre reçu\/facture est joint à ce message/);
assert.match(orderDetailPage, /Your receipt\/invoice is attached to this message/);

console.log("order whatsapp notify regression tests passed");
