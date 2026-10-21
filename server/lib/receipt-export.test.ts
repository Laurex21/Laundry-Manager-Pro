import assert from 'node:assert/strict';
import { receiptExportSize } from '../../client/src/lib/receipt-export';

for (const [width, height] of [[680, 900], [680, 1800], [794, 2400], [680, 4500]]) {
  const result = receiptExportSize(width, height);
  assert.equal(result.width, width);
  assert.equal(result.height, height); // No truncation of long invoices.
  assert.ok(result.scale >= 2 && result.scale <= 4);
  assert.ok(width * height * result.scale ** 2 <= 16_000_001);
  assert.ok(Math.max(width, height) * result.scale <= 16384);
}
assert.equal(receiptExportSize(680, 900).scale, 4);
for (const dimensions of [[0, 100], [-1, 100], [NaN, 50], [680, Infinity]]) {
  assert.throws(() => receiptExportSize(...dimensions as [number, number]), /Invalid receipt dimensions/);
}
assert.throws(() => receiptExportSize(680, 10000), /RECEIPT_TOO_LARGE/);
console.log('Receipt export resolution and overflow checks passed');
