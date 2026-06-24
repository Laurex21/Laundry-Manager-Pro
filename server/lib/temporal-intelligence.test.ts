import assert from "node:assert/strict";
import { calculateChurnRiskScore, calculateCustomerSegment } from "./temporal-formulas";

assert.equal(calculateChurnRiskScore(2, 30, 10), null);
assert.equal(calculateChurnRiskScore(3, 12, 10), 15);
assert.equal(calculateChurnRiskScore(3, 18, 10), 55);
assert.equal(calculateChurnRiskScore(3, 30, 10), 100);

assert.equal(calculateCustomerSegment({
  totalRevenue: 12000,
  visitsPerMonth: 4,
  avgDepositHour: 8,
  visitCount: 4,
  avgDaysBetweenVisits: 7,
  daysSinceLastVisit: 3,
  totalOrders: 4,
}), "weekly");

assert.equal(calculateCustomerSegment({
  totalRevenue: 12000,
  visitsPerMonth: 4,
  avgDepositHour: 8,
  visitCount: 5,
  avgDaysBetweenVisits: 7,
  daysSinceLastVisit: 3,
  totalOrders: 5,
}), "early_morning");

assert.equal(calculateCustomerSegment({
  totalRevenue: 12000,
  visitsPerMonth: 4,
  avgDepositHour: 17,
  visitCount: 5,
  avgDaysBetweenVisits: 7,
  daysSinceLastVisit: 3,
  totalOrders: 5,
}), "evening");

assert.equal(calculateCustomerSegment({
  totalRevenue: 51000,
  visitsPerMonth: 2,
  avgDepositHour: 12,
  visitCount: 3,
  avgDaysBetweenVisits: 12,
  daysSinceLastVisit: 5,
  totalOrders: 3,
}), "vip");

console.log("temporal intelligence formula tests passed");
