# PawaPay sandbox callback intake

Endpoint: `POST https://app.xpressclean.cm/api/payments/pawapay/sandbox/callback`

This endpoint is **sandbox-only**. It verifies PawaPay's RFC 9421 ECDSA P-256 callback signature and body digest using the public key supplied by the PawaPay sandbox, then acknowledges a valid final-status callback with HTTP 200. For a known sandbox checkout, it records the final status idempotently in `pawapay_sandbox_checkouts`. It makes **no payment, subscription, or customer-data changes**. It logs only the operation ID and status.

Do not enter this URL in a production PawaPay account. Do not use it as evidence that billing has been integrated. An actual payment flow still needs a pending transaction record, verified final-status processing, idempotent crediting, and reconciliation. The current XPress Pro plan-selection period is free and does not create payments.

Sandbox setup:

1. Enable **Sign all callbacks** in PawaPay Dashboard → API Security.
2. In sandbox Callback URLs, use the endpoint above only for the operation type being tested (Checkout or Deposit). Do not configure Payouts or Refunds unless those flows are actually implemented.
3. The additive `pawapay_sandbox_checkouts` schema is ensured by the server when the test feature is first used; the reviewed SQL is also available at `migrations/20261008_pawapay_sandbox_checkouts.sql` for manual application if needed.
4. Store the sandbox API token in the server-side Replit Secret `PAWAPAY_SANDBOX_API_TOKEN`, never in chat or source code. Do not configure a production token under this name.
5. In the Super Admin, open a test organisation's **Subscription** tab and create a 1,000 XAF sandbox Checkout. Open its hosted payment page, use PawaPay's Cameroon sandbox test data, then refresh the checkout list to confirm the final status arrived. **Check with PawaPay** queries the provider directly if the callback was missed; it never changes a real subscription or payment.
6. Verify that no row was written to `subscription_payments`, no subscription was changed and the financial KPI did not increase. An unsigned or tampered callback must return HTTP 401.

References: [PawaPay callback handling](https://docs.pawapay.io/v2/docs/what_to_know#callbacks), [callback signatures](https://docs.pawapay.io/v2/docs/signatures#signatures-in-callbacks), [callback URLs](https://docs.pawapay.io/dashboard/other/system_conf/callback_urls).
