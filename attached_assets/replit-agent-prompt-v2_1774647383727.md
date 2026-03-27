# Replit AI Agent — 5 Feature Additions to CleanEase (App 1)

## Context & Stack

This is CleanEase, a full-stack laundry management app.

- **Frontend**: React + TypeScript, Wouter routing, TanStack Query, shadcn/ui, Tailwind CSS, i18next (EN/FR)
- **Backend**: Express + TypeScript, Drizzle ORM, PostgreSQL, express-session + passport-local auth
- **Auth**: Currently uses Replit OAuth (`/api/login` redirects to Replit). Session stored server-side.
- **Entry point**: `client/src/App.tsx`
- **Layout**: `client/src/components/layout-shell.tsx`
- **Existing receipt system**: Already in `client/src/pages/payments.tsx` — generates HTML receipt after payment via `generateReceiptHTML()` function and downloads it as `.html` file
- **Existing order statuses**: `pending → processing → ready → delivered → cancelled`

Implement ALL 5 changes below. Do not break existing features.

---

## CHANGE 1 — Replace Replit OAuth with Email/Password + Phone Authentication

### Goal
Remove the current Replit OAuth login and replace it with a simple, self-contained email+password authentication system that also supports phone number login — more practical for the African market where users may not have Replit accounts.

### What to remove
- Remove all Replit OAuth code: any `passport-replit`, OpenID connect middleware, `/api/login` redirect routes, and any `REPLIT_*` environment variable dependencies from the auth system
- Remove the Replit login button from the auth page

### What to build

**Backend changes:**

1. Install packages if not present: `bcryptjs`, `@types/bcryptjs`

2. Update the `users` table in the Drizzle schema (`server/db/schema.ts` or equivalent) to include:
```ts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique(),
  phone: varchar("phone", { length: 30 }).unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  businessName: varchar("business_name", { length: 255 }),
  role: varchar("role", { length: 50 }).notNull().default("owner"),
  createdAt: timestamp("created_at").defaultNow(),
});
```
Note: either email OR phone must be provided (at least one). Both can be provided. Run `db:push` after schema changes.

3. Create/update these Express routes in the auth router:

**POST `/api/auth/register`** — Register new user:
- Body: `{ email?, phone?, password, firstName, lastName, businessName? }`
- Validate: at least one of email or phone must be provided; password min 6 chars
- Hash password with `bcryptjs` (saltRounds: 12)
- Create user in DB
- Auto-create a "Starter" subscription for the new user (look up plan with slug="starter", create subscription record with status="active", startDate=today, endDate=+30 days)
- Create session and return user object (without passwordHash)
- Return 400 with clear error message if email/phone already exists

**POST `/api/auth/login`** — Login:
- Body: `{ identifier, password }` where `identifier` is either an email address or a phone number
- Detect if identifier contains "@" → look up by email; otherwise → look up by phone
- Compare password with `bcryptjs.compare()`
- On success: create session (`req.session.userId = user.id`) and return user object
- On failure: return 401 with message "Invalid credentials"

**POST `/api/auth/logout`** — Logout:
- Destroy session
- Return `{ success: true }`

**GET `/api/auth/user`** — Get current user (already exists, keep it, just make sure it returns subscription + plan info):
- Check `req.session.userId`, fetch user with subscription and plan from DB
- Return user object including `subscription.plan.slug`
- Return 401 if not authenticated

4. Update `passport` config: remove `passport-replit` strategy. Configure `passport-local` strategy using the login logic above, or remove passport entirely and use manual session management — whichever is simpler given the existing codebase.

**Frontend changes:**

1. Replace `client/src/pages/auth-page.tsx` (or create it if it doesn't exist as a separate file) with a new auth page that has TWO tabs: **Sign In** and **Register**.

**Sign In tab:**
- Input: "Email or Phone number" (single field, `identifier`)
- Input: "Password" (type=password)
- Button: "Sign In"
- Link: "Don't have an account? Register"
- On submit: POST to `/api/auth/login` with `{ identifier, password }`
- On success: redirect to `/`

**Register tab:**
- Input: "First Name" (required)
- Input: "Last Name" (required)  
- Input: "Business / Laundry Name" (optional, placeholder: "e.g. Pressing Excellence")
- Input: "Email address" (optional but one of email/phone required)
- Input: "Phone number" (optional but one of email/phone required, placeholder: "+237 6XX XXX XXX")
- Input: "Password" (min 6 chars)
- Input: "Confirm Password"
- Button: "Create Account"
- Small note below: "You can sign in with either your email or phone number"
- On submit: validate passwords match, POST to `/api/auth/register`
- On success: redirect to `/`
- Show inline error messages from API response

2. Update `client/src/hooks/use-auth.ts`:
- Change the `logout` function from `window.location.href = "/api/logout"` to a proper POST fetch to `/api/auth/logout` followed by `queryClient.setQueryData(["/api/auth/user"], null)` and redirect to `/auth`
- Keep the `fetchUser` function calling `GET /api/auth/user` — no changes needed there

3. The `ProtectedRoute` in `App.tsx` already redirects to `/auth` if not logged in — keep that logic unchanged.

---

## CHANGE 2 — PDF/Printable Receipt Generated on Order Creation

### Goal
Currently a receipt is only generated after a payment is recorded (in `payments.tsx`). Add a **deposit receipt** (reçu de dépôt) that is generated immediately when a new order is created, so the customer gets proof of drop-off before any payment.

### What to build

**In `client/src/pages/orders.tsx`:**

1. After the `saveMutation` on order creation succeeds (not edit — only new orders), automatically trigger a receipt download. The receipt for order creation should be different from the payment receipt — it's a "deposit confirmation" receipt.

2. Create a new function `generateDepositReceiptHTML(order, clientName)` in `orders.tsx`:

The receipt HTML should include:
- **Header**: business name "CleanEase" + tagline "Laundry Management"
- **Title**: "REÇU DE DÉPÔT" / "DEPOSIT RECEIPT" (bilingual)
- **Order number**: large, padded to 5 digits (e.g. #00023)
- **Grid of info**: Client name, Drop-off date, Expected pickup date (show "À confirmer" if not set), Number of items, Weight (kg)
- **Services/items table**: if garment items exist, list them; otherwise show generic "Laundry service — X kg"
- **Price section**: Total order price, "Amount paid at deposit: 0 FCFA", "Balance due: [full price] FCFA"
- **Order status tracker** — a visual horizontal step bar showing: Received → Washing → Stain Treatment → Drying → Ironing → Ready. Highlight "Received" as the current step.
- **Terms & conditions** (same as existing payment receipt in French):
  - Responsabilité limitée à 3× le coût de nettoyage
  - Client responsable des poches
  - Articles non réclamés après 30 jours → frais de stockage
  - Réclamations dans les 24h avec reçu
- **Footer**: "Merci de conserver ce reçu / Please keep this receipt" + generation date
- **Print button**: `onclick="window.print()"`

3. After `saveMutation.onSuccess` for a NEW order (not edit):
```ts
onSuccess: (newOrder) => {
  qc.invalidateQueries({ queryKey: ["orders"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  setOpen(false);
  setError("");
  // Auto-download deposit receipt
  const html = generateDepositReceiptHTML(newOrder, selectedClientName);
  const blob = new Blob([html], { type: "text/html; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `depot-commande-${newOrder.id}-${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
```

4. Also add a "Print Receipt" / "Reprint Deposit Receipt" button (Download icon) on each row in the orders table, so staff can reprint the deposit receipt at any time for an existing order.

**Backend:**
- The `POST /api/orders` response must return the full order object including `clientName` so the receipt can be generated on the frontend. Ensure the create endpoint returns `{ ...order, clientName: client.name }`.

---

## CHANGE 3 — Detailed Order Treatment Pipeline with 6 Steps

### Goal
Replace the current 4-step order status system (`received → washing → ready → delivered`) with a detailed 6-step laundry treatment pipeline. Add a visual pipeline tracker on each order.

### New status values (in order)
1. `received` — Order received / Dépôt reçu
2. `washing` — Washing / Lavage
3. `stain_treatment` — Stain Treatment / Traitement des taches
4. `drying` — Drying / Séchage
5. `ironing` — Ironing / Repassage
6. `ready` — Ready for pickup / Prêt pour retrait
7. `delivered` — Delivered / Livré

### Backend changes

1. Update the Drizzle schema: change the `status` column on the `orders` table from a 4-value enum to a 7-value enum or varchar:
```ts
status: varchar("status", { length: 50 }).notNull().default("received"),
```

2. Update the `PATCH /api/orders/:id` route to accept all 7 status values.

3. Add a new `order_status_history` table to track when each status was reached:
```ts
export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
  changedBy: integer("changed_by").references(() => users.id),
  notes: varchar("notes", { length: 500 }),
});
```

4. Whenever an order's status is updated via `PATCH /api/orders/:id`, automatically insert a record into `order_status_history`.

5. Add endpoint `GET /api/orders/:id/history` that returns the status history for an order, ordered by `changedAt` ascending.

Run `db:push` after schema changes.

### Frontend changes

1. **Update `STATUS_CONFIG`** in `orders.tsx` to include all 7 statuses:
```ts
const STATUS_CONFIG = {
  received:        { label: "Received",        labelFr: "Reçu",                color: "bg-purple-100 text-purple-700 ..." },
  washing:         { label: "Washing",          labelFr: "Lavage",              color: "bg-blue-100 text-blue-700 ..." },
  stain_treatment: { label: "Stain Treatment",  labelFr: "Traitement taches",   color: "bg-orange-100 text-orange-700 ..." },
  drying:          { label: "Drying",           labelFr: "Séchage",             color: "bg-yellow-100 text-yellow-700 ..." },
  ironing:         { label: "Ironing",          labelFr: "Repassage",           color: "bg-indigo-100 text-indigo-700 ..." },
  ready:           { label: "Ready",            labelFr: "Prêt",                color: "bg-green-100 text-green-700 ..." },
  delivered:       { label: "Delivered",        labelFr: "Livré",               color: "bg-gray-100 text-gray-600 ..." },
};
```

2. **Update filter tabs** in the orders list to show all 7 statuses.

3. **Add an Order Detail / Pipeline View**: When clicking on an order row (not the edit or delete button), open a side panel or Dialog that shows:
   - Order header: order number, client name, date, price, weight
   - **Visual pipeline tracker**: a horizontal stepper showing all 6 treatment steps (received → washing → stain_treatment → drying → ironing → ready) with:
     - Completed steps: filled circle with checkmark, colored in green
     - Current step: filled circle with current status color, pulsing dot
     - Future steps: empty circle, gray
     - Step labels below each circle (bilingual: English / French)
     - Timestamps below each completed step (from order status history)
   - **"Advance to next step" button**: a prominent button showing the next status name, e.g. "→ Move to Washing". Clicking it calls `PATCH /api/orders/:id` with the next status.
   - **Status history log**: a timeline list at the bottom showing all past status changes with date/time
   - The "delivered" status is only reachable after "ready", and should be set separately via a "Mark as Delivered" button

4. **Update the status filter pills** in the orders list to use all 7 statuses. On mobile, wrap them in a horizontally scrollable row.

5. Update the **deposit receipt** (from Change 2) to always show the pipeline with the current step highlighted.

---

## CHANGE 4 — Garment Return Flag + Incomplete Order Alert System

### Goal
When a customer's order is being processed, sometimes one or more garments need to be sent back for additional treatment (e.g., a stain wasn't removed, a garment needs re-ironing). Staff should be able to flag individual garments as "returned for re-treatment", and when the rest of the order is marked as ready, the system should show a prominent warning that the order is incomplete.

### Backend changes

1. Update the `order_items` table (or create it if it doesn't exist — this is the garment inventory table) to add a `returnedForTreatment` field and tracking:
```ts
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  returnedForTreatment: boolean("returned_for_treatment").notNull().default(false),
  returnStage: varchar("return_stage", { length: 50 }), // which stage it was sent back from
  returnNotes: varchar("return_notes", { length: 500 }), // why it was returned
  returnedAt: timestamp("returned_at"),
  resolvedAt: timestamp("resolved_at"), // when it rejoined the order
});
```

2. Add API routes:
- `PATCH /api/orders/:orderId/items/:itemId/return` — Mark an item as returned for re-treatment. Body: `{ returnStage, returnNotes }`. Sets `returnedForTreatment=true`, `returnStage`, `returnNotes`, `returnedAt=now`.
- `PATCH /api/orders/:orderId/items/:itemId/resolve` — Mark the returned item as resolved (rejoined order). Sets `returnedForTreatment=false`, `resolvedAt=now`.
- `GET /api/orders/:orderId/items` — Returns all items for an order including their return status.

3. In the `GET /api/orders` list endpoint, add a computed field `hasReturnedItems: boolean` on each order — true if any `order_items` for that order have `returnedForTreatment=true`.

4. In the `GET /api/analytics/dashboard` endpoint, add an `alerts` array entry for each order that has `status="ready"` AND `hasReturnedItems=true`:
```ts
{
  type: "warning",
  message: `Order #${order.id} (${clientName}) is marked Ready but has incomplete garments`,
  detail: `Garment "${itemName}" is still in ${returnStage} stage and has not rejoined the order`
}
```

Run `db:push` after schema changes.

### Frontend changes

1. **In the Order Detail panel** (created in Change 3), add a "Garments" section listing all items. For each item show:
   - Item name + quantity
   - If `returnedForTreatment=true`:
     - Show a red badge "⚠ Returned for Re-treatment"
     - Show which stage it was returned from (`returnStage`)
     - Show the return notes
     - Show a "Mark as Resolved" button that calls the resolve endpoint
   - If `returnedForTreatment=false`:
     - Show a "Return for Re-treatment" button (outlined, orange/amber color) that opens a small inline form asking for: return stage (select from the 6 pipeline stages), and a notes field (e.g. "Stain not fully removed"). On submit, calls the return endpoint.

2. **In the orders table list**, for each order row that has `hasReturnedItems=true`:
   - Add a small amber warning icon (⚠) next to the status badge
   - Add a tooltip or inline text: "Incomplete — garment(s) in re-treatment"

3. **When an order's status is advanced to "ready"** (via the pipeline stepper in Change 3), check if `hasReturnedItems=true`. If yes, show a confirmation Dialog before advancing:
   - Title: "⚠ Incomplete Order"
   - Message: "This order has garment(s) that are still in re-treatment. Are you sure you want to mark the order as Ready? The customer will see an incomplete order warning."
   - Buttons: "Cancel" and "Mark as Ready Anyway"

4. **Dashboard alert banners** (added in the previous prompt): the dashboard already has an `alerts` array. The incomplete order alerts will flow through that system automatically once the backend is updated (step 4 of backend changes above). Make sure the dashboard renders `type: "warning"` alerts with a yellow/amber style and AlertTriangle icon.

5. **In the customer detail page** (`/customers/:id`), in the order history section, show a small amber "⚠ Incomplete" badge next to any order that has `hasReturnedItems=true` and is not yet delivered.

---

## CHANGE 5 — Pan-African Payment System

### Goal
Expand the payment methods in the existing payments system to support the most widely-used mobile money and payment platforms across Africa. The current system has: Cash, Bank Transfer, Mobile Money (Orange/MTN). Expand this to a full pan-African payment registry.

### Payment methods to support

Replace the current payment method options with this complete list, grouped by region:

```ts
export const PAYMENT_METHODS = [
  // Universal
  { value: "cash",               label: "Cash / Espèces",                   region: "all" },
  { value: "bank_transfer",      label: "Bank Transfer / Virement bancaire", region: "all" },
  
  // West & Central Africa — Mobile Money
  { value: "orange_money",       label: "Orange Money",                      region: "West/Central Africa" },
  { value: "mtn_momo",           label: "MTN Mobile Money (MoMo)",           region: "West/Central Africa" },
  { value: "wave",               label: "Wave",                              region: "Senegal, Côte d'Ivoire, Mali" },
  { value: "moov_money",         label: "Moov Money (Flooz)",                region: "West Africa" },
  { value: "free_money",         label: "Free Money",                        region: "Senegal" },
  { value: "airtel_money",       label: "Airtel Money",                      region: "East/Central Africa" },
  
  // East Africa
  { value: "mpesa",              label: "M-Pesa",                            region: "Kenya, Tanzania, DRC" },
  { value: "tigo_pesa",          label: "Tigo Pesa",                         region: "Tanzania" },
  { value: "halotel_pesa",       label: "Halotel Pesa",                      region: "Tanzania" },
  { value: "mtn_rwanda",         label: "MTN Mobile Money Rwanda",           region: "Rwanda" },
  
  // Southern Africa
  { value: "ecocash",            label: "EcoCash",                           region: "Zimbabwe" },
  { value: "innbucks",           label: "InnBucks",                          region: "Zimbabwe" },
  
  // North Africa & Pan-African
  { value: "cib_online",         label: "CIB Online / Edahabia",             region: "Algeria" },
  { value: "fawry",              label: "Fawry",                             region: "Egypt" },
  
  // International cards (for tourists / diaspora)
  { value: "visa_mastercard",    label: "Visa / Mastercard",                 region: "International" },
  { value: "paypal",             label: "PayPal",                            region: "International" },
];
```

### Backend changes

1. Update the `order_payments` table (or `payments` table — whichever exists): change the `method` column from a small enum to `varchar(50)` to support all new method values. Run `db:push`.

2. No payment gateway integration needed at this stage — these are all recorded as manual payments (staff records what the customer paid with). The actual mobile money transfer happens outside the app; staff just records the method and amount.

3. Update `GET /api/analytics/dashboard` to include payment method breakdown in stats (optional, for future analytics).

### Frontend changes — `client/src/pages/payments.tsx`

1. Replace the current 3-option payment method `<Select>` with the full `PAYMENT_METHODS` list above. Group them using `<SelectGroup>` and `<SelectLabel>` from shadcn/ui:

```tsx
<Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Universal</SelectLabel>
      <SelectItem value="cash">Cash / Espèces</SelectItem>
      <SelectItem value="bank_transfer">Bank Transfer / Virement</SelectItem>
    </SelectGroup>
    <SelectGroup>
      <SelectLabel>Mobile Money — West & Central Africa</SelectLabel>
      <SelectItem value="orange_money">Orange Money</SelectItem>
      <SelectItem value="mtn_momo">MTN Mobile Money (MoMo)</SelectItem>
      <SelectItem value="wave">Wave</SelectItem>
      <SelectItem value="moov_money">Moov Money (Flooz)</SelectItem>
      <SelectItem value="free_money">Free Money</SelectItem>
      <SelectItem value="airtel_money">Airtel Money</SelectItem>
    </SelectGroup>
    <SelectGroup>
      <SelectLabel>Mobile Money — East Africa</SelectLabel>
      <SelectItem value="mpesa">M-Pesa</SelectItem>
      <SelectItem value="tigo_pesa">Tigo Pesa</SelectItem>
      <SelectItem value="halotel_pesa">Halotel Pesa</SelectItem>
      <SelectItem value="mtn_rwanda">MTN Mobile Money Rwanda</SelectItem>
    </SelectGroup>
    <SelectGroup>
      <SelectLabel>Mobile Money — Southern Africa</SelectLabel>
      <SelectItem value="ecocash">EcoCash</SelectItem>
      <SelectItem value="innbucks">InnBucks</SelectItem>
    </SelectGroup>
    <SelectGroup>
      <SelectLabel>Other regions</SelectLabel>
      <SelectItem value="cib_online">CIB Online / Edahabia (Algeria)</SelectItem>
      <SelectItem value="fawry">Fawry (Egypt)</SelectItem>
    </SelectGroup>
    <SelectGroup>
      <SelectLabel>International</SelectLabel>
      <SelectItem value="visa_mastercard">Visa / Mastercard</SelectItem>
      <SelectItem value="paypal">PayPal</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

2. Update the `METHOD_LABELS` map in `payments.tsx` to include all new payment method values with their display labels.

3. Update the **receipt HTML** (`generateReceiptHTML` function) to use the new `METHOD_LABELS` map so the receipt shows the correct full name (e.g. "MTN Mobile Money (MoMo)" instead of just "mobile_money").

4. Add a **"Reference / Transaction ID" field** to the payment form, shown only when a mobile money or card method is selected (not cash or bank transfer). This lets staff record the mobile money transaction reference number:
```tsx
{["orange_money","mtn_momo","wave","moov_money","free_money","airtel_money","mpesa","tigo_pesa","halotel_pesa","mtn_rwanda","ecocash","innbucks","visa_mastercard","paypal"].includes(form.method) && (
  <div>
    <Label>Transaction Reference (optional)</Label>
    <Input 
      value={form.reference || ""} 
      onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} 
      className="mt-1" 
      placeholder="e.g. MP2401234567 or Orange ref #..." 
    />
  </div>
)}
```

5. Store the `reference` field in the DB — add `reference: varchar("reference", { length: 255 })` to the `order_payments` table. Run `db:push`.

6. Show the transaction reference on the receipt if it exists.

7. Also apply the same expanded payment method list to the **Subscription payment dialog** in `subscriptions.tsx` (if that page exists in this app).

---

## Cross-cutting concerns — apply to ALL changes

1. **i18n**: Add EN and FR translation keys for every new label introduced. Key additions needed:
   - Auth: `sign_in`, `register`, `email_or_phone`, `business_name`, `confirm_password`, `create_account`, `already_have_account`, `no_account_yet`
   - Pipeline steps: `step_received`, `step_washing`, `step_stain_treatment`, `step_drying`, `step_ironing`, `step_ready`, `step_delivered`, `advance_to_next`, `mark_delivered`
   - Garment return: `returned_for_treatment`, `return_garment`, `mark_resolved`, `return_stage`, `return_notes`, `incomplete_order`
   - Receipts: `deposit_receipt`, `balance_due`, `amount_paid_at_deposit`
   - Payment methods: all new method labels

2. **Dark mode**: All new UI components must use CSS variables (`text-foreground`, `bg-card`, `border-border`, etc.) not hardcoded colors. Check that new status badges, pipeline steps, and alert banners work in both light and dark modes.

3. **Mobile responsiveness**: The pipeline stepper must be horizontally scrollable on mobile (use `overflow-x-auto` wrapper). The payment method select must be fully usable on small screens.

4. **Do not break**: existing routes, the currency switcher, the language switcher, the services catalog, the reports page, customer preferences (starch/detergent), garment inventory, existing receipt download in payments.tsx.

---

## Verification checklist

After implementing, confirm:

- [ ] Can register a new account with email OR phone number (not both required)
- [ ] Can log in with email + password
- [ ] Can log in with phone number + password
- [ ] Replit OAuth button is completely removed
- [ ] Creating a new order automatically downloads/opens the deposit receipt HTML
- [ ] Deposit receipt shows order number, client name, items, price, and the pipeline tracker with "Received" highlighted
- [ ] Orders list shows all 7 status filter tabs
- [ ] Clicking an order opens a pipeline detail view with the stepper showing all 6 treatment stages
- [ ] Can advance an order step by step through the pipeline
- [ ] Status history timestamps show correctly below each completed step
- [ ] Can flag an individual garment as "returned for re-treatment" with a stage and notes
- [ ] Orders with returned garments show a ⚠ warning icon in the list
- [ ] Advancing an order to "ready" when it has returned garments shows a confirmation warning
- [ ] Dashboard shows alert for orders that are "ready" but have incomplete garments
- [ ] Payment method dropdown shows all grouped pan-African payment methods
- [ ] Mobile Money transaction reference field appears when a mobile money method is selected
- [ ] Receipt shows full payment method name and transaction reference if provided
- [ ] All new UI works in French (language switcher)
- [ ] All new UI works in dark mode
- [ ] No TypeScript errors (`pnpm run check`)
- [ ] App starts and all existing pages still work
