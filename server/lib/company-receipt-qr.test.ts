import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateDepositReceipt } from "../../client/src/lib/receipt";
import { DEFAULT_SETTINGS } from "../../client/src/lib/receipt-settings";
import { generateSubscriberReceiptHTML, generateSubscriptionPaymentReceiptHTML } from "./subscription-receipt";

const root = process.cwd();
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
const settingsPage = readFileSync(join(root, "client/src/pages/settings.tsx"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");

assert.match(schema, /receiptQrCodeBase64: text\("receipt_qr_code_base64"\)/);
assert.match(storage, /ADD COLUMN IF NOT EXISTS receipt_qr_code_base64 text/);
assert.match(settingsPage, /button-generate-receipt-qr/);
assert.match(settingsPage, /button-upload-receipt-qr/);
assert.match(settingsPage, /input-receipt-qr-label/);
assert.match(routes, /Invalid QR code image/);
assert.match(routes, /Invalid QR code destination/);

const qrImage = "data:image/png;base64,TEST-COMPANY-QR";
let capturedHtml = "";
(globalThis as any).__captureReceiptHtml = (html: string) => { capturedHtml = html; };

generateDepositReceipt({
  id: 71,
  siteOrderNumber: 71,
  createdAt: "2026-08-31T10:00:00.000Z",
  customer: { name: "Client Test", phone: "600000000" },
  items: [], garmentItems: [], payments: [], status: "received",
}, "FCFA ", {
  ...DEFAULT_SETTINGS,
  businessName: "Pressing Test",
  receiptLanguage: "fr",
  showTerms: false,
  receiptQrCodeBase64: qrImage,
  receiptQrCodeTarget: "https://wa.me/237600000000",
  receiptQrCodeLabel: "Scannez pour nous contacter",
}, "download");

assert.match(capturedHtml, /TEST-COMPANY-QR/);
assert.match(capturedHtml, /Scannez pour nous contacter/);

const subscriberData = {
  order: { id: 8, createdAt: new Date().toISOString() },
  customer: { name: "Client Test", phone: "600000000" },
  subscription: { membershipNumber: "MEM-1", remainingKg: 0, remainingPieces: 0, remainingOrders: 0 },
  plan: { name: "Essentiel", recurringPrice: 1000 },
  coverage: { extraAmount: 0, piecesConsumed: 1, kgConsumed: 0 },
  settings: { businessName: "Pressing Test", receiptQrCodeBase64: qrImage, receiptQrCodeLabel: "Notre WhatsApp" },
  items: [], garments: [], paymentSummary: { status: "paid", subscriptionCost: 1000, amountPaid: 1000, paymentDue: 0 },
};
assert.match(generateSubscriberReceiptHTML(subscriberData), /Notre WhatsApp/);
assert.match(generateSubscriptionPaymentReceiptHTML({
  ...subscriberData,
  payment: { id: 2, amount: 1000, paymentMethod: "Cash", paymentDate: new Date().toISOString() },
  paymentPosition: { cost: 1000, paid: 1000, due: 0 },
}), /TEST-COMPANY-QR/);

console.log("company receipt QR regression tests passed");
