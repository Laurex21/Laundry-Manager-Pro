import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("server/lib/membership-routes.ts", "utf8");
const ui = readFileSync("client/src/components/customer-membership-tab.tsx", "utf8");

assert.match(routes, /const amountDue = Number\(plan\.recurringPrice\) \+ Number\(plan\.activationFee \?\? 0\)/, "activation must include the recurring price and activation fee");
assert.match(routes, /status: fullyPaid \? "active" : "pending"/, "unconfirmed activation payments must not activate benefits");
assert.match(routes, /Completed payment must cover the full amount due/, "completed payments below the required total must be rejected");
assert.match(routes, /Complete the subscription payment before activation/, "pending subscriptions must not bypass payment through the status endpoint");
assert.match(routes, /paymentDate: input\.paymentDate \?\? new Date\(\)/);
assert.match(routes, /reference: input\.paymentReference \|\| null/);
assert.match(routes, /if \(!fullyPaid\)[\s\S]*renewed: false/, "insufficient or pending renewal payments must not reset benefits");
assert.match(routes, /renewed: true/, "a full completed renewal must report that benefits were reset");
assert.match(ui, /Register subscription payment/);
assert.match(ui, /Register renewal payment/);
assert.match(ui, /Plan price/);
assert.match(ui, /Activation fee/);
assert.match(ui, /Payment method/);
assert.match(ui, /Payment date/);
assert.match(ui, /Payment reference|Reference/);
assert.match(ui, /Benefits and allowances are activated or reset only after the full amount/);
assert.doesNotMatch(ui, /body:\{paymentMethod:"cash"\}/, "renewal must not be a one-click hard-coded cash payment");

console.log("subscription payment registration regression passed");
