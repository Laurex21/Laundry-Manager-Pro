---
name: Publish-time schema drift
description: Why production broke after publishing the customer-credit update, and how to avoid repeats
---

**Rule:** Any code that queries new columns must have those columns in the development database before publishing. Replit Publish compares development to production and applies the resulting schema diff; do not add production DDL to startup or deployment commands.

**Why:** July 2026 outage — the app was published from `feat/customer-credit-20260728` while main and the dev DB lacked `customers.credit_balance` etc. All customer pages went down in production.

**How to apply:** Before publishing schema-dependent code: (1) merge to main, (2) apply the migration or schema push to the development database, (3) verify the expected columns there, then (4) republish and review the production schema diff. Never bypass Publish with direct production DDL or startup-time schema mutation.
