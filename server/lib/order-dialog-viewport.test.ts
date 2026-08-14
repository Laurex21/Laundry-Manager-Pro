import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ordersPage = readFileSync(join(process.cwd(), "client/src/pages/orders.tsx"), "utf8");

assert.match(ordersPage, /data-testid="new-order-dialog"/);
assert.match(ordersPage, /lg:h-\[calc\(100dvh-1\.5rem\)\]/);
assert.match(ordersPage, /lg:overflow-hidden/);
assert.match(ordersPage, /lg:grid-rows-\[auto_1fr_auto\]/);
assert.match(ordersPage, /lg:space-y-0/);
assert.match(ordersPage, /lg:static lg:pt-1/);

console.log("new order desktop viewport regression tests passed");
