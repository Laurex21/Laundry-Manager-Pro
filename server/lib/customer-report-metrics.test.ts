import assert from "node:assert/strict";
import { aggregateCustomerReportMetrics } from "./customer-report-metrics";

const rows = aggregateCustomerReportMetrics({
  customers: [
    { id: 1, name: "CARESSE", address: "Centre" },
    { id: 2, name: "LIBOIRE", address: "Nord" },
  ],
  periodOrders: [
    { id: 11, customerId: 1, totalAmount: "8500" },
    { id: 12, customerId: 1, totalAmount: "7000" },
    { id: 21, customerId: 2, totalAmount: "6250" },
    { id: 22, customerId: 2, totalAmount: "5125" },
  ],
  paymentsReceivedInPeriod: [
    // A payment on an older order is cash collected, but must not create a period order entry.
    { orderId: 5, customerId: 1, amount: "15000" },
    { orderId: 21, customerId: 2, amount: "6250" },
  ],
  paymentsAppliedToPeriodOrders: [
    { orderId: 12, customerId: 1, amount: "7000" },
    { orderId: 21, customerId: 2, amount: "6250" },
  ],
});

assert.deepEqual(rows.topCustomers, [
  {
    name: "CARESSE",
    orderCount: 2,
    orderValue: 15500,
    amountCollected: 15000,
    outstandingBalance: 8500,
  },
  {
    name: "LIBOIRE",
    orderCount: 2,
    orderValue: 11375,
    amountCollected: 6250,
    outstandingBalance: 5125,
  },
]);

assert.deepEqual(rows.customerAreas, [
  {
    area: "Centre",
    customerCount: 1,
    orderCount: 2,
    orderValue: 15500,
    amountCollected: 15000,
    outstandingBalance: 8500,
  },
  {
    area: "Nord",
    customerCount: 1,
    orderCount: 2,
    orderValue: 11375,
    amountCollected: 6250,
    outstandingBalance: 5125,
  },
]);

console.log("customer report metrics regression passed");
