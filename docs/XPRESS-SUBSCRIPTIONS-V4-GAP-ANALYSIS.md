# XPress Pro SaaS subscriptions v4 — first-pass gap analysis

Status: source-code review only, 9 October 2026. No production database inventory, migration or deployment performed. The attached v4 commercial specification is the target, not the current UI.

Branch progress: the pure v4 tariff/proration module and an additive organisation-scoped entitlement schema are staged. The schema migration is intentionally **not** included in the automatic migration runner, and no production records have been backfilled. The live subscription reads and activation API still use legacy tables until the full transition is verified.

The production inventory query is in `scripts/inventory-saas-v4-readonly.sql`. It reports organisation IDs, legacy plan/status/end date, age band, site counts and two staff-account count methods without personal data. It has **not** been executed: this worktree has no production database connection. Staff records and auth accounts can diverge, so ambiguous counts require manual review before quota migration.

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

## Quota enforcement entry points found

- `POST /api/sites` → `storage.createSite`: the insertion is transactional but does not lock the organisation or check active-site entitlement. A count in the route alone would race under concurrent requests.
- `POST /api/employees` and `PATCH /api/employees/:id`: these operate on employee records, which are not identical to authenticated staff seats. The SaaS quota must not use employee-record count as its sole source of truth.
- `POST /api/staff/onboard/:token` → `storage.createStaffFromInvitation`, plus `storage.acceptInvitation`: both create or attach authenticated staff accounts/site membership. They require organisation-scoped, atomic seat checks at acceptance. Merely limiting invitation creation is insufficient.
- Site deactivation uses `storage.deleteSite` to set `is_active = false`; existing members and data remain. This is compatible with data preservation but must be reconciled with the v4 rule that optional-site removal takes effect at the *next* renewal, not immediately.

**Implementation gate:** define one canonical active staff-seat representation, including subscription-suspended sessions, before writing these guards. Neither `users` nor `employees` currently has a subscription-suspended status. Applying a simple count could block legitimate users or allow concurrent over-allocation.

The staged `saas_staff_seats_v4` schema now represents one authenticated account per organisation with `active` or `subscription_suspended` state. It is not backfilled or enforced yet. The database foreign keys alone do not prove that the user belongs to the same organisation; the eventual migration and all seat mutations must validate `users.organisation_id`, and all activation must lock the organisation/entitlement row before counting seats. Existing open sessions must be checked at each authenticated request, not just at login. `server/replit_integrations/auth/replitAuth.ts:isAuthenticated` is the central session gate; login and invitation onboarding are additional entry points to inspect.

An access-time staff check is now staged in `isAuthenticated` behind `SAAS_V4_ENFORCEMENT=true` (default off). It denies missing/expired entitlements or suspended/missing seats on every authenticated request, while preserving owner access. **Do not enable the flag** before applying the reviewed schema, backfilling every legitimate staff account, and verifying login/onboarding and non-`isAuthenticated` routes. The access check does not enforce atomic seat allocation; that remains a separate required lot.

`storage.createSite` now locks the v4 entitlement row and checks active-site capacity in the same transaction, under the same disabled flag. Concurrent site creates therefore serialize once the flag is enabled. Other site insertion paths and staff-seat writers still need review before turning it on. After installing the lockfile dependencies in this isolated worktree, `npm run check` and `npm run build` both pass; the earlier missing local `@replit/connectors-sdk` was an incomplete installation, not a code defect.

Both invitation acceptance paths now lock the pending invitation and the organisation entitlement, reserve an authenticated staff seat and insert/attach the account in one transaction under the disabled flag. Existing active seats can join another site without consuming another seat; suspended seats cannot self-reactivate via invitation. The remaining high-risk work is a reviewed legacy-seat backfill, an owner-controlled selection/restore flow for over-quota accounts, and a full endpoint/permission test with a database. Do not confuse this with `employees` personnel records.

Trial reminder policy is staged as a pure rule with organisation IANA time zone (default `Africa/Douala`) and a dedicated in-app notice ledger. It offers owner-only reminders from exactly J23 until expiry, stops after payment, and distinguishes the one-time expiry notice. Database uniqueness supports at most one reminder per organisation/local day and one expiry notice ever. A disabled-by-default claim endpoint and a banner in the common authenticated layout are wired; no outbound channel is wired and the new table is not migrated. The banner is claimed on layout mount, not generated by a scheduled job. A rapid navigation before its response could consume the once-daily notice without displaying it; a durable in-app inbox would remove that edge case.

The pure paid-plan transition now models confirmed trial/Starter-to-paid and **any switch to another paid plan**, including Business-to-Pro: full target base price, immediate new UTC monthly cycle, no credit, with short-month clamping. Stevve's 9 October clarification overrides the v4 document's scheduled downgrade rule *when the customer pays for the other plan immediately*; a downgrade request without immediate payment remains scheduled. This is **not connected to any provider or database write**. Same-plan early renewal is intentionally rejected pending a defined renewal policy; recurring anniversary anchoring after a short month also needs a deterministic decision/test before charging.

An additive, production-only payment-intent and receipt ledger is staged in the unexecuted migration. It separates real payments from the 1,000 XAF Sandbox table, snapshots the requested plan/amount, constrains the environment to production and permits at most one receipt per checkout ID. A composite foreign key prevents a receipt being recorded under a different organisation from its intent. No production checkout endpoint, PawaPay token use, provider verification or entitlement activation is wired yet; a schema alone is not a payment safety gate.

The [official pawaPay Merchant API v2 Postman collection](https://www.postman.com/pawapay-4106/pawapay/documentation/f2x5p5r/pawapay-merchant-api-v2) lists both `GET /v2/checkouts/{checkoutId}` and `GET /v2/deposits/{depositId}`; its deposit-status example includes final status, amount, currency and country. The staged checkout inspector checks immutable identity/amount/organisation/plan but *never* treats checkout `COMPLETED` as authority to activate: it returns `deposit_verification_required`. The exact deposit linkage in the checkout-status response still requires a verified v2 sample; do not guess a field name or enable charging until a completed deposit can be matched and validated. No provider call has been made from the v4 branch.

## Safe implementation order

1. Inventory production organisations, current Enterprise subscriptions, site/staff counts and expiry dates read-only. Identify whose access would narrow. Review migration mapping before any production write.
2. Establish central v4 plan and entitlement model, including owner exclusion, UTC cycles and pending downgrade. Keep current behaviour until migration gate.
3. Add server-side org-scoped enforcement across site/staff activation and premium API entry points; preserve data and suspend, never delete, over-quota accounts.
4. Add trial lifecycle and notification deduplication. Test expiry with scheduler delays, time zones and existing sessions.
5. Add isolated production payment intents and PawaPay reconciliation. In one transaction verify matching amount/currency/organisation/plan and apply each confirmed payment once. Disable the free activation route for the paid pilot before charging.
6. Add exact-cycle add-on proration and one renewal invoice; reconcile failures and duplicated/out-of-order callbacks or polls.
7. Update customer and Super Admin UI, verify full acceptance matrix, and present deployment/rollback plan. No public announcement, migration or Replit deployment before explicit approval.

## Devil's advocate / blockers

### Isolated schema check — 9 October 2026

The v4 migration was applied to an ephemeral PGlite PostgreSQL database with only stub organisation/user parent rows. Inserts verified that the partial unique index rejects a second open checkout for one organisation, the composite foreign key rejects a receipt attached to a different organisation, and the receipt primary key rejects a duplicate receipt. This is **schema-level evidence only**. It does not exercise the application transaction, PawaPay API, existing Replit schema, or production migration/backfill. No production data was read or changed.


- **Critical:** the free activation endpoint allows a paid plan without payment. Do not enable paid billing while it exists for pilot organisations.
- **High:** historical Enterprise subscribers may depend on rights absent from v4 Business/Pro. Automatically downgrading them risks service loss. A production inventory and per-organisation transition review are required.
- **High:** provider `COMPLETED` for a fictive Sandbox checkout proves connectivity, not production settlement. Never count Sandbox or legacy `subscription_payments.completed` as paid SaaS revenue.
- **High:** changing only plan cards or hiding premium buttons would leave API bypasses. Audit and enforce each relevant server entry point and open staff sessions.
- **High:** calendar-month transitions, add-on rounding and concurrent payments need deterministic tests. A new paid cycle must not double-activate on polling/callback retries.
- **Resolved commercial clarification:** a confirmed payment for any *different* paid plan starts it immediately, including Business-to-Pro; a downgrade request without immediate payment remains scheduled for the next renewal. The amount and loss of remaining time must be displayed before payment.
