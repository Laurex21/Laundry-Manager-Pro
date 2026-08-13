---
name: Stain treatment DB rollback procedure
description: Objects that must be dropped from the dev DB to fully revert the stain treatment pricing and order-money-foundation migrations.
---

## Context
The stain treatment pricing feature introduced two migrations applied to the dev DB via `ensureAuthSchema()`:
- `migrations/20260807_order_money_foundation.sql`
- `migrations/20260807_stain_treatment_pricing.sql`

When the feature was reverted (code files removed), the dev DB still held all these objects. Replit's publish system diffs dev DB → prod, so they would have been deployed to production unless explicitly dropped from dev DB.

## Full drop sequence (run in this order)

### 1. Stain treatment tables (CASCADE handles FK deps)
```sql
DROP TABLE IF EXISTS order_stain_treatment_adjustments CASCADE;
DROP TABLE IF EXISTS order_stain_treatments CASCADE;
DROP TABLE IF EXISTS stain_treatment_price_versions CASCADE;
DROP TABLE IF EXISTS stain_treatment_pricing_sets CASCADE;
```

### 2. Constraint on order_items
```sql
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_id_order_id_key;
```

### 3. Money-foundation tables
```sql
DROP TABLE IF EXISTS order_payment_allocations CASCADE;
DROP TABLE IF EXISTS order_refund_allocations CASCADE;
DROP TABLE IF EXISTS order_refunds CASCADE;
```

### 4. Triggers on surviving tables
```sql
DROP TRIGGER IF EXISTS enforce_order_tenant_identity ON orders;
DROP TRIGGER IF EXISTS preserve_order_posted_at ON orders;
DROP TRIGGER IF EXISTS derive_payment_tenant ON payments;
DROP TRIGGER IF EXISTS payments_append_only ON payments;
DROP TRIGGER IF EXISTS organisations_currency_freeze ON organisations;
```

### 5. Extra indexes (use CASCADE where needed)
```sql
DROP INDEX IF EXISTS orders_tenant_identity CASCADE;
DROP INDEX IF EXISTS payments_tenant_identity;
DROP INDEX IF EXISTS idx_payments_tenant_idempotency_key;
DROP INDEX IF EXISTS orders_organisation_id_site_id_idempotency_key_key;
```

### 6. Extra columns on orders (not in Drizzle schema)
```sql
ALTER TABLE orders DROP COLUMN IF EXISTS organisation_id;
ALTER TABLE orders DROP COLUMN IF EXISTS posted_at;
ALTER TABLE orders DROP COLUMN IF EXISTS idempotency_key;
ALTER TABLE orders DROP COLUMN IF EXISTS request_fingerprint;
```

### 7. Extra columns on payments (not in Drizzle schema)
```sql
ALTER TABLE payments DROP COLUMN IF EXISTS organisation_id;
ALTER TABLE payments DROP COLUMN IF EXISTS site_id;
ALTER TABLE payments DROP COLUMN IF EXISTS request_fingerprint;
```

### 8. Functions
```sql
DROP FUNCTION IF EXISTS enforce_order_tenant_identity() CASCADE;
DROP FUNCTION IF EXISTS preserve_order_posted_at() CASCADE;
DROP FUNCTION IF EXISTS derive_payment_tenant() CASCADE;
DROP FUNCTION IF EXISTS reject_order_money_mutation() CASCADE;
DROP FUNCTION IF EXISTS validate_payment_allocation_total() CASCADE;
DROP FUNCTION IF EXISTS validate_refund_allocation_total() CASCADE;
DROP FUNCTION IF EXISTS freeze_organisation_currency() CASCADE;
DROP FUNCTION IF EXISTS reject_stain_financial_mutation() CASCADE;
```

### 9. site_members column
```sql
ALTER TABLE site_members DROP COLUMN IF EXISTS capabilities;
```

## Why
After dropping code files, the dev DB still holds every object the migrations created. Replit's publish system reads the actual dev DB schema — not the Drizzle schema file — and generates SQL to make prod match dev. Any object present in dev but absent from prod becomes an ADD operation at publish time. Unique constraints on non-empty tables show as "potential conflicts" warnings; other objects (tables, columns) are added silently but incorrectly.

## How to apply
Run each step via `executeSql` in CodeExecution (dev environment, which is writable). Verify with a final query against `information_schema.tables` and `pg_constraint` to confirm all objects are gone before attempting to publish.
