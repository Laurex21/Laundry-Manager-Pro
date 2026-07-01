import assert from "node:assert/strict";
import { generateDepositReceipt } from "../../client/src/lib/receipt";
import { DEFAULT_SETTINGS } from "../../client/src/lib/receipt-settings";

let capturedBlob: Blob | null = null;

const originalUrl = globalThis.URL;
(globalThis as any).URL = {
  ...originalUrl,
  createObjectURL(blob: Blob) {
    capturedBlob = blob;
    return "blob:test";
  },
  revokeObjectURL() {},
};

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

assert.ok(capturedBlob, "receipt download should create a blob");
const html = await capturedBlob.text();

assert.match(html, /Date de commande<\/div><div class="value">30\/06\/2026 • 22h00/);
assert.match(html, /Retrait prévu<\/div><div class="value">04\/07\/2026<\/div>/);
assert.doesNotMatch(html, /Retrait prévu<\/div><div class="value">04\/07\/2026 • 0[01]h00/);
assert.doesNotMatch(html, /Date de commande<\/div><div class="value">30\/06\/2026 • 0[01]h00/);

console.log("receipt date regression tests passed");
