import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routes = readFileSync(join(root, "server/lib/membership-routes.ts"), "utf8");
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const ordersPage = readFileSync(join(root, "client/src/pages/orders.tsx"), "utf8");
const server = readFileSync(join(root, "server/index.ts"), "utf8");
const subscriberReceipt = readFileSync(join(root, "server/lib/subscription-receipt.ts"), "utf8");

assert.match(schema, /idx_sub_transactions_order_unique/);
assert.match(schema, /customerSubscriptionId, table\.orderId\)\.where/);
assert.doesNotMatch(schema, /area: text\("area"\)/);
assert.doesNotMatch(schema, /details: text\("details"\)/);

assert.match(routes, /for update/);
assert.match(routes, /error\?\.code === "23505"/);
assert.match(routes, /Subscription already applied to this order/);
assert.match(routes, /Subscription order limit exhausted/);
assert.match(routes, /remainingOrders == null \|\| row\.subscription\.remainingOrders > 0/);
assert.match(routes, /eligibleServiceDiscount\(extraAmount, String\(row\.plan\.discountPercentage/);
assert.doesNotMatch(routes, /coveredAmount \* \(Number\(row\.plan\.discountPercentage/);

assert.match(routes, /requirePlanManager/);
assert.match(routes, /eq\(siteMembers\.role, "manager"\)/);
assert.match(routes, /Select a specific site before applying subscription coverage/);
assert.match(routes, /eq\(orders\.siteId, siteId\)/);
assert.match(routes, /inArray\(customers\.siteId, allowedSites\)/);

assert.match(routes, /calculateDraftCoverage/);
assert.match(routes, /garmentPieceCount/);
assert.match(routes, /const consumesKg = item\.unit === "kg"/);
assert.match(routes, /sum\(\$\{garmentItems\.quantity\}\)/);
assert.match(routes, /originalPrice: coverage\.order!\.originalPrice \?\? coverage\.order!\.totalAmount/);
assert.match(ordersPage, /garmentPieceCount: totalRegisteredGarments/);
assert.match(ordersPage, /subscriber-receipt\?format=a4/);
assert.match(routes, /innerJoin\(sites, and\(eq\(services\.siteId, sites\.id\), eq\(sites\.organisationId, organisationId\)\)\)/);
assert.doesNotMatch(routes, /inArray\(services\.id, serviceIds\), eq\(services\.siteId, siteId\)/);
assert.match(ordersPage, /\/api\/subscriptions\/calculate-coverage/);
assert.match(ordersPage, /Subscription coverage not applied/);
assert.doesNotMatch(ordersPage, /catch \{\}/);
assert.match(server, /status >= 500 \? "Internal Server Error"/);

assert.match(routes, /const garments = await db\.select\(\{ itemName: garmentItems\.itemName, quantity: garmentItems\.quantity \}\)/);
assert.match(routes, /orderNumber/);
assert.match(routes, /kgConsumed: Number\(row\.transaction\.kgConsumed/);
assert.match(routes, /piecesConsumed: Number\(row\.transaction\.piecesConsumed/);
assert.match(subscriberReceipt, /order\.orderNumber \?\? order\.id/);
assert.match(subscriberReceipt, /Vêtements enregistrés/);
assert.match(subscriberReceipt, /Consommation de cette commande/);
assert.match(subscriberReceipt, /Taux de consommation/);
assert.match(subscriberReceipt, /plan\.includedWeightKg/);
assert.match(subscriberReceipt, /plan\.includedPieces/);
assert.match(ordersPage, /garmentPieceCount: totalRegisteredGarments/);

console.log("membership Run 1/2 regression tests passed");
