import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("client/src/App.tsx", "utf8");
const auth = readFileSync("client/src/hooks/use-auth.ts", "utf8");
const layout = readFileSync("client/src/components/layout-shell.tsx", "utf8");
const dashboard = readFileSync("client/src/pages/dashboard.tsx", "utf8");
const page = readFileSync("client/src/pages/quality-operations.tsx", "utf8");
const i18n = readFileSync("client/src/lib/i18n.ts", "utf8");

assert.match(app, /quality-operations/);
assert.match(app, /page="qualityOperations"/);
assert.match(auth, /operatorPages[^\n]*qualityOperations/);
assert.match(layout, /href: "\/quality-operations"/);
assert.match(dashboard, /\/api\/garment-returns/);
assert.match(dashboard, /href="\/quality-operations"/);
assert.match(page, /aria-label=.*quality_operations_filter/);
assert.match(page, /customer_return_status_/);
assert.match(page, /href=\{`\/orders\/\$\{item\.order\.id\}`\}/);

for (const key of [
  "quality_operations", "quality_operations_subtitle", "quality_operations_open",
  "quality_operations_filter", "quality_operations_all", "quality_operations_empty",
  "quality_operations_view_order",
]) {
  assert.equal((i18n.match(new RegExp(`"${key}"`, "g")) || []).length >= 3, true, `${key} needs EN/FR/PT translations`);
}

console.log("quality operations navigation regressions passed");
