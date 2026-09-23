import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routes = fs.readFileSync(path.join(root, "server/routes.ts"), "utf8");
const membership = fs.readFileSync(path.join(root, "server/lib/membership-routes.ts"), "utf8");

assert.match(
  routes,
  /approve-cancellation[\s\S]*db\.transaction[\s\S]*restoreSubscriptionUsageForCancelledOrder/,
  "cancellation approval must restore subscription usage in the same database transaction",
);
assert.match(
  membership,
  /remainingKg:[\s\S]*addDecimals\(usage\.subscription\.remainingKg, usage\.transaction\.kgConsumed/,
  "cancelled subscription orders must restore the exact consumed weight",
);
assert.match(
  membership,
  /remainingPieces:[\s\S]*remainingPieces\) \+ piecesConsumed/,
  "cancelled subscription orders must restore consumed pieces",
);
assert.match(
  membership,
  /remainingOrders:[\s\S]*remainingOrders\) \+ ordersConsumed/,
  "cancelled subscription orders must restore the consumed order allowance",
);
assert.match(
  membership,
  /update\(subscriptionTransactions\)[\s\S]*set\(\{ orderId: null \}\)[\s\S]*eq\(subscriptionTransactions\.orderId, orderId\)/,
  "restored usage must be detached from the order to make cancellation idempotent",
);
assert.match(
  routes,
  /eq\(orders\.status, "cancellation_requested"\)/,
  "only pending cancellation requests may be approved once",
);
assert.match(
  routes,
  /return \{ order: cancelled, organisationId: site\.organisationId \}/,
  "cancellation must carry the verified order organisation out of the transaction",
);
assert.doesNotMatch(
  routes,
  /approve-cancellation[\s\S]*organisationIdFor\(req\)/,
  "cancellation approval must not call an unavailable organisation lookup helper",
);

console.log("Subscription cancellation usage regression checks passed");
