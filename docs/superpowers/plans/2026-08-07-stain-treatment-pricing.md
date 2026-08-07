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
- `server/lib/stain-treatment.ts` — rate configuration, price resolution, posting, adjustment, and reporting service.
- `server/lib/stain-treatment-routes.ts` — authenticated configuration and reporting endpoints.
- `server/lib/stain-treatment.test.ts` — focused source/runtime regression gate.
- `client/src/hooks/use-stain-treatment.ts` — pricing and report queries/mutations.
- `client/src/components/orders/stain-treatment-editor.tsx` — order-form treatment selection and acknowledgement.
- `client/src/components/settings/stain-treatment-settings.tsx` — six-rate site configuration.
- `migrations/20260807_stain_treatment_pricing.sql` — production schema and constraints.

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

## Task 1: Add canonical contracts and decimal rules

**Files:**
- Create: `shared/stain-treatment.ts`
- Create: `server/lib/stain-treatment.test.ts`
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

Add `"test:stain-treatment": "tsx server/lib/stain-treatment.test.ts"`.

Run: `npm run test:stain-treatment`

Expected: FAIL because `shared/stain-treatment.ts` does not exist.

- [ ] **Step 3: Implement canonical types and pure rules**

Export readonly level/unit constants, input schemas, DTOs, `multiplyTreatmentAmount`, `validateAscendingRates`, `validateTreatmentQuantity`, and `validateNetEffectiveQuantity`. Use a decimal library already present in the lockfile; if none exists, add `decimal.js` and lock it. Never convert money to JavaScript floating point.

- [ ] **Step 4: Run focused tests and TypeScript**

Run: `npm run test:stain-treatment && npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/stain-treatment.ts server/lib/stain-treatment.test.ts package.json package-lock.json
git commit -m "feat: define stain treatment contracts"
```

## Task 2: Add versioned pricing and append-only financial schema

**Files:**
- Modify: `shared/schema.ts`
- Create: `migrations/20260807_stain_treatment_pricing.sql`
- Modify: `server/replit_integrations/auth/replitAuth.ts`
- Modify: `server/lib/stain-treatment.test.ts`

- [ ] **Step 1: Add failing schema assertions**

Require:

- `stain_treatment_price_versions` with organisation, site, level, unit, currency, price, version, effective timestamp, active state, actor, and timestamps.
- `order_stain_treatments` with organisation, site, order, order item, level, unit, quantity, captured rate, line total, currency, pricing version, idempotency key, acknowledgement fields, creator, and timestamp.
- `order_stain_treatment_adjustments` with original charge, signed quantity/amount effect, action (`adjustment` or `void`), reason, fresh acknowledgement when required, actor, and timestamp.
- Tenant/site/date indexes, idempotency uniqueness scoped to organisation, and restrictive foreign keys.
- Partial uniqueness for one active rate per site/level/unit and database checks for valid enums, positive rates/quantities, two-decimal scale, and acknowledgement completeness.

- [ ] **Step 2: Run the test to confirm failure**

Run: `npm run test:stain-treatment`

Expected: FAIL because the tables are absent.

- [ ] **Step 3: Add Drizzle tables, relations, and exported types**

Keep financial foreign keys restrictive. Do not cascade-delete posted charges, pricing versions, or adjustments.

- [ ] **Step 4: Write the production migration in one transaction**

Create constraints and indexes explicitly. Preserve pricing history by inserting replacement versions rather than updating captured historical rows.

- [ ] **Step 5: Mirror the migration in Replit self-heal**

Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and guarded `DO $$` blocks for constraints on partially existing tables. Never drop, truncate, or rewrite financial tables during startup.

- [ ] **Step 6: Run schema gates**

Run: `npm run test:stain-treatment && npm run test:schema-guard && npm run check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add shared/schema.ts migrations/20260807_stain_treatment_pricing.sql server/replit_integrations/auth/replitAuth.ts server/lib/stain-treatment.test.ts
git commit -m "feat: add stain treatment financial schema"
```

## Task 3: Implement tenant-safe site pricing configuration

**Files:**
- Create: `server/lib/stain-treatment.ts`
- Create: `server/lib/stain-treatment-routes.ts`
- Modify: `server/routes.ts`
- Modify: `server/lib/stain-treatment.test.ts`

- [ ] **Step 1: Write failing rate-service tests**

Cover complete six-rate activation, ascending validation independently for piece/kg, same-currency enforcement, atomic version replacement, active-rate resolution, and denial of cross-tenant reads/writes.

- [ ] **Step 2: Write failing route assertions**

Required endpoints:

```text
GET /api/stain-treatment/prices
PUT /api/stain-treatment/prices
GET /api/stain-treatment/report
```

All use authentication, derive active organisation/site, and reuse existing Owner/Manager site-settings authorization. Operators and unauthorized site members receive 403.

- [ ] **Step 3: Implement service operations**

Export `getActiveTreatmentPrices`, `replaceTreatmentPrices`, and `resolveTreatmentPrice`. Lock the current configuration while replacing it. Insert six new versions and deactivate the previous set in the same transaction.

- [ ] **Step 4: Implement and register focused routes**

Return generic client errors and logged server references. Never return another site's history or accept organisation/site/currency from the request body.

- [ ] **Step 5: Run security gates**

Run: `npm run test:stain-treatment && npm run test:tenant-isolation && npm run check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/stain-treatment.ts server/lib/stain-treatment-routes.ts server/routes.ts server/lib/stain-treatment.test.ts
git commit -m "feat: configure fixed stain treatment rates"
```

## Task 4: Post treatment charges atomically with orders

**Files:**
- Modify: `shared/routes.ts`
- Modify: `server/storage.ts`
- Modify: `server/routes.ts`
- Modify: `server/lib/stain-treatment.ts`
- Modify: `server/lib/stain-treatment.test.ts`

- [ ] **Step 1: Extend order input with safe treatment drafts**

Accept only `orderItemIndex`, level, quantity, acknowledgement attestation/version when applicable, and idempotency key. The index resolves to the server-created order item inside the transaction; no client order-item ID is trusted during new-order creation.

- [ ] **Step 2: Write failing posting tests**

Cover:

- `2 pieces × 15.00 = 30.00`.
- `3.50 kg × 8.25 = 28.88`.
- Split levels whose net total equals the service quantity.
- Aggregate overflow across multiple drafts.
- Unsupported service units.
- Missing prices and Very intensive acknowledgement.
- Duplicate idempotency keys and concurrent additions.
- Preview/post price changes returning 409 with a new server preview.

- [ ] **Step 3: Centralize the order transaction**

Make order row, order items, treatment charges, totals, and initial payment state commit or roll back together. Lock applicable active prices and validate aggregate quantities before insertion.

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

Order responses include separate cleaning subtotal, discount, membership coverage, treatment subtotal, other charges, final total, and posted treatment lines.

- [ ] **Step 5: Run order and tenant tests**

Run: `npm run test:stain-treatment && npm run test:tenant-isolation && npm run test:order-discount-toggle && npm run check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/routes.ts server/storage.ts server/routes.ts server/lib/stain-treatment.ts server/lib/stain-treatment.test.ts
git commit -m "feat: post stain treatment with orders"
```

## Task 5: Integrate memberships, corrections, payments, and receipts

**Files:**
- Modify: `server/lib/membership-routes.ts`
- Modify: `server/lib/order-corrections.ts`
- Modify: `server/lib/subscription-receipt.ts`
- Modify: `client/src/lib/receipt.ts`
- Modify: `server/lib/stain-treatment.test.ts`
- Modify: `server/lib/controlled-order-corrections.test.ts`
- Modify: `server/lib/membership-run1-run2.test.ts`
- Modify: `server/lib/receipt-display.test.ts`

- [ ] **Step 1: Write failing membership-total tests**

Verify full, partial, and zero service coverage while treatment remains entirely payable. Verify 100% and fixed discounts cannot reduce treatment.

- [ ] **Step 2: Write failing correction tests**

Cover treatment increases/decreases, voids, related service reduction/removal, net quantity bounds, fresh Very intensive acknowledgement, mandatory reason, already-paid balance/credit effects, cancellation, and corrected receipts. Assert posted values are never updated or deleted.

- [ ] **Step 3: Implement membership composition**

Run coverage against cleaning-service lines only, then add treatment and uncovered costs. Preserve existing membership quotas.

- [ ] **Step 4: Implement append-only treatment corrections**

Lock the original charge and related order item. Insert a linked adjustment/void and recalculate final totals, payment status, balance, or refundable credit using the existing audited correction workflow.

- [ ] **Step 5: Update receipts**

Show treatment level, quantity, unit, captured rate, and line total separately. Show the versioned warning for Very intensive treatment. Corrected receipts display original and adjustment rather than silently replacing history.

- [ ] **Step 6: Run integrated financial gates**

Run: `npm run test:stain-treatment && npm run test:membership-run1-run2 && npm run test:controlled-order-corrections && npm run test:receipt-display && npm run check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/lib/membership-routes.ts server/lib/order-corrections.ts server/lib/subscription-receipt.ts client/src/lib/receipt.ts server/lib/stain-treatment.test.ts server/lib/controlled-order-corrections.test.ts server/lib/membership-run1-run2.test.ts server/lib/receipt-display.test.ts
git commit -m "feat: audit stain treatment financial lifecycle"
```

## Task 6: Build six-rate site settings

**Files:**
- Create: `client/src/hooks/use-stain-treatment.ts`
- Create: `client/src/components/settings/stain-treatment-settings.tsx`
- Modify: `client/src/pages/settings.tsx`
- Modify: `client/src/lib/i18n.ts`
- Modify: `server/lib/stain-treatment.test.ts`

- [ ] **Step 1: Write failing UI-wiring assertions**

Require a settings section with three levels × two units, currency display, definitions, ascending-price validation, loading/error/disabled states, permission hiding, and a single atomic Save action.

- [ ] **Step 2: Implement TanStack Query hooks**

Add tenant-scoped price query and replacement mutation. Invalidate only stain-treatment settings keys.

- [ ] **Step 3: Implement the settings panel**

Use six numeric inputs with two-decimal steps. Explain all three levels and both units. Do not allow partial activation. Show the last update actor/time returned by the server.

- [ ] **Step 4: Add English, French, and Portuguese copy**

Translate labels, definitions, permissions, validation, saved state, currency, and missing-configuration guidance.

- [ ] **Step 5: Run UI and i18n gates**

Run: `npm run test:stain-treatment && npm run test:analytics-i18n && npm run check && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/use-stain-treatment.ts client/src/components/settings/stain-treatment-settings.tsx client/src/pages/settings.tsx client/src/lib/i18n.ts server/lib/stain-treatment.test.ts
git commit -m "feat: configure stain treatment pricing in settings"
```

## Task 7: Add treatment selection to the order page

**Files:**
- Create: `client/src/components/orders/stain-treatment-editor.tsx`
- Modify: `client/src/pages/orders.tsx`
- Modify: `client/src/lib/i18n.ts`
- Modify: `server/lib/stain-treatment.test.ts`

- [ ] **Step 1: Write failing order-UI assertions**

Require related service selection, automatic read-only unit, three defined levels, affected quantity label, server-rate preview, treatment subtotal, Very intensive unchecked acknowledgement, missing-price blocking state, and no custom-rate input.

- [ ] **Step 2: Implement the focused editor**

Use stable draft idempotency keys. Reset/revalidate treatment when its related service changes. Enforce aggregate quantity client-side for immediate feedback while keeping the server authoritative.

- [ ] **Step 3: Separate discountable and treatment totals**

Show cleaning subtotal, cleaning discount, stain treatment subtotal, pickup/delivery, and final total. Fixed and percentage discount controls use cleaning subtotal as their maximum/base.

- [ ] **Step 4: Handle posting-time price changes**

On 409, show old and new treatment totals and require explicit review/resubmission using the same idempotency keys. Never silently accept a changed price.

- [ ] **Step 5: Complete accessibility and translations**

Use semantic fieldsets, keyboard focus, 44px touch targets, text severity cues, and English/French/Portuguese copy.

- [ ] **Step 6: Run client gates**

Run: `npm run test:stain-treatment && npm run test:new-order-service-search && npm run test:mobile-service-selector && npm run test:analytics-i18n && npm run check && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/orders/stain-treatment-editor.tsx client/src/pages/orders.tsx client/src/lib/i18n.ts server/lib/stain-treatment.test.ts
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
- Modify: `server/lib/stain-treatment.test.ts`

- [ ] **Step 1: Write failing detail/report tests**

Require immutable treatment and adjustment history, creator metadata, acknowledgement version/time, tenant-safe report filters, booked versus collected values, distinct treated orders, separate piece/kg quantities, currency grouping, and cancellation/void/refund semantics.

- [ ] **Step 2: Implement report queries**

Exclude drafts and cancelled orders. Apply treatment adjustments/voids to booked revenue and quantity. Change collected treatment cash only for explicitly allocated treatment refunds. Never combine currencies or piece/kg quantities.

- [ ] **Step 3: Implement order detail treatment history**

Display posted lines, captured prices, adjustments/voids, actors, dates, and Very intensive acknowledgement. Do not add edit/delete controls for posted records.

- [ ] **Step 4: Implement analytics panel**

Show treatment revenue by level/unit/site, booked and collected values, treated order count, average treatment revenue, and acknowledgement-compliance exceptions.

- [ ] **Step 5: Run reporting, i18n, and build gates**

Run: `npm run test:stain-treatment && npm run test:tenant-isolation && npm run test:analytics-i18n && npm run check && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/stain-treatment.ts server/lib/stain-treatment-routes.ts server/routes.ts client/src/pages/order-detail.tsx client/src/pages/analytics.tsx client/src/lib/i18n.ts server/lib/stain-treatment.test.ts
git commit -m "feat: report audited stain treatment activity"
```

## Task 9: Full QA, devil's advocate, and rollout gate

**Files:**
- Modify only when an approved QA finding requires a fix; commit each fix separately.

- [ ] **Step 1: Run the complete automated gate**

```bash
npm run test:stain-treatment
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

- [ ] **Step 3: Run concurrency and retry checks**

Verify duplicate clicks and network retries create no duplicates; concurrent additions cannot exceed the order-item quantity; a posting-time rate change requires reconfirmation; price history remains stable.

- [ ] **Step 4: Run the mandatory devil's-advocate audit**

Challenge cross-tenant IDs, configuration/report access, rate activation races, decimal overflow/rounding, negative net corrections, related-item removal, paid-order credits/refunds, membership coverage, discount leakage, cancelled orders, receipt history, unsupported units, incomplete translations, and narrow mobile screens.

Report severity, impact, evidence, and proposed fixes before making any additional production-facing change. Wait for approval before applying non-plan QA fixes.

- [ ] **Step 5: Rerun the full gate after approved fixes**

Expected: every automated and browser regression passes with a clean worktree.

- [ ] **Step 6: Push and verify deployment only after approval**

Push the reviewed branch, confirm the GitHub commit, wait for Replit deployment, then smoke-test Settings, a piece order, a kg order, Very intensive acknowledgement, receipt, and report on the deployed test account. Do not call the feature live until Replit matches the reviewed commit and all deployed checks pass.

## Completion criteria

- Six fixed site prices are versioned, tenant-safe, and auditable.
- Staff can add Standard, Intensive, or Very intensive treatment to piece/kg services without custom prices.
- Server-side decimal totals, aggregate quantities, price races, and retries are deterministic.
- Discounts and memberships never reduce treatment charges.
- Very intensive acknowledgement is versioned and enforced.
- Posted charges and corrections are append-only and visible on receipts, details, and reports.
- Automated gates, browser QA, devil's-advocate review, GitHub push, Replit deployment, and deployed smoke tests all pass.

