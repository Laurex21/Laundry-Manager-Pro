# Stain Treatment Pricing Design

## Goal

Add a consistent, auditable stain-treatment charge to XPress Pro orders. The system supports piece-based and kilogram-based laundry without allowing staff to invent prices at checkout.

## Approved pricing model

Each site configures six fixed rates: three treatment levels for each of the two billing units.

| Treatment level | Per piece | Per kilogram |
| --- | ---: | ---: |
| Standard | Configurable | Configurable |
| Intensive | Configurable | Configurable |
| Very intensive | Configurable | Configurable |

Prices are independently configurable so management can reflect local chemical, labour, and operating costs. Validation requires positive prices and ascending rates within each unit:

- Standard < Intensive < Very intensive for piece rates.
- Standard < Intensive < Very intensive for kilogram rates.

Only Owners and authorized Managers may change these rates. The active rate at final posting is authoritative; posted order charges keep the rate captured at that moment.

All six rates must be configured and active before a site can post stain treatment. Replacing a rate is transactional: the previous configuration remains as immutable history and a new version becomes active. The server derives organisation, site, and currency from the authenticated site context; configuration APIs and reports are tenant-scoped and never accept client-selected organisation scope.

## Treatment definitions

- **Standard:** One treatment cycle using normal stain-removal products and normal handling.
- **Intensive:** A specialised or stronger product, additional handling, or a second treatment cycle.
- **Very intensive:** Multiple treatment cycles, specialised handling, and materially greater staff time. Complete removal is not guaranteed.

These definitions must be visible to staff beside the level selector. The purpose is to make level selection repeatable across staff members and sites.

## Order workflow

Stain treatment is an optional add-on selected on the order page after the underlying laundry service has been added.

1. Staff selects the related order service line. If garment records exist, the UI may use a garment picker, but every selection must resolve to one related order-item identifier.
2. XPress Pro derives the billing unit from the selected service.
3. Staff selects Standard, Intensive, or Very intensive.
4. For a piece service, staff enters the number of affected pieces.
5. For a kilogram service, staff enters the treated weight.
6. XPress Pro resolves the fixed site rate and shows the calculated charge before the order is submitted.

One treatment charge may cover several affected pieces from the same order line. Different levels may coexist against one order line, but the net effective treated quantity after all posted additions, reductions, replacements, and voids for that order line must never be negative or exceed its current service quantity. The server enforces this cumulative rule transactionally for initial posting and corrections, including concurrent requests.

The charge is:

`captured fixed rate × affected pieces or treated kilograms`

Staff cannot type or override the rate. A single charge cannot use both units. Piece quantities are positive integers. Kilogram quantities allow at most two decimal places. Both use documented safe upper bounds aligned with order-item limits.

The UI preview uses the current active rate, but it is not authoritative. At final order posting the server locks the applicable configuration, re-resolves the active rate, validates cumulative quantity, calculates the line, and captures the rate atomically. If the rate changed after preview, posting returns a price-changed conflict containing the new preview total; staff must review and resubmit. Idempotency keys prevent duplicate charges during retry.

## Customer acknowledgement

Very intensive treatment requires an explicit acknowledgement before the order can be submitted. The acknowledgement states that the laundry will use specialised treatment but complete stain removal cannot be guaranteed and fabric risks will be explained where relevant.

This is a staff attestation that the customer acknowledged the warning, not a digital customer signature. The system stores the immutable acknowledgement text version, affirmative attestation, staff actor, and timestamp. Changing the level to Very intensive, increasing its quantity, or creating a corrected Very intensive charge requires a fresh attestation. The receipt includes the versioned non-guarantee note when a Very intensive treatment is present.

## Data model

### Site pricing

Store stain-treatment pricing as site-scoped configuration with:

- treatment level;
- billing unit (`piece` or `kg`);
- fixed price;
- active status;
- organisation and site ownership;
- currency inherited from the site/organisation configuration;
- configuration version and effective timestamp;
- updated-by actor;
- created and updated timestamps.

The database enforces one active configuration row per organisation, site, level, and unit, valid level/unit enums, and tenant-consistent organisation/site ownership. Activation and replacement happen in one transaction. A site cannot activate stain treatment until it has a complete, valid six-rate set. Financial records use restrictive foreign keys and must not cascade-delete if a site or price configuration is removed.

### Posted order charge

Store each stain-treatment charge separately from the underlying service item with:

- organisation, site, order, and related order-item identifiers;
- treatment level and billing unit;
- treated quantity;
- price captured at order time;
- calculated line total;
- currency and pricing-configuration version;
- idempotency key;
- very-intensive acknowledgement metadata when required;
- creator and timestamps.

The server derives organisation and site scope, currency, price, unit, and total. Clients may supply only the related order item, treatment level, treated quantity, acknowledgement attestation, and idempotency key.

Money uses decimal strings throughout. XPress Pro applies a platform-wide two-decimal money rule to every supported order currency; rates, totals, validation, storage, receipts, and reports all use two decimal places. Kilogram quantities also use two decimal places. The server multiplies using decimal arithmetic and rounds once to two decimal places using half-up rounding. The stored server-calculated line total is authoritative, and subtotal reconciliation must equal the sum of stored order-service and treatment line totals.

Draft charges may be edited or removed before posting. Removing or reducing a related draft service line immediately revalidates its draft treatment quantities. Posted charges retain their captured values even if site pricing changes later. Posted values are never mutated or deleted. Corrections insert append-only adjustment or void records linked to the original charge and capture actor, mandatory reason, timestamp, acknowledgement when applicable, and the resulting balance effect. Corrected receipts show the original and adjustment. Corrections to already-paid orders recalculate the balance or refundable credit using the existing audited payment workflow.

## Totals, discounts, memberships, and receipts

- Stain treatment is included in the order total but tracked as a non-discountable treatment subtotal.
- The line is shown separately from the underlying cleaning service on the order summary, receipt, and order detail page.
- Membership coverage does not include stain treatment unless a later membership design explicitly adds it.
- The first release excludes stain treatment from percentage and fixed order discounts. Discounts apply only to the discountable cleaning-service subtotal. The calculation order is: service subtotal, eligible service discount, membership coverage against eligible services, non-discountable treatment subtotal, pickup/delivery charges, then final total.
- Payment status and outstanding balance use the final order total including stain treatment.
- A fully covered membership order still owes the treatment subtotal and other uncovered charges. A 100% cleaning-service discount never reduces stain treatment.

Example receipt lines:

- `Intensive stain treatment — 2 pieces × [rate]`
- `Standard stain treatment — 3.5 kg × [rate]`

## Permissions and tenant isolation

- Owners can configure all stain-treatment prices for their organisation's sites.
- Managers may configure prices only when their existing permissions authorize site pricing changes.
- Order-authorized staff may add treatment charges only for the active site and only against order items belonging to that order and organisation.
- Configuration reads/writes and treatment reports require authenticated, tenant-scoped authorization for the derived site or organisation.
- The API rejects cross-organisation, cross-site, and mismatched order-item identifiers.
- Price resolution verifies that the active configuration row belongs to the derived organisation and site.
- The server never trusts a client-supplied price, currency, organisation, site, or calculated total.

## Error handling

The order cannot be submitted when:

- the applicable site rate is missing or inactive;
- the treated quantity is zero, negative, malformed, or greater than the related service quantity;
- net effective treated quantity after additions, reductions, replacements, and voids would be negative or exceed the related service quantity;
- the related order item belongs to a different order, site, or organisation;
- Very intensive treatment lacks acknowledgement;
- the selected service uses an unsupported billing unit.
- a number exceeds configured money or quantity bounds, precision, or database capacity.

Errors use clear staff-facing language and preserve the order draft. The system must not silently omit a treatment charge or fall back to a custom price.

## Reporting

Reports expose posted, non-cancelled treatment activity and apply append-only treatment corrections and voids. Drafts do not count. Treatment revenue means booked treatment revenue: it changes only when the treatment charge itself is adjusted or voided, not merely when a payment is refunded. Collected treatment cash is reported separately. A refund reduces collected treatment cash only when it is explicitly linked or allocated to treatment; an unallocated order-level refund is not attributed to treatment reporting. A money-only refund does not change treated quantity. Revenue uses the order posting date unless the report explicitly selects payment date. Reports expose:

- treatment revenue by site, level, and billing unit;
- treated quantity by level and unit;
- number of orders with stain treatment;
- average stain-treatment revenue per treated order;
- Very intensive treatment count and acknowledgement-compliance exceptions.

Piece and kilogram quantities are never combined into one meaningless total. Revenue is grouped by currency; currencies are never combined without an explicit, versioned conversion policy. Distinct treated-order counts use unique posted order IDs after cancellation rules are applied. Valid posted Very intensive charges must always have acknowledgement, so reporting flags missing acknowledgement only as a compliance/data-integrity exception.

## UI and accessibility

- The order form presents three clearly labelled treatment levels with short definitions.
- The unit is automatic and read-only.
- The affected quantity label changes between `Affected pieces` and `Treated weight (kg)`.
- The calculated add-on total updates before submission.
- The Very intensive acknowledgement is keyboard accessible and cannot be preselected.
- Treatment levels and validation errors are translated in English, French, and Portuguese.
- Status and severity are communicated with text, not colour alone.

## Verification

Automated and browser tests must cover:

- all six site price configurations and ascending-price validation;
- transactional rate replacement, complete-set activation, and immutable pricing history;
- correct rate resolution for piece and kilogram services;
- exact calculations such as 2 pieces × 15.00 = 30.00 and 3.50 kg × 8.25 = 28.88 using half-up rounding;
- captured-price stability after a configuration change;
- preview/post price-change conflicts and explicit staff reconfirmation;
- cumulative quantity enforcement across split levels, duplicate retries, and concurrent additions;
- positive-integer piece quantities, two-decimal kilogram quantities, boundary values, malformed enums, overflow, and precision rejection;
- prevention of custom prices and cross-tenant identifiers;
- Very intensive acknowledgement enforcement and persistence;
- order subtotal, total, payment balance, receipt, and reporting integration;
- membership, percentage-discount, fixed-discount, partial-coverage, and 100%-discount exclusions;
- draft editing, related-item reduction/removal, posted adjustment/void, cancellation, refund, paid-order correction, and corrected-receipt behavior;
- correction increases and decreases with atomic net-effective-quantity bounds;
- Owner, Manager, and staff permission boundaries;
- tenant-scoped configuration reads/writes and report access;
- booked-versus-collected reporting, explicit treatment-refund allocation, unallocated refund behavior, currency grouping, date basis, cancellation, void, and correction semantics;
- English, French, Portuguese, mobile, keyboard, and screen-reader behavior.

## Out of scope

- Staff-entered custom treatment prices.
- AI or image-based stain classification.
- Chemical inventory consumption.
- Guaranteed stain removal.
- Customer self-selection of a treatment level.
- Automatic membership coverage or promotional discounts.
