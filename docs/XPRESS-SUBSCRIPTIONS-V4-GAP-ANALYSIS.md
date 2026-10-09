# XPress Pro SaaS subscriptions v4 — first-pass gap analysis

Status: source-code review only, 9 October 2026. No production database inventory, migration or deployment performed. The attached v4 commercial specification is the target, not the current UI.

Branch progress: the pure v4 tariff/proration module and an additive organisation-scoped entitlement schema are staged. The schema migration is intentionally **not** included in the automatic migration runner, and no production records have been backfilled. The live subscription reads and activation API still use legacy tables until the full transition is verified.

| Area | Current state | v4 target | Assessment |
| --- | --- | --- | --- |
| Catalogue | `server/storage.ts` seeds Starter 6,000, Pro 15,000, Business 30,000, Enterprise 50,000 XAF, with order/user limits | Free Starter; Pro 10,999; Business 18,999; unlimited orders; no Enterprise | Existing, incompatible |
| SaaS subscription scope | `subscriptions.user_id` | Organisation-level entitlement | Missing |
| Trial | No SaaS `trial_started_at` / `trial_ends_at` in subscription schema | 30-day organisation Pro trial and expiry enforcement | Missing |
| Plan activation | `POST /api/subscriptions/activate` calls `createSubscription` without payment; prior active subscription cancelled immediately | Paid changes only after verified provider completion; downgrades scheduled | Existing, unsafe for paid launch |
| Expiry | `getUserSubscription` filters active status, not `end_date` | Starter at expiry even when scheduler lags | Missing |
| Payment record | `subscription_payments` lacks provider checkout reference, verified time, currency and idempotency key | Provider-verified, immutable intent/receipt ledger | Missing |
| PawaPay | Isolated 1,000 XAF Sandbox checkout and status reconciliation, no entitlement change | Production verified checkout, transaction-safe entitlement update | Pilot only |
| Sites/staff/add-ons | Existing sites/staff; no central v4 entitlement source found in first pass | Atomic org-scoped quota and add-on billing | Partial; endpoint-by-endpoint audit required |
| UI | Existing subscription cards and Sandbox test | v4 prices, cycle, quotas, trial countdown, precise payment terms | Existing, incompatible |

## Safe implementation order

1. Inventory production organisations, current Enterprise subscriptions, site/staff counts and expiry dates read-only. Identify whose access would narrow. Review migration mapping before any production write.
2. Establish central v4 plan and entitlement model, including owner exclusion, UTC cycles and pending downgrade. Keep current behaviour until migration gate.
3. Add server-side org-scoped enforcement across site/staff activation and premium API entry points; preserve data and suspend, never delete, over-quota accounts.
4. Add trial lifecycle and notification deduplication. Test expiry with scheduler delays, time zones and existing sessions.
5. Add isolated production payment intents and PawaPay reconciliation. In one transaction verify matching amount/currency/organisation/plan and apply each confirmed payment once. Disable the free activation route for the paid pilot before charging.
6. Add exact-cycle add-on proration and one renewal invoice; reconcile failures and duplicated/out-of-order callbacks or polls.
7. Update customer and Super Admin UI, verify full acceptance matrix, and present deployment/rollback plan. No public announcement, migration or Replit deployment before explicit approval.

## Devil's advocate / blockers

- **Critical:** the free activation endpoint allows a paid plan without payment. Do not enable paid billing while it exists for pilot organisations.
- **High:** historical Enterprise subscribers may depend on rights absent from v4 Business/Pro. Automatically downgrading them risks service loss. A production inventory and per-organisation transition review are required.
- **High:** provider `COMPLETED` for a fictive Sandbox checkout proves connectivity, not production settlement. Never count Sandbox or legacy `subscription_payments.completed` as paid SaaS revenue.
- **High:** changing only plan cards or hiding premium buttons would leave API bypasses. Audit and enforce each relevant server entry point and open staff sessions.
- **High:** calendar-month transitions, add-on rounding and concurrent payments need deterministic tests. A new paid cycle must not double-activate on polling/callback retries.
- **Open product interpretation:** v4 specifically schedules customer-requested downgrades at renewal, while a later statement says a newly paid plan starts immediately. Treat immediate effect as paid upgrades; confirm if a paid Business-to-Pro switch was meant to override the v4 downgrade rule.
