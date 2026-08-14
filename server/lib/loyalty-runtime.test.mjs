import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeOrderPoints } from "./loyalty-formulas.ts";

const settings = readFileSync("client/src/pages/settings.tsx", "utf8");
const routes = readFileSync("server/lib/membership-routes.ts", "utf8");

assert.match(settings, /spendAmountPerPoint: Number\(program\.spendAmountPerPoint \?\? 500\)/);
assert.match(settings, /value=\{form\.spendAmountPerPoint\}/);
assert.match(settings, /body: JSON\.stringify\(\{[\s\S]*enabled,[\s\S]*\.\.\.form,/);
assert.match(routes, /spendAmountPerPoint: String\(programInput\.spendAmountPerPoint\)/);
assert.match(routes, /onConflictDoUpdate\(\{ target: loyaltyProgram\.organisationId, set: values \}\)/);
assert.equal(computeOrderPoints(24_000, 10, 2_000, "bronze"), 22);

console.log("loyalty save/reload and award regression passed");
