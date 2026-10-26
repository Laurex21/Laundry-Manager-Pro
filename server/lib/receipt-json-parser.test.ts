import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import express from 'express';
import { receiptJsonParser } from './receipt-json-parser';
import { orderReceiptMessages } from '../../client/src/lib/order-receipt-messages';

async function parse(parser: ReturnType<typeof express.json>, html: string) {
  const body = Buffer.from(JSON.stringify({ orderId: 1, kind: 'deposit', html }));
  const req = Readable.from([body]) as any;
  req.headers = { 'content-type': 'application/json', 'content-length': String(body.length) };
  req.method = 'POST'; req.url = '/api/receipt-snapshots';
  return new Promise<any>(resolve => parser(req, {} as any, error => resolve({ error, req, body })));
}
// A realistic embedded logo exceeded the previous 250 KiB global parser limit.
const html = '<html><img src="data:image/png;base64,' + 'A'.repeat(350_000) + '"></html>';
assert.equal((await parse(express.json({ limit: '250kb' }), html)).error.status, 413);
const receipt = await parse(receiptJsonParser, html);
assert.equal(receipt.error, undefined);
assert.equal(receipt.req.body.html, html);
assert.deepEqual(receipt.req.rawBody, receipt.body);
assert.equal((await parse(receiptJsonParser, 'x'.repeat(3 * 1024 * 1024))).error.status, 413);
for (const language of ['fr', 'fr-CM', 'en']) {
  const message = orderReceiptMessages(language);
  assert.notEqual(message.receiptTitle, message.coverageTitle);
  assert.ok(message.receiptDescription.length > 50);
}
console.log('Receipt body size regression passed: logo receipt accepted, oversized body rejected, FR/EN messages distinct.');
