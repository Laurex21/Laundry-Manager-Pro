import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const analyticsPath = resolve(here, "../../client/src/pages/analytics.tsx");

test("customer revenue at risk uses the localized money formatter", () => {
  const source = readFileSync(analyticsPath, "utf8");
  assert.match(source, /const money = \(value: unknown\) => `\$\{Number\(value \|\| 0\)\.toLocaleString\(i18n\.language/);
  assert.match(source, /money\(churn\.revenueAtRisk\)/);
  assert.doesNotMatch(source, /\{symbol\}\{Number\(churn\.revenueAtRisk/);
});
