---
name: Publish-time schema drift
description: Why production broke after publishing the customer-credit update, and how to avoid repeats
---

**Rule:** Any code that queries new columns must have those columns in BOTH the dev database and `ensureAuthSchema()` (server/replit_integrations/auth/replitAuth.ts) before publishing. Publishing from an unmerged feature branch skips the publish-time schema diff (which compares dev DB → prod), leaving prod missing columns and crashing with 42703 "column does not exist".

**Why:** July 2026 outage — the app was published from `feat/customer-credit-20260728` while main and the dev DB lacked `customers.credit_balance` etc. All customer pages went down in production.

**How to apply:** Before any publish involving schema changes: (1) merge to main, (2) apply the migration to the dev DB, (3) mirror the DDL idempotently (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) in `ensureAuthSchema()` — that function is this codebase's established startup self-heal path for production DDL and one-time data corrections.
