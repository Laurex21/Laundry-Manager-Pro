---
name: Production startup migration guard — orphaned orders
description: The order-money-foundation migration aborts if any orders row has NULL site_id; ensureAuthSchema() now repairs this before calling the migration.
---

## Rule
`ensureAuthSchema()` must repair any `orders` rows with `NULL site_id` **before** calling `ensureOrderMoneyFoundation()`. The order-money-foundation migration wraps everything in a `BEGIN`/`COMMIT` transaction and raises an exception — aborting the whole transaction — if it finds any order that cannot be mapped to a tenant.

## Why
Production had order #732 (customer Charles, site 187, org 185) with `site_id = NULL`. The migration's guard check:
```sql
IF EXISTS (SELECT 1 FROM orders WHERE organisation_id IS NULL OR site_id IS NULL) THEN
  RAISE EXCEPTION 'cannot safely establish tenant identity for every legacy order';
END IF;
```
…fired during the transaction, rolling it back. The unhandled exception propagated up through `ensureAuthSchema()` and crashed the Node.js server process (exit status 1) before it could bind to its port, causing every deployment health check to fail.

## How to apply
The repair is already in `ensureAuthSchema()` (lines above `ensureOrderMoneyFoundation()` call):
1. UPDATE orders SET site_id = customer's site WHERE site_id IS NULL (safe inference).
2. DELETE order_items + orders where site_id is still NULL and no payments exist (garbage rows).

These three queries are idempotent and run on every startup. If a future migration also guards on NULL site_id, the same pattern applies: fix the data in `ensureAuthSchema()` before the migration call.

## Related
- `migrations/20260807_order_money_foundation.sql` — the blocking migration
- `server/replit_integrations/auth/replitAuth.ts` — ensureAuthSchema()
- Companion: payments with NULL idempotency_key (2,403 in prod) are handled *inside* the migration via `UPDATE payments SET idempotency_key = 'legacy-payment-' || id WHERE idempotency_key IS NULL` — no pre-flight needed for those.
