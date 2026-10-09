import assert from "node:assert/strict";
import { test } from "node:test";
import { SAAS_PLANS_V4, saasMonthlyQuoteV4, prorateAddedOptionXaf,
  saasCapacityV4, canActivateSaasSiteV4, canActivateSaasStaffV4 } from "./saas-plan-v4.ts";

test("approved base prices and unlimited-order catalogue shape", () => {
  assert.deepEqual(Object.keys(SAAS_PLANS_V4), ["starter", "pro", "business"]);
  assert.deepEqual(Object.values(SAAS_PLANS_V4).map((plan) => plan.monthlyXaf), [0, 10999, 18999]);
  assert.deepEqual(saasMonthlyQuoteV4("starter", 1, 0).totalXaf, 0);
  assert.deepEqual(saasMonthlyQuoteV4("pro", 1, 2).totalXaf, 10999);
});

test("Business site adds two included staff places and add-ons are itemised", () => {
  assert.deepEqual(saasMonthlyQuoteV4("business", 3, 7), {
    baseXaf: 18999, siteXaf: 5000, staffXaf: 0,
    totalXaf: 23999, extraSites: 1, extraStaff: 0, includedStaff: 7,
  });
  assert.equal(saasMonthlyQuoteV4("business", 4, 10).totalXaf, 30999);
  assert.throws(() => saasMonthlyQuoteV4("starter", 1, 1));
  assert.throws(() => saasMonthlyQuoteV4("pro", 2, 0));
});

test("paid options determine server-side active capacity; owner is excluded", () => {
  assert.deepEqual(saasCapacityV4("business", 1, 2), {
    maxActiveSites: 3, maxActiveStaffExcludingOwner: 9,
  });
  assert.equal(canActivateSaasSiteV4("business", 1, 0, 2), true);
  assert.equal(canActivateSaasSiteV4("business", 1, 0, 3), false);
  assert.equal(canActivateSaasStaffV4("business", 1, 0, 6), true);
  assert.equal(canActivateSaasStaffV4("business", 1, 0, 7), false);
  assert.equal(canActivateSaasStaffV4("starter", 0, 0, 0), false);
  assert.throws(() => saasCapacityV4("starter", 0, 1));
});

test("option proration uses actual UTC cycle and half-up FCFA rounding", () => {
  const start = new Date("2026-10-01T00:00:00Z");
  const end = new Date("2026-10-31T00:00:00Z");
  const added = new Date("2026-10-21T00:00:00Z");
  assert.equal(prorateAddedOptionXaf(5000, added, start, end), 1667);
  assert.equal(prorateAddedOptionXaf(2000, added, start, end), 667);
  assert.equal(prorateAddedOptionXaf(5000, end, start, end), 0);
  assert.throws(() => prorateAddedOptionXaf(5000, new Date("2026-09-30T00:00:00Z"), start, end));
});
