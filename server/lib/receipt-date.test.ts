import assert from "node:assert/strict";
import { generateDepositReceipt } from "../../client/src/lib/receipt";
import { DEFAULT_SETTINGS } from "../../client/src/lib/receipt-settings";

let capturedHtml = "";
let capturedFilename = "";

(globalThis as any).document = {
  createElement() {
    return {
      click() {},
      set href(_value: string) {},
      set download(_value: string) {},
    };
  },
  body: {
    appendChild() {},
    removeChild() {},
  },
};

(globalThis as any).__captureReceiptPdfHtml = (html: string, filename: string) => {
  capturedHtml = html;
  capturedFilename = filename;
};

generateDepositReceipt({
  id: 26,
  siteOrderNumber: 26,
  createdAt: "2026-06-30T22:00:00.000",
  entryDate: "2026-06-30T00:00:00.000Z",
  pickupDate: "2026-07-04T00:00:00.000Z",
  customer: { name: "M. BOKO", phone: "600000000" },
  items: [],
  garmentItems: [],
  payments: [],
  paymentStatus: "unpaid",
  status: "received",
}, "FCFA ", {
  ...DEFAULT_SETTINGS,
  businessName: "SODELAND PRESSING",
  receiptLanguage: "fr",
  showTerms: false,
  showLogo: false,
}, "download");

assert.equal(capturedFilename, "deposit-receipt-order-26.pdf");
assert.ok(capturedHtml, "receipt download should render HTML into a PDF");

assert.match(capturedHtml, /Date de commande<\/div><div class="value">30\/06\/2026 • 22h00/);
assert.match(capturedHtml, /Retrait prévu<\/div><div class="value">04\/07\/2026<\/div>/);
assert.doesNotMatch(capturedHtml, /Retrait prévu<\/div><div class="value">04\/07\/2026 • 0[01]h00/);
assert.doesNotMatch(capturedHtml, /Date de commande<\/div><div class="value">30\/06\/2026 • 0[01]h00/);

console.log("receipt date regression tests passed");
