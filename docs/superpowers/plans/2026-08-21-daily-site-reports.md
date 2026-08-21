# Optional Daily Site Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators and managers submit optional, traceable end-of-day site reports enriched with frozen operational metrics for owners and managers to read.

**Architecture:** Store versioned daily reports and comments/acknowledgements in dedicated tenant-scoped tables. Generate metric snapshots server-side from existing orders, payments, expenses, and return cases at draft creation/submission time. Add a responsive site-report page with draft, submit, read, comment, and multi-site owner views.

**Tech Stack:** React 18, TypeScript, Wouter, TanStack Query, Express 5, Drizzle ORM/PostgreSQL, Zod, Radix/shadcn UI.

---

### Task 1: Daily report schema and tenant indexes

**Files:**
- Modify: `shared/schema.ts`
- Modify: `server/replit_integrations/auth/replitAuth.ts`
- Create: `server/lib/daily-site-reports-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Require `daily_site_reports` and `daily_site_report_comments`, organisation/site/date/version/status, author/submitted/acknowledged identities and timestamps, frozen JSON metrics, narrative fields, and uniqueness per site/date/version.

- [ ] **Step 2: Run and verify failure**

Run: `npx tsx server/lib/daily-site-reports-schema.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Add schema and startup DDL**

Create Drizzle tables, relations, organisation/site/date indexes, and idempotent SQL. Use `jsonb` for frozen metrics and text fields for summary, difficulties, needs, and handover.

- [ ] **Step 4: Run tests and commit**

Run: `npx tsx server/lib/daily-site-reports-schema.test.ts && npm run check`  
Expected: PASS.

```bash
git add shared/schema.ts server/replit_integrations/auth/replitAuth.ts server/lib/daily-site-reports-schema.test.ts
git commit -m "feat: add daily site report schema"
```

### Task 2: Metrics snapshot and report API

**Files:**
- Create: `server/lib/daily-site-report-metrics.ts`
- Create: `server/lib/daily-site-report-routes.ts`
- Create: `server/lib/daily-site-reports.test.ts`
- Modify: `server/routes.ts`

- [ ] **Step 1: Write failing formula/API/security tests**

Cover timezone-safe site date boundaries, orders created/delivered/pending, payments collected, expenses, outstanding balance for the day's orders, returns created/open/decided, operator draft ownership, immutable submitted versions, manager/owner reads, owner multi-site scope, and organisation isolation.

- [ ] **Step 2: Run and verify failure**

Run: `npx tsx server/lib/daily-site-reports.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement pure metric aggregation**

Reuse reporting date helpers. Compute metrics server-side for exactly one authorised site/date. Do not accept financial totals from the client.

- [ ] **Step 4: Implement report routes**

Register:
- `GET /api/daily-site-reports?date=&siteId=&status=`
- `POST /api/daily-site-reports/draft`
- `PATCH /api/daily-site-reports/:id`
- `POST /api/daily-site-reports/:id/submit`
- `POST /api/daily-site-reports/:id/comments`
- `POST /api/daily-site-reports/:id/acknowledge`

Allow operators/managers to create for their selected site; only the draft author or manager/owner can edit; submitted reports are immutable; corrections create a new version/addendum; managers read assigned sites; owners read all organisation sites.

- [ ] **Step 5: Register routes, run tests, and commit**

Run: `npx tsx server/lib/daily-site-reports.test.ts && npx tsx server/lib/tenant-isolation.test.ts && npm run check`  
Expected: PASS.

```bash
git add server/lib/daily-site-report-metrics.ts server/lib/daily-site-report-routes.ts server/lib/daily-site-reports.test.ts server/routes.ts
git commit -m "feat: add daily site report API"
```

### Task 3: Daily report authoring and reading UI

**Files:**
- Create: `client/src/pages/daily-site-reports.tsx`
- Create: `client/src/components/daily-site-report-form.tsx`
- Create: `client/src/components/daily-site-report-card.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/layout-shell.tsx`
- Modify: `client/src/hooks/use-auth.ts`
- Modify: `client/src/lib/i18n.ts`
- Create: `server/lib/daily-site-reports-ui.test.ts`

- [ ] **Step 1: Write failing UI/accessibility tests**

Require route/nav/permissions, labeled form controls, semantic metric summaries, explicit optional messaging, visible draft/submitted/acknowledged text, immutable submitted UI, owner multi-site filter, comment controls, EN/FR/PT, keyboard operation, and non-color status cues.

- [ ] **Step 2: Run and verify failure**

Run: `npx tsx server/lib/daily-site-reports-ui.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Build accessible report form**

Show server-provided metric snapshot, site/date, summary, difficulties, needs, and handover. Use `<form>`, associated labels, descriptions, error text, real submit buttons, and confirmation before freezing a submission.

- [ ] **Step 4: Build report feed and reading controls**

Provide filters, cards with site/date/author/status, expandable metric details, comments, acknowledgement, empty/loading/error states, and responsive layout.

- [ ] **Step 5: Register route/navigation/access and translations**

Add `/daily-reports`; allow operators, managers, and owners with server-side scoping as authority. Add complete EN/FR/PT keys.

- [ ] **Step 6: Run checks and commit**

Run: `npx tsx server/lib/daily-site-reports-ui.test.ts && npm run check && npm run build`  
Expected: PASS.

```bash
git add client/src/pages/daily-site-reports.tsx client/src/components/daily-site-report-form.tsx client/src/components/daily-site-report-card.tsx client/src/App.tsx client/src/components/layout-shell.tsx client/src/hooks/use-auth.ts client/src/lib/i18n.ts server/lib/daily-site-reports-ui.test.ts
git commit -m "feat: add daily site report experience"
```

### Task 4: Cross-feature operational integration

**Files:**
- Modify: `server/lib/daily-site-report-metrics.ts`
- Modify: `client/src/pages/quality-operations.tsx`
- Modify: `client/src/pages/dashboard.tsx`
- Create: `server/lib/quality-reporting-integration.test.ts`

- [ ] **Step 1: Write failing integration tests**

Assert return cases created/open/decided on the selected date/site appear in report snapshots, dashboard links to reports/returns, and switching sites changes both query keys and server scopes.

- [ ] **Step 2: Run and verify failure**

Run: `npx tsx server/lib/quality-reporting-integration.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement cross-links and metrics**

Add return counts to frozen metrics, links between reports and return queue, and dashboard indicators for open returns and submitted/unread reports.

- [ ] **Step 4: Run checks and commit**

Run: `npx tsx server/lib/quality-reporting-integration.test.ts && npm run check`  
Expected: PASS.

```bash
git add server/lib/daily-site-report-metrics.ts client/src/pages/quality-operations.tsx client/src/pages/dashboard.tsx server/lib/quality-reporting-integration.test.ts
git commit -m "feat: connect quality returns and daily reports"
```

### Task 5: Full verification and critical review

**Files:**
- Modify: relevant tests only if a verified gap is found and approved.

- [ ] **Step 1: Run all quality-operations tests**

Run: all new return/report tests plus `tenant-isolation`, `reporting-date`, `npm run check`, and `npm run build`.  
Expected: PASS.

- [ ] **Step 2: Accessibility review**

Verify semantic forms/headings, focus order, keyboard controls, 200% zoom/reflow assumptions, target sizes, screen-reader labels, contrast, status text beyond color, and image alt text requirements.

- [ ] **Step 3: Devil's-advocate review**

Challenge site timezone boundaries, stale snapshots, edits after submission, forged totals, cross-site owner/manager/operator access, duplicate reports, unread counts, empty reports, and financial mismatch. Report findings before applying additional non-plan fixes.

- [ ] **Step 4: Final verification commit if required**

Commit only verified test/documentation hardening; do not bundle unrelated cleanup.
