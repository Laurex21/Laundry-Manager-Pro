import fs from "node:fs";
import assert from "node:assert/strict";

const orders = fs.readFileSync("client/src/pages/orders.tsx", "utf8");
const picker = fs.readFileSync("client/src/components/garment-color-picker.tsx", "utf8");
const schema = fs.readFileSync("shared/schema.ts", "utf8");
const routes = fs.readFileSync("shared/routes.ts", "utf8");
const storage = fs.readFileSync("server/storage.ts", "utf8");

assert.match(orders, /DialogClose asChild/);
assert.match(orders, /customer-outstanding-alert/);
assert.match(orders, /garmentItems\.\$\{index\}\.textileReserve/);
assert.doesNotMatch(orders, /id="textile-reserve"/);
assert.match(picker, /<Dialog open=\{open\} onOpenChange=\{setOpen\}>/);
assert.match(schema, /textileReserve: text\("textile_reserve"\)/);
assert.match(routes, /textileReserve: z\.string\(\)\.trim\(\)\.max\(500\)/);
assert.match(storage, /textileReserve: garment\.textileReserve \|\| null/);

console.log("Order wizard polish regression checks passed.");
