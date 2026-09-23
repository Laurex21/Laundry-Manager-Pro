import fs from "node:fs";
import assert from "node:assert/strict";

const routes = fs.readFileSync("server/lib/inventory-routes.ts", "utf8");
const page = fs.readFileSync("client/src/pages/inventory.tsx", "utf8");
const shell = fs.readFileSync("client/src/components/layout-shell.tsx", "utf8");
const app = fs.readFileSync("client/src/App.tsx", "utf8");
const migrationRunner = fs.readFileSync("scripts/run-reviewed-migrations.ts", "utf8");

assert.match(routes, /nextQuantity < 0/, "stock must never become negative");
assert.match(routes, /Receipt quantity must be positive/, "receipts must not silently decrease stock");
assert.match(routes, /FOR UPDATE/, "stock updates must lock the product row");
assert.match(routes, /movementType !== "consumption" && role === "operator"/, "operators may not receive or adjust stock");
assert.match(routes, /production_cycle_id/, "consumption must support production-cycle attribution");
assert.match(routes, /consumptionCostThisMonth/, "summary must expose monthly consumption cost");
assert.match(routes, /\/api\/inventory\/movements/, "movement history must be queryable");
assert.match(page, /inventory_recent_movements/, "inventory page must show the audit trail");
assert.match(page, /\/api\/production-cycles/, "cycle selection must use real production cycles");
assert.match(shell, /href: "\/inventory"/, "inventory must be reachable from navigation");
assert.match(app, /path="\/inventory"/, "inventory route must be registered");
assert.match(migrationRunner, /20260922_inventory_consumption\.sql/, "reviewed migration runner must include inventory schema");

console.log("inventory-consumption regression checks passed");
