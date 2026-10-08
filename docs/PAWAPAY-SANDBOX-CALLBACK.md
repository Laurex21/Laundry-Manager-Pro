# PawaPay sandbox callback intake

Endpoint: `POST https://app.xpressclean.cm/api/payments/pawapay/sandbox/callback`

This endpoint is **sandbox-only**. It verifies PawaPay's RFC 9421 ECDSA P-256 callback signature and body digest using the public key supplied by the PawaPay sandbox, then acknowledges a valid final-status callback with HTTP 200. It is idempotent because it makes **no payment, subscription, or customer-data changes**. It logs only the operation ID and status.

Do not enter this URL in a production PawaPay account. Do not use it as evidence that billing has been integrated. An actual payment flow still needs a pending transaction record, verified final-status processing, idempotent crediting, and reconciliation. The current XPress Pro plan-selection period is free and does not create payments.

Sandbox setup:

1. Enable **Sign all callbacks** in PawaPay Dashboard → API Security.
2. In sandbox Callback URLs, use the endpoint above only for the operation type being tested (Checkout or Deposit). Do not configure Payouts or Refunds unless those flows are actually implemented.
3. After deployment, generate the sandbox API token using PawaPay's own dashboard. Store it in the approved server-side secret store, never in chat or source code.
4. Initiate a sandbox operation with PawaPay's test data. Verify that the dashboard reports callback delivery and that application logs show a verified operation ID and final status. An unsigned or tampered request must return HTTP 401.

References: [PawaPay callback handling](https://docs.pawapay.io/v2/docs/what_to_know#callbacks), [callback signatures](https://docs.pawapay.io/v2/docs/signatures#signatures-in-callbacks), [callback URLs](https://docs.pawapay.io/dashboard/other/system_conf/callback_urls).
