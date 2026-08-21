import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const metrics = readFileSync("server/lib/daily-site-report-metrics.ts", "utf8");
const quality = readFileSync("client/src/pages/quality-operations.tsx", "utf8");
const dashboard = readFileSync("client/src/pages/dashboard.tsx", "utf8");

for (const metric of ["returnsCreated", "returnsOpen", "returnsDecided"]) assert.match(metrics, new RegExp(metric));
assert.match(quality, /href="\/daily-reports"/);
assert.match(dashboard, /href="\/quality-operations"/);
assert.match(dashboard, /href="\/daily-reports"/);
assert.match(quality, /currentSite\?\.id/);
assert.match(dashboard, /currentSite\?\.id/);
assert.match(dashboard, /daily_report_unacknowledged/);

console.log("quality and daily reporting integration regressions passed");
