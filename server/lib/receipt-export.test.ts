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
assert.equal(receiptExportSize(680, 1400, true).scale, 2);
assert.equal(receiptExportSize(680, 1400, true).height, 1400);
assert.ok(680 * 1400 * receiptExportSize(680, 1400, true).scale ** 2 < 4_000_000);
for (const dimensions of [[0, 100], [-1, 100], [NaN, 50], [680, Infinity]]) {
  assert.throws(() => receiptExportSize(...dimensions as [number, number]), /Invalid receipt dimensions/);
}
assert.throws(() => receiptExportSize(680, 10000), /RECEIPT_TOO_LARGE/);
assert.throws(() => receiptExportSize(680, 10000, true), /RECEIPT_TOO_LARGE/);
console.log('Receipt export resolution and overflow checks passed');

// Preserve six-decimal weights while removing storage-only trailing zeros.
const { receiptQuantity } = await import('../../client/src/lib/receipt-quantity');
assert.equal(receiptQuantity('1.000000','fr'), '1');
assert.equal(receiptQuantity('5.000000','en'), '5');
assert.equal(receiptQuantity('2.125000','fr'), '2,125');
assert.equal(receiptQuantity('2.125000','en'), '2.125');
assert.equal(receiptQuantity('0.000001','fr'), '0,000001');
assert.equal(receiptQuantity('0.000000','fr'), '0');
const { generateDepositReceipt, generatePaymentReceipt } = await import('../../client/src/lib/receipt');
const { DEFAULT_SETTINGS, receiptSettingsForOrder } = await import('../../client/src/lib/receipt-settings');
const xpressSite = { id: 14, name: 'Xpress 0' };
const otherSite = { id: 15, name: 'Autre agence' };
const companySettings = { businessName: 'Xpress Clean' };
assert.equal(receiptSettingsForOrder(companySettings, 'fr', 14, xpressSite, []).businessName, 'Xpress 0');
assert.equal(receiptSettingsForOrder(companySettings, 'fr', 14, otherSite, [xpressSite]).businessName, 'Xpress 0');
assert.equal(receiptSettingsForOrder(companySettings, 'fr', 14, otherSite, []).businessName, 'Xpress Clean');
const starter = receiptSettingsForOrder({ businessName: 'XpressPro', starterServiceProvider: '' }, 'fr', 14, xpressSite, []);
assert.equal(starter.businessName, 'XpressPro');
assert.equal(starter.starterServiceProvider, 'Xpress 0');
let receiptHtml = '';
(globalThis as any).__captureReceiptHtml = (html: string) => { receiptHtml = html; };
const items = [{quantity:'2.125000',priceAtOrder:'1000',service:{name:'Lavage',unit:'kg'}}];
try {
  for(const receiptLanguage of ['fr','en']) {
    const settings = receiptSettingsForOrder({ ...DEFAULT_SETTINGS, ...companySettings, receiptLanguage }, 'fr', 14, xpressSite, []);
    const payment = { amount: '100', method: 'Cash', date: '2026-10-26', newStatus: 'partial' };
    const payments = [payment, { ...payment, method: 'Chipper Cash' }];
    await generateDepositReceipt({id:1,items,garmentItems:[{quantity:'1.000000',itemName:'Chemise'}],payments,customer:{}},'FCFA',settings,'html');
    assert.ok(receiptHtml.includes(receiptLanguage==='fr'?'2,125 kg':'2.125 kg'));
    assert.ok(receiptHtml.includes('1 x Chemise'));
    assert.ok(!receiptHtml.includes('1.000000'));
    assert.ok(receiptHtml.includes(`&bull; ${receiptLanguage === 'fr' ? 'Espèces' : 'Cash'}<`));
    await generatePaymentReceipt('DP-26-TEST',{},items,[],{ ...payment, method: 'cash' },payments,'2026-10-26','2026-10-29',0,'FCFA',settings,0,'html');
    assert.ok(receiptHtml.includes(receiptLanguage==='fr'?'2,125 kg':'2.125 kg'));
    assert.ok(!receiptHtml.includes('2.125000'));
    assert.match(receiptHtml, /<h1[^>]*>Xpress 0<\/h1>/);
    assert.ok(!receiptHtml.includes('Xpress Clean'));
    assert.ok(receiptHtml.includes(receiptLanguage === 'fr' ? 'Méthode: Espèces' : 'Method: Cash'));
    assert.ok(receiptHtml.includes(`&bull; ${receiptLanguage === 'fr' ? 'Espèces' : 'Cash'}<`));
    assert.ok(receiptHtml.includes('Chipper Cash'));
  }
} finally {delete (globalThis as any).__captureReceiptHtml;}
console.log('Receipt quantities: integer and fractional precision preserved in FR/EN deposit and payment HTML.');
