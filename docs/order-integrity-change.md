# Order creation integrity

Order creation previously committed the order before saving its advance payment,
employee activities and machine usage. A later failure could leave a saved order
with missing related records and make a retry create another order.

`DatabaseStorage.createOrder` now saves all of those records and refreshes customer
analytics in one database transaction. Any failure rolls back all of them. The
existing machine and employee counters, garment verification, garment colors,
textile reserves, payment date and overpayment behavior are preserved. Negative or
malformed advances are rejected by the shared request schema.

The related insert logic lives in `server/lib/order-creation.ts`. Other storage
methods and the existing tenant authorization rules are unchanged. There are no
production schema changes or data migrations.

## Verification

- `npm run check`: passed.
- Build and `scripts/verify-production-build.ts`: passed.
- `npm run test:order-integrity`: passed; runs the real storage methods and
  authentication middleware against an in-memory PostgreSQL engine (PGlite), with
  synthetic records only and network database connections disabled.
- Covers successful partial/full/no advance payments, overpayment, free orders,
  garment details, machine and employee counters, rollback after payment failure,
  rollback after analytics failure, two organisations, staff with a corrupt
  cross-organisation membership, inactive sites, a forged selected site and empty
  scopes. These are database/middleware tests, not full browser tests.
- Of the 42 test files referenced by package scripts, 38 passed. Four existing
  source-pattern tests also fail against the unmodified base commit `2cbb0a0`:
  `dashboard-quick-links`, `garment-colors`, `navigation-destinations` and
  `order-dialog-viewport`. The garment storage assertion was pointed at the
  extracted module; its pre-existing correction-query assertion still fails.

The PGlite dependency is development-only. CI now runs the integration test.

## Release and recovery

Review the changes, run the checks in Replit's development workspace, then publish
through the existing Replit workflow. No production database access was used for
these checks. Reverting this change restores the previous code without a schema
rollback. A request whose response is lost after a successful commit can still
be retried as a duplicate: request-level order idempotency is outside this fix.
