# Storefront production migration approval

The owner requires a **new explicit validation before every storefront production
migration**, including the initial release. Previous publication approval is not
valid for this purpose. This instruction was confirmed on 20 November 2026
(Africa/Douala).

## Database enforcement

`scripts/sql/install-storefront-approval-guard.sql` installs three PostgreSQL event
triggers in `ENABLE ALWAYS` mode. They reject storefront DDL with SQLSTATE `42501`
and `STOREFRONT_APPROVAL_REQUIRED`. A rejection rolls back the DDL statement; an
explicit transaction cannot commit a partial migration after that error.

The guard covers `storefronts`, `storefront_*`, their catalog dependencies (indexes,
constraints, sequences, etc.), dynamic SQL, renames and cascading drops. It also
keeps the identities of existing protected objects so renaming or dropping an
index with an unrelated name cannot evade detection. A DDL batch mentioning a
protected name is conservatively rejected even if the mention is in a comment.
Ordinary application SELECT/INSERT/UPDATE/DELETE operations do not invoke this
guard. Unrelated DDL remains possible.

The private `xpresspro_release_guard` schema stores catalog identifiers only. It
is independent of the deployed application, build and Git branch. Therefore an
older application deployment does not remove the database protection. Replit
compares the actual development and production databases: reviewing source files
alone is insufficient to exclude storefront migrations.

This installation is an explicitly requested operational protection, **not a
feature migration**. Never run it from application startup, a build script, or
an automatic deployment command. It must be installed deliberately against the
verified production database. The installer is atomic and can be reinstalled to
refresh the protected-object inventory.

## Before every publication

1. Inspect the actual SQL proposed by Replit. Cancel if it touches storefront and
   there is no new owner validation for that exact SQL.
2. Verify the three event triggers below exist, use `evtenabled = 'A'`, and call
   `xpresspro_release_guard.require_storefront_approval`.
3. Keep the receipt and Super Admin release protections enabled.
4. If an unrelated publication is blocked by storefront schema differences,
   cancel and prepare an isolated development schema matching the approved
   release. Do not disable the production guard to get past Replit.

```sql
SELECT e.evtname, e.evtevent, e.evtenabled,
       n.nspname AS function_schema, p.proname AS function_name
FROM pg_event_trigger e
JOIN pg_proc p ON p.oid = e.evtfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE e.evtname IN ('xpresspro_storefront_approval_start',
                    'xpresspro_storefront_approval_end',
                    'xpresspro_storefront_approval_drop')
ORDER BY e.evtname;
```

## When the owner later validates a migration

Present the exact SQL, source commit, database target, data impact and recovery
plan. Record the owner's new validation and the SHA-256 of the reviewed SQL.
This repository contains **no approval token, environment-variable bypass or
automatic unlock**. Do not infer approval from an earlier feature request or PR.

Arrange a controlled migration window and a reviewed procedure that restores the
guard and refreshes its object inventory before any transaction is committed.
Never leave the triggers disabled across an unattended Replit publication.
The owner/database administrator can deliberately modify this protection; it is
a safeguard against accidental publishing, not a restriction on the owner.

## Verification

Run `npm run test:storefront-approval` locally and in CI. Tests execute the SQL on
an isolated PostgreSQL-compatible PGlite database, covering first creation,
existing tables, indirect objects, rollback, normal application data operations,
unrelated schema changes, replication mode and reinstallation.

Production verification must use a transaction that always rolls back or an
exception-catching DO block. Never commit sample storefront tables or customer
records merely to test the guard.
