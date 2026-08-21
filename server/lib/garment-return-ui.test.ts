import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync("client/src/components/post-delivery-return-panel.tsx", "utf8");
const orderDetail = readFileSync("client/src/pages/order-detail.tsx", "utf8");
const i18n = readFileSync("client/src/lib/i18n.ts", "utf8");

assert.match(orderDetail, /PostDeliveryReturnPanel/);
assert.match(orderDetail, /order\.status === "delivered"/);
assert.match(orderDetail, /internal_return_to_production/);
assert.match(component, /<form/);
assert.match(component, /<fieldset/);
assert.match(component, /<legend/);
assert.match(component, /type="checkbox"/);
assert.match(component, /htmlFor="customer-return-comment"/);
assert.match(component, /aria-describedby="customer-return-comment-help"/);
assert.match(component, /accept="image\/jpeg,image\/png,image\/webp"/);
assert.match(component, /isManager[\s\S]*customer_return_decision/);
assert.match(component, /aria-hidden="true"/);
assert.match(component, /customer_return_financial_notice/);

for (const key of [
  "customer_return_after_delivery", "internal_return_to_production", "customer_return_reason",
  "customer_return_comment", "customer_return_submit", "customer_return_decision",
  "customer_return_status_pending_review", "customer_return_financial_notice",
]) {
  assert.equal((i18n.match(new RegExp(`"${key}"`, "g")) || []).length >= 3, true, `${key} needs EN/FR/PT translations`);
}

console.log("garment return UI regressions passed");
