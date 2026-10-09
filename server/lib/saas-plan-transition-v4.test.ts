import assert from "node:assert/strict";
import { test } from "node:test";
import { newOrganisationTrialV4 } from "./saas-entitlement-v4.ts";
import { confirmedPaidPlanSwitchV4, nextMonthlyAnniversaryUtcV4 } from "./saas-plan-transition-v4.ts";

test("payment during trial activates paid Business immediately at full price", () => {
  const trial = newOrganisationTrialV4(new Date("2026-10-01T00:00:00Z"));
  const confirmed = new Date("2026-10-10T13:15:00Z");
  const switched = confirmedPaidPlanSwitchV4(trial, "business", confirmed);
  assert.equal(switched.fullPlanPriceXaf, 18999);
  assert.equal(switched.entitlement.planSlug, "business");
  assert.equal(switched.entitlement.cycleStartedAt?.toISOString(), confirmed.toISOString());
  assert.equal(switched.entitlement.cycleEndsAt?.toISOString(), "2026-11-10T13:15:00.000Z");
  assert.equal(switched.entitlement.trialStartedAt?.toISOString(), trial.trialStartedAt?.toISOString());
});

test("paid Pro upgrade to Business discards remaining Pro cycle without credit", () => {
  const paidPro = confirmedPaidPlanSwitchV4(null, "pro", new Date("2026-10-01T00:00:00Z")).entitlement;
  const upgrade = confirmedPaidPlanSwitchV4(paidPro, "business", new Date("2026-10-20T00:00:00Z"));
  assert.equal(upgrade.fullPlanPriceXaf, 18999);
  assert.equal(upgrade.entitlement.cycleEndsAt?.toISOString(), "2026-11-20T00:00:00.000Z");
  assert.throws(() => confirmedPaidPlanSwitchV4(upgrade.entitlement, "pro", new Date("2026-10-21T00:00:00Z")),
    /DOWNGRADE_MUST_BE_SCHEDULED/);
});

test("monthly anniversary clamps 31st to the last day of shorter month", () => {
  assert.equal(nextMonthlyAnniversaryUtcV4(new Date("2026-01-31T08:30:00Z")).toISOString(), "2026-02-28T08:30:00.000Z");
  assert.equal(nextMonthlyAnniversaryUtcV4(new Date("2028-01-31T08:30:00Z")).toISOString(), "2028-02-29T08:30:00.000Z");
  assert.equal(nextMonthlyAnniversaryUtcV4(new Date("2026-12-31T08:30:00Z")).toISOString(), "2027-01-31T08:30:00.000Z");
});
