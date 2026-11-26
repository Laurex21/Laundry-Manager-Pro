# Production publication constraints

The owner confirmed on 20 November 2026 (Africa/Douala): **wait for a new explicit
validation before any storefront production migration**, including an initial
migration. This supersedes earlier storefront publication permission.

- Read `docs/releases/replit.md` and `docs/releases/storefront-approval.md` before
  any production publication or database migration.
- Inspect the actual Replit database diff, not just migration files in Git.
- Do not disable, remove, bypass, or automatically unlock the PostgreSQL
  `xpresspro_storefront_approval_*` event triggers to publish another feature.
- Present the exact storefront SQL and impact to the owner for new validation.
  A feature request, prior approval, successful tests or merged PR is insufficient.
- Keep receipt, Super Admin and Starter branding release anchors enabled in production.
- These constraints do not prevent development work or isolated tests.

## Explicit owner-approved exception — 21 November 2026

The owner explicitly requested clarification of this exception and resubmission
to automatic approval review. It applies only to the V2 `public.storefronts.branding`
addition reviewed in Replit, SHA-256 (UTF-8 SQL with final newline):
`4224bd1dd3fd8b60c7d9870d29412c373dd30d671b3ccf57e2ab5453faefcb5e`.

For this approved migration only, a manually supervised transaction may temporarily
disable the three `xpresspro_storefront_approval_*` event triggers, execute the
exact approved ALTER TABLE, refresh the protected-object inventory, and restore
all three triggers to ENABLE ALWAYS before commit. Any error must roll back the
whole transaction, including trigger changes. Verify the production target, backup,
guards and column absence before execution and verify guards and column afterward.
Do not leave protections disabled during Replit publishing. This is not permission
for another migration, automatic unlock, or build/startup migration.

This clarification does not override tool approval review. Resubmit the concrete
action with the owner's explicit authorization; stop if review rejects it. Keep
receipt and Super Admin protections enabled. After successful migration, the owner
authorized V2 publication and an explicitly identified test on Laurepressing through
a simulated payment record and PDF receipt; no real money transfer or WhatsApp send.
