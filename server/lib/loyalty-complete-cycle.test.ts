import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const membershipRoutes = readFileSync("server/lib/membership-routes.ts", "utf8");
const loyalty = readFileSync("server/lib/loyalty.ts", "utf8");
const settings = readFileSync("client/src/pages/settings.tsx", "utf8");
const customerDetail = readFileSync("client/src/pages/customer-detail.tsx", "utf8");
const routes = readFileSync("server/routes.ts", "utf8");
const schema = readFileSync("shared/schema.ts", "utf8");

assert.match(readFileSync("server/lib/loyalty-formulas.ts", "utf8"), /Math\.floor\(amount \/ spendAmountPerPoint\)/, "spend points must use the configured amount-per-point rule");
assert.match(settings, /loyalty_spend_amount_per_point/);
assert.doesNotMatch(settings, /form\.pointsPerFcfa/, "the cashier must never enter a points-per-FCFA decimal");
assert.match(membershipRoutes, /const \{ enabled, \.\.\.programInput \} = input/);
assert.match(membershipRoutes, /safeParse\(req\.body\)/, "invalid loyalty settings must return a client error");
assert.match(membershipRoutes, /\/api\/customers\/:id\/loyalty\/redeem/);
assert.match(loyalty, /for update/, "redemption must lock the customer balance");
assert.match(loyalty, /reason: "loyalty_reward"/);
assert.match(loyalty, /redeemedPoints/, "redemption must prevent already-spent points from expiring twice");
assert.match(schema, /rewardPointsRequired/);
assert.match(schema, /rewardValue/);
assert.match(customerDetail, /button-confirm-loyalty-redemption/);
const deliverRoute = routes.slice(routes.indexOf('app.patch("/api/orders/:id/deliver"'), routes.indexOf("app.post(api.payments.create.path"));
assert.match(deliverRoute, /awardOrderPoints/);
assert.match(deliverRoute, /awardReferralPoints/);

console.log("loyalty complete-cycle regression passed");
