import assert from "node:assert/strict";
import {
  formatReportingDay,
  getOrderReportingDate,
  isWithinReportingRange,
  parseLocalDateParam,
  reportingDateRange,
  reportingDateString,
  validReportingTimeZone,
} from "./reporting-date";

const mayStart = parseLocalDateParam("2026-05-01", new Date("2026-01-01"));
const mayEnd = parseLocalDateParam("2026-05-31", new Date("2026-01-01"), true);

assert.equal(mayStart.getFullYear(), 2026);
assert.equal(mayStart.getMonth(), 4);
assert.equal(mayStart.getDate(), 1);
assert.equal(mayStart.getHours(), 0);
assert.equal(mayStart.getMinutes(), 0);
assert.equal(mayStart.getSeconds(), 0);
assert.equal(mayStart.getMilliseconds(), 0);

assert.equal(mayEnd.getFullYear(), 2026);
assert.equal(mayEnd.getMonth(), 4);
assert.equal(mayEnd.getDate(), 31);
assert.equal(mayEnd.getHours(), 23);
assert.equal(mayEnd.getMinutes(), 59);
assert.equal(mayEnd.getSeconds(), 59);
assert.equal(mayEnd.getMilliseconds(), 999);

const historicalOrder = {
  entryDate: "2026-05-15T10:30:00.000Z",
  createdAt: "2026-06-10T08:00:00.000Z",
};

assert.equal(formatReportingDay(getOrderReportingDate(historicalOrder)), "2026-05-15");
assert.equal(isWithinReportingRange(historicalOrder, mayStart, mayEnd), true);

const physicallyCreatedInMayButReportedInJune = {
  entryDate: "2026-06-02T09:00:00.000Z",
  createdAt: "2026-05-15T09:00:00.000Z",
};

assert.equal(isWithinReportingRange(physicallyCreatedInMayButReportedInJune, mayStart, mayEnd), false);

const futureOrderDateAlias = {
  orderDate: "2026-05-20T12:00:00.000Z",
  entryDate: "2026-06-20T12:00:00.000Z",
};

assert.equal(formatReportingDay(getOrderReportingDate(futureOrderDateAlias)), "2026-05-20");
assert.equal(isWithinReportingRange(futureOrderDateAlias, mayStart, mayEnd), true);

const doualaDay = reportingDateRange("2026-08-30", "2026-08-30", "Africa/Douala");
assert.equal(doualaDay.start.toISOString(), "2026-08-29T23:00:00.000Z");
assert.equal(doualaDay.end.toISOString(), "2026-08-30T22:59:59.999Z");

const johannesburgMonth = reportingDateRange("2026-08-01", "2026-08-31", "Africa/Johannesburg");
assert.equal(johannesburgMonth.start.toISOString(), "2026-07-31T22:00:00.000Z");
assert.equal(johannesburgMonth.end.toISOString(), "2026-08-31T21:59:59.999Z");

assert.equal(reportingDateString(new Date("2026-08-29T23:30:00.000Z"), "Africa/Douala"), "2026-08-30");
assert.equal(validReportingTimeZone("Not/A_Timezone"), "UTC");

console.log("reporting-date historical order tests passed");
