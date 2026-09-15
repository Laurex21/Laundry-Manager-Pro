import fs from "node:fs";
import assert from "node:assert/strict";

const customers = fs.readFileSync("client/src/pages/customers.tsx", "utf8");
const orders = fs.readFileSync("client/src/pages/orders.tsx", "utf8");
const payments = fs.readFileSync("client/src/pages/payments.tsx", "utf8");

assert.match(customers, /data-testid="customers-page-redesign"/, "Customers must expose the redesigned page marker");
assert.match(customers, /bg-\[#082D5B\]/, "Customers desktop details must use the navy visual hierarchy");
assert.match(customers, /\{symbol\}\{Number\(\(customer as any\)\.creditBalance\)\.toLocaleString\(\)\}/, "Customer credit must use the localized currency format");
assert.match(orders, /data-testid="new-order-dialog"[^>]+bg-\[#F8FAFC\]/, "Order creation must use the neutral operational canvas");
assert.match(orders, /DialogTitle className="text-\[#082D5B\]"/, "Order creation must expose the navy fixed title");
assert.match(payments, /order-1 overflow-hidden[^\n]+lg:order-2/, "Mobile payments must surface the unpaid queue before the form");
assert.match(payments, /order-2 overflow-hidden[^\n]+lg:order-1/, "The payment form must retain desktop priority");
assert.match(payments, /button-print-thermal-receipt/, "Thermal printing must remain available");
assert.match(orders, /button-send-order-confirmation-whatsapp/, "Order confirmation workflow must remain available");

console.log("Core operations redesign checks passed.");
