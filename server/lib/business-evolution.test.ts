import assert from "node:assert/strict";
import { aggregateBusinessEvolution } from "./business-evolution-aggregation";

const date = (value: string) => new Date(value);
const input = {
  startDay: "2026-09-28",
  endDay: "2026-10-04",
  granularity: "week" as const,
  timeZone: "Africa/Douala",
  orderRows: [
    { customerId: 1, entryDate: date("2026-09-28T08:00:00Z") },
    { customerId: 1, entryDate: date("2026-09-30T08:00:00Z") },
    { customerId: 2, entryDate: date("2026-10-01T08:00:00Z") },
  ],
  firstOrders: [
    { customerId: 1, firstDate: date("2026-09-28T08:00:00Z") },
    { customerId: 2, firstDate: date("2026-08-01T08:00:00Z") },
  ],
  paymentRows: [
    { date: date("2026-09-30T08:00:00Z"), amount: "800" },
    { date: date("2026-10-01T08:00:00Z"), amount: "200" },
  ],
  expenseRows: [{ date: date("2026-10-01T08:00:00Z"), amount: "300" }],
};
assert.deepEqual(aggregateBusinessEvolution(input), [{
  period: "2026-09-28", customersServed: 2, newCustomers: 1,
  revenue: 1000, expenses: 300, profit: 700,
}]);
assert.deepEqual(aggregateBusinessEvolution({ ...input, granularity: "month" }), [
  { period: "2026-09-01", customersServed: 1, newCustomers: 1, revenue: 800, expenses: 0, profit: 800 },
  { period: "2026-10-01", customersServed: 1, newCustomers: 0, revenue: 200, expenses: 300, profit: -100 },
]);
assert.equal(aggregateBusinessEvolution({ ...input, orderRows: [], firstOrders: [], paymentRows: [], expenseRows: [] }).length, 1);
console.log("business evolution aggregation tests passed");
