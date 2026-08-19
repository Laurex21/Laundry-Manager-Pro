import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ordersPage = fs.readFileSync(path.join(root, "client/src/pages/orders.tsx"), "utf8");
const ordersHook = fs.readFileSync(path.join(root, "client/src/hooks/use-orders.ts"), "utf8");
const orderDetail = fs.readFileSync(path.join(root, "client/src/pages/order-detail.tsx"), "utf8");
const routes = fs.readFileSync(path.join(root, "server/routes.ts"), "utf8");

assert.match(ordersPage, /function InlineOrderStatus/, "orders list must expose an inline status control");
assert.match(ordersPage, /ORDER_PIPELINE\.map/, "inline control must use the controlled production pipeline");
assert.match(ordersPage, /ORDER_PIPELINE = PRODUCTION_STAGE_KEYS/, "inline control must reuse the canonical production workflow");
assert.match(ordersPage, /nextStatus === "delivered" \|\| isBackward/, "delivery and backward transitions must require confirmation");
assert.match(ordersPage, /order\.paymentStatus === "paid"/, "delivery confirmation must warn when payment is incomplete");
assert.match(ordersPage, /disabled=\{isPending\}/, "the active row control must prevent duplicate updates");
assert.match(ordersPage, /<Card key=\{order\.id\}[\s\S]*<InlineOrderStatus order=\{order\} mobile \/>/, "mobile cards must expose the inline control without wrapping the card in a link");
assert.match(ordersHook, /invalidateQueries\(\{ queryKey: \["\/api\/analytics\/dashboard"\] \}\)/, "status changes must refresh dashboard counters");
assert.match(ordersHook, /invalidateQueries\(\{ queryKey: \["\/api\/analytics\/storage-occupancy"\] \}\)/, "status changes must refresh garments waiting in storage");
assert.match(orderDetail, /handleMarkDelivered[\s\S]*invalidateQueries\(\{ queryKey: \["\/api\/analytics\/storage-occupancy"\] \}\)/, "direct delivery must refresh garments waiting in storage");
assert.match(ordersHook, /onError:/, "network failures must be visible to the operator");
assert.match(routes, /VALID_PIPELINE_STATUSES[\s\S]*canAccessOrder/, "the existing API must validate status and tenant access");

console.log("Inline order-status regression checks passed");
