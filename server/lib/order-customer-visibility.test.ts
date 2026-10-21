import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");

assert.match(storage, /private async customersForScopedOrders/);
assert.match(storage, /async getOrdersBySite[\s\S]*customersForScopedOrders\(allOrders\)/);
assert.match(storage, /async getProductionDelays[\s\S]*customersForScopedOrders\(activeOrders\)/);
assert.match(storage, /async getStorageOccupancyAlerts[\s\S]*customersForScopedOrders\(readyRows\)/);
const report = storage.slice(storage.indexOf("  async getReportData("), storage.indexOf("  async getReportData(") + 8000);
assert.match(report, /customerIds = Array\.from\(new Set\(\[\.\.\.reportOrders\.map\(o => o\.customerId\), \.\.\.filteredPayments\.map\(p => p\.customerId\)\]\)\)/);
assert.match(report, /customerIds\.length[\s\S]*where\(inArray\(customers\.id, customerIds\)\)[\s\S]*: \[\]/);

console.log("order customer visibility regression tests passed");
