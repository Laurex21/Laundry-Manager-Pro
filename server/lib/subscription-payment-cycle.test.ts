import assert from "node:assert/strict";
import { currentSubscriptionPaymentCycle } from "./subscription-payment-cycle";

const initialAdvance = [{ id: 1, amount: 1000, status: "partial", paymentDate: "2026-08-20T14:22:00Z" }];
assert.deepEqual(currentSubscriptionPaymentCycle(initialAdvance, 20000, 20000), {
  cycle: "initial", cost: 20000, paid: 1000, due: 19000,
  nextPaymentStatus: "partial", completedPaymentStatus: "completed",
});

const cumulativeAdvance = [...initialAdvance, { id: 2, amount: 3000, status: "partial", paymentDate: "2026-08-20T14:23:00Z" }];
assert.equal(currentSubscriptionPaymentCycle(cumulativeAdvance, 20000, 20000).due, 16000);

const fullyPaid = [...cumulativeAdvance, { id: 3, amount: 16000, status: "completed", paymentDate: "2026-08-20T14:24:00Z" }];
assert.equal(currentSubscriptionPaymentCycle(fullyPaid, 20000, 20000).due, 0);

const legacyWrongStatus = [{ id: 1, amount: 1000, status: "completed", paymentDate: "2026-08-20T14:22:00Z" }];
assert.equal(currentSubscriptionPaymentCycle(legacyWrongStatus, 20000, 20000).due, 19000, "a legacy Completed label must not erase the unpaid balance");

const renewalAdvance = [...fullyPaid, { id: 4, amount: 5000, status: "renewal_partial", paymentDate: "2026-09-20T14:22:00Z" }];
assert.deepEqual(currentSubscriptionPaymentCycle(renewalAdvance, 20000, 20000), {
  cycle: "renewal", cost: 20000, paid: 5000, due: 15000,
  nextPaymentStatus: "renewal_partial", completedPaymentStatus: "renewal_completed",
});

const completedRenewal = [...renewalAdvance, { id: 5, amount: 15000, status: "renewal_completed", paymentDate: "2026-09-20T14:23:00Z" }];
assert.equal(currentSubscriptionPaymentCycle(completedRenewal, 20000, 20000).due, 0);

const nextRenewal = [...completedRenewal, { id: 6, amount: 2000, status: "renewal_partial", paymentDate: "2026-10-20T14:22:00Z" }];
assert.deepEqual(currentSubscriptionPaymentCycle(nextRenewal, 20000, 20000), {
  cycle: "renewal", cost: 20000, paid: 2000, due: 18000,
  nextPaymentStatus: "renewal_partial", completedPaymentStatus: "renewal_completed",
});

const legacyRenewalBeforeInitialCompletion = [...initialAdvance, { id: 2, amount: 3000, status: "renewal_partial", paymentDate: "2026-08-20T14:23:00Z" }];
assert.equal(currentSubscriptionPaymentCycle(legacyRenewalBeforeInitialCompletion, 20000, 20000).due, 16000);

const appliedRenewalAdvance = [...fullyPaid, { id: 4, amount: 5000, status: "advance_applied", paymentDate: "2026-09-19T14:22:00Z" }, { id: 5, amount: 2000, status: "renewal_partial", paymentDate: "2026-09-20T14:22:00Z" }];
assert.equal(currentSubscriptionPaymentCycle(appliedRenewalAdvance, 20000, 20000).due, 13000);

const backdatedInitialInstallments = [
  { id: 3, amount: 16000, status: "completed", paymentDate: "2026-08-18T14:24:00Z" },
  { id: 1, amount: 1000, status: "partial", paymentDate: "2026-08-20T14:22:00Z" },
  { id: 2, amount: 3000, status: "partial", paymentDate: "2026-08-19T14:23:00Z" },
];
assert.equal(currentSubscriptionPaymentCycle(backdatedInitialInstallments, 20000, 20000).due, 0, "backdated installments must keep their insertion order");

const backdatedRenewalCompletion = [
  ...fullyPaid,
  { id: 4, amount: 5000, status: "renewal_partial", paymentDate: "2026-09-20T14:22:00Z" },
  { id: 5, amount: 15000, status: "renewal_completed", paymentDate: "2026-08-01T14:23:00Z" },
];
assert.equal(currentSubscriptionPaymentCycle(backdatedRenewalCompletion, 20000, 20000).due, 0, "a backdated renewal completion must remain in its renewal cycle");

console.log("subscription payment cycle regression passed");
