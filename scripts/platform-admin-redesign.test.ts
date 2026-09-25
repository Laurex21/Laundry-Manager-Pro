import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/platform-admin.tsx", "utf8");
const routes = readFileSync("server/lib/platform-admin-routes.ts", "utf8");

assert.match(source, /Executive control centre/);
assert.match(source, /value="organisations"/);
assert.match(source, /value="security"/);
assert.match(source, /Organisation directory/);
assert.match(source, /Without plan/);
assert.match(source, /Read-only boundary/);
assert.doesNotMatch(source, /Recent security activity/);
assert.match(source, /Organisation workspace · read-only/);
assert.match(source, /value="subscription"/);
assert.match(source, /value="sites"/);
assert.match(source, /value="users"/);
assert.match(source, /value="payments"/);
assert.match(source, /Only aggregate role counts are shown/);
assert.match(routes, /\/api\/platform-admin\/organisations\/:organisationId/);
assert.match(routes, /platform_admin\.organisation_view/);
assert.match(routes, /WHERE event\.organisation_id = \$1/);
assert.doesNotMatch(source, /Suspend organisation|Impersonate owner|Change plan/);

console.log("platform admin redesign regression checks passed");
