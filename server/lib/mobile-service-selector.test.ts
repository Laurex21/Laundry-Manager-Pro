import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const orders = readFileSync(
  join(process.cwd(), "client/src/pages/orders.tsx"),
  "utf8",
);

assert.match(
  orders,
  /className="max-h-\[min\(300px,calc\(100dvh-12rem\)\)\] touch-pan-y overscroll-contain"/,
);
assert.match(orders, /WebkitOverflowScrolling: "touch"/);
assert.match(orders, /overscrollBehavior: "contain"/);
assert.match(orders, /touchAction: "pan-y"/);
assert.match(orders, /onTouchMove=\{\(event\) => event\.stopPropagation\(\)\}/);

console.log("mobile service selector regression tests passed");
