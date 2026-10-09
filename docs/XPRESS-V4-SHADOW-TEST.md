# XPress Pro v4 shadow Sandbox test — review gate

Purpose: use the existing public app and the allowlisted organisation owner to test PawaPay Sandbox checkout → server verification → a **shadow** monthly plan. This never changes `subscriptions`, `saas_entitlements_v4`, staff access, site quotas, or real revenue. It is not a production subscription acceptance test.

## Prepared, not executed

- Additive SQL: `migrations/20261009_saas_v4_shadow_sandbox.sql` creates two separate test tables. It is not in the automatic migration runner.
- Routes `/api/subscriptions/v4/shadow-test` are hidden unless `SAAS_V4_SHADOW_TEST_ENABLED=true` and `SAAS_V4_SHADOW_TEST_EMAIL` matches the authenticated organisation owner. The token is the existing PawaPay Sandbox token, never a production token.
- The user page labels amounts fictitious and keeps the current real formula visible separately.
- Test amount equals the official v4 plan price, but no money is charged in Sandbox.
- Each checkout can activate its shadow plan once; repeated refreshes return `already_activated`. A different paid shadow plan starts immediately at a full new monthly cycle.

## Approval and execution sequence

1. Tumi reviews the additive production-database schema change and approves it explicitly. Back up the database first; no existing rows are modified by the SQL.
2. Apply only the shadow SQL on the public app's database. Verify the two empty tables and their constraints. Do **not** apply the real v4 entitlement migration or enable `SAAS_V4_PAID_BILLING` for this test.
3. Set the two shadow-test flags for the chosen owner in Replit's protected environment. Do not place email, passwords or API tokens in code or chat.
4. Deploy the reviewed branch, verify the displayed app build, then log in as the allowlisted owner. Confirm the real subscription still shows its original plan before and after testing.
5. Run Pro and Business Sandbox payments, refresh their status, and verify the shadow plan/dates and idempotency. Test a failed/expired checkout too.
6. Disable `SAAS_V4_SHADOW_TEST_ENABLED` after the test. Keep test tables for audit or remove them only after a separate destructive-change approval.

## Evidence and residual risk

TypeScript/build and an ephemeral PostgreSQL schema check pass. The latter verified that a second open test checkout and invalid shadow cycle are rejected. The routes and PawaPay payload have **not** been exercised against Replit or PawaPay yet. A payment shown as `COMPLETED` in Sandbox is fictitious; the real paid entitlement engine still needs a dedicated acceptance test before billing launch.
