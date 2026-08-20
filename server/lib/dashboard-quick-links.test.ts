import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, "client/src/pages/dashboard.tsx"), "utf8");
const translations = fs.readFileSync(path.join(root, "client/src/lib/i18n.ts"), "utf8");
const orders = fs.readFileSync(path.join(root, "client/src/pages/orders.tsx"), "utf8");
const expenses = fs.readFileSync(path.join(root, "client/src/pages/expenses.tsx"), "utf8");

for (const status of ["received", "washing", "ready", "delivered"]) {
  assert.match(dashboard, new RegExp(`orders\\?status=\\$\\{key\\}|orders\\?status=${status}`), `dashboard must link the ${status} queue to an order filter`);
}
assert.match(dashboard, /orders\?period=today/, "today order KPI must link to today's orders");
assert.match(dashboard, /orders\?period=week/, "week order KPI must link to the seven-day order view");
assert.match(dashboard, /orders\?period=month/, "month order KPI must link to the current-month order view");
assert.match(dashboard, /expenses\?period=\$\{format\(new Date\(\), "yyyy-MM"\)\}/, "month expenses KPI must link to the matching expense period");
assert.match(orders, /new URLSearchParams\(window\.location\.search\)/, "orders must read dashboard filters from the URL");
assert.match(orders, /o\.entryDate \|\| o\.createdAt/, "order periods must filter on the business entry date");
assert.match(orders, /start\.setDate\(start\.getDate\(\) - 7\)/, "week shortcut must match the dashboard's rolling seven-day definition");
assert.match(expenses, /getInitialPeriod/, "expenses must initialize its month from the dashboard link");
assert.match(dashboard, /t\('garments_waiting'\)/, "storage waiting title must use translations");
assert.match(dashboard, /t\('days_value', \{ count: order\.daysWaiting \}\)/, "storage waiting age must use translated day units");
assert.match(dashboard, /card-storage-waiting[\s\S]*href="\/orders\?status=ready"[\s\S]*t\('view_all'\)/, "storage waiting card must link to all ready orders");
assert.equal((translations.match(/"garments_waiting":/g) || []).length, 3, "storage waiting title must be translated in every supported language");

console.log("Dashboard quick-link regression checks passed");
