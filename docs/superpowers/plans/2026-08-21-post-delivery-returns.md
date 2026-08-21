# Post-Delivery Garment Returns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tenant-safe post-delivery return workflow at garment level while preserving the current internal production-return action.

**Architecture:** Introduce dedicated return-case and immutable event tables instead of overloading `garment_items`. Register a focused Express route module with organisation/site/role guards, then add return intake and manager decision UI to Order Detail plus an operational queue page. Keep existing legacy fields readable and backfill them into historical cases idempotently at startup.

**Tech Stack:** React 18, TypeScript, Wouter, TanStack Query, Express 5, Drizzle ORM/PostgreSQL, Zod, Radix/shadcn UI.

---

### Task 1: Return domain schema and idempotent startup migration

**Files:**
- Modify: `shared/schema.ts`
- Modify: `server/replit_integrations/auth/replitAuth.ts`
- Create: `server/lib/quality-operations-schema.test.ts`

- [ ] **Step 1: Write the failing schema regression test**

Assert the schema contains `garment_return_cases`, `garment_return_events`, unique active-case protection, organisation/site/order/garment FKs, actor IDs, statuses, complaint reason, decision/action, timestamps, and legacy backfill SQL.

- [ ] **Step 2: Run the test and verify failure**

Run: `npx tsx server/lib/quality-operations-schema.test.ts`  
Expected: FAIL because the tables and migration do not exist.

- [ ] **Step 3: Add Drizzle tables and indexes**

Create `garmentReturnCases` with `organisationId`, `siteId`, `orderId`, `garmentItemId`, `status`, `complaintReason`, `customerComment`, `decision`, `assignedStage`, `decisionNotes`, `receivedByUserId`, `decidedByUserId`, `resolvedByUserId`, `returnedAt`, `decidedAt`, `resolvedAt`, `createdAt`, and `updatedAt`. Create `garmentReturnEvents` with immutable `eventType`, `fromStatus`, `toStatus`, `notes`, `actorUserId`, and `createdAt`. Create `garmentReturnAttachments` for up to three JPEG/PNG/WebP evidence images per case, each capped at 500 KB and stored as a validated data URL in this first version because the app has no general object-storage upload layer yet.

- [ ] **Step 4: Add idempotent startup DDL and legacy backfill**

Use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and indexes. Backfill legacy `garment_items.returned_for_treatment = true OR resolved_at IS NOT NULL` into one historical case per garment using a deterministic uniqueness key and `ON CONFLICT DO NOTHING`. Map unresolved rows to `in_rework` and resolved rows to `resolved`; retain all legacy columns.

- [ ] **Step 5: Run schema tests and TypeScript**

Run: `npx tsx server/lib/quality-operations-schema.test.ts && npm run check`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/schema.ts server/replit_integrations/auth/replitAuth.ts server/lib/quality-operations-schema.test.ts
git commit -m "feat: add post-delivery return schema"
```

### Task 2: Return-state rules, permissions, and API

**Files:**
- Create: `server/lib/garment-return-rules.ts`
- Create: `server/lib/garment-return-routes.ts`
- Create: `server/lib/garment-return-routes.test.ts`
- Modify: `server/routes.ts`

- [ ] **Step 1: Write failing rule and security tests**

Cover allowed transitions: `pending_review -> approved|rejected`, `approved -> in_rework`, `in_rework -> quality_check`, `quality_check -> resolved`. Confirm operators can create but cannot decide/resolve; managers and owners can decide/resolve; orders must be delivered for customer returns; site and organisation scope are mandatory; only one active case per garment is allowed.

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx tsx server/lib/garment-return-routes.test.ts`  
Expected: FAIL because rules/routes are missing.

- [ ] **Step 3: Implement pure transition and validation helpers**

Define reason enum (`poor_washing`, `poor_ironing`, `poor_packaging`, `persistent_stain`, `damage`, `wrong_item`, `other`), decisions/actions, rejection/credit/refund justification requirements, and role checks.

- [ ] **Step 4: Implement tenant-safe routes**

Register:
- `POST /api/orders/:orderId/garment-returns`
- `GET /api/orders/:orderId/garment-returns`
- `GET /api/garment-returns?status=&siteId=`
- `POST /api/garment-returns/:id/decision`
- `POST /api/garment-returns/:id/transition`
- `GET /api/garment-returns/:id/events`

Use authenticated organisation ID, authorised site IDs, selected write site, parameterized Drizzle conditions, Zod bodies, transactions, immutable events, conflict-safe active-case checks, and strict image MIME/size/count validation. Financial decisions are recorded only; they do not create credit/refund transactions in this version.

- [ ] **Step 5: Register routes and preserve current internal-return endpoints**

Call `registerGarmentReturnRoutes(app)` from `server/routes.ts`. Do not remove or change `/api/garment-items/:id/return` and `/resolve`.

- [ ] **Step 6: Run targeted regressions**

Run: `npx tsx server/lib/garment-return-routes.test.ts && npx tsx server/lib/tenant-isolation.test.ts && npm run check`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/lib/garment-return-rules.ts server/lib/garment-return-routes.ts server/lib/garment-return-routes.test.ts server/routes.ts
git commit -m "feat: add garment return workflow API"
```

### Task 3: Order Detail intake and decision experience

**Files:**
- Create: `client/src/components/post-delivery-return-panel.tsx`
- Modify: `client/src/pages/order-detail.tsx`
- Modify: `client/src/lib/i18n.ts`
- Create: `server/lib/garment-return-ui.test.ts`

- [ ] **Step 1: Write failing UI regression assertions**

Require distinct labels for internal return and post-delivery customer return, delivered-order gating, article selection, visible labels, complaint comment requirement, manager-only decision controls, keyboard-operable buttons, descriptive icon labels, and EN/FR/PT keys.

- [ ] **Step 2: Run the UI test and verify failure**

Run: `npx tsx server/lib/garment-return-ui.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Build the accessible intake panel**

Use semantic form/fieldset/legend, labeled Radix Selects, checkboxes for garment selection, textarea for mandatory customer remarks, and explicit error text. Hide the post-delivery action unless order status is `delivered`. Keep the current internal action and rename it visually to “Return to production”.

- [ ] **Step 4: Add manager decision and timeline UI**

Show status, complaint, receiver, dates, events, and manager/owner decision controls. Do not expose decision controls to operators. Announce mutation success through the existing toast system and invalidate order/return queries.

- [ ] **Step 5: Add EN/FR/PT translations**

Add complete labels, reasons, statuses, actions, errors, and empty states. Avoid hard-coded workflow text in components.

- [ ] **Step 6: Run UI, TypeScript, and accessibility-oriented static checks**

Run: `npx tsx server/lib/garment-return-ui.test.ts && npm run check`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/post-delivery-return-panel.tsx client/src/pages/order-detail.tsx client/src/lib/i18n.ts server/lib/garment-return-ui.test.ts
git commit -m "feat: add post-delivery return controls"
```

### Task 4: Return queue and dashboard visibility

**Files:**
- Create: `client/src/pages/quality-operations.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/layout-shell.tsx`
- Modify: `client/src/hooks/use-auth.ts`
- Modify: `client/src/pages/dashboard.tsx`
- Create: `server/lib/quality-operations-navigation.test.ts`

- [ ] **Step 1: Write failing navigation/access tests**

Assert all roles can access the queue within site scope, only managers/owners receive decision controls, route and nav labels exist, and dashboard shows open-return count.

- [ ] **Step 2: Run and verify failure**

Run: `npx tsx server/lib/quality-operations-navigation.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Build the responsive queue page**

Add status/site filters, accessible cards/table reflow, open-case counts, clear empty/loading/error states, and links back to orders. Use headings, real buttons, visible focus states, and text labels alongside color.

- [ ] **Step 4: Register route, permissions, navigation, and dashboard card**

Add `/quality-operations`, a navigation item, role access, and a dashboard quick indicator sourced from the return queue API.

- [ ] **Step 5: Run checks and commit**

Run: `npx tsx server/lib/quality-operations-navigation.test.ts && npm run check && npm run build`  
Expected: PASS.

```bash
git add client/src/pages/quality-operations.tsx client/src/App.tsx client/src/components/layout-shell.tsx client/src/hooks/use-auth.ts client/src/pages/dashboard.tsx server/lib/quality-operations-navigation.test.ts
git commit -m "feat: add return operations queue"
```

### Task 5: Return workflow regression and compatibility pass

**Files:**
- Modify: `server/lib/tenant-isolation.test.ts`
- Modify: `server/lib/quality-operations-schema.test.ts`
- Modify: `server/lib/garment-return-routes.test.ts`
- Modify: `server/lib/garment-return-ui.test.ts`

- [ ] **Step 1: Add compatibility assertions**

Confirm current internal production return remains callable and visually distinct, old fields are not dropped, legacy backfill is idempotent, and post-delivery workflow never changes the commercial order status.

- [ ] **Step 2: Run the full targeted suite**

Run: `npx tsx server/lib/quality-operations-schema.test.ts && npx tsx server/lib/garment-return-routes.test.ts && npx tsx server/lib/garment-return-ui.test.ts && npx tsx server/lib/quality-operations-navigation.test.ts && npx tsx server/lib/tenant-isolation.test.ts && npm run check && npm run build`  
Expected: PASS.

- [ ] **Step 3: Devil's-advocate review**

Challenge duplicate submissions, cross-site access, operator escalation, invalid transitions, historical rows with partial data, order corrections, mobile overflow, keyboard flow, color-only status, and financial-decision side effects. Report any findings before applying additional non-plan fixes.

- [ ] **Step 4: Commit test hardening**

```bash
git add server/lib/tenant-isolation.test.ts server/lib/quality-operations-schema.test.ts server/lib/garment-return-routes.test.ts server/lib/garment-return-ui.test.ts server/lib/quality-operations-navigation.test.ts
git commit -m "test: harden garment return workflow"
```
