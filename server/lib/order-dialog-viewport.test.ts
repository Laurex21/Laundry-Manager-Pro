import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ordersPage = readFileSync(join(process.cwd(), "client/src/pages/orders.tsx"), "utf8");

assert.match(ordersPage, /data-testid="new-order-dialog"/);
assert.match(ordersPage, /lg:h-\[calc\(100dvh-1\.5rem\)\]/);
assert.match(ordersPage, /lg:overflow-y-auto/);
assert.match(ordersPage, /space-y-4 lg:space-y-2/);
assert.match(ordersPage, /lg:items-start lg:gap-4/);
assert.doesNotMatch(ordersPage, /data-testid="order-form-primary-column"[^>]*lg:overflow-y-auto/);
const dialogClass = ordersPage.match(/<DialogContent data-testid="new-order-dialog" className="([^"]+)"/)?.[1];
assert.ok(dialogClass, "new order dialog must keep its viewport layout");
const dialogClasses = new Set(dialogClass.split(/\s+/));
for (const token of ["h-[100dvh]", "overflow-y-auto", "overscroll-contain", "lg:h-[calc(100dvh-1.5rem)]", "lg:overflow-y-auto"]) {
  assert.ok(dialogClasses.has(token), `dialog must retain ${token}`);
}
const headerClass = ordersPage.match(/<DialogHeader className="([^"]+)"/)?.[1];
assert.ok(headerClass, "new order dialog must retain its header");
const headerClasses = new Set(headerClass.split(/\s+/));
for (const token of ["sticky", "top-0", "z-20", "backdrop-blur-sm"]) {
  assert.ok(headerClasses.has(token), `dialog header must retain ${token}`);
}

console.log("new order desktop viewport regression tests passed");
