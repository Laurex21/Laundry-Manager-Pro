# Laurepressing v4 paid pilot — review before execution

Scope: organisation **424** only. This plan is not a general subscription
rollout. No Replit or production database access is available to the author.

## Evidence and initial state

- Replit Agent read-only report (2026-10-10): legacy Enterprise active until
  2026-11-09 23:59:59.999 UTC; 1 active site, 0 active staff accounts.
- The v4 entitlement, intent and receipt tables were absent; enforcement and
  billing flags were unset. This report must be reconfirmed immediately before
  any write because the account may change.
- PawaPay Sandbox 1,000 XAF tests do not activate a real plan. The public
  domain explicitly refuses `SAAS_V4_PILOT_PROVIDER=sandbox`.

## Preconditions / hard stops

1. Review the branch diff, build and isolated SQL checks. Verify the published
   Replit build contains the reviewed commit. A GitHub push may cause Replit to
   publish automatically; do not assume publishing waits for a main merge.
2. Take and verify a database snapshot/backup. Record the current legacy
   subscription ID, status, plan ID and end date for organisation 424 only.
3. Verify that the production PawaPay API token is configured **without
   displaying its value**. Verify `SAAS_V4_PUBLIC_APP_ORIGIN` is the HTTPS
   public app origin, and that the PawaPay account is the intended merchant.
4. Re-run the read-only inventory. Abort if the legacy plan, site count or
   staff count differs from the reviewed initial state.
5. Confirm with the person paying that a production Business checkout charges
   **18,999 XAF real money**, starts a new monthly cycle immediately, and
   gives no credit for the remaining legacy Enterprise time.

## Controlled sequence

1. Apply `migrations/20261009_saas_entitlements_v4.sql` manually. This creates
   shared v4 tables but does not backfill or change other organisations.
2. Execute `scripts/seed-laurepressing-v4-pilot.sql`. It inserts only a
   provisional starter row for organisation 424, guarded by exact current
   Enterprise/footprint checks. Legacy Enterprise remains authoritative until
   a verified v4 receipt exists.
3. Enable billing only for organisation 424:
   `SAAS_V4_PAID_BILLING=true`, `SAAS_V4_PILOT_ORGANISATION_IDS=424`,
   `SAAS_V4_PILOT_PROVIDER=production`. Enable
   `SAAS_V4_ENFORCEMENT=true` only after verifying the scoped guards on the
   reviewed build. No other ID may be added during this pilot.
4. Before payment, verify the owner still sees Enterprise as historical and
   retains its rights; v4 Business is offered at 18,999 XAF. Verify other
   organisations remain on their legacy flow. Abort if any differs.
5. The owner starts one Business checkout and pays. Never activate from the
   browser redirect. The server must fetch PawaPay checkout status and verify
   `COMPLETED`, IDs, amount, reference, organisation and environment.
6. Verify exactly one v4 receipt and activation for the checkout, Business
   active with a new cycle, owner UI and super-admin v4 panel consistent,
   legacy Enterprise still present only as historical/rollback record.
   Re-run the verification after reload and duplicate reconciliation.

## Failure and rollback

- Before payment: turn off the v4 billing and enforcement flags and remove
  organisation 424 from the allowlist. The legacy Enterprise subscription was
  not changed. Do not delete shared tables or the provisional row as a quick
  rollback.
- After a real payment: **do not simply turn off the flags**; that would hide
  paid rights while keeping the money. Freeze further checkouts, compare the
  PawaPay receipt and database, then restore the paid entitlement or arrange a
  documented refund. No automatic rollback is safe after funds move.
- If status is uncertain or provider verification fails, leave the intent in
  review. Do not create another checkout until the first is reconciled.

## Residual risk / devil's advocate

- The pilot has not been tested against the real Replit database or production
  PawaPay API. Passing a build and isolated SQL test does not prove end-to-end
  activation.
- Platform-admin list filters and historical finance summaries still read
  legacy subscription records; the list row and organisation detail show v4
  after activation, but legacy rollups are not migrated.
- Premium-feature server guards are not comprehensively audited against the
  v4 entitlement model. This is a **single-organisation payment/plan pilot**,
  not approval to commercialise v4 for all organisations.
