# PressFlow — Bug Fixes & Feature Additions
## Agent Implementation Prompt

---

## CONTEXT

This is the PressFlow SaaS laundry management application. The tech stack is:
- **Frontend**: React + TypeScript, Wouter, TanStack Query v5, shadcn/ui, Tailwind CSS, i18next (EN/FR)
- **Backend**: Express 5 + TypeScript, JWT (Bearer token + `X-Site-Id` header), Drizzle ORM, PostgreSQL
- **Auth**: JWT in localStorage (`token`), active site in localStorage (`pressflow_active_site_id`), sent as `X-Site-Id` header on all API calls

Implement ALL sections below in order. Do not skip any item. Do not break existing functionality.

---

# SECTION A — BUG FIXES (implement first)

---

## BUG 1 — Order entry date always shows today's date

### Root cause
Two separate failures:
1. The order creation form either does not render an `entryDate` field, or initializes it but does not submit it to the API
2. The backend `POST /api/orders` ignores the submitted date and lets Drizzle's `defaultNow()` fire on the `createdAt` column

### Fix — Backend

In the `orders` table schema (`server/db/schema.ts`), add a separate `entryDate` column distinct from `createdAt`:

```ts
entryDate: date("entry_date").notNull(),
// createdAt remains as the system timestamp (when the record was inserted)
// entryDate is the business date — when the customer physically dropped off their clothes
// These can differ: staff may register an order retroactively
```

Run `npm run db:push` after schema change.

In `POST /api/orders` route:
```ts
// Accept entryDate from body, fall back to today if not provided
const entryDate = body.entryDate ?? new Date().toISOString().slice(0, 10);
// Insert with: entryDate: entryDate (NOT createdAt)
```

In `GET /api/orders`, return `entryDate` in the response for every order.

In `GET /api/orders/:id`, return `entryDate`.

### Fix — Frontend (`client/src/pages/orders.tsx`)

In the New Order form, add an **Entry Date** field:

```tsx
<div>
  <Label>Entry Date / Date de dépôt *</Label>
  <Input
    type="date"
    value={form.entryDate}
    onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))}
    className="mt-1"
    required
  />
</div>
```

Initialize form state with today's date:
```ts
const [form, setForm] = useState({
  clientId: "", weight: "", itemCount: "", price: "",
  entryDate: new Date().toISOString().slice(0, 10),  // default today, editable
  pickupDate: "", notes: "", status: "received"
});
```

Include `entryDate` in the mutation payload:
```ts
saveMutation.mutate({
  clientId: parseInt(form.clientId),
  weight: parseFloat(form.weight),
  entryDate: form.entryDate,   // ← add this
  // ... rest of fields
});
```

In the orders table display, show `order.entryDate` (not `order.createdAt`) in the Date column.

In the Order Detail side panel, show:
```
Entry Date: [entryDate formatted as DD/MM/YYYY]
Expected Pickup: [pickupDate or "Not set"]
```

In the deposit receipt generation (`generateDepositReceiptHTML`), use `order.entryDate` for the "Date de dépôt" field.

---

## BUG 2 — Dashboard and Analytics page overlap

### Goal
Clear separation: Dashboard = operational pulse (today/this week/this month). Analytics = business health (deep KPIs, trends, profitability, performance score).

### Fix — Dashboard page (`client/src/pages/dashboard.tsx`)

**Remove from Dashboard** (move to Analytics only):
- Break-even analysis card
- Cost per kg / Profit per kg (keep on Analytics, remove from Dashboard main view)
- Performance score section
- Waste detection alerts
- 30-day revenue area chart (replace with 7-day bar chart)
- Any period switcher (day/week/month/year) — Dashboard is always "live"

**Dashboard now shows — three time scopes, always visible simultaneously:**

**TODAY section** (top, most prominent):
- Orders received today (count + list of new entries)
- kg processed today
- Revenue collected today (payments recorded today)
- Expenses logged today
- Orders in each pipeline stage (received/washing/stain_treatment/drying/ironing/ready/delivered) — as horizontal pill counters
- Alerts (incomplete orders, overdue pickups, machine issues)
- Daily target progress bar

**THIS WEEK section** (middle):
- Total orders this week (bar chart: one bar per day, Mon→Sun or last 7 days)
- Total revenue this week
- Total expenses this week
- Orders delivered this week

**THIS MONTH section** (bottom):
- Monthly revenue vs last month (simple comparison: current vs previous, +/- delta)
- Monthly expenses vs last month
- Monthly orders count
- Outstanding payments (unpaid orders count + total value)
- Top 3 services by order count this month

**Keep on Dashboard:**
- Alert banners (danger/warning/info)
- Orders by status donut chart (today's breakdown)
- Ready for pickup list (actionable — needs attention now)

### Fix — Analytics page (`client/src/pages/analytics.tsx`)

Analytics is now the deep analysis hub. It keeps the period switcher (day/week/month/year) and **adds** the following that were removed from Dashboard:

**Business Health section** (top):
- Revenue trend — area chart (selected period)
- Expenses trend — overlaid line
- Net profit — prominently displayed with color
- Break-even analysis card (kg needed vs actual)

**Financial KPIs grid:**
- Cost per kg, Profit per kg, Revenue per order, Average order weight
- Each with a period-over-period delta (vs previous period)

**Production Performance section** (NEW — see Feature 7):
- Average time from entry → ready (in hours/days)
- Average time from entry → delivered
- On-time readiness rate: % of orders marked ready before their pickup date
- Orders delayed (ready after pickup date) — count + list

**Operational KPIs:**
- Machine utilization %
- Employee productivity (kg/person)
- Order completion rate

**Waste Detection** (Business+ plan)

**Performance Score** (Business+ plan)

---

## BUG 3 — New member lands on wrong dashboard

### Root cause
The `AuthProvider` login function does not set `activeSiteId` in localStorage before the dashboard component mounts and fires its data fetch. The dashboard fetches without an `X-Site-Id` header, gets org-level data or the owner's data instead of the member's assigned site.

### Fix — Auth context (`client/src/lib/auth-context.tsx`)

In the `login()` function, after receiving the response, set `activeSiteId` BEFORE `setUser()`:

```ts
const login = async (identifier: string, password: string) => {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

  localStorage.setItem("token", data.token);

  // Set site context BEFORE setting user (so any query that fires on user change already has the header)
  if (data.user.organisationRole === "owner") {
    // Owners start in HQ mode — no site selected
    localStorage.removeItem("pressflow_active_site_id");
    setActiveSiteIdState(null);
  } else if (data.user.siteMemberships?.length > 0) {
    // Members: auto-select their first (and usually only) assigned site
    const firstSiteId = data.user.siteMemberships[0].siteId;
    localStorage.setItem("pressflow_active_site_id", String(firstSiteId));
    setActiveSiteIdState(firstSiteId);
  } else {
    // Member with no sites assigned yet — show a "waiting for access" screen
    localStorage.removeItem("pressflow_active_site_id");
    setActiveSiteIdState(null);
  }

  setUser(data.user);
};
```

Also fix the `useEffect` on mount (for page refresh / token restore):

```ts
useEffect(() => {
  const token = localStorage.getItem("token");
  if (!token) { setLoading(false); return; }

  apiFetch("/auth/me")
    .then(data => {
      // Restore site context for members
      if (data.user.organisationRole === "member") {
        const stored = localStorage.getItem("pressflow_active_site_id");
        if (!stored && data.user.siteMemberships?.length > 0) {
          // No stored site — default to first membership
          const firstSiteId = data.user.siteMemberships[0].siteId;
          localStorage.setItem("pressflow_active_site_id", String(firstSiteId));
          setActiveSiteIdState(firstSiteId);
        }
        // Validate stored siteId still belongs to this user's memberships
        if (stored) {
          const valid = data.user.siteMemberships?.some((m: any) => m.siteId === parseInt(stored));
          if (!valid) {
            // Stored site no longer valid (membership revoked) — reset
            const firstSiteId = data.user.siteMemberships?.[0]?.siteId;
            if (firstSiteId) {
              localStorage.setItem("pressflow_active_site_id", String(firstSiteId));
              setActiveSiteIdState(firstSiteId);
            }
          }
        }
      }
      setUser(data.user);
    })
    .catch(() => { localStorage.removeItem("token"); })
    .finally(() => setLoading(false));
}, []);
```

### Add "No Site Assigned" screen

When a member is logged in but has no site memberships, show a clear informational screen instead of a broken dashboard:

```tsx
// In the ProtectedRoute or Dashboard component:
if (!isOwner && !activeSiteId && siteMemberships.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
        <MapPin className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold mb-2">Waiting for Site Access</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        Your account has been created but you have not been assigned to any site yet.
        Contact your organisation administrator to grant you access.
      </p>
      <p className="text-xs text-muted-foreground mt-4">Logged in as: {user?.email || user?.phone}</p>
    </div>
  );
}
```

---

## BUG 4 — Site management broken (4 separate failures)

### Fix 4A — `X-Site-Id` header not sent on all requests

Audit every `apiFetch` call in the codebase. The `apiFetch` function in `client/src/lib/api.ts` must attach `X-Site-Id` from localStorage on EVERY request. Verify this is the case:

```ts
// client/src/lib/api.ts
export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const activeSiteId = localStorage.getItem("pressflow_active_site_id");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (activeSiteId) headers["X-Site-Id"] = activeSiteId;

  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  // ... rest
}
```

Critically: ensure this function is the ONLY way the frontend makes API calls. If any page is using raw `fetch()` directly, replace it with `apiFetch()`.

### Fix 4B — Backend: all data routes must filter by siteId

Audit every data route in `server/routes/`. Each GET endpoint for site-scoped data must have `WHERE site_id = req.siteId`. Add this check to a shared utility:

```ts
// server/lib/siteGuard.ts
export function getSiteId(req: Request): number {
  if (!req.siteId) throw new ApiError(400, "X-Site-Id header is required");
  return req.siteId;
}
```

Apply to all routes:
- `GET /api/orders` → `WHERE orders.site_id = getSiteId(req)`
- `GET /api/clients` → filter by site (or org if HQ mode)
- `GET /api/expenses` → `WHERE expenses.site_id = getSiteId(req)`
- `GET /api/machines` → `WHERE machines.site_id = getSiteId(req)`
- `GET /api/employees` → `WHERE employees.site_id = getSiteId(req)`
- `GET /api/analytics/dashboard` → all aggregations filtered by `site_id`

### Fix 4C — Dashboard does not switch data when site context changes

The dashboard query key must include `activeSiteId` so TanStack Query treats it as a different query when the site changes:

```ts
// In all dashboard/analytics queries, include the site in the query key:
const { data } = useQuery({
  queryKey: ["dashboard", activeSiteId],  // ← activeSiteId in key
  queryFn: () => apiFetch("/analytics/dashboard"),
  // apiFetch automatically sends X-Site-Id header
  refetchInterval: 30000,
});
```

Apply the same pattern to ALL queries on ALL pages:
```ts
// Orders
queryKey: ["orders", activeSiteId, statusFilter]

// Clients
queryKey: ["clients", activeSiteId]

// Expenses
queryKey: ["expenses", activeSiteId, typeFilter]

// Machines, Employees, etc.
queryKey: ["machines", activeSiteId]
queryKey: ["employees", activeSiteId]
```

Also call `queryClient.clear()` or `queryClient.invalidateQueries()` every time `switchToSite()` or `switchToHQ()` is called in the auth context.

### Fix 4D — Analytics page does not respect site scope

Same fix as 4C. Analytics query keys:
```ts
queryKey: ["kpis", activeSiteId, period]
queryKey: ["waste", activeSiteId]
queryKey: ["performance-score", activeSiteId]
```

---

# SECTION B — NEW FEATURES (implement after all bugs are fixed)

---

## FEATURE 1 — Decimal kg input (e.g. 1.5 kg, 2.5 kg)

### Backend
Verify the `weight` column on the `orders` table is `decimal(8, 2)` or `numeric(8, 2)` in Drizzle, NOT `integer`. If it's integer, change it:
```ts
weight: numeric("weight", { precision: 8, scale: 2 }).notNull(),
```
Run `npm run db:push`.

### Frontend
All weight input fields across the app must use `step="0.5"` as the default step (allowing 0.5 increments), but also allow arbitrary decimals via `step="any"`:

```tsx
<Input
  type="number"
  step="0.5"      // default step = 0.5 kg increments
  min="0"
  placeholder="e.g. 2.5"
  value={form.weight}
  onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
/>
```

Also update all display formatting to show one decimal place:
```ts
// Replace: order.weight + " kg"
// With:
parseFloat(order.weight).toFixed(1) + " kg"
```

Apply to: orders table, order detail panel, client detail order history, dashboard KPI cards, analytics totals, receipts.

---

## FEATURE 2 — Customer discount system

### Schema changes

Add to the `clients` table:
```ts
defaultDiscountPct: numeric("default_discount_pct", { precision: 5, scale: 2 }).default("0"),
// Percentage discount automatically applied to every new order for this client
// 0 = no discount, 10 = 10% off, etc.
```

Add to the `orders` table:
```ts
discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).default("0"),
discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).default("0"),
originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
// originalPrice = price before discount
// price = final price after discount
```

Run `npm run db:push`.

### Backend

**GET `/api/clients/:id`**: include `defaultDiscountPct` in response.

**POST `/api/orders`**: when creating an order, if the client has a `defaultDiscountPct > 0`:
```ts
const originalPrice = body.price;
const discountPct = body.discountPct ?? client.defaultDiscountPct ?? 0;
const discountAmount = originalPrice * (discountPct / 100);
const finalPrice = originalPrice - discountAmount;

// Insert:
{
  originalPrice,
  discountPct,
  discountAmount,
  price: finalPrice,   // final price after discount
}
```

### Frontend — Client detail page

In the client preferences section, add a **Default Discount** field:
```tsx
<div>
  <Label>Default Discount</Label>
  <div className="flex items-center gap-2 mt-1">
    <Input
      type="number"
      min="0"
      max="100"
      step="1"
      value={form.defaultDiscountPct}
      onChange={e => setForm(f => ({ ...f, defaultDiscountPct: e.target.value }))}
      className="w-24"
      placeholder="0"
    />
    <span className="text-sm text-muted-foreground">% off all orders</span>
  </div>
  {parseFloat(form.defaultDiscountPct) > 0 && (
    <p className="text-xs text-green-600 mt-1">
      This client gets {form.defaultDiscountPct}% off every order automatically
    </p>
  )}
</div>
```

### Frontend — New Order form

Add a **Discount** field. When a client is selected, auto-fill with their `defaultDiscountPct`. The user can override it:

```tsx
{/* After price field */}
<div className="grid grid-cols-2 gap-3">
  <div>
    <Label>Discount (%)</Label>
    <Input
      type="number"
      min="0"
      max="100"
      step="1"
      value={form.discountPct}
      onChange={e => {
        const pct = parseFloat(e.target.value) || 0;
        const original = parseFloat(form.originalPrice) || 0;
        const discountAmount = original * (pct / 100);
        setForm(f => ({
          ...f,
          discountPct: e.target.value,
          discountAmount: discountAmount.toFixed(0),
          price: (original - discountAmount).toFixed(0),
        }));
      }}
      className="mt-1"
    />
  </div>
  <div>
    <Label>Final Price</Label>
    <div className="mt-1 px-3 py-2 bg-muted rounded-lg text-sm font-semibold">
      {parseFloat(form.price).toLocaleString("fr-FR")} FCFA
      {parseFloat(form.discountPct) > 0 && (
        <span className="text-xs text-muted-foreground ml-2 line-through">
          {parseFloat(form.originalPrice).toLocaleString("fr-FR")}
        </span>
      )}
    </div>
  </div>
</div>
```

When client is selected, auto-fetch their discount:
```ts
// When clientId changes, set discount from client data
onClientSelect: (clientId) => {
  const client = clients.find(c => c.id === parseInt(clientId));
  const defaultDiscount = parseFloat(client?.defaultDiscountPct ?? "0");
  setForm(f => ({
    ...f,
    clientId,
    discountPct: String(defaultDiscount),
    // Recalculate price with discount
    price: defaultDiscount > 0
      ? (parseFloat(f.originalPrice) * (1 - defaultDiscount / 100)).toFixed(0)
      : f.originalPrice,
  }));
}
```

### Receipt update

In `generateReceiptHTML` and `generateDepositReceiptHTML`, if `discountPct > 0`, add a discount line:
```html
<tr>
  <td>Service price</td>
  <td style="text-align:right">${originalPrice} FCFA</td>
</tr>
<tr style="color:#16a34a">
  <td>Discount (${discountPct}%)</td>
  <td style="text-align:right">-${discountAmount} FCFA</td>
</tr>
<tr style="font-weight:bold; border-top:2px solid #eee">
  <td>Total</td>
  <td style="text-align:right">${finalPrice} FCFA</td>
</tr>
```

---

## FEATURE 3 — Order cancellation with approval workflow

### Schema changes

Add new status values to orders. The `status` column now supports:
```
received → washing → stain_treatment → drying → ironing → ready → delivered
                                                                  ↓
                                          cancellation_requested → cancelled
```

Add to the `orders` table:
```ts
cancellationReason: text("cancellation_reason"),
cancellationRequestedBy: integer("cancellation_requested_by").references(() => users.id),
cancellationRequestedAt: timestamp("cancellation_requested_at"),
cancellationReviewedBy: integer("cancellation_reviewed_by").references(() => users.id),
cancellationReviewedAt: timestamp("cancellation_reviewed_at"),
cancellationRejectionNote: text("cancellation_rejection_note"),
```

Run `npm run db:push`.

### Backend routes

**POST `/api/orders/:id/request-cancellation`** — operator or manager can call this:
```ts
// Body: { reason: string }
// Sets status = "cancellation_requested"
// Sets cancellationReason, cancellationRequestedBy, cancellationRequestedAt
// Inserts into orderStatusHistory
// Returns updated order
```

**POST `/api/orders/:id/approve-cancellation`** — manager or owner only (`requireRole("manager", "owner")`):
```ts
// Sets status = "cancelled"
// Sets cancellationReviewedBy, cancellationReviewedAt
// Inserts into orderStatusHistory with note "Cancellation approved"
```

**POST `/api/orders/:id/reject-cancellation`** — manager or owner only:
```ts
// Body: { rejectionNote: string }
// Reverts status to previous status (get from orderStatusHistory — last status before "cancellation_requested")
// Sets cancellationRejectionNote
// Inserts into orderStatusHistory with note "Cancellation rejected: [rejectionNote]"
```

**GET `/api/orders/pending-cancellations`** — manager/owner only:
```ts
// Returns all orders WHERE status = "cancellation_requested" for req.siteId
// Includes: order details, client name, reason, who requested it, when
```

### Frontend — Order detail panel

**For operators and managers**: add a "Request Cancellation" button (red, outlined) at the bottom of the order detail panel. Only visible for orders not yet delivered or already cancelled:

```tsx
{!["delivered", "cancelled", "cancellation_requested"].includes(order.status) && (
  <Button
    variant="outline"
    className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
    onClick={() => setCancelDialogOpen(true)}
  >
    <XCircle className="w-4 h-4 mr-2" />
    {effectiveRole === "operator" ? "Request Cancellation" : "Cancel Order"}
  </Button>
)}
```

**Cancellation request dialog**:
```tsx
<Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Request Order Cancellation</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 mt-2">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
        <AlertTriangle className="w-4 h-4 inline mr-2" />
        A manager must approve this cancellation request before the order is cancelled.
      </div>
      <div>
        <Label>Reason for cancellation *</Label>
        <Textarea
          value={cancelReason}
          onChange={e => setCancelReason(e.target.value)}
          placeholder="Explain why this order should be cancelled..."
          className="mt-1"
          rows={3}
          required
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setCancelDialogOpen(false)}>
          Keep Order
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          disabled={!cancelReason.trim() || cancelMutation.isPending}
          onClick={() => cancelMutation.mutate({ orderId: order.id, reason: cancelReason })}
        >
          Submit Request
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

**For managers/owners**: when viewing a `cancellation_requested` order, show an approval panel:
```tsx
{order.status === "cancellation_requested" && (effectiveRole === "manager" || isOwner) && (
  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-4 space-y-3">
    <div className="flex items-center gap-2">
      <AlertCircle className="w-4 h-4 text-destructive" />
      <p className="text-sm font-semibold text-destructive">Cancellation Requested</p>
    </div>
    <p className="text-sm text-muted-foreground">
      <span className="font-medium">{order.cancellationRequestedByName}</span> requested cancellation:
    </p>
    <p className="text-sm italic bg-muted rounded p-2">"{order.cancellationReason}"</p>
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="destructive"
        size="sm"
        onClick={() => approveCancellationMutation.mutate(order.id)}
      >
        <Check className="w-3.5 h-3.5 mr-1.5" /> Approve — Cancel Order
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRejectDialogOpen(true)}
      >
        <X className="w-3.5 h-3.5 mr-1.5" /> Reject Request
      </Button>
    </div>
  </div>
)}
```

**Pending Cancellations badge**: in the sidebar nav item for Orders, show a count badge if there are pending cancellation requests:
```tsx
{ icon: ShoppingBag, labelKey: "orders", href: "/orders", page: "orders", badgeKey: "pendingCancellations" }
```

**In the Orders list**: highlight rows with `status = "cancellation_requested"` with a subtle red-tinted background and a ⚠ icon.

---

## FEATURE 4 — Service delivery timeline → auto-calculates pickup date

### Schema — services table
Ensure this field exists (add if missing):
```ts
estimatedDurationDays: integer("estimated_duration_days").default(1),
// Renamed from estimatedDuration for clarity — always stored in DAYS
// 1 = next day, 2 = 2 days, etc.
```

Run `npm run db:push` if changed.

### Backend

**GET `/api/services`**: include `estimatedDurationDays` in response.

### Frontend — New Order form

When a service is selected from a dropdown in the order form, auto-calculate and set the pickup date:

First, add a **Service** select field to the order form (if not already present):
```tsx
<div>
  <Label>Service</Label>
  <Select
    value={form.serviceId}
    onValueChange={(serviceId) => {
      const service = services.find(s => s.id === parseInt(serviceId));
      // Auto-calculate pickup date
      if (service?.estimatedDurationDays && form.entryDate) {
        const entry = new Date(form.entryDate);
        entry.setDate(entry.getDate() + service.estimatedDurationDays);
        const autoPickup = entry.toISOString().slice(0, 10);
        setForm(f => ({ ...f, serviceId, pickupDate: autoPickup }));
      } else {
        setForm(f => ({ ...f, serviceId }));
      }
    }}
  >
    <SelectTrigger className="mt-1"><SelectValue placeholder="Select service" /></SelectTrigger>
    <SelectContent>
      {services.map(s => (
        <SelectItem key={s.id} value={String(s.id)}>
          {s.name} — {s.effectivePrice.toLocaleString("fr-FR")} FCFA/{s.unit}
          {s.estimatedDurationDays && (
            <span className="text-muted-foreground ml-2">· {s.estimatedDurationDays}d</span>
          )}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Also, when `entryDate` changes and a service is already selected, recalculate the pickup date:
```ts
onEntryDateChange: (newDate) => {
  const service = services.find(s => s.id === parseInt(form.serviceId));
  let newPickup = form.pickupDate;
  if (service?.estimatedDurationDays) {
    const entry = new Date(newDate);
    entry.setDate(entry.getDate() + service.estimatedDurationDays);
    newPickup = entry.toISOString().slice(0, 10);
  }
  setForm(f => ({ ...f, entryDate: newDate, pickupDate: newPickup }));
}
```

Show the auto-calculated pickup date with a visual indicator:
```tsx
<div>
  <Label>
    Expected Pickup Date
    {autoCalculated && (
      <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">
        Auto-calculated
      </span>
    )}
  </Label>
  <Input
    type="date"
    value={form.pickupDate}
    onChange={e => { setForm(f => ({ ...f, pickupDate: e.target.value })); setAutoCalculated(false); }}
    className="mt-1"
  />
  {form.serviceId && form.pickupDate && (
    <p className="text-xs text-muted-foreground mt-1">
      Based on {selectedService?.name} ({selectedService?.estimatedDurationDays} day turnaround)
    </p>
  )}
</div>
```

### Services management — update duration field

In the Services page add/edit form, rename "Estimated Duration" to "Turnaround Time (days)" and ensure it stores an integer number of days:
```tsx
<div>
  <Label>Turnaround Time (days)</Label>
  <Input
    type="number"
    min="1"
    step="1"
    value={form.estimatedDurationDays}
    onChange={e => setForm(f => ({ ...f, estimatedDurationDays: e.target.value }))}
    className="mt-1"
    placeholder="e.g. 1 = next day, 2 = 2 days"
  />
  <p className="text-xs text-muted-foreground mt-1">
    This automatically sets the expected pickup date when registering an order.
  </p>
</div>
```

---

## FEATURE 5 — Expense date field (with today as default)

### Backend
Verify `expenses` table has `date: date("date").notNull()`. If missing, add it and run `npm run db:push`.

In `POST /api/expenses`:
```ts
const expenseDate = body.date ?? new Date().toISOString().slice(0, 10);
// Insert with: date: expenseDate
```

In `GET /api/expenses`: return `date` field.

In `PUT /api/expenses/:id`: accept `date` in update body.

### Frontend (`client/src/pages/expenses.tsx`)

In the Add/Edit Expense form, add a date field if missing:
```tsx
<div>
  <Label>Expense Date</Label>
  <Input
    type="date"
    value={form.date}
    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
    className="mt-1"
    required
  />
</div>
```

Initialize with today:
```ts
const [form, setForm] = useState({
  type: "water",
  amount: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),  // ← today by default
});
```

In the expenses table, display the `date` column (not `createdAt`).

---

## FEATURE 6 — Delivery date on "Mark as Delivered" + customer punctuality tracking

### Schema changes

Add to the `orders` table:
```ts
deliveredAt: timestamp("delivered_at"),
// Set when status changes to "delivered"
// Separate from updatedAt — explicit business date/time of delivery
```

Add to the `clients` table:
```ts
totalDeliveries: integer("total_deliveries").default(0),
onTimeDeliveries: integer("on_time_deliveries").default(0),
lateDeliveries: integer("late_deliveries").default(0),
// on_time = deliveredAt <= pickupDate
// late = deliveredAt > pickupDate
// punctualityRate = (onTimeDeliveries / totalDeliveries) * 100
```

Run `npm run db:push`.

### Backend

**PATCH `/api/orders/:id/status`**: when new status is `"delivered"`:
```ts
const deliveredAt = body.deliveredAt
  ? new Date(body.deliveredAt)
  : new Date();  // default now

// Update order:
await db.update(orders).set({
  status: "delivered",
  deliveredAt,
}).where(eq(orders.id, orderId));

// Update client punctuality stats:
const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
const isOnTime = order.pickupDate
  ? deliveredAt <= new Date(order.pickupDate)
  : true;  // no pickup date set → count as on-time

await db.update(clients).set({
  totalDeliveries: sql`total_deliveries + 1`,
  onTimeDeliveries: isOnTime ? sql`on_time_deliveries + 1` : sql`on_time_deliveries`,
  lateDeliveries: !isOnTime ? sql`late_deliveries + 1` : sql`late_deliveries`,
}).where(eq(clients.id, order.clientId));
```

**GET `/api/clients/:id`**: include punctuality stats:
```ts
{
  ...client,
  punctualityRate: client.totalDeliveries > 0
    ? Math.round((client.onTimeDeliveries / client.totalDeliveries) * 100)
    : null,
  totalDeliveries: client.totalDeliveries,
  onTimeDeliveries: client.onTimeDeliveries,
  lateDeliveries: client.lateDeliveries,
}
```

### Frontend — Order detail panel

When clicking "Mark as Delivered", show a small dialog (not just a confirm):

```tsx
function DeliveryConfirmDialog({ order, onConfirm, onCancel }) {
  const [deliveredAt, setDeliveredAt] = useState(
    new Date().toISOString().slice(0, 10)  // default today
  );
  const isLate = order.pickupDate && deliveredAt > order.pickupDate;

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Delivery</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Delivery Date</Label>
            <Input
              type="date"
              value={deliveredAt}
              onChange={e => setDeliveredAt(e.target.value)}
              className="mt-1"
            />
          </div>
          {order.pickupDate && (
            <div className={cn(
              "flex items-center gap-2 text-sm px-3 py-2 rounded-lg",
              isLate
                ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                : "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
            )}>
              {isLate
                ? <><AlertTriangle className="w-4 h-4" /> Late delivery (expected {order.pickupDate})</>
                : <><CheckCircle2 className="w-4 h-4" /> On time ✓</>
              }
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button className="flex-1" onClick={() => onConfirm(deliveredAt)}>
              Confirm Delivery
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Frontend — Client detail page

Add a **Punctuality** section in the client stats row:

```tsx
{client.totalDeliveries > 0 && (
  <div className="bg-card border border-border rounded-xl p-4">
    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Pickup Punctuality</p>
    <div className="flex items-center gap-4">
      <div className="text-center">
        <p className="text-2xl font-bold">{client.punctualityRate}%</p>
        <p className="text-xs text-muted-foreground">on time</p>
      </div>
      <div className="flex-1">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full",
              client.punctualityRate >= 80 ? "bg-green-500"
              : client.punctualityRate >= 50 ? "bg-amber-500"
              : "bg-destructive"
            )}
            style={{ width: `${client.punctualityRate}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{client.onTimeDeliveries} on time</span>
          <span>{client.lateDeliveries} late</span>
        </div>
      </div>
    </div>
    {client.lateDeliveries > 2 && (
      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        This client frequently picks up late — consider a reminder system
      </p>
    )}
  </div>
)}
```

---

## FEATURE 7 — "Ready date" tracking for production delay analysis

### Schema
No change needed — the `orderStatusHistory` table already records a timestamp for every status transition, including `ready`. The `ready` status transition timestamp IS the "ready date". We just need to expose and analyze this data.

### Backend — new analytics endpoint

**GET `/api/analytics/production-delays`** (requires `X-Site-Id`, Pro+ plan):

```ts
// Returns production performance data
{
  // Average time from entry to ready (in hours)
  avgEntryToReadyHours: number,

  // Average time from entry to delivered (in hours)
  avgEntryToDeliveredHours: number,

  // On-time readiness rate: % of orders where readyAt <= pickupDate
  onTimeReadinessRate: number,

  // Orders ready on time vs late (current period)
  onTimeCount: number,
  lateCount: number,
  noPickupDateCount: number,  // orders without a pickup date set

  // Distribution: how many hours does it take to process orders?
  processingTimeDistribution: [
    { range: "0-24h", count: number },
    { range: "24-48h", count: number },
    { range: "2-3 days", count: number },
    { range: "3-5 days", count: number },
    { range: "5+ days", count: number },
  ],

  // Orders that are currently overdue (past pickup date, not yet delivered)
  overdueOrders: [{
    orderId, clientName, entryDate, pickupDate,
    daysOverdue: number,
    currentStatus: string
  }],

  // Recent orders with their production time
  recentOrders: [{
    orderId, clientName, entryDate,
    readyAt: string | null,
    deliveredAt: string | null,
    pickupDate: string | null,
    entryToReadyHours: number | null,
    isOnTime: boolean | null,
  }]
}
```

Implementation logic:
```ts
// For each order in the period, find the timestamp when status became "ready"
// by querying orderStatusHistory WHERE status = 'ready' AND order_id IN (...)
// Then: entryToReadyHours = (readyAt - entryDate) / 3600000
// isOnTime = readyAt <= pickupDate (if pickupDate is set)
```

### Frontend — Analytics page: new "Production Performance" section

Add this section to the Analytics page, below the operational KPIs card. Gated at Pro+ plan.

```tsx
{hasFeature("analytics") && (
  <ProductionPerformanceSection data={productionData} />
)}

function ProductionPerformanceSection({ data }) {
  if (!data) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Production Performance</h3>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Avg. Entry → Ready</p>
          <p className="text-xl font-bold mt-1">
            {data.avgEntryToReadyHours < 24
              ? `${data.avgEntryToReadyHours.toFixed(0)}h`
              : `${(data.avgEntryToReadyHours / 24).toFixed(1)} days`
            }
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">On-Time Readiness</p>
          <p className={cn("text-xl font-bold mt-1",
            data.onTimeReadinessRate >= 80 ? "text-green-600"
            : data.onTimeReadinessRate >= 60 ? "text-amber-600"
            : "text-destructive"
          )}>
            {data.onTimeReadinessRate.toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ready On Time</p>
          <p className="text-xl font-bold mt-1 text-green-600">{data.onTimeCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ready Late</p>
          <p className={cn("text-xl font-bold mt-1", data.lateCount > 0 ? "text-destructive" : "text-muted-foreground")}>
            {data.lateCount}
          </p>
        </div>
      </div>

      {/* Processing time distribution bar chart */}
      <div>
        <p className="text-xs text-muted-foreground mb-3">Processing Time Distribution</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data.processingTimeDistribution} layout="vertical" margin={{ left: 60 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="range" tick={{ fontSize: 11 }} width={55} />
            <Tooltip formatter={(v: any) => [`${v} orders`, "Count"]} />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Overdue orders alert */}
      {data.overdueOrders.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {data.overdueOrders.length} Overdue Order{data.overdueOrders.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-1.5">
            {data.overdueOrders.slice(0, 5).map(o => (
              <div key={o.orderId} className="flex items-center justify-between text-xs">
                <span className="font-medium">#{o.orderId} · {o.clientName}</span>
                <span className="text-destructive font-medium">{o.daysOverdue} day{o.daysOverdue > 1 ? "s" : ""} overdue</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## SECTION C — i18n ADDITIONS

Add these keys to BOTH `en` and `fr` translation objects:

**English:**
```json
"entry_date": "Entry Date",
"delivery_date": "Delivery Date",
"default_discount": "Default Discount",
"discount": "Discount",
"original_price": "Original Price",
"final_price": "Final Price",
"discount_applied": "{{pct}}% discount applied",
"request_cancellation": "Request Cancellation",
"cancellation_reason": "Reason for Cancellation",
"approve_cancellation": "Approve — Cancel Order",
"reject_cancellation": "Reject Request",
"cancellation_pending": "Cancellation Requested",
"pending_cancellations": "Pending Cancellations",
"turnaround_days": "Turnaround Time (days)",
"auto_calculated": "Auto-calculated",
"on_time": "On Time",
"late_delivery": "Late Delivery",
"punctuality": "Pickup Punctuality",
"on_time_rate": "on time",
"production_performance": "Production Performance",
"avg_entry_to_ready": "Avg. Entry → Ready",
"on_time_readiness": "On-Time Readiness",
"overdue_orders": "Overdue Orders",
"days_overdue": "days overdue",
"processing_time": "Processing Time Distribution",
"no_site_assigned": "Waiting for Site Access",
"no_site_description": "You have not been assigned to any site yet. Contact your administrator.",
"confirm_delivery": "Confirm Delivery",
"cancel_order": "Cancel Order",
"keep_order": "Keep Order"
```

**French:**
```json
"entry_date": "Date de dépôt",
"delivery_date": "Date de livraison",
"default_discount": "Remise par défaut",
"discount": "Remise",
"original_price": "Prix original",
"final_price": "Prix final",
"discount_applied": "Remise de {{pct}}% appliquée",
"request_cancellation": "Demander une annulation",
"cancellation_reason": "Motif d'annulation",
"approve_cancellation": "Approuver — Annuler la commande",
"reject_cancellation": "Rejeter la demande",
"cancellation_pending": "Annulation demandée",
"pending_cancellations": "Annulations en attente",
"turnaround_days": "Délai de traitement (jours)",
"auto_calculated": "Calculé automatiquement",
"on_time": "Dans les délais",
"late_delivery": "Livraison en retard",
"punctuality": "Ponctualité de retrait",
"on_time_rate": "dans les délais",
"production_performance": "Performance de production",
"avg_entry_to_ready": "Moy. Dépôt → Prêt",
"on_time_readiness": "Taux de préparation à temps",
"overdue_orders": "Commandes en retard",
"days_overdue": "jours de retard",
"processing_time": "Distribution des délais de traitement",
"no_site_assigned": "En attente d'accès au site",
"no_site_description": "Vous n'avez pas encore été affecté à un site. Contactez votre administrateur.",
"confirm_delivery": "Confirmer la livraison",
"cancel_order": "Annuler la commande",
"keep_order": "Conserver la commande"
```

---

## SECTION D — VERIFICATION CHECKLIST

Run through every item before marking this prompt complete.

**Bug fixes**
- [ ] Creating an order with a past entry date (e.g. yesterday) saves and displays that past date
- [ ] Orders table shows `entryDate` column, not `createdAt`
- [ ] Deposit receipt shows correct entry date from `order.entryDate`
- [ ] Dashboard shows today/this week/this month sections — no break-even, no performance score
- [ ] Analytics shows break-even, performance score, waste — with period switcher
- [ ] Analytics shows new Production Performance section
- [ ] New invited member logs in → lands on their assigned site's dashboard
- [ ] Member with no sites assigned sees "Waiting for Site Access" screen
- [ ] Switching sites in the header → all page data (orders, clients, expenses) refreshes for the new site
- [ ] Analytics data changes when site context changes
- [ ] Every API call includes `X-Site-Id` header when a site is active (verify in browser devtools Network tab)

**Feature 1 — Decimal kg**
- [ ] Can enter 1.5 kg — accepted and saved
- [ ] Can enter 0.5 kg — accepted and saved
- [ ] All weight displays show one decimal place (e.g. "2.5 kg" not "2 kg" or "2.50000 kg")

**Feature 2 — Discounts**
- [ ] Can set a default discount % on a client profile
- [ ] Creating an order for a discounted client auto-fills the discount field
- [ ] Changing the discount % in the order form recalculates the final price live
- [ ] Final price and discount line appear on the deposit receipt
- [ ] Orders with 0% discount show no discount line on receipts

**Feature 3 — Cancellation workflow**
- [ ] Operator can submit a cancellation request with a mandatory reason
- [ ] Order status changes to "cancellation_requested"
- [ ] Orders list highlights cancellation-requested orders
- [ ] Sidebar Orders nav shows pending cancellations badge count
- [ ] Manager/owner sees approve/reject panel in order detail
- [ ] Approving cancellation sets status to "cancelled"
- [ ] Rejecting restores previous status + stores rejection note
- [ ] Operator CANNOT directly cancel or delete an order

**Feature 4 — Service delivery timeline**
- [ ] Services have a "Turnaround Time (days)" field in add/edit form
- [ ] Selecting a service in new order form auto-calculates pickup date
- [ ] Changing entry date with service selected recalculates pickup date
- [ ] "Auto-calculated" badge shows on pickup date field
- [ ] Manual override of pickup date clears "Auto-calculated" badge

**Feature 5 — Expense date**
- [ ] Add expense form has a date field defaulting to today
- [ ] Can set a past date for an expense
- [ ] Expenses table shows the expense date, not created_at

**Feature 6 — Delivery date + punctuality**
- [ ] "Mark as Delivered" opens a dialog asking for delivery date (default today)
- [ ] Dialog shows "Late delivery" warning if delivery date > pickup date
- [ ] Dialog shows "On time ✓" if delivery date <= pickup date
- [ ] Client detail page shows punctuality section after first delivery
- [ ] Punctuality rate % calculates correctly
- [ ] Late pickup count shows correctly
- [ ] "Frequently picks up late" warning shows after 2+ late pickups

**Feature 7 — Production delays**
- [ ] Analytics page shows "Production Performance" section
- [ ] Avg. Entry → Ready time displays in hours (if <24h) or days
- [ ] On-Time Readiness rate percentage calculates correctly
- [ ] Processing time distribution bar chart renders
- [ ] Overdue orders alert shows orders past their pickup date
- [ ] Section is gated behind Pro+ plan

**General**
- [ ] All new labels appear correctly in French
- [ ] All new labels appear correctly in English
- [ ] Dark mode works on all new UI elements
- [ ] No TypeScript compilation errors
- [ ] No console errors in browser
