import fs from "node:fs";
import assert from "node:assert/strict";

const orders = fs.readFileSync("client/src/pages/orders.tsx", "utf8");
const payments = fs.readFileSync("client/src/pages/payments.tsx", "utf8");
const i18n = fs.readFileSync("client/src/lib/i18n.ts", "utf8");

assert.match(orders, /const formatListMoney =/, "Orders must localize visible list amounts");
assert.match(orders, /formatListMoney\(order\.totalAmount\)/, "Desktop and mobile order totals must use the list formatter");
assert.match(payments, /sm:hidden[^>]*>\{t\("collect_payment_short"\)\}/, "Mobile payments must use the short collect label");
assert.match(payments, /sm:hidden[^>]*>\{t\("history_short"\)\}/, "Mobile payments must use the short history label");
assert.match(payments, /hidden sm:inline[^>]*>\{t\("register_payment"\)\}/, "Desktop payments must keep the full register label");
assert.match(i18n, /"collect_payment_short": "Encaisser"/, "French mobile collect label must be translated");
assert.match(i18n, /"history_short": "Histórico"/, "Portuguese mobile history label must be translated");
assert.match(payments, /button-print-thermal-receipt/, "Thermal printing must remain available");

console.log("Mobile operations polish checks passed.");
