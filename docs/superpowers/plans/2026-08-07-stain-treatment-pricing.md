# Stain Treatment Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-safe, fixed-price Standard, Intensive, and Very intensive stain treatment to piece- and kilogram-based XPress Pro orders.

**Architecture:** Add versioned site pricing and append-only posted treatment-charge tables, then centralize decimal calculation, price resolution, cumulative-quantity validation, and adjustment rules in a focused server service. Extend the existing order flow, membership calculation, corrections, receipts, settings, detail pages, and reports without representing stain treatment as a normal cleaning service or accepting client-calculated money.

**Tech Stack:** PostgreSQL, Drizzle ORM, Express 5, Zod, React 18, TanStack Query, React Hook Form, i18next, TypeScript, tsx regression tests.

---

## Scope and invariants

- Levels: `standard`, `intensive`, `very_intensive`.
- Units: `piece`, `kg`.
- Every enabled site must have six active rates; each unit must satisfy Standard < Intensive < Very intensive.
- XPress Pro uses decimal strings and a platform-wide two-decimal money rule. Kilogram treatment quantity has at most two decimal places; piece quantity is an integer.
- The server derives tenant, site, currency, service unit, active rate, and totals. The client cannot supply them.
- Posted charges are immutable. Corrections use linked append-only adjustments or voids.
- Net effective treatment quantity for an order item must remain between zero and its service quantity, transactionally.
- Stain treatment is excluded from membership coverage and all order discounts.
- Very intensive treatment requires versioned staff attestation that the customer received the non-guarantee warning.
- Do not call the feature live until GitHub and Replit deployment are both verified.

## File map

### Create

- `shared/stain-treatment.ts` — enums, Zod inputs, DTOs, and pure decimal/domain rules.
- `shared/order-money.ts` — declared decimal arithmetic, authoritative money DTOs, refund/allocation contracts.
- `server/lib/stain-treatment.ts` — rate configuration, price resolution, posting, adjustment, and reporting service.
- `server/lib/order-money.ts` — shared decimal totals, payment/refund allocation, and balance recalculation.
- `server/lib/stain-treatment-routes.ts` — authenticated configuration and reporting endpoints.
- `server/lib/stain-treatment-domain.test.ts` — pure decimal and domain tests.
- `server/lib/stain-treatment-schema.test.ts` — disposable-Postgres migration/constraint tests.
- `server/lib/stain-treatment-api.test.ts` — authenticated multi-tenant API integration tests.
- `server/lib/stain-treatment-concurrency.test.ts` — real two-connection transaction-race tests.
- `server/lib/stain-treatment-ui.test.ts` — UI wiring, translations, and accessibility-source gate.
- `server/lib/order-refunds.test.ts` — refund, allocation, and paid-order correction tests.
- `scripts/test-stain-postgres.ts` — safe unique-schema database harness, migration/self-heal parity, and cleanup.
- `playwright.stain-treatment.config.ts` — isolated browser test configuration.
- `e2e/stain-treatment.spec.ts` — desktop/mobile workflow and accessibility browser tests.
- `scripts/seed-stain-treatment-e2e.ts` — disposable tenant/site/role fixtures.
- `client/src/hooks/use-stain-treatment.ts` — pricing and report queries/mutations.
- `client/src/components/orders/stain-treatment-editor.tsx` — order-form treatment selection and acknowledgement.
- `client/src/components/settings/stain-treatment-settings.tsx` — six-rate site configuration.
- `migrations/20260807_stain_treatment_pricing.sql` — production schema and constraints.
- `migrations/20260807_order_money_foundation.sql` — authoritative currency, pricing permission, refunds, and allocations.

### Modify

- `shared/schema.ts` — pricing versions, posted charges, adjustments, relations, and types.
- `shared/routes.ts` — order-create treatment input and response DTO.
- `server/replit_integrations/auth/replitAuth.ts` — idempotent schema self-heal.
- `server/routes.ts` — register routes and integrate treatment into order posting and order reads.
- `server/storage.ts` — transaction-aware order creation/read mapping.
- `server/lib/membership-routes.ts` — calculate coverage only from cleaning-service lines and add treatment afterward.
- `server/lib/order-corrections.ts` — audited treatment adjustments and final-total recalculation.
- `server/lib/subscription-receipt.ts` — separate treatment lines and uncovered amount.
- `client/src/pages/orders.tsx` — editor, preview, price-conflict retry, and non-discountable subtotal.
- `client/src/pages/order-detail.tsx` — treatment and acknowledgement history.
- `client/src/pages/settings.tsx` — settings panel.
- `client/src/pages/analytics.tsx` — treatment reporting panel.
- `client/src/lib/receipt.ts` — treatment receipt lines and Very intensive warning.
- `client/src/lib/i18n.ts` — English, French, and Portuguese copy.
- `package.json` — focused test command.

## Blocking foundation decisions

Implementation is split into a money-foundation prerequisite and the stain-treatment feature. The feature work must not start until the foundation gate passes.

### Authoritative currency

- Add `organisations.currency varchar(10) NOT NULL DEFAULT 'FCFA'` as the server authority. Existing organisations backfill to `FCFA`, matching the current XPress Pro deployment default; Owners may change it only before any posted financial record exists. Site-specific currency is out of scope.
- Client currency display reads authenticated organisation currency. The Zustand currency hook becomes a formatter/cache only and cannot override server financial currency.
- Every price, charge, payment, refund, receipt, and report derives currency from the order's organisation.

### Pricing permission

- Add explicit membership capabilities `manage_stain_treatment_pricing` and `view_stain_treatment_reports` to the existing `site_members.capabilities` JSONB model used by Business Analysis work. Organisation Owners receive both implicitly; Managers require each explicitly; Operators can never receive either.
- Settings visibility and server authorization both use effective capabilities. Hiding controls is never the security boundary.

### Refund and allocation model

- Add append-only `order_refunds` and `order_refund_allocations`. A refund has organisation, site, order, positive amount, currency, reason, idempotency key, canonical request fingerprint, actor, timestamp, and optional source payment. Allocations link a refund to a service, treatment charge, pickup/delivery, or remain explicitly unallocated. A database check requires exactly one allocation target/kind.
- Refunds never mutate or delete payments. Total allocated amount cannot exceed the refund, and treatment allocation cannot exceed collected cash attributable to that treatment after prior refunds.
- Paid-order corrections create either an outstanding balance, customer credit, or approved refund record according to the signed recalculated balance. No automatic external money send occurs.
- Booked treatment revenue changes only through treatment adjustment/void; collected treatment cash changes through deterministic payment allocation and treatment-linked refunds.

### Deterministic payment allocation

- Allocate incoming order payments in this order: discounted cleaning-service balance, non-discountable treatment, pickup/delivery, then other charges. Persist allocations in `order_payment_allocations`; do not infer historical allocations repeatedly in reports.
- Backfill existing payments as `unallocated` because treatment did not previously exist. New orders with treatment use explicit allocation rows.
- Payments also store tenant-scoped idempotency keys and canonical request fingerprints. Reuse with a different amount/order/payload is rejected. Payment/refund rows are locked before checking allocation sums so two transactions cannot over-allocate.

### Decimal policy

- Add direct dependency `decimal.js-light`; do not rely on a transitive lockfile package.
- Migrate every touched subtotal, discount, membership, treatment, correction, payment, refund, receipt, and report calculation away from JavaScript `Number`.
- `numeric(10,2)` money accepts `0.00` through `99,999,999.99`; inputs exceeding this are rejected before SQL. Round half-up once at line boundaries and keep DTO money as canonical two-decimal strings.

## Task 0: Build the authoritative order-money foundation

**Files:**
- Create: `shared/order-money.ts`
- Create: `server/lib/order-money.ts`
- Create: `server/lib/order-refunds.test.ts`
- Create: `migrations/20260807_order_money_foundation.sql`
- Modify: `shared/schema.ts`
- Modify: `server/replit_integrations/auth/replitAuth.ts`
- Modify: `server/replit_integrations/auth/routes.ts`
- Modify: `server/routes.ts`
- Modify: `server/lib/membership-routes.ts`
- Modify: `server/lib/order-corrections.ts`
- Modify: `client/src/hooks/use-currency.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/test-stain-postgres.ts`

- [ ] **Step 1: Write failing decimal and authoritative-currency tests**

Test canonical two-decimal strings, half-up multiplication/subtraction, `numeric(10,2)` bounds, organisation-currency derivation, denial of client currency overrides, FCFA backfill, and prevention of currency changes after posted financial activity.

- [ ] **Step 2: Write failing payment/refund allocation tests**

Test append-only positive payments/refunds, canonical request fingerprints, rejection of changed-payload key reuse, deterministic allocation order, exactly-one-target allocation checks, composite target tenant FKs, treatment-linked refund limits, explicit unallocated refunds, already-paid correction outcomes, and the rule that no external refund is sent automatically. Use two connections to prove locked payment/refund rows prevent concurrent over-allocation.

- [ ] **Step 3: Add the direct decimal dependency and test scripts**

Add `decimal.js-light`, `@playwright/test`, and `@axe-core/playwright` directly. Add:

```json
"test:order-money": "tsx server/lib/order-refunds.test.ts",
"test:stain-domain": "tsx server/lib/stain-treatment-domain.test.ts",
"test:stain-schema": "tsx server/lib/stain-treatment-schema.test.ts",
"test:stain-api": "tsx server/lib/stain-treatment-api.test.ts",
"test:stain-concurrency": "tsx server/lib/stain-treatment-concurrency.test.ts",
"test:stain-ui": "tsx server/lib/stain-treatment-ui.test.ts",
"test:stain-db": "tsx scripts/test-stain-postgres.ts",
"test:stain-e2e": "playwright test --config playwright.stain-treatment.config.ts"
```

Run: `npm run test:order-money`

Expected: FAIL because the foundation is absent.

- [ ] **Step 4: Add currency, capability, refund, and allocation schema**

Add organisation currency, both stain-treatment capabilities, append-only refund tables, and payment/refund allocation tables. Enforce exactly one target/kind per allocation and use composite tenant keys for every target so direct SQL cannot link an order, payment, refund, or allocation across organisation/site boundaries. Mirror the migration idempotently in Replit self-heal.

- [ ] **Step 5: Implement shared decimal totals and allocation service**

Export money parsing/formatting, line multiplication, eligible-discount calculation, membership composition, payment allocation, refund allocation, and balance recalculation. All APIs use string money DTOs.

- [ ] **Step 6: Migrate touched existing calculations**

Replace JavaScript `Number` financial arithmetic in `server/routes.ts`, `server/lib/membership-routes.ts`, and `server/lib/order-corrections.ts` with the shared service before treatment is introduced. Preserve existing outcomes with characterization tests.

- [ ] **Step 7: Expose effective currency and pricing capability**

Return authenticated organisation currency and validated effective capabilities. Owner is implicit; only explicitly capable Managers receive price-setting access.

- [ ] **Step 8: Apply the migration to a disposable PostgreSQL database**

Implement `scripts/test-stain-postgres.ts` to hard-fail if `TEST_DATABASE_URL` is absent, matches configured production/Replit URLs, or does not identify a test database. It creates a cryptographically unique PostgreSQL schema, sets `search_path`, applies the money-foundation then treatment migration, reruns both, exercises Replit self-heal against a second clean schema, compares required tables/columns/constraints/indexes, runs the two-connection suites, and drops only the exact validated temporary schemas in `finally`.

Run: `npm run test:stain-db && npm run test:order-money && npm run test:schema-guard && npm run test:tenant-isolation && npm run check`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add shared/order-money.ts shared/schema.ts server/lib/order-money.ts server/lib/order-refunds.test.ts migrations/20260807_order_money_foundation.sql server/replit_integrations/auth/replitAuth.ts server/replit_integrations/auth/routes.ts server/routes.ts server/lib/membership-routes.ts server/lib/order-corrections.ts client/src/hooks/use-currency.ts scripts/test-stain-postgres.ts package.json package-lock.json
git commit -m "feat: add authoritative order money foundation"
```

## Task 1: Add canonical contracts and decimal rules

**Files:**
- Create: `shared/stain-treatment.ts`
- Create: `server/lib/stain-treatment-domain.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing contract tests**

Test the six `(level, unit)` pairs, piece integers, two-decimal kilograms, positive two-decimal prices, immutable acknowledgement version input, 120-character idempotency keys, and rejection of client-supplied price/site/organisation/currency/total.

```ts
assert.equal(stainTreatmentDraftInputSchema.safeParse({
  orderItemIndex: 0,
  level: "intensive",
  quantity: "3.50",
  idempotencyKey: "stain-draft-1",
}).success, true);

assert.equal(multiplyTreatmentAmount("8.25", "3.50"), "28.88");
assert.equal(validateTreatmentQuantity("piece", "2.50").success, false);
```

- [ ] **Step 2: Add the focused test command and confirm failure**

Use the `test:stain-domain` script added in Task 0.

Run: `npm run test:stain-domain`

Expected: FAIL because `shared/stain-treatment.ts` does not exist.

- [ ] **Step 3: Implement canonical types and pure rules**

Export readonly level/unit constants, input schemas, DTOs, `multiplyTreatmentAmount`, `validateAscendingRates`, `validateTreatmentQuantity`, and `validateNetEffectiveQuantity`. Use the directly declared `decimal.js-light` foundation and never convert money to JavaScript floating point.

- [ ] **Step 4: Run focused tests and TypeScript**

Run: `npm run test:stain-domain && npm run test:order-money && npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/stain-treatment.ts server/lib/stain-treatment-domain.test.ts
git commit -m "feat: define stain treatment contracts"
```

## Task 2: Add versioned pricing and append-only financial schema

**Files:**
- Modify: `shared/schema.ts`
- Create: `migrations/20260807_stain_treatment_pricing.sql`
- Modify: `server/replit_integrations/auth/replitAuth.ts`
- Create: `server/lib/stain-treatment-schema.test.ts`

- [ ] **Step 1: Add failing schema assertions**

Require:

- `stain_treatment_pricing_sets` as the lockable org/site parent and shared set version.
- `stain_treatment_price_versions` with pricing set, organisation, site, level, unit, currency, price, effective timestamp, active state, actor, and timestamps.
- Tenant-scoped `orders.idempotency_key`, `orders.request_fingerprint`, and immutable `orders.posted_at` for atomic whole-order retry and booked-report dates.
- `order_stain_treatments` with organisation, site, order, order item, level, unit, quantity, captured rate, line total, currency, pricing version, idempotency key, acknowledgement fields, nullable `corrected_from_treatment_id`, creator, and timestamp.
- `order_stain_treatment_adjustments` with original charge, signed quantity/amount effect, action (`adjustment` or `void`), reason, fresh acknowledgement when required, actor, and timestamp.
- Tenant/site/date indexes, idempotency uniqueness scoped to organisation, and restrictive composite foreign keys proving `(organisation_id, site_id)`, `(order_id, site_id)`, and `(order_item_id, order_id)` consistency.
- Unique org/site pricing-set parent, partial uniqueness for one active rate per site/level/unit, one-way/no-self correction linkage, and database checks for valid enums, positive rates/quantities, two-decimal scale, and acknowledgement completeness.

- [ ] **Step 2: Run the test to confirm failure**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-schema`

Expected: FAIL because the tables are absent.

- [ ] **Step 3: Add Drizzle tables, relations, and exported types**

Keep financial foreign keys restrictive. Do not cascade-delete posted charges, pricing versions, or adjustments.

- [ ] **Step 4: Write the production migration in one transaction**

Create constraints and indexes explicitly. Preserve pricing history by inserting replacement versions rather than updating captured historical rows.

- [ ] **Step 5: Mirror the migration in Replit self-heal**

Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and guarded `DO $$` blocks for constraints on partially existing tables. Never drop, truncate, or rewrite financial tables during startup.

- [ ] **Step 6: Run schema gates**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-schema && npm run test:schema-guard && npm run check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add shared/schema.ts migrations/20260807_stain_treatment_pricing.sql server/replit_integrations/auth/replitAuth.ts server/lib/stain-treatment-schema.test.ts
git commit -m "feat: add stain treatment financial schema"
```

## Task 3: Implement tenant-safe site pricing configuration

**Files:**
- Create: `server/lib/stain-treatment.ts`
- Create: `server/lib/stain-treatment-routes.ts`
- Modify: `server/routes.ts`
- Create: `server/lib/stain-treatment-api.test.ts`
- Create: `server/lib/stain-treatment-concurrency.test.ts`

- [ ] **Step 1: Write failing rate-service tests**

Cover complete six-rate activation, ascending validation independently for piece/kg, same-currency enforcement, atomic version replacement, active-rate resolution, and denial of cross-tenant reads/writes.

- [ ] **Step 2: Write failing route assertions**

Required endpoints:

```text
GET /api/stain-treatment/prices
PUT /api/stain-treatment/prices
```

All use authentication, derive active organisation/site, and require Owner or effective `manage_stain_treatment_pricing`. Unauthorized Managers and Operators receive 403.

- [ ] **Step 3: Implement service operations**

Export `getActiveTreatmentPrices`, `replaceTreatmentPrices`, and `resolveTreatmentPrice`. In one transaction, perform `INSERT ... ON CONFLICT DO NOTHING` for the unique `(organisation_id, site_id)` pricing-set parent, then `SELECT ... FOR UPDATE` that parent, including first activation. Validate the full set, deactivate prior active children, insert/activate six children sharing the new set version, then commit. Posting and replacement always lock parent set before related order item to prevent deadlocks.

- [ ] **Step 4: Implement and register focused routes**

Return generic client errors and logged server references. Never return another site's history or accept organisation/site/currency from the request body. Add real two-connection tests here only for first activation versus activation and replacement versus replacement. Posting-versus-replacement belongs to Task 4 after posting exists.

- [ ] **Step 5: Run security gates**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-api && TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-concurrency && npm run test:tenant-isolation && npm run check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/stain-treatment.ts server/lib/stain-treatment-routes.ts server/routes.ts server/lib/stain-treatment-api.test.ts server/lib/stain-treatment-concurrency.test.ts
git commit -m "feat: configure fixed stain treatment rates"
```

## Task 4: Post treatment charges atomically with orders

**Files:**
- Modify: `shared/routes.ts`
- Modify: `server/storage.ts`
- Modify: `server/routes.ts`
- Modify: `server/lib/stain-treatment.ts`
- Modify: `server/lib/stain-treatment-api.test.ts`
- Modify: `server/lib/stain-treatment-concurrency.test.ts`

- [ ] **Step 1: Extend order input with safe treatment drafts**

Require an order-level idempotency key and canonical request fingerprint covering tenant, customer, service lines, treatment drafts, acknowledgement, advance payment, and expected pricing-set version. Accept treatment `orderItemIndex`, level, quantity, acknowledgement attestation/version when applicable, line idempotency key, and an opaque server-issued `expectedPricingSetVersion`. The index resolves to the server-created order item inside the transaction; no client order-item ID is trusted during new-order creation.

- [ ] **Step 2: Write failing posting tests**

Cover:

- `2 pieces × 15.00 = 30.00`.
- `3.50 kg × 8.25 = 28.88`.
- Split levels whose net total equals the service quantity.
- Aggregate overflow across multiple drafts.
- Unsupported service units.
- Missing prices and Very intensive acknowledgement.
- Duplicate whole-order retries, changed-payload key reuse, and concurrent duplicate submissions.
- Preview/post price changes returning 409 with a new server preview.
- Same idempotency key retry after a pre-insert 409, and immutable replay after a successful insert.
- Posting versus rate replacement using two real database connections.

- [ ] **Step 3: Centralize the order transaction**

Before creating anything, look up the tenant-scoped order idempotency key. Replay only when its stored fingerprint matches the complete request; reject changed-payload reuse. Make order row, order items, treatment charges, totals, advance-payment row, payment allocations, and initial payment state commit or roll back together. Lock pricing-set parent, then related `order_items` rows, then sum original charges plus signed append-only adjustments with database numeric arithmetic. Validate net effective quantity and insert in the same transaction. This lock order applies to posting, corrections, and service-line reductions.

Calculate:

```text
discountable service subtotal
- eligible service discount
- membership-covered service amount
+ non-discountable treatment subtotal
+ pickup/delivery cost
= final order total
```

Reject fixed discounts larger than the service subtotal. Never discount treatment.

- [ ] **Step 4: Return treatment DTOs and price-conflict details**

Order responses include separate string-valued cleaning subtotal, discount, membership coverage, treatment subtotal, other charges, final total, and posted treatment lines. A 409 returns old/new per-line rates, old/new totals, and a new opaque pricing-set token. The original idempotency key remains unused after a pre-insert conflict and may be reused for explicit resubmission; after success it replays the original posted result.

- [ ] **Step 5: Run order and tenant tests**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-api && TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-concurrency && npx tsx server/lib/order-discount-toggle.test.ts && npm run test:tenant-isolation && npm run check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/routes.ts server/storage.ts server/routes.ts server/lib/stain-treatment.ts server/lib/stain-treatment-api.test.ts server/lib/stain-treatment-concurrency.test.ts
git commit -m "feat: post stain treatment with orders"
```

## Task 5: Integrate memberships, corrections, payments, and receipts

**Files:**
- Modify: `server/lib/membership-routes.ts`
- Modify: `server/lib/order-corrections.ts`
- Modify: `server/lib/subscription-receipt.ts`
- Modify: `client/src/lib/receipt.ts`
- Modify: `server/lib/stain-treatment-api.test.ts`
- Modify: `server/lib/stain-treatment-concurrency.test.ts`
- Modify: `server/lib/order-refunds.test.ts`
- Modify: `server/lib/controlled-order-corrections.test.ts`
- Modify: `server/lib/membership-run1-run2.test.ts`
- Modify: `server/lib/receipt-display.test.ts`

- [ ] **Step 1: Write failing membership-total tests**

Verify full, partial, and zero service coverage while treatment remains entirely payable. Verify 100% and fixed discounts cannot reduce treatment.

- [ ] **Step 2: Write failing correction tests**

Cover treatment increases/decreases, one-time idempotent voids, related service reduction/removal, net quantity bounds, fresh Very intensive acknowledgement, mandatory reason, already-paid balance/credit/refund effects, cancellation, and corrected receipts. Assert posted values are never updated or deleted. Use two connections for increase/increase, increase/void, service-reduction/treatment-adjustment, and duplicate correction races.

- [ ] **Step 3: Implement membership composition**

Run coverage against cleaning-service lines only. The transaction returns `eligibleServiceAmount`, `coveredServiceAmount`, `uncoveredServiceAmount`, `treatmentAmount`, `pickupDeliveryAmount`, and `finalAmount`; it never replaces `orders.total_amount` with `coverage.extraAmount`. Preserve existing membership quotas and make reapplication idempotent under concurrent treatment correction.

- [ ] **Step 4: Implement append-only treatment corrections**

Lock the related order item before treatment rows. Derive signed quantity and amount effects server-side from the original captured rate; the client never supplies amount effects. Insert a linked adjustment/void and recalculate final totals, payment allocations, status, balance, customer credit, or refund requirement through `order-money.ts`.

The current correction flow deletes and reinserts order items. Change it to preserve stable item IDs when a service line remains. When a corrected-copy workflow is required, create an explicit old-item-to-new-item map and new append-only treatment charges linked through `corrected_from_treatment_id`. Preserve original captured rate/value provenance, but never copy an old Very intensive attestation as the new charge's acknowledgement. Corrected-copy input must capture a fresh affirmative attestation, current immutable warning-text version, actor, and timestamp for every effective Very intensive line. Include treatment/refund/allocation tables in correction snapshots and dependency checks. Never leave a treatment linked to a deleted order item.

- [ ] **Step 5: Update receipts**

Show treatment level, quantity, unit, captured rate, and line total separately. Show the versioned warning for Very intensive treatment. Corrected receipts display original and adjustment rather than silently replacing history. Server receipt DTOs supply canonical two-decimal strings and authoritative line totals; `subscription-receipt.ts` uses decimal helpers and the client receipt formatter displays strings without recalculating money with `Number`.

- [ ] **Step 6: Run integrated financial gates**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-api && TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-concurrency && npm run test:order-money && npm run test:membership-run1-run2 && npm run test:controlled-order-corrections && npm run test:receipt-display && npm run check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/lib/membership-routes.ts server/lib/order-corrections.ts server/lib/subscription-receipt.ts client/src/lib/receipt.ts server/lib/stain-treatment-api.test.ts server/lib/stain-treatment-concurrency.test.ts server/lib/order-refunds.test.ts server/lib/controlled-order-corrections.test.ts server/lib/membership-run1-run2.test.ts server/lib/receipt-display.test.ts
git commit -m "feat: audit stain treatment financial lifecycle"
```

## Task 6: Build six-rate site settings

**Files:**
- Create: `client/src/hooks/use-stain-treatment.ts`
- Create: `client/src/components/settings/stain-treatment-settings.tsx`
- Modify: `client/src/pages/settings.tsx`
- Modify: `client/src/lib/i18n.ts`
- Create: `server/lib/stain-treatment-ui.test.ts`

- [ ] **Step 1: Write failing UI-wiring assertions**

Require a settings section with three levels × two units, currency display, definitions, ascending-price validation, loading/error/disabled states, permission hiding, and a single atomic Save action.

- [ ] **Step 2: Implement TanStack Query hooks**

Add tenant-scoped price query and replacement mutation. Invalidate only stain-treatment settings keys.

- [ ] **Step 3: Implement the settings panel**

Use decimal-string text inputs with `inputMode="decimal"`; HTML `step` is not validation. Explain all three levels and both units. Do not allow partial activation. Map server field errors, focus the first invalid field, announce save/errors through `aria-live`, and show the last update actor/time returned by the server.

- [ ] **Step 4: Add English, French, and Portuguese copy**

Translate labels, definitions, permissions, validation, saved state, currency, and missing-configuration guidance.

- [ ] **Step 5: Run UI and i18n gates**

Run: `npm run test:stain-ui && npm run test:analytics-i18n && npm run check && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/use-stain-treatment.ts client/src/components/settings/stain-treatment-settings.tsx client/src/pages/settings.tsx client/src/lib/i18n.ts server/lib/stain-treatment-ui.test.ts
git commit -m "feat: configure stain treatment pricing in settings"
```

## Task 7: Add treatment selection to the order page

**Files:**
- Create: `client/src/components/orders/stain-treatment-editor.tsx`
- Modify: `client/src/pages/orders.tsx`
- Modify: `client/src/lib/i18n.ts`
- Modify: `server/lib/stain-treatment-ui.test.ts`

- [ ] **Step 1: Write failing order-UI assertions**

Require related service selection, automatic read-only unit, three defined levels, affected quantity label, server-rate preview, treatment subtotal, Very intensive unchecked acknowledgement, missing-price blocking state, and no custom-rate input.

- [ ] **Step 2: Implement the focused editor**

Use stable draft idempotency keys. Reset/revalidate treatment when its related service changes. Enforce aggregate quantity client-side for immediate feedback while keeping the server authoritative.

- [ ] **Step 3: Separate discountable and treatment totals**

Show cleaning subtotal, cleaning discount, stain treatment subtotal, pickup/delivery, and final total. Fixed and percentage discount controls use cleaning subtotal as their maximum/base.

- [ ] **Step 4: Handle posting-time price changes**

On 409, open a focus-trapped dialog showing old/new line rates and totals, announce the change, and require explicit review/resubmission with the returned token and same still-unused idempotency keys. Never silently accept a changed price.

- [ ] **Step 5: Complete accessibility and translations**

Use semantic fieldsets/legends, `aria-describedby` definitions, keyboard focus, 44px touch targets, `aria-live` preview/errors, text severity cues, locale-decimal normalization, and English/French/Portuguese copy.

- [ ] **Step 6: Run client gates**

Run: `npm run test:stain-ui && npx tsx server/lib/new-order-service-search.test.ts && npx tsx server/lib/mobile-service-selector.test.ts && npm run test:analytics-i18n && npm run check && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/orders/stain-treatment-editor.tsx client/src/pages/orders.tsx client/src/lib/i18n.ts server/lib/stain-treatment-ui.test.ts
git commit -m "feat: add fixed stain treatment to orders"
```

## Task 8: Add order history and treatment reporting

**Files:**
- Modify: `server/lib/stain-treatment.ts`
- Modify: `server/lib/stain-treatment-routes.ts`
- Modify: `server/routes.ts`
- Modify: `client/src/pages/order-detail.tsx`
- Modify: `client/src/pages/analytics.tsx`
- Modify: `client/src/lib/i18n.ts`
- Modify: `server/lib/stain-treatment-api.test.ts`
- Modify: `server/lib/stain-treatment-ui.test.ts`

- [ ] **Step 1: Write failing detail/report tests**

Require immutable treatment and adjustment history, creator metadata, acknowledgement version/time, tenant-safe bounded/paginated report filters, booked versus collected values, distinct treated orders, separate piece/kg quantities, currency grouping, posting-date/payment-date modes, and cancellation/void/refund semantics. Test Owner, Manager with/without `view_stain_treatment_reports`, Operator, selected-site, all-sites, and forged site filters.

- [ ] **Step 2: Implement report queries**

Register `GET /api/stain-treatment/report` only in this task. Exclude drafts and cancelled orders. In booked mode, attribute the original charge and all later adjustments/voids to the original order posting date; an optional as-of cutoff controls whether later adjustments are included, but never moves them to a new booked date. In collected mode, use payment/allocation/refund timestamps. Change collected treatment cash only through persisted payment allocations and explicitly allocated treatment refunds. Count unique non-cancelled posted orders whose net effective treatment quantity remains positive after corrections/voids. Define average as net booked treatment revenue divided by that distinct treated-order count. Return database numeric aggregates as canonical two-decimal strings without JS arithmetic; never combine currencies or piece/kg quantities. Enforce site-filter derivation, date-range bounds, pagination, and Owner or effective `view_stain_treatment_reports` access. All-sites reports are Owner/capable-Manager organisation aggregates constrained to their authorized sites.

- [ ] **Step 3: Implement order detail treatment history**

Display posted lines, captured prices, adjustments/voids, actors, dates, and Very intensive acknowledgement. Do not add edit/delete controls for posted records.

- [ ] **Step 4: Implement analytics panel**

Show treatment revenue by level/unit/site, booked and collected values, treated order count, average treatment revenue, and acknowledgement-compliance exceptions.

- [ ] **Step 5: Run reporting, i18n, and build gates**

Run: `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-api && npm run test:stain-ui && npm run test:tenant-isolation && npm run test:analytics-i18n && npm run check && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/stain-treatment.ts server/lib/stain-treatment-routes.ts server/routes.ts client/src/pages/order-detail.tsx client/src/pages/analytics.tsx client/src/lib/i18n.ts server/lib/stain-treatment-api.test.ts server/lib/stain-treatment-ui.test.ts
git commit -m "feat: report audited stain treatment activity"
```

## Task 9: Full QA, devil's advocate, and rollout gate

**Files:**
- Modify only when an approved QA finding requires a fix; commit each fix separately.

- [ ] **Step 1: Run the complete automated gate**

```bash
npm run test:order-money
npm run test:stain-domain
TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-schema
TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-api
TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:stain-concurrency
npm run test:stain-ui
npm run test:stain-e2e
npm run test:tenant-isolation
npm run test:schema-guard
npm run test:controlled-order-corrections
npm run test:membership-run1-run2
npm run test:receipt-display
npm run test:analytics-i18n
npm run check
npm run build
git diff --check
```

Expected: every command passes.

- [ ] **Step 2: Test browser workflows on a disposable database**

Verify desktop and mobile configuration, piece/kg orders, all three levels, split levels, memberships, percentage/fixed discounts, receipts, payments, corrections, reporting, and all three languages. Never use production financial data for QA.

Create `playwright.stain-treatment.config.ts` with `webServer` starting the app against the unique safe test schema created by `scripts/test-stain-postgres.ts`, `baseURL` on an unused localhost port, desktop Chromium and 320px mobile projects, trace on first retry, and artifacts under `artifacts/stain-treatment-e2e/`. Seed isolated Owner, capable Manager, unauthorized Manager, Operator, piece service, kg service, membership, and six rates through `scripts/seed-stain-treatment-e2e.ts`. `npm run test:stain-e2e` must hard-fail without safe test DB context and clean up fixtures.

Automate keyboard-only settings/order entry, changed-price dialog focus, first-invalid-field focus, `aria-live` announcements, untranslated-key detection, 320px mobile layout, and receipt/detail/report rendering. Use `@axe-core/playwright` on Settings, Order, Order Detail, and Analytics and fail on serious/critical violations. Save screenshots, traces, and JSON results under the declared artifact path.

- [ ] **Step 3: Run concurrency and retry checks**

Verify duplicate clicks and network retries create no duplicates; concurrent additions cannot exceed the order-item quantity; a posting-time rate change requires reconfirmation; price history remains stable.

- [ ] **Step 4: Run the mandatory devil's-advocate audit**

Challenge cross-tenant IDs, configuration/report access, rate activation races, decimal overflow/rounding, negative net corrections, related-item removal, paid-order credits/refunds, membership coverage, discount leakage, cancelled orders, receipt history, unsupported units, incomplete translations, and narrow mobile screens.

Report severity, impact, evidence, and proposed fixes before making any additional production-facing change. Wait for approval before applying non-plan QA fixes.

- [ ] **Step 5: Rerun the full gate after approved fixes**

Expected: every automated and browser regression passes with a clean worktree.

- [ ] **Step 6: Push and verify deployment only after approval**

Push the reviewed branch, confirm the GitHub commit, wait for Replit deployment, then smoke-test Settings, a piece order, a kg order, Very intensive acknowledgement, receipt, and report on the deployed test account. Do not call the feature live until Replit matches the reviewed commit and all deployed checks pass.

Deployment order is backward compatible: deploy additive money/schema migrations first, verify constraints/backfill, then deploy server code, then client code. Stain treatment remains feature-disabled for every site until an authorized user explicitly saves a complete six-rate set; never auto-enable existing sites. Rollback disables new posting/UI but never drops financial tables or history. Verify migration logs, authorization failures, 409 price conflicts, duplicate-key conflicts, and server error rate. Record the GitHub SHA and prove the Replit deployment reports the same SHA.

## Completion criteria

- Six fixed site prices are versioned, tenant-safe, and auditable.
- Staff can add Standard, Intensive, or Very intensive treatment to piece/kg services without custom prices.
- Server-side decimal totals, aggregate quantities, price races, and retries are deterministic.
- Discounts and memberships never reduce treatment charges.
- Very intensive acknowledgement is versioned and enforced.
- Posted charges and corrections are append-only and visible on receipts, details, and reports.
- Automated gates, browser QA, devil's-advocate review, GitHub push, Replit deployment, and deployed smoke tests all pass.
