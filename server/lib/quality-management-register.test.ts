import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schema = fs.readFileSync(path.join(root, "shared/schema.ts"), "utf8");
const routes = fs.readFileSync(path.join(root, "server/lib/garment-return-routes.ts"), "utf8");
const operations = fs.readFileSync(path.join(root, "client/src/pages/quality-operations.tsx"), "utf8");
const panel = fs.readFileSync(path.join(root, "client/src/components/post-delivery-return-panel.tsx"), "utf8");
const runner = fs.readFileSync(path.join(root, "scripts/run-reviewed-migrations.ts"), "utf8");

for (const field of ["severity", "rootCause", "responsibility", "estimatedCost", "correctiveAction", "correctiveActionDueAt"]) assert.match(schema, new RegExp(field));
assert.match(routes, /\/api\/garment-returns\/summary/);
assert.match(routes, /A corrective action requires a due date/);
assert.match(routes, /high-severity case/);
assert.match(operations, /quality-management-summary/);
assert.match(panel, /quality_corrective_action/);
assert.match(runner, /20260922_quality_management_register\.sql/);

console.log("quality management register regression test passed");
