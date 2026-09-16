import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pilotage = readFileSync("client/src/pages/pilotage.tsx", "utf8");
const analytics = readFileSync("client/src/pages/analytics.tsx", "utf8");
const expenses = readFileSync("client/src/pages/expenses.tsx", "utf8");

assert.match(pilotage, /pilotage-page-redesign/, "Pilotage must preserve its redesign marker");
assert.match(pilotage, /bg-primary text-primary-foreground/, "Pilotage must use a visible violet active tab");
assert.doesNotMatch(pilotage, /bg-gradient-to-r/, "Pilotage must avoid decorative gradients");

assert.match(analytics, /analytics-view-tabs/, "Analytics must provide compact secondary navigation");
assert.match(analytics, /key: "executive"/, "Analytics must expose the executive view");
assert.match(analytics, /view === "customers"/, "Analytics must separate customer intelligence");
assert.match(analytics, /view === "operations"/, "Analytics must separate operational intelligence");
assert.match(analytics, /view === "advanced"/, "Analytics must separate advanced intelligence");

assert.match(expenses, /expense-kpi-strip/, "Expenses must show decision KPIs above the ledger");
assert.match(expenses, /average_expense/, "Expenses must show average expense");
assert.match(expenses, /top_category/, "Expenses must show the leading category");
assert.doesNotMatch(expenses, /text-2xl font-bold tabular-nums text-destructive/, "Normal spending totals must not look like errors");

console.log("management surfaces redesign regression checks passed");
