import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const detail = readFileSync("client/src/pages/order-detail.tsx", "utf8");
const shell = readFileSync("client/src/components/layout-shell.tsx", "utf8");

assert.match(detail, /order-mobile-actions-grid/, "mobile actions grid is missing");
assert.match(detail, /grid w-full grid-cols-2 gap-2/, "mobile actions must use a compact 2-column grid");
assert.match(detail, /receipt_short/, "mobile receipt action should use a short label");
assert.match(detail, /thermal_ticket_short/, "mobile thermal action should use a short label");
assert.match(detail, /notify_short/, "mobile notification action should use a short label");
assert.match(detail, /compactMobile/, "correction action must join the mobile 2x2 grid");
assert.match(detail, /className="w-full md:w-auto"[^>]*data-testid="button-advance-status"/, "primary advance CTA must remain full width on mobile");
assert.match(detail, /min-h-14 border-border bg-muted\/30 py-2 opacity-70/, "future stages should be compact and visually subdued");
assert.match(detail, /sensitive_actions/, "cancellation needs a labelled sensitive-actions section");
assert.match(shell, /currentPath\.startsWith\("\/orders\/"\) \? "orders"/, "order detail must show the Orders top-bar title");

console.log("mobile order detail polish regression passed");
