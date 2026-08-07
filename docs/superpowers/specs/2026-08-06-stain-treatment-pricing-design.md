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

Only Owners and authorized Managers may change these rates. Changes affect new order selections only; posted order charges keep the rate captured at order time.

## Treatment definitions

- **Standard:** One treatment cycle using normal stain-removal products and normal handling.
- **Intensive:** A specialised or stronger product, additional handling, or a second treatment cycle.
- **Very intensive:** Multiple treatment cycles, specialised handling, and materially greater staff time. Complete removal is not guaranteed.

These definitions must be visible to staff beside the level selector. The purpose is to make level selection repeatable across staff members and sites.

## Order workflow

Stain treatment is an optional add-on selected on the order page after the underlying laundry service has been added.

1. Staff selects the related order service or garment.
2. XPress Pro derives the billing unit from the selected service.
3. Staff selects Standard, Intensive, or Very intensive.
4. For a piece service, staff enters the number of affected pieces.
5. For a kilogram service, staff enters the treated weight.
6. XPress Pro resolves the fixed site rate and shows the calculated charge before the order is submitted.

The charge is:

`captured fixed rate × affected pieces or treated kilograms`

Staff cannot type or override the rate. A single charge cannot use both units. The treated quantity must be positive and cannot exceed the quantity of its related order service.

## Customer acknowledgement

Very intensive treatment requires an explicit acknowledgement before the order can be submitted. The acknowledgement states that the laundry will use specialised treatment but complete stain removal cannot be guaranteed and fabric risks will be explained where relevant.

The system stores the acknowledgement timestamp and the staff actor who recorded it. The receipt should include a concise non-guarantee note when a very intensive treatment is present.

## Data model

### Site pricing

Store stain-treatment pricing as site-scoped configuration with:

- treatment level;
- billing unit (`piece` or `kg`);
- fixed price;
- active status;
- updated-by actor;
- created and updated timestamps.

The database enforces one active configuration row per site, level, and unit. Financial records must not cascade-delete if a site or price configuration is removed.

### Posted order charge

Store each stain-treatment charge separately from the underlying service item with:

- organisation, site, order, and related order-item identifiers;
- treatment level and billing unit;
- treated quantity;
- price captured at order time;
- calculated line total;
- very-intensive acknowledgement metadata when required;
- creator and timestamps.

The server derives organisation and site scope, price, unit, and total. Clients may supply only the related order item, treatment level, treated quantity, and acknowledgement response.

Posted charges retain their captured values even if site pricing changes later. Corrections must follow the existing audited order-correction workflow rather than silently rewriting financial history.

## Totals, discounts, memberships, and receipts

- Stain treatment is included in the order subtotal and total.
- The line is shown separately from the underlying cleaning service on the order summary, receipt, and order detail page.
- Membership coverage does not include stain treatment unless a later membership design explicitly adds it.
- The first release excludes stain treatment from general percentage discounts so treatment cost is not accidentally reduced. A later policy may add an explicit discount rule.
- Payment status and outstanding balance use the final order total including stain treatment.

Example receipt lines:

- `Intensive stain treatment — 2 pieces × [rate]`
- `Standard stain treatment — 3.5 kg × [rate]`

## Permissions and tenant isolation

- Owners can configure all stain-treatment prices for their organisation's sites.
- Managers may configure prices only when their existing permissions authorize site pricing changes.
- Order-authorized staff may add treatment charges only for the active site and only against order items belonging to that order and organisation.
- The API rejects cross-organisation, cross-site, and mismatched order-item identifiers.
- The server never trusts a client-supplied price, currency, organisation, site, or calculated total.

## Error handling

The order cannot be submitted when:

- the applicable site rate is missing or inactive;
- the treated quantity is zero, negative, malformed, or greater than the related service quantity;
- the related order item belongs to a different order, site, or organisation;
- Very intensive treatment lacks acknowledgement;
- the selected service uses an unsupported billing unit.

Errors use clear staff-facing language and preserve the order draft. The system must not silently omit a treatment charge or fall back to a custom price.

## Reporting

Reports expose:

- treatment revenue by site, level, and billing unit;
- treated quantity by level and unit;
- number of orders with stain treatment;
- average stain-treatment revenue per treated order;
- use of Very intensive treatment and its acknowledgement rate.

Piece and kilogram quantities are never combined into one meaningless total. Revenue may be aggregated across both units.

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
- correct rate resolution for piece and kilogram services;
- captured-price stability after a configuration change;
- quantity bounds and decimal kilogram quantities;
- prevention of custom prices and cross-tenant identifiers;
- Very intensive acknowledgement enforcement and persistence;
- order subtotal, total, payment balance, receipt, and reporting integration;
- membership and discount exclusions;
- correction behavior without silent historical rewrites;
- Owner, Manager, and staff permission boundaries;
- English, French, Portuguese, mobile, keyboard, and screen-reader behavior.

## Out of scope

- Staff-entered custom treatment prices.
- AI or image-based stain classification.
- Chemical inventory consumption.
- Guaranteed stain removal.
- Customer self-selection of a treatment level.
- Automatic membership coverage or promotional discounts.

