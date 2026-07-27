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
assert.match(orders, /sm:max-h-\[94dvh\]/);
assert.match(orders, /md:max-w-\[1080px\]/);
assert.match(orders, /md:grid-cols-\[minmax\(0,1\.2fr\)_minmax\(1[68]rem,0\.8fr\)\]/);
assert.match(orders, /data-testid="order-form-primary-column"/);
assert.match(orders, /data-testid="order-form-summary-column"/);
assert.match(orders, /sm:\[scrollbar-gutter:stable\]/);
assert.match(orders, /DialogHeader className="sticky top-0 z-20/);
assert.match(orders, /className="sticky bottom-0 z-20 -mx-1/);

console.log("order dialog responsive regression tests passed");
