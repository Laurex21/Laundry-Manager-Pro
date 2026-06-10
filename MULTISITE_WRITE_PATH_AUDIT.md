# Multi-Site Write Path Audit

Date: 2026-06-10

## Root Cause

Invited sub-site users could open customer, order, and payment forms because read
authorization was based on their authorized site scope. Save operations were less
complete: several create routes wrote records using `req.siteId` directly.

For invited users, `req.siteId` can be `null` when the session has no selected
site yet, even if the user has exactly one authorized sub-site. That made writes
ambiguous and could create records outside the visible site scope or cause the UI
to show a generic failed save.

The service list had the same shape: default services were auto-seeded only when
`req.siteId` was set. A sub-site with an authorized scope but no selected session
site could therefore have no services, making order creation fail.

## Fixes Applied

- Added an explicit write-site resolver.
- Single-site employees automatically resolve writes to their only authorized
  site.
- Users in `All Sites` mode must select a specific site before creating
  site-originated records.
- Invitation acceptance now updates the active session's `currentSiteId` to the
  invited site immediately.
- Customer creates now always save with a resolved site ID.
- Order creates now always save with a resolved originating site ID.
- Order creation validates that the selected customer belongs to the same
  organisation scope.
- Order creation validates that selected services belong to the same organisation
  scope.
- Service auto-seeding now uses the resolved write site, so newly invited
  single-site employees can get default services for their branch.
- Customer and service reads now use organisation site scope, so shared working
  data can be available across sites in the same organisation.
- Service update/delete now checks organisation/site access before mutating.
- Frontend customer and order create mutations now display backend rejection
  reasons instead of generic failure messages.

## Visibility Rules

- Customers: organisation-visible, with originating `siteId`.
- Services: organisation-visible, with originating `siteId`.
- Orders: site-originated and filtered by authorized operational site scope.
- Payments: protected through the parent order's site authorization.
- Expenses, machines, employees: site-originated writes require an explicit
  writable site.
- HQ/admin owner: can view all active sites in the organisation.
- Branch employee: can write to their assigned site; shared customer/service data
  can be read across the organisation.

## Remaining Hardening

- Add real database constraints after production data is confirmed clean:
  non-null `site_id` for site-originated tables and unique
  `site_members(site_id, user_id)`.
- Add backend role checks for owner/manager/operator action boundaries.
- Add direct-ID authorization checks for remaining non-critical update/delete
  routes such as expenses, machines, employees, and garment treatment actions.
- Consider adding `organisation_id` directly to customers and services if they
  are intended to be true organisation-level master data long term.
