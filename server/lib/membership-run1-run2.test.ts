import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routes = readFileSync(join(root, "server/lib/membership-routes.ts"), "utf8");
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const ordersPage = readFileSync(join(root, "client/src/pages/orders.tsx"), "utf8");
const server = readFileSync(join(root, "server/index.ts"), "utf8");

assert.match(schema, /idx_sub_transactions_order_unique/);
assert.match(schema, /customerSubscriptionId, table\.orderId\)\.where/);
assert.match(schema, /area: text\("area"\)/);
assert.match(schema, /details: text\("details"\)/);

assert.match(routes, /for update/);
assert.match(routes, /error\?\.code === "23505"/);
assert.match(routes, /Subscription already applied to this order/);
assert.match(routes, /Subscription order limit exhausted/);
assert.match(routes, /remainingOrders == null \|\| row\.subscription\.remainingOrders > 0/);
assert.match(routes, /extraAmount \* \(Number\(row\.plan\.discountPercentage/);
assert.doesNotMatch(routes, /coveredAmount \* \(Number\(row\.plan\.discountPercentage/);

assert.match(routes, /requirePlanManager/);
assert.match(routes, /eq\(siteMembers\.role, "manager"\)/);
assert.match(routes, /Select a specific site before applying subscription coverage/);
assert.match(routes, /eq\(orders\.siteId, siteId\)/);
assert.match(routes, /inArray\(customers\.siteId, allowedSites\)/);

assert.match(routes, /calculateDraftCoverage/);
assert.match(ordersPage, /\/api\/subscriptions\/calculate-coverage/);
assert.match(ordersPage, /Subscription coverage not applied/);
assert.doesNotMatch(ordersPage, /catch \{\}/);
assert.match(server, /status >= 500 \? "Internal Server Error"/);

console.log("membership Run 1/2 regression tests passed");
