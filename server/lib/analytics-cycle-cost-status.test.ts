import assert from "node:assert/strict";
import fs from "node:fs";

const routes = fs.readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
const inventoryRoutes = fs.readFileSync(new URL("./inventory-routes.ts", import.meta.url), "utf8");
const analytics = fs.readFileSync(new URL("../../client/src/pages/analytics.tsx", import.meta.url), "utf8");
const inventory = fs.readFileSync(new URL("../../client/src/pages/inventory.tsx", import.meta.url), "utf8");

assert.match(routes, /pc\.status = 'completed'/);
assert.match(routes, /completed_product_cost/);
assert.match(routes, /in_progress_product_cost/);
assert.match(routes, /in_progress_costed_cycles/);
assert.match(routes, /SELECT DISTINCT pc2\.id, pc2\.total_weight_kg/);
assert.match(routes, /completedProductConsumptionCost \/ costedCycles/);
assert.doesNotMatch(routes, /productConsumptionCost \/ costedCycles/);
assert.match(inventoryRoutes, /"cycleCostStatus"/);
assert.match(inventoryRoutes, /ELSE 'in_progress'/);
assert.match(analytics, /completedProductConsumptionCost/);
assert.match(analytics, /inProgressProductConsumptionCost/);
assert.match(inventory, /cycleCostStatus==="completed"/);

console.log("analytics cycle cost status regression passed");
