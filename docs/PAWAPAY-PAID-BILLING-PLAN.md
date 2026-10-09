# XPress Pro paid billing — implementation gate

Status: design only. Do not activate production charging from this document. The current free plan selection and isolated PawaPay Sandbox test remain unchanged.

## Verified current state

- The Sandbox Checkout links an organisation and a selected plan and has been observed to reach `COMPLETED` by direct PawaPay status verification. It intentionally does not modify `subscriptions` or `subscription_payments`.
- `POST /api/subscriptions/activate` currently lets an owner select any active plan without payment. `createSubscription` cancels the former active row and creates a new one with a nominal end date one month later.
- `getUserSubscription` selects by `status = 'active'` without checking `end_date`; a lapsed subscription may still be presented as active. This must be resolved before paid expiry can be enforced.
- `subscription_payments` has no provider checkout ID, verification timestamp, currency, or uniqueness constraint. Historic `completed` rows cannot be treated as provider-verified receipts. The Super Admin KPI must not re-label them as verified revenue.

## Target payment invariant

An organisation's paid entitlement may change only after the server verifies a final PawaPay `COMPLETED` status through the production API for an intent it created, with the same immutable checkout ID, organisation, selected plan, amount, currency, country, and checkout code. Browser redirects and callbacks alone must never grant entitlement.

## Proposed implementation

1. Add a production payment-intent ledger separate from Sandbox. Record checkout UUID, organisation owner, plan ID, plan-price snapshot, XAF amount, provider checkout code, provider environment, state, timestamps, and activation reference. Enforce unique checkout IDs in the database.
2. Create a Checkout only when paid billing is explicitly enabled for a pilot organisation. Keep credentials server-side. While the platform is free, preserve self-service plan selection and show no paid Checkout to ordinary users.
3. Reconcile pending intents using the PawaPay production checkout status API. Per Stevve's 9 October 2026 product decision, a server-fetched `COMPLETED` checkout confirms payment when its immutable identity, reference, organisation, selected plan, amount, currency and country match the stored intent. A separate deposit lookup is optional diagnostic evidence, not a condition for activation. Reject mismatches; do not auto-correct them.
4. In one database transaction, lock the intent and relevant subscription rows, record a verified receipt once, apply the agreed plan-transition policy once, and mark the intent activated. Repeated polling or callbacks must return the same result without creating another receipt or subscription.
5. Show distinct states to the customer: awaiting payment, provider confirmed, plan activated, failed/expired, and requires manual review. The Super Admin should show the source and time of verification; manual plan grants remain audited and are not counted as revenue.
6. Count only provider-verified production receipts as confirmed subscription revenue. Keep historical `completed` rows separately labelled as unverified legacy records until reconciled; do not delete or rewrite them automatically.

## Confirmed v4 commercial rules (9 October 2026)

The previous prices and open questions in this document are superseded by `PROMPT_IMPLEMENTATION_ABONNEMENTS_XPRESSPRO_v4` supplied by Stevve. The live cards are *not* the approved tariff schedule.

- Starter: **0 XAF**, one site, owner only, unlimited orders. Pro: **10,999 XAF/month**, one site, two active staff plus owner, unlimited orders. Business: **18,999 XAF/month**, two sites, five active staff plus owner, unlimited orders. Enterprise is not part of the target catalogue.
- Each additional active staff member costs **2,000 XAF/month**. Each additional Business site costs **5,000 XAF/month** and grants two further active staff slots. Owner is outside staff quota.
- A confirmed payment for a *different* paid plan starts it immediately at its full price, with a fresh monthly cycle and no credit or plan-price proration, including Business → Pro (Stevve clarification, 9 October 2026). A downgrade request **without immediate payment** is scheduled for the next renewal. Added sites/staff are prorated over the exact remainder of the current cycle; removals take effect at the next renewal.
- A new organisation gets 30 days of Pro trial, without automatic charging, then Starter. An expired unpaid paid cycle returns immediately to Starter without grace. Preserve all historical data and suspend excess staff rather than deleting them.
- Existing organisations require a reviewed migration inventory. Organisations older than 30 days get a seven-day transitional Pro period; newer organisations complete their original trial with at least seven days' notice. Do not apply this to production without migration approval.
- The first paid pilot date and scope remain undecided. Default must remain off. Production credentials, provider reconciliation, and entitlement activation remain separate from the fictive Sandbox flow.

## Required acceptance tests

- Sandbox-only user test cannot create production receipts or subscriptions.
- Provider `ACCEPTED` and browser return do not activate a plan; only verified final `COMPLETED` can.
- Duplicate status checks/callbacks produce exactly one receipt and one entitlement transition.
- Wrong amount, currency, checkout ID, checkout code, organisation, or plan never activates.
- Failure, expiration, network timeout, and a provider/local status conflict stay visible and do not activate.
- A paid pilot cannot bypass checkout through the existing free-activation endpoint once that pilot is explicitly enabled.
- Expired paid entitlements are not represented as current; manual grants remain distinguishable from paid entitlements.

## Devil's advocate

The current Sandbox success proves provider connectivity and status polling, not production settlement, price correctness, refund handling, or entitlement safety. A direct cutover using the existing `subscription_payments` table would risk granting a plan for an unverified or duplicate payment. The safe next code lot is the isolated ledger and transaction engine behind a disabled pilot flag; production payment creation and public launch remain separate gates.
