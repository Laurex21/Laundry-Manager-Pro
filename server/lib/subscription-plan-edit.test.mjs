import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("server/lib/membership-routes.ts", "utf8");
const ui = readFileSync("client/src/pages/membership-plans.tsx", "utf8");

assert.match(ui, /optionalPositiveInput/, "edit form must normalize legacy optional zero values");
assert.match(ui, /optionalPositiveNumber/, "save payload must convert unused optional limits to null");
assert.match(ui, /body\.field/, "validation notification must identify the rejected field");
assert.match(ui, /aria-invalid/, "rejected field must be marked for assistive technology");
assert.match(ui, /plan-\$\{key\}-error/, "rejected field must display an inline error");
assert.match(routes, /optionalPositive/, "API must normalize legacy zero values for optional positive plan limits");
assert.match(routes, /includedWeightKg: optionalPositive/);
assert.match(routes, /includedPieces: optionalPositive/);
assert.match(routes, /maxOrders: optionalPositive/);
assert.match(routes, /durationDays: z\.coerce\.number\(\)\.int\(\)\.positive\(\)/, "required duration must remain strictly positive");
assert.match(routes, /recurringPrice: z\.coerce\.number\(\)\.positive\(\)/, "required price must remain strictly positive");

console.log("subscription plan edit regression passed");
