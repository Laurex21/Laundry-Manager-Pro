# XPRESSPRO Reporting Date Audit

## Result

The reporting engine now uses the order business date for report-period logic.

In this codebase the persisted business date field is `orders.entryDate`. This is the current implementation of the product concept described as `orderDate`.

## Replacements

- `server/storage.ts` / `getReportData`
  - Replaced report order filtering from `orders.createdAt` to `orders.entryDate`.
  - Removed `payments.date` filtering from report revenue.
  - Revenue is now summed from payments attached to orders whose `entryDate` is inside the selected report period.
  - Daily revenue buckets are now grouped by `orders.entryDate`, not `payments.date`.

- `server/storage.ts` / `sumPaymentsInRange`
  - Replaced payment-date revenue filtering with order-date filtering.
  - Revenue helpers now first select non-cancelled orders by `orders.entryDate`, then sum payments for those orders.

- `server/storage.ts` / `sumPaymentsInRangeBySite`
  - Replaced `payments.date` range filtering with `orders.entryDate` range filtering.
  - Site revenue now uses the same order-date rule and excludes cancelled orders.

- `server/storage.ts` / `getDashboardData`
  - Replaced today, week, and month order counts from `orders.createdAt` to `orders.entryDate`.
  - Dashboard revenue already flows through the revenue helper, so it now uses `orders.entryDate`.
  - All-sites overview monthly order count and revenue now use `orders.entryDate`.

- `server/storage.ts` / `getAnalyticsKpis`
  - Replaced period order counts from `orders.createdAt` to `orders.entryDate`.
  - KPI revenue now flows through the order-date revenue helper.

- `server/storage.ts` / `getPerformanceData`, `getWasteAlerts`, `getPerformanceScore`
  - Profitability and performance revenue now flow through the order-date revenue helper.

- `server/routes.ts` / `/api/reports`
  - Replaced generic `new Date("YYYY-MM-DD")` parsing with local day-boundary parsing.
  - This prevents timezone shifts from excluding the first or last day of a report range.

- `client/src/lib/demo-data.ts`
  - Demo dashboard today/week counts now use `entryDate` before falling back to `createdAt`.

## Operational Dates Left Unchanged

- Order list sorting still uses `createdAt`.
- Customer/order history sorting still uses `createdAt`.
- Payment history sorting still uses `payments.date`.
- Cancellation queues still use `updatedAt`.
- Delivery timing still uses `pickupDate` and `deliveredAt`.

These are operational workflows, not reporting period filters.

## Test Coverage

- Added `npm run test:reporting`.
- The test verifies that an order created in June with a May `entryDate` is included in May reports.
- The test also verifies that an order created in May with a June `entryDate` is excluded from May reports.
