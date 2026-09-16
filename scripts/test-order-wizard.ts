import fs from "node:fs";
import assert from "node:assert/strict";

const orders = fs.readFileSync("client/src/pages/orders.tsx", "utf8");
const routes = fs.readFileSync("server/routes.ts", "utf8");
const schema = fs.readFileSync("shared/schema.ts", "utf8");
const migration = fs.readFileSync("migrations/20260916_order_drafts.sql", "utf8");

assert.match(orders, /const wizardSteps = \[/);
assert.match(orders, /data-testid="order-wizard-step-client"/);
assert.match(orders, /data-testid="order-wizard-step-delivery"/);
assert.match(orders, /data-testid="order-wizard-review"/);
assert.match(orders, /saved-order-draft-banner/);
assert.match(orders, /Réserve textile \(facultative\)/);
assert.match(orders, /correctionReason\.trim\(\)\.length < 5/);
assert.match(routes, /app\.get\("\/api\/order-drafts\/current"/);
assert.match(routes, /app\.put\("\/api\/order-drafts\/current"/);
assert.match(routes, /app\.delete\("\/api\/order-drafts\/current"/);
assert.match(schema, /export const orderDrafts = pgTable\("order_drafts"/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS order_drafts/);

console.log("Order wizard and persistent draft regression checks passed.");
