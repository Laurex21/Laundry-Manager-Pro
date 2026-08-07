import assert from "node:assert/strict";
import { generateDepositReceipt } from "../../client/src/lib/receipt";
import { DEFAULT_SETTINGS } from "../../client/src/lib/receipt-settings";

let capturedHtml = "";
(globalThis as any).document = {
  createElement() { return { click() {}, set href(_value: string) {}, set download(_value: string) {} }; },
  body: { appendChild() {}, removeChild() {} },
};
(globalThis as any).__captureReceiptHtml = (html: string) => { capturedHtml = html; };

await generateDepositReceipt({
  id: 91,
  createdAt: "2026-08-07T12:00:00.000Z",
  customer: { name: "Cliente E2E", phone: "000" },
  items: [],
  garmentItems: [],
  payments: [],
  paymentStatus: "unpaid",
  status: "received",
  totalAmount: "60.00",
  stainTreatments: [
    { level: "standard", unit: "piece", quantity: "1", capturedRate: "10.00", lineTotal: "10.00", adjustments: [] },
    { level: "intensive", unit: "kg", quantity: "1", capturedRate: "20.00", lineTotal: "20.00", adjustments: [{ action: "adjustment", reason: "Mais produto", quantityEffect: "1", amountEffect: "20.00" }] },
    { level: "very_intensive", unit: "piece", quantity: "1", capturedRate: "30.00", lineTotal: "30.00", acknowledgementTextVersion: "v1", adjustments: [{ action: "void", reason: "Cancelado", quantityEffect: "-1", amountEffect: "-30.00" }] },
  ],
}, "R", { ...DEFAULT_SETTINGS, receiptLanguage: "pt", showTerms: false, showLogo: false }, "download");

assert.match(capturedHtml, /Tratamento de manchas padrão/);
assert.match(capturedHtml, /Tratamento de manchas intensivo/);
assert.match(capturedHtml, /Tratamento de manchas muito intensivo/);
assert.match(capturedHtml, /não garante a remoção completa da mancha/);
assert.match(capturedHtml, /Ajuste: Mais produto/);
assert.match(capturedHtml, /Anulado: Cancelado/);
assert.doesNotMatch(capturedHtml, />Standard stain treatment</);
assert.doesNotMatch(capturedHtml, />Voided:/);

console.log("Portuguese stain-treatment receipt regression checks passed");
