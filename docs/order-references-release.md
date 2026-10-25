# Order references and desktop menu

New orders receive a stored `order_reference`, for example `LP-26-2X7N85B`. The prefix comes from the site name at creation, the year uses Africa/Douala, and the seven-character suffix is a bijection of the serial ID (not a security token). A unique database index provides additional protection. IDs and foreign keys remain numeric. Corrected replacement orders receive distinct references.

Existing orders are not backfilled or renumbered. Their previous display numbering remains available. A renamed site or changed order date does not regenerate a stored reference. Searches accept references without case sensitivity in orders, unpaid queues and the payment ledger. Standard, thermal and subscriber receipts use the reference while archive requests retain the internal ID.

The desktop sidebar uses larger text and icons and distributes available height among navigation groups. Mobile styles remain independent. All 14 links were visible without sidebar overflow at 1280×720 in development.

## Release prerequisite

Apply only the reviewed `migrations/20261025_order_references.sql` to the intended database before starting this version. It adds a nullable column and a unique index; it does not update existing rows. Startup checks the column exists and does not run this migration automatically. This migration has been applied only to the isolated Replit development database. Production requires its own backup and explicit migration authorization before deployment.

Keep `SAAS_BILLING_MODE=disabled`, `SAAS_LIVE_ENABLED=false`, and `XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED=true`. Merging this change does not authorize a production migration or deployment.

## Validation

`npm run check`, `npm run test:order-references`, `npm run test:order-integrity`, receipt/export, corrected-order, production-cycle and daily-report regression checks, plus the Replit build passed. The reference tests use an in-memory PostgreSQL engine, exercise migration replay, 100,000 unique references, the Douala year boundary and FR/EN receipt content. The integrity suite covers rollback, tenant boundaries and corrected copies.

Development UI verification used the fictitious SITE TEST QA account: order 57 displayed `ST-26-2X7N85B`, retained its internal ID, and its fictitious 100 FCFA cash advance appeared under the same reference in the ledger. Case-insensitive searches were verified in all three screens. No production data was changed.
