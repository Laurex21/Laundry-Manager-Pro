import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const routes = readFileSync("server/lib/membership-routes.ts", "utf8");
const orders = readFileSync("client/src/pages/orders.tsx", "utf8");

assert.match(routes, /customers\/:id\/subscription\/status/);
assert.match(routes, /effectiveStatus/);
assert.match(orders, /selected-customer-subscription-status/);
assert.match(orders, /customer-subscription-summaries/);
assert.match(orders, /Abonné · \{subscriptionStatus\.planName\}/);
assert.match(orders, /Couvert par le forfait/);
assert.match(orders, /Non couvert par le forfait/);
assert.match(orders, /subscriptionStatus\?\.status === "active" \? subscriptionStatus : null/);

console.log("subscriber order visibility regression passed");
