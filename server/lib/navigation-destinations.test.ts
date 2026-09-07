import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const auth = readFileSync(join(root, "client/src/pages/auth-page.tsx"), "utf8");
const landing = readFileSync(join(root, "client/src/pages/landing.tsx"), "utf8");
const payments = readFileSync(join(root, "client/src/pages/payments.tsx"), "utf8");
const orders = readFileSync(join(root, "client/src/pages/orders.tsx"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");

assert.match(auth, /requestedTab === "register" \? "register" : "login"/);
assert.doesNotMatch(landing, /href="#"/);
assert.match(landing, /id="about"/);
assert.match(landing, /product: \["#features", "#pricing", "\/rentabilite", "\/diagnostic", "#tools"\]/);
assert.match(routes, /href: "\/payments\?view=history"/);
assert.match(payments, /requestedView === "history" \? "history" : "register"/);
assert.match(routes, /href: "\/pilotage\?view=quality"/);
assert.match(routes, /href: "\/orders\?discounted=true"/);
assert.match(orders, /discounted: params\.get\("discounted"\) === "true"/);
assert.match(orders, /Number\(o\.discountAmount \?\? o\.discount \?\? 0\) > 0/);

console.log("Navigation destination regression checks passed");
