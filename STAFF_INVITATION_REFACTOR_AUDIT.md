# Staff Invitation Refactor Audit

## Root Cause

Employee invitations were using the owner account funnel:

- `/join/:token` required the invited person to sign in or register through `/auth`.
- `/api/auth/register` always created an owner-style account.
- `ensureUserOrganisation()` and `isAuthenticated` could auto-create an organisation/site for any user without one.
- The invitation was accepted only after that account existed, so employees could become platform users before being attached to the invited site.

That polluted SaaS acquisition metrics and created a bad daily workflow for multi-site laundries.

## New Model

- `OWNER`: organisation creator, subscription holder, SaaS customer.
- `STAFF`: employee account, attached to an existing organisation/site, not a subscriber.

Staff accounts live in `users` with `user_type = "staff"`, plus `organisation_id`, `current_site_id`, and `site_members` role membership.

Existing owner accounts remain compatible because `user_type` defaults to `"owner"`.

## Save Path Impact

Customer, order, and payment writes still use the existing tenant-scope rules:

- staff sessions resolve authorized site IDs through `site_members`.
- single-site staff writes automatically use their assigned site.
- records are still written with the originating `site_id`.
- payments remain protected through the parent order's site authorization.

## API Changes

- `POST /api/staff/onboard/:token`
  - Public staff onboarding from a secure invitation token.
  - Creates a staff account only.
  - Attaches the staff user to the invitation organisation and site.
  - Starts a session on the invited site.

- `POST /api/staff/login`
  - Dedicated staff login.
  - Rejects organisation owners.

- `POST /api/auth/login`
  - Owner/subscriber login.
  - Rejects staff accounts and tells them to use staff login.

- `/api/settings`, `/api/subscriptions/*`, `/api/sites`, `/api/invitations/*`
  - Restricted to organisation owners.

## Analytics Change

Public laundry/customer acquisition metrics no longer count `site_members` owner rows.

`totalLaundries` now counts organisations, which maps to paying customer workspaces instead of employee memberships.

## Frontend Changes

- `/join/:token` now presents a staff credential form directly.
- Staff do not enter a business name.
- Staff do not register a subscriber account.
- `/staff-login` is a dedicated staff login page.
- `/auth` remains the owner/subscriber login and registration page.

## Devil's Advocate

- This change does not add database-level enum constraints for `user_type`; it relies on application writes for now.
- Existing staff who previously registered as owners are only normalized when they accept an invitation or are otherwise updated.
- Staff shares the same `users` table, so analytics must consistently use organisations/subscriptions, not raw users.
- Production needs `npm run db:push` or equivalent migration before deploy because `users.user_type` is a new column.
