# PawaPay payout/refund notification receivers

Prepared in development only. Do not configure these URLs in Production until the code is published and verified.

- Payouts: `https://app.xpressclean.cm/api/saas/live/payout-callback`
- Refunds: `https://app.xpressclean.cm/api/saas/live/refund-callback`

Set `SAAS_PRODUCTION_ORIGIN=https://app.xpressclean.cm` on the future deployment. These acknowledgement-only endpoints deliberately work independently of `SAAS_BILLING_MODE`: keep billing disabled and automatic maintenance suspended while preparing notifications.

They require JSON, a valid PawaPay Production signature and body digest, a recent signing time, the configured HTTPS host, the exact route, a matching operation UUID and documented status/monetary fields. Missing origin or unavailable public keys fail closed. They reject oversized bodies and operation identifiers for a different flow.

A valid event receives HTTP 200 with `{ "received": true, "handled": false }`. Duplicate valid events receive the same response. No event history is persisted. These endpoints do not track payouts/refunds, initiate money movement, settle invoices, alter balances, or grant subscription access. Never use them as evidence that a refund was applied in the application. Do not route Checkout/Deposit callbacks here.

Validation: `node --import tsx server/lib/pawapay-notification-receivers.test.ts` uses generated keys, mock key retrieval and no database or external requests. Existing billing/live-launch and automatic-maintenance tests must also remain passing before release.

References: https://docs.pawapay.io/v2/api-reference/payouts/payout-callback and https://docs.pawapay.io/v2/api-reference/refunds/refund-callback
