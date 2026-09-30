import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/platform-admin.tsx", "utf8");

assert.match(source, /Executive control centre/);
assert.match(source, /value="organisations"/);
assert.match(source, /value="security"/);
assert.match(source, /Organisation directory/);
assert.match(source, /Without plan/);
assert.match(source, /Read-only boundary/);
assert.doesNotMatch(source, /Recent security activity/);

console.log("platform admin redesign regression checks passed");
