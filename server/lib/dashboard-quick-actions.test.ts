import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, "client/src/pages/dashboard.tsx"), "utf8");
const orders = fs.readFileSync(path.join(root, "client/src/pages/orders.tsx"), "utf8");
const strip = dashboard.slice(
  dashboard.indexOf("{/* Operations command strip */}"),
  dashboard.indexOf("{/* All-sites banner */}"),
);

assert.match(strip, /href="\/orders\?create=true"/);
assert.match(strip, /href="\/payments"/);
assert.match(strip, /href="\/pilotage\?view=quality"/);
assert.match(strip, /href="\/pilotage\?view=daily"/);
assert.doesNotMatch(strip, /href="\/customers"/);
assert.doesNotMatch(strip, /ready_for_pickup/);
assert.doesNotMatch(strip, /href="\/pilotage\?view=reports"/);
assert.match(strip, /grid-cols-2/);
assert.match(strip, /sm:grid-cols-4/);

assert.match(orders, /function shouldOpenCreateOrderFromUrl/);
assert.match(orders, /get\("create"\) === "true"/);
assert.match(orders, /useState\(shouldOpenCreateOrderFromUrl\)/);

console.log("Dashboard quick-action regression checks passed");
