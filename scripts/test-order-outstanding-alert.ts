import fs from "node:fs";
import assert from "node:assert/strict";

const orders = fs.readFileSync("client/src/pages/orders.tsx", "utf8");
const payments = fs.readFileSync("client/src/pages/payments.tsx", "utf8");

assert.match(orders, /order\.paymentStatus === "paid"/);
const outstandingBlock = orders.slice(orders.indexOf("const customerOutstanding"), orders.indexOf("const selectedCustomer ="));
assert.doesNotMatch(outstandingBlock, /order\.payments \|\| \[\]/);
assert.match(orders, /\/payments\?view=register&customerId=/);
assert.match(orders, /variant="ghost" size="icon"/);
assert.match(payments, /requestedCustomerId/);
assert.match(payments, /setSelectedOrderId\(customerOrder\.id\)/);

console.log("Order outstanding alert regression checks passed.");
