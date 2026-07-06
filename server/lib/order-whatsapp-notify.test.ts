import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const orderDetailPage = readFileSync(join(root, "client/src/pages/order-detail.tsx"), "utf8");
const ordersPage = readFileSync(join(root, "client/src/pages/orders.tsx"), "utf8");

assert.match(orderDetailPage, /MessageCircle/);
assert.match(orderDetailPage, /function normalizeWhatsAppPhone/);
assert.match(orderDetailPage, /if \(digits\.startsWith\("237"\)\) return digits/);
assert.match(orderDetailPage, /if \(digits\.startsWith\("6"\)\) return `237\$\{digits\}`/);
assert.match(orderDetailPage, /const canShowCustomerNotification = !\["cancelled", "canceled", "cancellation_requested"\]\.includes\(order\.status\)/);
assert.match(orderDetailPage, /data-testid="button-notify-customer-whatsapp"/);
assert.match(orderDetailPage, /function buildCustomerWhatsAppMessage/);
assert.doesNotMatch(orderDetailPage, /data-testid="button-send-order-confirmation-whatsapp"/);
assert.match(orderDetailPage, /await generateDepositReceipt\(order, symbol, mergedSettings, "download"\)/);
assert.match(orderDetailPage, /https:\/\/wa\.me\/\$\{readyWhatsAppPhone\}\?text=\$\{encodeURIComponent\(buildCustomerWhatsAppMessage\(\)\)\}/);
assert.match(orderDetailPage, /Votre commande \$\{businessName\} #\$\{displayId\} est actuellement à l'étape : \$\{stageLabel\}\./);
assert.match(orderDetailPage, /État facture : total \$\{totalText\}, payé \$\{paidText\}, solde \$\{balanceText\}\./);
assert.match(orderDetailPage, /Notifier Client/);
assert.match(orderDetailPage, /Votre reçu\/facture est joint à ce message/);
assert.match(orderDetailPage, /Your receipt\/invoice is attached to this message/);

assert.match(ordersPage, /function buildOrderConfirmationWhatsAppMessage/);
assert.match(ordersPage, /setCreatedOrder\(orderDetails\)/);
assert.match(ordersPage, /data-testid="button-send-order-confirmation-whatsapp"/);
assert.match(ordersPage, /Notifier Client/);
assert.match(ordersPage, /The receipt downloads first, then WhatsApp opens with a prefilled confirmation message/);
assert.match(ordersPage, /Your .* order #\$\{displayId\} has been registered/);
assert.match(ordersPage, /Votre commande .* #\$\{displayId\} a bien été enregistrée/);
assert.match(ordersPage, /await generateDepositReceipt\(createdOrder, symbol/);

console.log("order whatsapp notify regression tests passed");
