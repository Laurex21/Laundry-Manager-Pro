import assert from "node:assert/strict";
import { STARTER_SETTINGS_FIELDS, starterReceiptSettings } from "../../shared/starter-receipt";
import { DEFAULT_SETTINGS, receiptSettingsForOrder } from "../../client/src/lib/receipt-settings";
import { generateDepositReceipt, generatePaymentReceipt, generateThermalDepositReceipt, generateThermalPaymentReceipt } from "../../client/src/lib/receipt";

const saved = {
  ...DEFAULT_SETTINGS, businessName: "Pressing fictif", receiptLanguage: "fr",
  termsOfService: "CONDITIONS_TEST", phone: "PRIVATE_PHONE", address: "PRIVATE_ADDRESS", logoBase64: "PRIVATE_LOGO",
};
const site = { id: 10, name: "Boutique fictive" };
const order = {
  id: 999, customer: { name: "Client test" }, createdAt: "2026-10-31T09:00:00Z",
  items: [{ quantity: 2, priceAtOrder: "1000", service: { name: "Chemise", unit: "piece" } }],
  garmentItems: [], totalAmount: "2000", paymentStatus: "partial",
};
const payment = { amount: "500", method: "cash", date: order.createdAt, newStatus: "partial" };
const standard = starterReceiptSettings(saved);
assert.deepEqual(starterReceiptSettings(standard), standard);
assert.equal(saved.businessName, "Pressing fictif");
assert.equal(standard.businessName, "XpressPro");
assert.equal(standard.showTerms, false);
assert.match(standard.logoBase64, /^data:image\/svg\+xml;base64,/);
assert.ok(!STARTER_SETTINGS_FIELDS.includes("businessName"));
assert.ok(!STARTER_SETTINGS_FIELDS.includes("logoBase64"));

let html = "";
const capture = (value: string) => { html = value; };
const printWindow = { document: { open() {}, write: capture, close() {}, getElementById: () => null }, focus() {} } as unknown as Window;
function assertStandardReceipt() {
  assert.match(html, /<(?:h1[^>]*|div class="business")>XpressPro<\//);
  assert.doesNotMatch(html, /Pressing fictif|Boutique fictive|Service assuré par|Conditions Générales|CONDITIONS_TEST|PRIVATE_|NaN|undefined/);
  html = "";
}
(globalThis as any).__captureReceiptHtml = capture;
try {
  for (const settings of [
    receiptSettingsForOrder(standard, "fr", site.id, site, []),
    receiptSettingsForOrder(saved, "fr", site.id, null, [site], "starter"), // Paid settings cached before downgrade.
    receiptSettingsForOrder(undefined, "fr", site.id, site, [], "starter"), // First print while settings are loading.
  ]) {
    await generateDepositReceipt(order, "FCFA ", settings, "html");
    assertStandardReceipt();
    await generatePaymentReceipt(order.id, order.customer, order.items, [], payment, [payment], order.createdAt, "", 0, "FCFA ", settings, 0, "html");
    assertStandardReceipt();
    generateThermalDepositReceipt(order, "FCFA ", settings, printWindow);
    assertStandardReceipt();
    generateThermalPaymentReceipt(order.id, order.customer, order.items, [], payment, [payment], order.createdAt, 0, "FCFA ", settings, 0, printWindow);
    assertStandardReceipt();
  }
  for (const plan of ["pro", "business"]) {
    const settings = receiptSettingsForOrder(saved, "fr", site.id, site, [], plan);
    await generateDepositReceipt(order, "FCFA ", settings, "html");
    assert.match(html, /<h1[^>]*>Boutique fictive<\/h1>/);
    assert.equal(receiptSettingsForOrder(saved, "fr", null, null, [], plan).businessName, saved.businessName);
  }
} finally {
  delete (globalThis as any).__captureReceiptHtml;
}
console.log("Starter settings, A4 and thermal deposit/payment receipts, plan downgrade and paid branding passed.");
