import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const analytics = readFileSync(join(root, "client/src/pages/analytics.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");

[
  "top_service_revenue",
  "lowest_service_revenue",
  "analytics_no_alerts",
  "smart_recommendations",
  "not_enough_data_recommendations",
  "rec_employee_orders_above_average",
  "rec_machine_underutilized",
  "rec_machine_maintenance_soon",
  "rec_service_highest_revenue",
].forEach((key) => {
  assert.match(analytics, new RegExp(`"${key}"`));
  assert.match(i18n, new RegExp(`"${key}"`));
});

[
  "employee_orders_above_average",
  "machine_underutilized",
  "machine_maintenance_soon",
  "service_highest_revenue",
].forEach((type) => {
  assert.match(storage, new RegExp(`type: "${type}"`));
});

assert.doesNotMatch(storage, /processed \$\{Math\.round/);
assert.doesNotMatch(storage, /generated the highest service revenue this period/);

console.log("analytics i18n regression tests passed");
