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
assert.match(ordersPage, /backdrop-blur-sm lg:pt-1/);

console.log("new order desktop viewport regression tests passed");
