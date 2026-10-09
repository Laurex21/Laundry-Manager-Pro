import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectProductionDepositV4 } from "./pawapay-production-deposit-v4.ts";

const expected = {
  depositId: "8917c345-4791-4285-a416-62f24b6982db",
  clientReferenceId: "XP-PROD-424-001",
  organisationId: 424,
  planSlug: "business" as const,
  amountXaf: 18999,
};
const completed = { status: "FOUND", data: {
  depositId: expected.depositId, clientReferenceId: expected.clientReferenceId,
  status: "COMPLETED", amount: "18999.00", currency: "XAF", country: "CMR",
  metadata: { organisationId: "424", planSlug: "business" },
} };

test("deposit verification requires exact identity and settled amount", () => {
  assert.equal(inspectProductionDepositV4(expected, completed), "completed");
  assert.equal(inspectProductionDepositV4(expected, { ...completed, data: { ...completed.data, status: "PENDING" } }), "pending");
  for (const patch of [
    { depositId: "other" }, { clientReferenceId: "other" }, { amount: "1000.00" },
    { currency: "ZMW" }, { country: "ZMB" },
    { metadata: { organisationId: "425", planSlug: "business" } },
    { metadata: { organisationId: "424", planSlug: "pro" } },
  ]) assert.throws(() => inspectProductionDepositV4(expected, { ...completed, data: { ...completed.data, ...patch } }));
  assert.throws(() => inspectProductionDepositV4(expected, { status: "NOT_FOUND" }));
});
