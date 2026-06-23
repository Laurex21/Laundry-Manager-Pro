import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const receipt = readFileSync(join(root, "client/src/lib/receipt.ts"), "utf8");

assert.match(receipt, /const displayOrderId = orderDisplayId\(order\);/);
assert.match(receipt, /getReceiptContactLines\(settings, displayOrderId, lang\)/);
assert.match(receipt, /deposit-receipt-order-\$\{displayOrderId\}\.html/);
assert.doesNotMatch(receipt, /getReceiptContactLines\(settings, order\.id, lang\)/);
assert.doesNotMatch(receipt, /deposit-receipt-order-\$\{order\.id\}\.html/);

console.log("receipt display id regression tests passed");
