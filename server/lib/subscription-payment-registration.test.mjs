import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("server/lib/membership-routes.ts", "utf8");
const ui = readFileSync("client/src/components/customer-membership-tab.tsx", "utf8");

assert.match(routes, /const amountDue = Number\(plan\.recurringPrice\) \+ Number\(plan\.activationFee \?\? 0\)/, "activation must include the recurring price and activation fee");
assert.match(routes, /const hasConfirmedAdvance = input\.paymentStatus === "completed" && input\.paymentAmount > 0/, "a confirmed activation advance must activate benefits");
assert.match(routes, /status: hasConfirmedAdvance \? "active" : "pending"/, "only confirmed positive activation payments may activate benefits");
assert.doesNotMatch(routes, /Completed payment must cover the full amount due/, "partial confirmed activation payments must be accepted");
assert.match(routes, /Complete the subscription payment before activation/, "pending subscriptions must not bypass payment through the status endpoint");
assert.match(routes, /paymentDate: input\.paymentDate \?\? new Date\(\)/);
assert.match(routes, /reference: input\.paymentReference \|\| null/);
assert.match(routes, /const hasConfirmedAdvance = advanceAmount > 0 \|\| \(input\.paymentStatus === "completed" && input\.amount > 0\)/, "a confirmed renewal advance must reset benefits");
assert.match(routes, /if \(!hasConfirmedAdvance\)[\s\S]*renewed: false/, "unconfirmed renewal payments must not reset benefits");
assert.match(routes, /renewed: true/, "a confirmed renewal advance must report that benefits were reset");
assert.match(routes, /\/api\/subscriptions\/:id\/payments/, "existing subscribers need a standalone payment endpoint");
assert.match(routes, /status: input\.paymentStatus === "completed" \? "advance_available" : "pending"/, "completed added payments must remain available for renewal");
assert.match(routes, /advanceAmount = availableAdvances\.reduce/, "renewal must deduct available advance payments");
assert.match(routes, /status: "advance_applied"/, "advance payments must be consumed exactly once at renewal");
assert.match(routes, /Advance payment cannot exceed the next subscription charge/, "advance credit must not be silently lost through overpayment");
assert.match(routes, /\.for\("update"\)/, "advance registration must lock the subscription against concurrent overpayment");
assert.match(ui, /Register subscription payment/);
assert.match(ui, /Register renewal payment/);
assert.match(ui, /Add subscription payment/);
assert.match(ui, />Add payment</);
assert.match(ui, /Advance credit:/);
assert.match(ui, /Completed advance payments reduce the next renewal amount/);
assert.match(ui, /Plan price/);
assert.match(ui, /Activation fee/);
assert.match(ui, /Payment method/);
assert.match(ui, /Payment date/);
assert.match(ui, /Payment reference|Reference/);
assert.match(ui, /A confirmed advance above 0 activates or renews the benefits immediately/);
assert.doesNotMatch(ui, /body:\{paymentMethod:"cash"\}/, "renewal must not be a one-click hard-coded cash payment");

console.log("subscription payment registration regression passed");
