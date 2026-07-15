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
  "rec_machine_maintenance_overdue",
  "rec_service_highest_revenue",
  "peak_deposit_hours",
  "peak_pickup_hours",
  "activity_by_day",
  "customer_behavior",
  "average_return_frequency",
  "deposit_to_pickup_delay",
  "average_storage_time",
  "time_to_payment",
  "insight_deposits_morning",
  "insight_pickups_evening",
  "insight_average_customer_returns",
].forEach((key) => {
  assert.match(analytics, new RegExp(`"${key}"`));
  assert.match(i18n, new RegExp(`"${key}"`));
});

[
  "analytics_owner_summary",
  "analytics_period",
  "analytics_overview",
  "analytics_customers_operations",
  "analytics_business_intelligence",
  "analytics_needs_attention",
  "analytics_attention_description",
  "analytics_business_performance",
  "analytics_performance_description",
  "analytics_customer_flow",
  "analytics_customer_description",
  "analytics_deeper_insights",
  "analytics_intelligence_description",
].forEach((key) => {
  assert.match(analytics, new RegExp(`"${key}"`));
  assert.equal([...i18n.matchAll(new RegExp(`"${key}"`, "g"))].length, 3, `${key} must exist in English, French, and Portuguese`);
});

assert.match(analytics, /severity_\$\{alert\.severity\}/);
assert.match(i18n, /"severity_medium"/);

[
  "employee_orders_above_average",
  "machine_underutilized",
  "machine_maintenance_soon",
  "machine_maintenance_overdue",
  "service_highest_revenue",
  "deposits_morning",
  "pickups_evening",
  "average_customer_returns",
].forEach((type) => {
  assert.match(storage, new RegExp(`type: "${type}"`));
});

assert.doesNotMatch(storage, /processed \$\{Math\.round/);
assert.doesNotMatch(storage, /generated the highest service revenue this period/);
assert.doesNotMatch(storage, /% of deposits occur between 8h and 11h/);
assert.doesNotMatch(storage, /% of pickups occur after 17h/);
assert.doesNotMatch(storage, /Average customer returns every/);
assert.match(storage, /const maintenanceSoon = machineStats\.find\(\(machine\) => machine\.daysUntilNextMaintenance != null && machine\.daysUntilNextMaintenance >= 0 && machine\.daysUntilNextMaintenance <= 14\)/);

console.log("analytics i18n regression tests passed");
