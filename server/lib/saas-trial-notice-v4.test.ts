import assert from "node:assert/strict";
import { test } from "node:test";
import { newOrganisationTrialV4 } from "./saas-entitlement-v4.ts";
import { trialNoticeCandidateV4 } from "./saas-trial-notice-v4.ts";

test("owner sees reminders from J23, never staff or before J23", () => {
  const trial = newOrganisationTrialV4(new Date("2026-10-01T00:00:00Z"));
  assert.equal(trialNoticeCandidateV4(trial, true, new Date("2026-10-23T23:59:59Z"), "Africa/Douala"), null);
  assert.equal(trialNoticeCandidateV4(trial, false, new Date("2026-10-24T00:00:00Z"), "Africa/Douala"), null);
  assert.deepEqual(trialNoticeCandidateV4(trial, true, new Date("2026-10-24T00:00:00Z"), "Africa/Douala"), {
    kind: "trial_reminder", localDate: "2026-10-24", remainingMs: 7 * 24 * 60 * 60 * 1000,
  });
});

test("payment stops reminders; expiry produces one kind of in-app event", () => {
  const trial = newOrganisationTrialV4(new Date("2026-10-01T00:00:00Z"));
  const expired = trialNoticeCandidateV4(trial, true, trial.trialEndsAt!, "Africa/Douala");
  assert.equal(expired?.kind, "trial_expired");
  assert.equal(trialNoticeCandidateV4({ ...trial, state: "active" }, true, trial.trialEndsAt!, "Africa/Douala"), null);
});

test("local date respects organisation time zone", () => {
  const trial = newOrganisationTrialV4(new Date("2026-10-01T00:00:00Z"));
  const now = new Date("2026-10-24T23:30:00Z");
  assert.equal(trialNoticeCandidateV4(trial, true, now, "Africa/Douala")?.localDate, "2026-10-25");
  assert.equal(trialNoticeCandidateV4(trial, true, now, "UTC")?.localDate, "2026-10-24");
});
