# XPress Pro Business Analysis — Design Specification

## Purpose

Give new and existing laundry entrepreneurs a trustworthy answer to three questions:

1. Is the business profitable now?
2. Has it recovered the money invested in it?
3. At the current performance level, when is break-even expected?

The feature provides decision support without turning XPress Pro into a full accounting system.

## Product position

Business Analysis is a separate Owner/Manager section. It does not replace the current operational dashboard.

- Add **Business Analysis** to the primary navigation near Financial Intelligence and Expenses.
- Call the investment-recovery area **Business Journey**.
- Add one compact business-health card to the existing dashboard for authorized users. The card links to the full analysis.
- Keep the Operator dashboard unchanged.

## Users and permissions

### Owner

- Views consolidated company analysis and every site.
- Manages original investments, later capital expenditure, loans, owner injections, withdrawals, owner salary, and shared-cost allocation.
- Corrects manual entries through audited reversals or amendments.

### Manager

- Views assigned sites.
- Records approved site-level financial inputs.
- Cannot change original investment, company-wide rules, or shared-cost allocation unless granted the `manage_business_analysis_settings` capability.

### Operator

- Has no access to Business Analysis or its summary card.

## Onboarding and historical businesses

The setup wizard supports both new businesses and businesses that existed before adopting XPress Pro.

Required setup:

- Business start date.
- Analysis start date.
- Site or company assignment for each entry.
- Itemized original investment.
- For pre-existing businesses: opening cumulative operating profit or loss, capital already returned to the owner, and the effective date of those opening balances.

Investment categories:

- Machines and equipment.
- Premises and renovation.
- Rent deposit.
- Generator or alternative power.
- Furniture and fittings.
- Licences and registration.
- Opening stock.
- Working capital.
- Other investment.

Owners may use a quick total when itemized history is unavailable. Historical owner-entered data is labelled **Estimated**. Data sourced directly from XPress Pro is labelled **Tracked**.

If a pre-existing owner cannot provide opening cumulative profit/loss, XPress Pro calculates performance only from the analysis start date. It must not claim an actual historical break-even date; investment recovery and forecasts are labelled **Estimated from available data**.

## Financial classifications

The system must keep the following concepts separate:

- **Customer revenue:** earned from completed orders.
- **Customer collections:** payments actually received.
- **Operating expenses:** rent, wages, owner salary, electricity, water, detergent, repairs, transport, marketing, and similar running costs.
- **Capital expenditure:** equipment or long-lived assets; increases total investment and does not distort one month's operating profit.
- **Owner salary:** operating expense.
- **Owner withdrawal:** cash taken from accumulated profit or capital; not an operating expense.
- **Owner injection:** additional capital; not revenue.
- **Loan proceeds:** financing; not revenue.
- **Loan principal repayment:** financing cash outflow; not an operating expense.
- **Loan interest:** operating/finance expense.

## Core calculations

### Operating profit

`completed-order revenue - operating expenses`

Owner salary is included once inside operating expenses and must not be subtracted a second time.

Revenue recognition uses completed orders. Cancelled orders are excluded. Refunds and reversals reduce revenue in the appropriate period according to the existing transaction record.

### Cash flow

`customer payments received - expenses paid - loan principal repayments - owner withdrawals + owner injections + loan proceeds`

The interface must explain that cash flow is not profit.

### Investment recovery

- **Investment base** equals original owner-funded investment plus later owner capital injections designated as investment plus owner-funded capital expenditure. Capital expenditure funded from operating cash or loans is tracked but does not increase owner capital invested.
- **Cumulative operating result** equals opening historical cumulative operating profit/loss plus the running sum of monthly operating profit/loss from the analysis ledger.
- **Capital returned** is recorded only through an explicit capital-return transaction. A normal owner withdrawal does not silently change the investment base.
- **Net investment to recover** equals investment base minus explicit capital returned, never below zero.
- **Recovered investment** equals cumulative operating result, capped between zero and net investment to recover. Losses reduce cumulative operating result before recovery resumes.
- **Remaining investment** equals net investment to recover minus recovered investment.
- Break-even occurs on the first date cumulative operating result equals or exceeds net investment to recover.

Owner injections and loan proceeds never count as profit or recovered investment. Owner withdrawals affect cash flow but do not change cumulative operating profit. If a withdrawal is a return of capital, the Owner must classify it explicitly as capital returned.

### Break-even forecast

- Require at least three complete months with reviewed expense data.
- Use up to the six most recent complete months. Apply linear weights from oldest to newest: 1 through N.
- Forecast monthly recovery using weighted average monthly operating profit. Withdrawals remain a cash-flow concern and do not change the operating-profit forecast.
- Exclude incomplete months unless the UI explicitly presents a run-rate estimate.
- Display the period used, weights, assumptions, and confidence level.
- Confidence is **Low** with three valid months, **Medium** with four or five, and **High** with six only when every source month is complete and reviewed. Any estimated historical opening balance caps confidence at Medium.
- If weighted retained profit is zero or negative, display **No break-even forecast yet**.
- Never invent a date when data is missing or performance is loss-making.

### Fixed-cost coverage

- Calculate recurring fixed costs separately from variable costs.
- Show both fixed-cost coverage and full operating break-even revenue.
- Full operating break-even revenue equals fixed costs divided by expected contribution margin ratio. Derive that ratio from the most recent three to six complete months; if history is insufficient, require an Owner-entered estimate and label the target **Estimated**.
- Show the current coverage percentage.
- Derive a daily or weekly sales target using working days configured for the site.

## Multi-site rules

- Calculate profit, cash flow, investment recovery, and forecasts per site.
- Provide a consolidated company view.
- Keep company-level shared costs visible as a separate line by default.
- Owners may allocate shared costs using an explicit method such as equal allocation or revenue proportion.
- Always show the allocation method and original company-level amount.
- Never allow a profitable site to silently conceal a loss-making site in the site comparison.

## Dashboard

### 1. Business health summary

- Profitable, breaking even, or loss-making status.
- Current month's operating profit.
- Current month's cash generated or consumed.
- Data-confidence indicator.

### 2. Business Journey

- Total investment.
- Amount recovered.
- Amount remaining.
- Recovery percentage and progress bar.
- Actual break-even date or forecast date.

### 3. Monthly evolution

- Revenue, expenses, and operating-profit trend.
- Cash-in and cash-out trend.
- Comparison with the previous complete month.
- Site and consolidated filters.

### 4. Cost coverage

- Monthly fixed costs.
- Revenue required to cover costs.
- Coverage percentage.
- Required daily and weekly sales target.

### 5. Site performance

- Profit and cash flow by site.
- Investment recovery by site.
- Best-performing and loss-making sites.
- Shared costs and allocations shown transparently.

### 6. Owner and financing activity

- Owner salary.
- Capital injections.
- Withdrawals.
- Loans received.
- Principal and interest repayments.

### 7. Guidance and alerts

Examples:

- Electricity costs increased materially from the previous complete month.
- Investment recovery is forecast in a stated number of months.
- A site has not covered fixed costs for two consecutive complete months.
- Sales are growing while cash collections are falling.

Alerts must include the comparison period and calculation basis. Suppress prescriptive or alarmist conclusions when confidence is low.

## Explanation and traceability

- Every metric opens a calculation breakdown.
- Breakdowns link to source orders, payments, expenses, and manual ledger entries.
- XPress Pro-generated source figures cannot be overwritten from Business Analysis.
- Manual entries record creator, timestamp, site, category, amount, effective date, reference, and notes.
- Corrections create amendments or reversals; they never erase the original entry.
- Forecast cards display the source period, assumptions, and confidence.

## Data quality and error states

- Warn when required setup data is incomplete.
- Warn when a month has missing or unreviewed expense information.
- Mark incomplete months and avoid comparing them directly with complete months.
- Distinguish zero from missing data.
- If a source query fails, show an explicit unavailable state with retry; never silently display zero.
- Preserve calculation version metadata so historical results remain explainable after formulas change.

## Components and boundaries

- **Financial setup module:** captures business dates, investment, fixed-cost expectations, and historical opening data.
- **Capital ledger:** records investment, capital expenditure, owner injections, withdrawals, loans, and repayments.
- **Financial classifier:** maps source transactions into revenue, collections, expenses, capital, and financing without modifying source records.
- **Metrics engine:** calculates profit, cash flow, recovery, coverage, and forecasts using versioned formulas.
- **Analysis API:** enforces site permissions and returns metrics plus calculation breakdowns.
- **Business Analysis UI:** presents summaries, trends, filters, breakdowns, and manual-entry workflows.
- **Alert engine:** evaluates complete periods and emits evidence-backed insights.

Each component has one responsibility. The metrics engine consumes normalized financial events rather than querying UI-specific data directly.

## Rollout

### Phase 1 — Core financial truth

Phase 1 is delivered through four implementation milestones, each with its own plan and acceptance gate.

#### Milestone 1A — Setup and ledgers

- Setup wizard.
- Itemized investment and capital ledger.
- Owner salary, withdrawal, injection, and loan tracking.

#### Milestone 1B — Classification and calculations

- Operating profit and cash-flow calculations.
- Investment recovery and break-even tracking.

#### Milestone 1C — Permissions and multi-site analysis

- Site and consolidated filters.
- Shared-cost handling.
- Owner, Manager, capability, and Operator enforcement.

#### Milestone 1D — Dashboard and traceability

- Core dashboard and drill-downs.

### Phase 2 — Guidance

- Intelligent alerts.
- Period comparisons.
- Break-even forecasts.
- Daily and weekly sales targets.

### Phase 3 — Reporting

- Downloadable owner/investor report.
- Accountant export.
- Optional scheduled reports.

## Testing and acceptance

- Formula unit tests cover profit, cash flow, investment recovery, withdrawals, injections, loans, refunds, reversals, and negative-profit periods.
- Permission tests verify Owner, Manager, cross-site, and Operator access.
- Integration tests reconcile dashboard totals to known orders, payments, expenses, and ledger entries.
- Multi-site tests verify shared-cost allocation and consolidated totals.
- Forecast tests cover insufficient history, incomplete months, zero profit, losses, and formula-version changes.
- UI tests verify setup, filters, drill-downs, explicit error states, and mobile layouts.
- Production rollout requires Replit deployment verification and browser checks before the feature is declared live.

## Explicit non-goals

Phase 1 does not include:

- Double-entry bookkeeping.
- Tax filing or tax advice.
- Depreciation schedules.
- Formal balance sheets.
- Inventory valuation accounting.
- Automated bank reconciliation.

These can be added later through accountant-focused exports or integrations without complicating the entrepreneur-facing experience.
