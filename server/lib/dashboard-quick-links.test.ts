import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, "client/src/pages/dashboard.tsx"), "utf8");
const orders = fs.readFileSync(path.join(root, "client/src/pages/orders.tsx"), "utf8");
const expenses = fs.readFileSync(path.join(root, "client/src/pages/expenses.tsx"), "utf8");

for (const status of ["received", "washing", "ready", "delivered"]) {
  assert.match(dashboard, new RegExp(`orders\\?status=\\$\\{key\\}|orders\\?status=${status}`), `dashboard must link the ${status} queue to an order filter`);
}
assert.match(dashboard, /orders\?period=today/, "today order KPI must link to today's orders");
assert.match(dashboard, /orders\?period=week/, "week order KPI must link to the current calendar week");
assert.match(dashboard, /orders\?period=month/, "month order KPI must link to the current-month order view");
assert.match(dashboard, /expenses\?period=\$\{format\(new Date\(\), "yyyy-MM"\)\}/, "month expenses KPI must link to the matching expense period");
assert.match(orders, /new URLSearchParams\(window\.location\.search\)/, "orders must read dashboard filters from the URL");
assert.match(orders, /o\.entryDate \|\| o\.createdAt/, "order periods must filter on the business entry date");
assert.match(orders, /const daysSinceMonday = \(start\.getDay\(\) \+ 6\) % 7/, "the order week must start on Monday, including on Sundays");
assert.match(orders, /start\.setDate\(start\.getDate\(\) - daysSinceMonday\)/, "the week shortcut must use the current calendar week");
assert.match(orders, /start\.setHours\(0, 0, 0, 0\)/, "calendar periods must include midnight at the start");
const storage = fs.readFileSync(path.join(root, "server/storage.ts"), "utf8");
assert.match(storage, /weekStartDate = reportingWeekStart\(today\)/, "dashboard week must also start on Monday");
assert.match(expenses, /getInitialPeriod/, "expenses must initialize its month from the dashboard link");
assert.doesNotMatch(dashboard, /card-storage-waiting/, "overdue pickups must not be duplicated in a separate card");
assert.match(dashboard, /overduePickupById/, "ready pickup rows must be enriched with overdue details");
assert.match(dashboard, /t\('days_value', \{ count: overdueOrder\.daysWaiting \}\)/, "overdue pickup age must use translated day units");
assert.match(dashboard, /card-ready-for-pickup[\s\S]*href="\/orders\?status=ready"[\s\S]*t\('view_all'\)/, "ready pickup card must link to all ready orders");
assert.match(dashboard, /overdueOrder\?\.whatsappUrl/, "overdue pickup rows must retain WhatsApp follow-up");

console.log("Dashboard quick-link regression checks passed");
