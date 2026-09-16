import fs from "node:fs";
import assert from "node:assert/strict";

const payments = fs.readFileSync("client/src/pages/payments.tsx", "utf8");
const customers = fs.readFileSync("client/src/pages/customers.tsx", "utf8");
const i18n = fs.readFileSync("client/src/lib/i18n.ts", "utf8");

assert.doesNotMatch(payments, /t\("record_payment"\)/, "Payments must not render the missing translation key");
assert.match(payments, /t\("register_payment"\)/, "Payments must use the existing translated label");
assert.match(payments, /const formatMoney =/, "Payments must centralize visible currency formatting");
assert.match(payments, /grid min-h-40 place-items-center/, "Payments must provide a useful empty selection state");
assert.match(customers, /customer\.segment !== "new"/, "Technical new customer segments must be hidden");
assert.match(customers, /search_customer_short/, "Customers must use the concise search label");
assert.match(i18n, /"search_customer_short": "Rechercher un client"/, "French concise customer search must be translated");
assert.match(payments, /button-print-thermal-receipt/, "Thermal printing must remain available");

console.log("Core operations polish checks passed.");
