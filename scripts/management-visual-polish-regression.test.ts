import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const analytics = fs.readFileSync(path.join(root, "client/src/pages/analytics.tsx"), "utf8");
const expenses = fs.readFileSync(path.join(root, "client/src/pages/expenses.tsx"), "utf8");

assert.match(analytics, /toLocaleString\(i18n\.language[^)]*\}\)\} \$\{symbol\}/s, "analytics should localize amounts and place the currency symbol after the value");
assert.match(analytics, /localizedWeekdays/);
assert.match(analytics, /dataKey="localizedDay"/);
assert.match(analytics, /minTickGap=\{8\}/);
assert.doesNotMatch(expenses, /tabular-nums text-destructive">−\{Number\(expense\.amount\)/, "normal expense rows should not use the destructive color");
assert.match(expenses, /data-testid="expense-period-comparison"/);

console.log("management visual polish regression tests passed");
