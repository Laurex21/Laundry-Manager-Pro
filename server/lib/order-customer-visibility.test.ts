import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");

assert.match(storage, /private async customersForScopedOrders/);
assert.match(storage, /async getOrdersBySite[\s\S]*customersForScopedOrders\(allOrders\)/);
assert.match(storage, /async getProductionDelays[\s\S]*customersForScopedOrders\(activeOrders\)/);
assert.match(storage, /async getStorageOccupancyAlerts[\s\S]*customersForScopedOrders\(readyRows\)/);
assert.match(storage, /async getReportData[\s\S]*customersForScopedOrders\(reportOrders\)/);

console.log("order customer visibility regression tests passed");
