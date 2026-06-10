# XPRESSPRO Tenant Isolation Security Audit

Date: 2026-06-10
Severity: Critical

## Summary

XPRESSPRO uses `organisations.id` as the tenant boundary for owners, `sites.organisation_id` for owned branches, and `site_members` for invited users.

The audit confirmed a critical tenant-isolation flaw: the backend used `currentSiteId = null` to represent "All Sites", and multiple storage methods interpreted `null` as "no site filter". That made All Sites capable of reading data across the entire database.

## Vulnerable Query Classes

### Site Selector / All Sites

- `server/replit_integrations/auth/replitAuth.ts`
  - Before: session `currentSiteId` was trusted directly and exposed as `req.siteId`.
  - Risk: a stale or tampered selected site could be used without checking ownership.
  - Fix: middleware now resolves `authorizedSiteIds` on every authenticated request and builds `req.siteScope`.

- `server/routes.ts`
  - Before: `/api/auth/switch-site` accepted any `siteId` and persisted it.
  - Risk: a subscriber could switch into another subscriber's site by ID.
  - Fix: switch-site now rejects any `siteId` not present in `req.authorizedSiteIds`.

### Dashboard / Analytics / Reports

- `server/storage.ts`
  - Before: `getDashboardData(..., allSites = true)` used `sql\`1=1\`` and loaded `sites` using only `isActive = true`.
  - Risk: Dashboard All Sites showed every active site and global operational metrics.
  - Fix: dashboard now receives an explicit authorized site-id array and site overview uses `inArray(sites.id, scopedSiteIds)`.

- `server/storage.ts`
  - Before: `getReportData`, `getStatsBySite`, `getAnalyticsKpis`, `getPerformanceData`, `getWasteAlerts`, and `getPerformanceScore` treated `siteId = null` as global.
  - Risk: financial, profitability, revenue, expense, order, customer, machine, employee, and waste metrics could aggregate across tenants.
  - Fix: tenant-scoped storage methods now accept site scopes and fail closed when scope is empty.

### Orders / Customers / Expenses

- `server/routes.ts`
  - Before: list endpoints passed `req.siteId`; All Sites became `null`.
  - Risk: `/api/orders`, `/api/customers`, `/api/expenditures`, and cancellation/delay queues could return cross-tenant data.
  - Fix: list endpoints now pass `scopedSites(req)`.

- `server/routes.ts`
  - Before: direct object endpoints fetched records by ID without checking site ownership.
  - Risk: users could access another tenant's orders/customers/payments/status history by changing IDs.
  - Fix: customer, order, payment, status, delivery, and cancellation endpoints now enforce site access before returning or mutating data.

### Site Administration

- `server/routes.ts`
  - Before: update/delete/member/invitation site endpoints accepted site IDs without organisation ownership checks.
  - Risk: one subscriber could manage another subscriber's site, members, or invitations by ID.
  - Fix: site administration routes now require `canManageSite`, which verifies the site belongs to the current owner's organisation.

- `server/storage.ts`
  - Before: new sites were created under an organisation but did not add the owner as a site member.
  - Risk: membership-based authorization could omit new owner sites in future checks.
  - Fix: `createSite` now inserts an owner membership transactionally.

## Fixed Modules

- Site Selector / auth scope resolution
- Dashboard statistics
- Dashboard All Sites site overview
- Orders list and order detail
- Customers list, customer detail, and customer orders
- Reports and date-range report aggregations
- Analytics KPIs
- Revenue calculations
- Profitability calculations
- Expenses and waste alerts
- Machines and employees
- Cancellation queues
- Production delays
- Site management APIs
- Invitation APIs
- Payment APIs

## New Enforcement Rule

"All Sites" now means:

```text
all active sites the current authenticated subscriber owns or is explicitly a member of
```

It no longer means:

```text
all active sites in the database
```

## Regression Tests

Added:

- `server/lib/tenant-isolation.test.ts`
- `npm run test:tenant-isolation`

The test checks that:

- auth middleware builds `authorizedSiteIds` and `siteScope`
- stale unauthorized selected sites are rejected/reset
- All Sites routes pass `scopedSites(req)`
- dashboard All Sites no longer passes `null`
- unauthorized switch-site is rejected
- storage scope helpers fail closed instead of falling through to global data

## Verification

Passed:

- `npm run test:tenant-isolation`
- `npm run test:reporting`
- `npm run check`
- `npm run build`

## Residual Risk

Public aggregate stats remain intentionally global via `/api/public/stats`.

Legacy global storage methods such as `getOrders()` and `getStats()` still exist for internal/public use. They must not be used from authenticated tenant-facing routes unless wrapped in explicit authorization.
