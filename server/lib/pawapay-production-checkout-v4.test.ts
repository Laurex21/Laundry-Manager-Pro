import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectProductionCheckoutV4 } from "./pawapay-production-checkout-v4.ts";

const intent = {
  checkoutId: "17f59011-21c2-48df-a371-2d319ac2841e",
  checkoutCode: "expected-code",
  organisationId: 424,
  targetPlanSlug: "business" as const,
  amountXaf: 18999,
};
const completed = {
  status: "FOUND",
  data: {
    checkoutId: intent.checkoutId, checkoutCode: intent.checkoutCode, status: "COMPLETED",
    amounts: [{ country: "CMR", currency: "XAF", amount: "18999" }],
    metadata: [{ organisationId: "424" }, { planSlug: "business" }],
  },
};

test("completed checkout cannot activate until actual deposit is verified", () => {
  assert.equal(inspectProductionCheckoutV4(intent, completed), "deposit_verification_required");
  assert.equal(inspectProductionCheckoutV4(intent, { ...completed, data: { ...completed.data, status: "ACCEPTED" } }), "pending");
});

test("wrong amount, tenant, plan or checkout code fails closed", () => {
  const mismatch = (patch: Record<string, unknown>) => ({ ...completed, data: { ...completed.data, ...patch } });
  assert.throws(() => inspectProductionCheckoutV4(intent, mismatch({ amounts: [{ country: "CMR", currency: "XAF", amount: "1000" }] })));
  assert.throws(() => inspectProductionCheckoutV4(intent, mismatch({ metadata: [{ organisationId: "425" }, { planSlug: "business" }] })));
  assert.throws(() => inspectProductionCheckoutV4(intent, mismatch({ metadata: [{ organisationId: "424" }, { planSlug: "pro" }] })));
  assert.throws(() => inspectProductionCheckoutV4(intent, mismatch({ checkoutCode: "different" })));
  assert.throws(() => inspectProductionCheckoutV4(intent, { status: "NOT_FOUND" }));
});
