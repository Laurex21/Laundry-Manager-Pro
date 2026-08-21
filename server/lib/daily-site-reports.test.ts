import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const metrics = readFileSync("server/lib/daily-site-report-metrics.ts", "utf8");
const routes = readFileSync("server/lib/daily-site-report-routes.ts", "utf8");
const registry = readFileSync("server/routes.ts", "utf8");

for (const route of [
  'get("/api/daily-site-reports"', 'post("/api/daily-site-reports/draft"',
  'patch("/api/daily-site-reports/:id"', 'post("/api/daily-site-reports/:id/submit"',
  'post("/api/daily-site-reports/:id/comments"', 'post("/api/daily-site-reports/:id/acknowledge"',
]) assert.match(routes, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

assert.match(metrics, /ordersCreated/);
assert.match(metrics, /ordersDelivered/);
assert.match(metrics, /paymentsCollected/);
assert.match(metrics, /expensesRecorded/);
assert.match(metrics, /outstandingBalance/);
assert.match(metrics, /returnsCreated/);
assert.match(metrics, /returnsOpen/);
assert.match(metrics, /returnsDecided/);
assert.match(routes, /authorizedSiteIds/);
assert.match(routes, /authorUserId, req\.userId/);
assert.match(routes, /managerSiteIds/);
assert.match(routes, /status[^\n]*draft/);
assert.match(routes, /Only a manager or owner/);
assert.match(routes, /registerDailySiteReportRoutes/);
assert.match(registry, /registerDailySiteReportRoutes\(app\)/);

console.log("daily site report API regressions passed");
