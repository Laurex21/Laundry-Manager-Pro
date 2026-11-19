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
- Keep receipt and Super Admin release anchors enabled in production.
- These constraints do not prevent development work or isolated tests.
