import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { generateDepositReceipt } from "../../client/src/lib/receipt";
import { DEFAULT_SETTINGS } from "../../client/src/lib/receipt-settings";
import { createOrderReference } from "./order-reference";
import { orderDisplayId } from "../../client/src/lib/order-display";
const date = new Date("2026-12-31T23:30:00Z");
const reference = createOrderReference(42, "Laurepressing", date);
assert.match(reference, /^LP-27-[2-9A-HJ-NP-Z]{7}$/);
assert.equal(createOrderReference(42, "Laurepressing", date), reference);
assert.match(createOrderReference(1, "Étoile Pro", date), /^EP-/);
assert.equal(new Set(Array.from({length: 100000}, (_,i) => createOrderReference(i+1,"Same site",date))).size, 100000);
assert.throws(() => createOrderReference(0,"X",date));
assert.equal(orderDisplayId({id:42,orderReference:reference,orderNumber:2}), reference);
assert.equal(orderDisplayId({id:42,orderNumber:2}),2);
const pg = new PGlite();
try {
  await pg.exec("CREATE TABLE orders(id serial primary key, total_amount numeric); INSERT INTO orders(total_amount) VALUES(2000)");
  const migration = await readFile(new URL("../../migrations/20261025_order_references.sql",import.meta.url),"utf8");
  await pg.exec(migration); await pg.exec(migration);
  assert.deepEqual((await pg.query("SELECT * FROM orders")).rows,[{id:1,total_amount:"2000",order_reference:null}]);
  await pg.query("INSERT INTO orders(order_reference) VALUES($1)",[reference]);
  await assert.rejects(pg.query("INSERT INTO orders(order_reference) VALUES($1)",[reference]));
  await pg.exec("INSERT INTO orders(order_reference) VALUES(NULL)");
} finally {await pg.close();}
console.log("PASS: unique references, Douala year, accents, legacy display, idempotent additive migration");

let captured = {html: "", filename: ""};
(globalThis as any).__captureReceiptHtml = (html: string, filename: string) => {captured = {html, filename};};
try {
  for (const receiptLanguage of ["fr", "en"] as const) {
    await generateDepositReceipt({id:42, orderReference:reference, orderNumber:2, totalAmount:"1000", customer:{name:"QA"}, items:[], garmentItems:[],payments:[], status:"received"}, "FCFA", {...DEFAULT_SETTINGS,receiptLanguage}, "html");
    assert.ok(captured.html.includes(`#${reference}`));
    assert.equal(captured.filename, `deposit-receipt-order-${reference}.html`);
  }
} finally { delete (globalThis as any).__captureReceiptHtml; }
console.log("PASS: FR/EN receipt content and filenames use the permanent reference");
