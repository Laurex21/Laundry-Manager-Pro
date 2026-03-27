# Replit AI Agent — Instructions for App 1 (CleanEase) Upgrade

## Context

This is App 1 (CleanEase), a full-stack laundry management app. I have a second app (BlanchisseriePro) that has several features not present here. Your job is to port those features into this app WITHOUT breaking anything that already works.

**App 1 current stack:**
- Frontend: React + TypeScript, Wouter routing, TanStack Query, Radix UI / shadcn, Tailwind, Recharts, Framer Motion
- Backend: Express + TypeScript, Drizzle ORM, PostgreSQL, express-session + passport-local auth
- i18n: i18next (EN + FR)
- State: Zustand (currency), TanStack Query (server state)
- Entry: `client/src/App.tsx`, routes use `wouter`, layout in `client/src/components/layout-shell.tsx`

---

## What already exists in App 1 (DO NOT remove or break)

- `/` — Dashboard
- `/customers` — Customer list
- `/customers/:id` — Customer detail with preferences (starch level, detergent type, garment inventory)
- `/orders` — Orders with garment inventory per order
- `/services` — Service catalog with express surcharge, categories, unit (piece/kg)
- `/expenses` — Expenditures log
- `/payments` — Payments page
- `/reports` — Reports with PDF download, trend notifications
- `/auth` — Auth page (login + register unified)
- `use-currency.ts` — Zustand multi-currency hook (USD/NGN/XOF/EUR) — KEEP IT
- `i18n.ts` — Full EN/FR translation dictionary — KEEP AND EXTEND IT
- `layout-shell.tsx` — Sidebar nav with language + currency dropdowns in header — KEEP STRUCTURE

---

## Changes to make — implement ALL of the following

---

### CHANGE 1 — Extend `useAuth` hook with plan-based feature gating

File: `client/src/hooks/use-auth.ts`

The `useAuth` hook currently returns `{ user, isLoading, isAuthenticated, logout }`. Extend it to also return `planSlug` and `hasFeature()`.

Add the following logic inside the `useAuth` function, derived from the existing `user` data:

```ts
const planSlug: string = (user as any)?.subscription?.plan?.slug ?? (user as any)?.planSlug ?? "starter";

const hasFeature = (feature: string): boolean => {
  const featureMap: Record<string, string[]> = {
    analytics:   ["pro", "business", "enterprise"],
    waste:       ["business", "enterprise"],
    performance: ["business", "enterprise"],
    machines:    ["pro", "business", "enterprise"],
    employees:   ["pro", "business", "enterprise"],
    reports:     ["pro", "business", "enterprise"],
    api:         ["enterprise"],
  };
  return featureMap[feature]?.includes(planSlug) ?? false;
};
```

Return these two new values from `useAuth`:
```ts
return {
  user,
  isLoading,
  isAuthenticated: !!user,
  logout: logoutMutation.mutate,
  isLoggingOut: logoutMutation.isPending,
  planSlug,
  hasFeature,
};
```

Also ensure the backend `/api/auth/user` endpoint returns the user's subscription and plan slug. If `user.subscription.plan.slug` is not already returned, update the backend auth route to include it via a JOIN or relation on the subscriptions and plans tables.

---

### CHANGE 2 — Create the UpgradePrompt component

Create new file: `client/src/components/upgrade-prompt.tsx`

```tsx
import { Lock, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface UpgradePromptProps {
  title: string;
  description: string;
  requiredPlan: string;
}

export function UpgradePrompt({ title, description, requiredPlan }: UpgradePromptProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-lg mx-auto mt-12 shadow-lg">
      <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
        <Lock className="w-8 h-8 text-muted-foreground" />
        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground p-1.5 rounded-full shadow-md">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground mb-8">
        {description} This feature requires the{" "}
        <span className="font-semibold text-foreground">{requiredPlan}</span> plan or higher.
      </p>
      <Link href="/subscriptions">
        <Button size="lg" className="w-full sm:w-auto font-semibold px-8 rounded-xl">
          Upgrade Plan
        </Button>
      </Link>
    </div>
  );
}
```

---

### CHANGE 3 — Create the Machines page

Create new file: `client/src/pages/machines.tsx`

This page manages the laundry machine fleet. It must:
- Fetch machines from `GET /api/machines`
- Display machines as a card grid (3 columns on desktop)
- Each card shows: machine name, type badge (Washer/Dryer/Press/Other), capacity in kg, status badge (active=green, maintenance=yellow, inactive=gray), utilization rate as a colored progress bar (green ≥70%, yellow ≥40%, red <40%), cycle count, total kg processed
- "Add Machine" button opens a Dialog with fields: Name (required), Type (select: washer/dryer/press/other), Capacity kg (number, required), Status (select: active/maintenance/inactive)
- Each card has Edit and Delete buttons
- Edit opens the same Dialog pre-filled
- Delete calls `DELETE /api/machines/:id` with a `confirm()` dialog
- Save calls `POST /api/machines` (create) or `PATCH /api/machines/:id` (edit)
- Invalidate `["machines"]` query on success
- Use `useAuth().hasFeature("machines")` — if false, render `<UpgradePrompt title="Machine Management" description="Track your machine fleet, utilization rates and maintenance." requiredPlan="Pro" />`
- Show a loading skeleton while fetching
- Empty state: centered Cog icon + "No machines yet. Add your first machine!"
- All text must use `useTranslation()` with keys: `machines`, `add_machine`, `machine_name`, `machine_type`, `capacity_kg`, `machine_status`, `utilization`, `cycles`, `total_kg`, `no_machines_yet`

**Backend:** Ensure these routes exist in the Express server:
- `GET /api/machines` — returns array of machines for authenticated user's tenant
- `POST /api/machines` — creates machine, fields: `{ name, type, capacityKg, status }`
- `PATCH /api/machines/:id` — partial update
- `DELETE /api/machines/:id` — delete

Drizzle schema for `machines` table (if not already present):
```ts
export const machines = pgTable("machines", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("washer"),
  capacityKg: numeric("capacity_kg", { precision: 8, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  cycleCount: integer("cycle_count").notNull().default(0),
  totalKgProcessed: numeric("total_kg_processed", { precision: 10, scale: 2 }).notNull().default("0"),
  utilizationRate: numeric("utilization_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

### CHANGE 4 — Create the Employees page

Create new file: `client/src/pages/employees.tsx`

This page manages laundry staff. It must:
- Fetch from `GET /api/employees`
- Display as a list of cards
- Each card shows: initials avatar (first letter of name in a colored circle), name, role, phone (if set), email (if set), kg processed, orders handled, monthly salary in the user's selected currency (use `useCurrency()`)
- "Add Employee" button opens a Dialog with fields: Name (required), Role (required, e.g. "Operator"), Phone, Email, Monthly Salary (number), kg Processed (number, default 0), Orders Handled (number, default 0)
- Edit and Delete buttons on each card
- Save calls `POST /api/employees` or `PATCH /api/employees/:id`
- Delete calls `DELETE /api/employees/:id`
- Invalidate `["employees"]` query on success
- Use `useAuth().hasFeature("employees")` — if false, render `<UpgradePrompt title="Employee Management" description="Track staff productivity, kg processed and salaries." requiredPlan="Pro" />`
- Empty state: UserCheck icon + "No employees yet. Add your first employee!"
- Use `useTranslation()` for all labels

**Backend:** Ensure these routes exist:
- `GET /api/employees` — returns employees for authenticated user
- `POST /api/employees` — creates employee, fields: `{ name, role, phone?, email?, salary?, kgProcessed?, ordersHandled? }`
- `PATCH /api/employees/:id` — partial update
- `DELETE /api/employees/:id` — delete

Drizzle schema for `employees` table (if not already present):
```ts
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  salary: numeric("salary", { precision: 10, scale: 2 }),
  kgProcessed: numeric("kg_processed", { precision: 10, scale: 2 }).notNull().default("0"),
  ordersHandled: integer("orders_handled").notNull().default(0),
  productivityScore: numeric("productivity_score", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

### CHANGE 5 — Create the Analytics page

Create new file: `client/src/pages/analytics.tsx`

This is a plan-gated advanced KPI page. Structure:

**If `!hasFeature("analytics")`** → render `<UpgradePrompt title="Analytics & KPIs" description="Get detailed insights into your laundry's financial performance." requiredPlan="Pro" />`

**Otherwise render:**

1. **Header** — "Analytics" title, period switcher buttons: day / week / month / year (state: `period`, default `"month"`). Active period button uses `bg-primary text-white`.

2. **KPI grid** — 8 cards in a 2×4 grid (2 cols mobile, 4 cols desktop). Fetch from `GET /api/analytics/kpis?period=${period}`. Display:
   - Total kg processed
   - Total orders
   - Average kg per order
   - Total revenue (formatted with `useCurrency()`)
   - Total expenses
   - Profit (green if ≥0, red if <0)
   - Cost per kg
   - Profit per kg (green/red)

3. **Break-even card** — Fetch same KPI data. Show:
   - Break-even point in kg
   - Actual kg vs break-even as a colored progress bar (green if actual ≥ break-even, red otherwise)
   - Text: "✓ Above break-even" or "⚠ Need X more kg"

4. **Operational KPIs card** — Machine utilization % (with colored progress bar), Employee productivity (kg/person), MRR if available

5. **Waste Detection section** — Use `hasFeature("waste")`:
   - If false: show "Business plan required" message with upgrade button linking to `/subscriptions`
   - If true: fetch `GET /api/analytics/waste` and display alert cards. Each alert has a severity badge (high=red, medium=yellow), message text, and recommendation text
   - If no alerts: show "✓ No waste issues detected. Great job!"

6. **Performance Score section** — Use `hasFeature("performance")`:
   - If false: show "Business plan required" message with upgrade button
   - If true: fetch `GET /api/analytics/performance-score` and display:
     - Large letter grade (A/B/C/D/F) with color (A=green, B=blue, C=yellow, D=orange, F=red)
     - Numeric score /100 below the grade
     - 4 progress bars: Machine Usage, Cost Efficiency, Productivity, Waste Level

**Backend:** Ensure these routes exist:
- `GET /api/analytics/kpis?period=day|week|month|year` — returns `{ totalKg, totalOrders, avgWeightPerOrder, totalRevenue, totalExpenses, profit, costPerKg, profitPerKg, breakEvenKg, machineUtilization, employeeProductivity, mrr, performanceScore }`
- `GET /api/analytics/waste` — Business plan guard — returns array of `{ category, severity, message, recommendation }`
- `GET /api/analytics/performance-score` — Business plan guard — returns `{ total, machineUsage, costEfficiency, productivity, wasteLevel, grade }`

Plan guard middleware: check `req.user.subscription.plan.slug` and return 403 if plan insufficient.

---

### CHANGE 6 — Create the Subscriptions page

Create new file: `client/src/pages/subscriptions.tsx`

This page shows the 4 subscription plans and allows upgrading. It must:

1. **Current subscription banner** — if user has active subscription, show a card with: plan name, status badge (active=green), expiry date, orders used this month vs limit (e.g. "23 / 100" or "23 / ∞")

2. **Plans grid** — 4 columns on desktop, 2 on tablet, 1 on mobile. Fetch plans from `GET /api/plans`. Each plan card shows:
   - Plan name + price in FCFA/month
   - List of features (checkmark per feature)
   - Limits (max orders, max users — "Unlimited" if null)
   - "Current Plan" badge if it's the active plan (green ring around card)
   - "Most Popular" badge on the Business plan (highlighted with primary border)
   - "Upgrade to X" button (disabled and labeled "Current Plan" if already active)

3. **Payment Dialog** — clicking Upgrade opens a Dialog with:
   - Plan name + price summary
   - Payment method selector (Select): "Simulate Payment (Demo)", "Mobile Money (Orange/MTN)", "Credit/Debit Card", "Cash"
   - If "Simulate Payment": show a blue info note "Demo mode: payment will be simulated and subscription activated immediately."
   - "Confirm Payment" button calls `POST /api/payments` with `{ planId, method }`
   - On success: invalidate `["subscription"]` query and refresh user data

**Backend:** Ensure these routes exist:
- `GET /api/plans` — public, returns all active plans with their features array
- `GET /api/subscriptions/current` — returns current user's active subscription with plan details
- `POST /api/payments` — creates a payment record and upgrades the user's subscription to the selected plan

Plans table should have these 4 rows seeded:
- Starter: 6,000 FCFA, 100 orders/month, 1 user, features: ["Client management", "Order tracking", "Basic dashboard"]
- Pro: 15,000 FCFA, 500 orders/month, 3 users, features: ["Everything in Starter", "Analytics & KPIs", "Break-even analysis", "Employee management", "Machine management"]
- Business: 30,000 FCFA, 2000 orders/month, 10 users, features: ["Everything in Pro", "Waste detection", "Performance score", "Smart alerts", "Financial forecasts"]
- Enterprise: 50,000 FCFA, null orders (unlimited), null users (unlimited), features: ["Everything in Business", "Unlimited orders & users", "Custom API access", "Priority support 24/7"]

---

### CHANGE 7 — Upgrade the Dashboard page

File: `client/src/pages/dashboard.tsx`

Keep the existing dashboard but add the following new sections:

1. **Alert banners** — at the top, just below the page title. Fetch from `GET /api/analytics/dashboard` which should return an `alerts` array. Each alert has `{ type: "danger"|"warning"|"info", message: string, detail?: string }`. Render each as a colored banner:
   - danger: red background, AlertCircle icon
   - warning: yellow background, AlertTriangle icon
   - info: blue background, Info icon

2. **Daily target progress bar** — a card showing today's kg vs the daily target. Show a progress bar that fills based on `(todayKg / dailyTarget) * 100`. Color: green if ≥100%, yellow if ≥60%, red if <60%. Show percentage text below the bar.

3. **Cost per kg + Profit per kg cards** — two new stat cards added to the existing KPI grid:
   - Cost per kg: value from dashboard data, formatted with `useCurrency()`
   - Profit per kg: value from dashboard data, green if ≥0, red if <0

4. **Replace the existing simple revenue chart** with an AreaChart (from recharts) showing revenue over the last 30 days. Use a gradient fill. Data from `dashboard.revenueByDay` array `[{ date: string, value: number }]`.

5. **Add an Orders by Status donut chart** — a PieChart with innerRadius showing the 4 order statuses (received/washing/ready/delivered) with their counts. Add a color legend below the chart.

6. **Add a kg Processed bar chart** — a BarChart showing kg processed per day over the last 30 days. Data from `dashboard.kgByDay`.

**Backend:** Update `GET /api/analytics/dashboard` to return:
```ts
{
  todayKg: number,
  todayOrders: number,
  todayRevenue: number,
  monthKg: number,
  monthOrders: number,
  monthRevenue: number,
  monthExpenses: number,
  profit: number,
  costPerKg: number,
  profitPerKg: number,
  dailyTarget: number,         // configurable, default 50
  targetAchievement: number,   // percentage 0-100
  ordersByStatus: { received: number, washing: number, ready: number, delivered: number },
  revenueByDay: Array<{ date: string, value: number }>,  // last 30 days
  kgByDay: Array<{ date: string, value: number }>,       // last 30 days
  alerts: Array<{ type: string, message: string, detail?: string }>
}
```

---

### CHANGE 8 — Upgrade the Expenses page

File: `client/src/pages/expenses.tsx`

Keep all existing functionality but add:

1. **Expense type breakdown summary grid** — above the table, a grid of small cards (one per type that has expenses). Each card shows the type name as a colored badge and the total FCFA for that type. Types: water (blue), electricity (yellow), detergent (purple), rent (orange), salary (green), other (gray).

2. **Filter tabs by type** — a row of pill buttons: "all", "water", "electricity", "detergent", "rent", "salary", "other". Clicking a pill filters the table. Active pill: `bg-primary text-white`.

3. **Edit capability** — currently App 1 only allows creating expenses. Add an Edit button on each row that opens the form pre-filled. Call `PATCH /api/expenditures/:id` on save.

4. **Date field** — add a date input to the create/edit form (type="date", default today). Display the date column in the table.

**Backend:** Ensure `PATCH /api/expenditures/:id` exists for editing existing expenditure records.

---

### CHANGE 9 — Add new nav items to layout-shell.tsx

File: `client/src/components/layout-shell.tsx`

Add 4 new items to the `NAV_ITEMS` array:
```ts
{ icon: Cog, labelKey: "machines", href: "/machines" },
{ icon: UserCheck, labelKey: "employees", href: "/employees" },
{ icon: BarChart3, labelKey: "analytics", href: "/analytics" },
{ icon: CreditCard, labelKey: "subscription", href: "/subscriptions" },
```

Import `Cog` and `UserCheck` from `lucide-react` (they're already installed).

Also add a **plan badge** at the bottom of the sidebar, just above the logout button. It should show the current plan name (from `useAuth().planSlug`) and the subscription expiry date if available. Style it as a small card with a subtle background.

---

### CHANGE 10 — Register all new routes in App.tsx

File: `client/src/App.tsx`

Add imports and routes for the 4 new pages:

```tsx
import Machines from "@/pages/machines";
import Employees from "@/pages/employees";
import Analytics from "@/pages/analytics";
import Subscriptions from "@/pages/subscriptions";
```

Add inside the `Router` function:
```tsx
<Route path="/machines">
  <ProtectedRoute component={Machines} />
</Route>
<Route path="/employees">
  <ProtectedRoute component={Employees} />
</Route>
<Route path="/analytics">
  <ProtectedRoute component={Analytics} />
</Route>
<Route path="/subscriptions">
  <ProtectedRoute component={Subscriptions} />
</Route>
```

---

### CHANGE 11 — Extend i18n translations

File: `client/src/lib/i18n.ts`

Add the following keys to BOTH the `en` and `fr` translation objects:

**English additions:**
```json
"machines": "Machines",
"employees": "Employees",
"analytics": "Analytics",
"subscription": "Subscription",
"add_machine": "Add Machine",
"machine_name": "Machine Name",
"machine_type": "Type",
"capacity_kg": "Capacity (kg)",
"machine_status": "Status",
"utilization": "Utilization",
"cycles": "Cycles",
"total_kg": "Total kg",
"no_machines_yet": "No machines yet. Add your first machine!",
"add_employee": "Add Employee",
"employee_name": "Name",
"employee_role": "Role",
"monthly_salary": "Monthly Salary",
"kg_processed": "kg Processed",
"orders_handled": "Orders Handled",
"no_employees_yet": "No employees yet. Add your first employee!",
"analytics_kpis": "Analytics & KPIs",
"break_even": "Break-Even Analysis",
"break_even_point": "Break-even point",
"above_break_even": "Above break-even",
"waste_detection": "Waste Detection",
"performance_score": "Performance Score",
"upgrade_required": "Upgrade Required",
"current_plan": "Current Plan",
"valid_until": "Valid until",
"orders_this_month": "Orders this month",
"confirm_payment": "Confirm Payment",
"payment_method": "Payment Method",
"daily_target": "Daily Target",
"cost_per_kg": "Cost per kg",
"profit_per_kg": "Profit per kg",
"edit_expense": "Edit Expense",
"expense_type": "Expense Type"
```

**French additions:**
```json
"machines": "Machines",
"employees": "Employés",
"analytics": "Analytique",
"subscription": "Abonnement",
"add_machine": "Ajouter une machine",
"machine_name": "Nom de la machine",
"machine_type": "Type",
"capacity_kg": "Capacité (kg)",
"machine_status": "Statut",
"utilization": "Utilisation",
"cycles": "Cycles",
"total_kg": "Total kg",
"no_machines_yet": "Aucune machine. Ajoutez votre première machine !",
"add_employee": "Ajouter un employé",
"employee_name": "Nom",
"employee_role": "Rôle",
"monthly_salary": "Salaire mensuel",
"kg_processed": "kg traités",
"orders_handled": "Commandes gérées",
"no_employees_yet": "Aucun employé. Ajoutez votre premier employé !",
"analytics_kpis": "Analytique & KPIs",
"break_even": "Analyse du seuil de rentabilité",
"break_even_point": "Seuil de rentabilité",
"above_break_even": "Au-dessus du seuil",
"waste_detection": "Détection des gaspillages",
"performance_score": "Score de performance",
"upgrade_required": "Mise à niveau requise",
"current_plan": "Plan actuel",
"valid_until": "Valide jusqu'au",
"orders_this_month": "Commandes ce mois",
"confirm_payment": "Confirmer le paiement",
"payment_method": "Mode de paiement",
"daily_target": "Objectif journalier",
"cost_per_kg": "Coût par kg",
"profit_per_kg": "Bénéfice par kg",
"edit_expense": "Modifier la dépense",
"expense_type": "Type de dépense"
```

---

### CHANGE 12 — Database schema and seed data

If any of these tables don't already exist, run `db:push` after adding them to the Drizzle schema:

- `machines` table (see Change 3)
- `employees` table (see Change 4)
- `plans` table with 4 rows seeded (see Change 6)
- `subscriptions` table linking users to plans
- `payments` table for payment history

Ensure the `users` table returns subscription + plan info when fetched via `/api/auth/user`. If using Drizzle relations, add a `with: { subscription: { with: { plan: true } } }` join.

After modifying the schema, run:
```bash
pnpm run db:push
```

---

## Important constraints — DO NOT break these

1. **Do not remove** the currency switcher (`useCurrency` hook) from `layout-shell.tsx` header
2. **Do not remove** the language switcher from `layout-shell.tsx` header
3. **Do not remove** or rename any existing routes: `/`, `/customers`, `/customers/:id`, `/orders`, `/services`, `/expenses`, `/payments`, `/reports`
4. **Do not change** the existing auth flow — App 1 uses express-session + passport, not JWT. The `use-auth.ts` hook fetches from `/api/auth/user` with `credentials: "include"`. Keep this.
5. **Do not replace** the existing `StatusBadge` component in `status-badge.tsx` — it has more statuses than App 2 (paid/unpaid/partial)
6. **Do not change** the existing Orders page structure — it has garment inventory which App 2 doesn't have
7. **Do not change** the existing Customers pages — they have customer preferences (starch level, detergent type) which App 2 doesn't have
8. **Keep** the existing Reports page with PDF download and trend notifications

---

## Verification checklist — after implementing, confirm:

- [ ] App starts without TypeScript errors (`pnpm run check`)
- [ ] `/machines` page loads, CRUD works (add, edit, delete a machine)
- [ ] `/employees` page loads, CRUD works
- [ ] `/analytics` page loads, shows KPI grid; waste/performance sections show upgrade prompt for Starter plan users
- [ ] `/subscriptions` page loads, shows 4 plan cards, payment dialog opens and simulated payment works
- [ ] Dashboard shows alert banners, daily target bar, area chart, donut chart, bar chart
- [ ] Expenses page shows type breakdown grid and filter tabs, edit works
- [ ] Sidebar shows 4 new nav items (Machines, Employees, Analytics, Subscription)
- [ ] All existing pages still work (customers, orders, services, payments, reports)
- [ ] Language switcher still works (EN/FR) on all new pages
- [ ] Currency switcher still works on all new pages
- [ ] No console errors in browser
