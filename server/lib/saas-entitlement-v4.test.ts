import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveSaasPlanV4, newOrganisationTrialV4, TRIAL_DURATION_MS } from "./saas-entitlement-v4.ts";

test("new organisation trial lasts exactly 30 UTC days", () => {
  const start = new Date("2026-10-09T12:00:00Z");
  const trial = newOrganisationTrialV4(start);
  assert.equal(trial.trialEndsAt!.getTime() - start.getTime(), TRIAL_DURATION_MS);
  assert.equal(effectiveSaasPlanV4(trial, new Date(trial.trialEndsAt!.getTime() - 1)), "pro");
  assert.equal(effectiveSaasPlanV4(trial, trial.trialEndsAt!), "starter");
});

test("paid rights stop at cycle end even if database state still says active", () => {
  const paid = {
    ...newOrganisationTrialV4(new Date("2026-10-01T00:00:00Z")),
    planSlug: "business" as const, state: "active" as const,
    cycleStartedAt: new Date("2026-10-01T00:00:00Z"),
    cycleEndsAt: new Date("2026-11-01T00:00:00Z"),
  };
  assert.equal(effectiveSaasPlanV4(paid, new Date("2026-10-31T23:59:59Z")), "business");
  assert.equal(effectiveSaasPlanV4(paid, paid.cycleEndsAt), "starter");
  assert.equal(effectiveSaasPlanV4({ ...paid, cycleEndsAt: null }, new Date("2026-10-10T00:00:00Z")), "starter");
  assert.equal(effectiveSaasPlanV4({ ...paid, state: "past_due" }, new Date("2026-10-10T00:00:00Z")), "starter");
});

test("missing entitlement never grants paid rights", () => {
  assert.equal(effectiveSaasPlanV4(null, new Date("2026-10-09T00:00:00Z")), "starter");
});
