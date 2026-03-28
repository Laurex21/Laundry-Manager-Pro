# Replit AI Agent — Prompt B: Multi-Site Management & Role-Based Access

## Prerequisites

This prompt assumes Prompt A (Business Profile & Receipt Settings) has already been implemented.

## Context & Stack

- **Frontend**: React + TypeScript, Wouter routing, TanStack Query, shadcn/ui, Tailwind CSS, i18next (EN/FR)
- **Backend**: Express 5 + TypeScript, JWT auth (Bearer token in Authorization header), Drizzle ORM, PostgreSQL
- **Monorepo**: `artifacts/api-server/` (backend), `artifacts/laundry-saas/src/` (frontend), `lib/db/` (Drizzle schema)
- **Current user model**: single-tenant — every user has their own isolated data. `orders`, `clients`, `expenses`, `machines`, `employees` all filtered by `userId`
- **Auth context**: `src/lib/auth-context.tsx` — provides `user`, `loading`, `login`, `logout`, `register`, `planSlug`, `hasFeature()`

## Goal

Transform the app from single-user to a **multi-site organisation model** where:
- One **owner** account controls an organisation with one or more named sites (laundry branches)
- The owner can invite **managers** and **operators** to specific sites with limited access
- All data is scoped to a site — not just a user
- The owner sees a consolidated cross-site view; managers/operators see only their assigned site(s)

---

## PART 1 — Database Schema Changes

Add these tables to `lib/db/schema.ts`. Run `pnpm --filter @workspace/db run push` after all schema changes.

### New table: `organisations`
```ts
export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### New table: `sites`
```ts
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),         // e.g. "Pressing Centre-Ville"
  address: varchar("address", { length: 500 }).default(""),
  city: varchar("city", { length: 100 }).default(""),
  phone: varchar("phone", { length: 50 }).default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### New table: `site_members`
```ts
export const siteMembers = pgTable("site_members", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull(),   // "owner" | "manager" | "operator"
  createdAt: timestamp("created_at").defaultNow(),
});
// Unique constraint: one membership per user per site
// CREATE UNIQUE INDEX site_members_unique ON site_members(site_id, user_id);
```

### New table: `site_invitations`
```ts
export const siteInvitations = pgTable("site_invitations", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  invitedBy: integer("invited_by").notNull().references(() => users.id),
  identifier: varchar("identifier", { length: 255 }).notNull(),  // email or phone of invitee
  role: varchar("role", { length: 50 }).notNull(),               // role to assign on acceptance
  token: varchar("token", { length: 64 }).notNull().unique(),    // random hex token
  status: varchar("status", { length: 20 }).notNull().default("pending"), // "pending"|"accepted"|"expired"
  expiresAt: timestamp("expires_at").notNull(),   // NOW() + 7 days
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Modify existing operational tables

Add `siteId` to all operational tables. This is the most important migration step.

For each of these tables: `clients`, `orders`, `machines`, `employees`, `expenses`, `order_payments` (and `business_settings` if it exists):

```ts
// Add to each table:
siteId: integer("site_id").references(() => sites.id),
```

Make `siteId` nullable for now (to avoid breaking existing data). Existing rows will have `siteId = null`, which means they belong to the owner's default site. The migration script below will back-fill them.

### Also modify `users` table

Add:
```ts
currentSiteId: integer("current_site_id").references(() => sites.id),  // the site the user is currently viewing
organisationId: integer("organisation_id").references(() => organisations.id),
```

### Data migration — run after `db:push`

Write and execute this migration function in the backend startup (run it once, check if already migrated):

```ts
async function migrateToMultiSite() {
  // For each existing user who has no organisation:
  // 1. Create an organisation named after their business
  // 2. Create a default site named "Main Site" (or their business name)
  // 3. Create a site_member record: userId, siteId, role="owner"
  // 4. Set user.organisationId = new org id
  // 5. Set user.currentSiteId = new site id
  // 6. Back-fill siteId on all their clients, orders, expenses, machines, employees
}
```

---

## PART 2 — Role System

### Three roles, defined clearly:

| Role | Access |
|---|---|
| `owner` | Full access to ALL sites in their organisation. Can manage sites, invite members, see consolidated dashboard, access Settings and Subscriptions. |
| `manager` | Access to their ASSIGNED site(s) only. Can view all data, create/edit orders, clients, expenses, employees, machines. Cannot access Settings, Subscriptions, or other sites. |
| `operator` | Access to their ASSIGNED site only. Can create/update orders and record payments. Cannot access Expenses, Machines, Employees, Reports, Analytics, or Settings. |

### Pages accessible per role:

| Page | owner | manager | operator |
|---|---|---|---|
| Dashboard | ✓ (all sites) | ✓ (assigned site) | ✓ (assigned site) |
| Orders | ✓ | ✓ | ✓ |
| Clients | ✓ | ✓ | ✓ |
| Payments | ✓ | ✓ | ✓ |
| Services | ✓ | ✓ | ✗ |
| Expenses | ✓ | ✓ | ✗ |
| Machines | ✓ | ✓ | ✗ |
| Employees | ✓ | ✓ | ✗ |
| Analytics | ✓ (Pro+) | ✓ (Pro+) | ✗ |
| Reports | ✓ | ✗ | ✗ |
| Settings | ✓ | ✗ | ✗ |
| Subscriptions | ✓ | ✗ | ✗ |
| Team Management | ✓ | ✗ | ✗ |

---

## PART 3 — Backend Changes

### JWT payload

Update the JWT payload to include site context:
```ts
interface JwtPayload {
  userId: number;
  organisationId: number;
  currentSiteId: number;   // the site this token is scoped to
  role: string;            // "owner" | "manager" | "operator"
}
```

When a user logs in, include their `currentSiteId` and `role` in the JWT. If they are an owner, include `currentSiteId = null` initially (they'll pick a site or see all).

### Middleware: `requireSite`

Create a middleware that:
1. Extracts `currentSiteId` from the JWT
2. Verifies the user has a `site_members` record for that site
3. Attaches `req.siteId` and `req.userRole` for use in route handlers

### Middleware: `requireRole(...roles)`

```ts
function requireRole(...allowedRoles: string[]) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
```

### Update ALL data routes to filter by siteId

For every route that queries operational data, add `WHERE site_id = req.siteId` (or `AND site_id = req.siteId`).

For owner routes that support cross-site aggregation (analytics/dashboard), allow `?siteId=all` parameter — if `req.userRole === "owner"` and `siteId=all`, aggregate across all sites in the organisation.

### New routes for site management

All require `requireRole("owner")`:

**GET `/api/sites`** — List all sites in the user's organisation
```ts
// Returns: Array<{ id, name, address, city, phone, isActive, memberCount, ordersThisMonth }>
```

**POST `/api/sites`** — Create a new site
```ts
// Body: { name, address?, city?, phone? }
// Creates site + creates site_member record for owner
```

**PUT `/api/sites/:id`** — Update site details

**DELETE `/api/sites/:id`** — Soft-delete (set isActive=false). Prevent deletion if it's the only site.

**GET `/api/sites/:id/members`** — List all members of a site
```ts
// Returns: Array<{ id, userId, name, email, phone, role, joinedAt }>
```

**POST `/api/sites/:id/members`** — Add an existing user directly (for owner adding themselves or migrating)

**PATCH `/api/sites/:id/members/:userId`** — Change a member's role

**DELETE `/api/sites/:id/members/:userId`** — Remove a member from a site

### New routes for invitations

**POST `/api/invitations`** — Send invitation (owner only)
```ts
// Body: { siteId, identifier (email or phone), role }
// Generates a random 32-byte hex token
// Stores in site_invitations with expiresAt = NOW() + 7 days
// Returns: { invitationLink: `/join/${token}` }
// NOTE: In a real system this would send an SMS/email. For now just return the link.
```

**GET `/api/invitations/pending`** — List pending invitations for the owner's organisation

**DELETE `/api/invitations/:id`** — Cancel a pending invitation

**GET `/api/invitations/join/:token`** — Public route — get invitation details by token
```ts
// Returns: { siteName, organisationName, role, inviterName, identifier, status }
// Returns 404 if token not found or expired
```

**POST `/api/invitations/accept/:token`** — Accept invitation
```ts
// Requires: user must be logged in (JWT)
// Verify token is valid and not expired
// Create site_members record: { siteId, userId: req.user.id, role }
// Update invitation status to "accepted"
// Update user's currentSiteId to the accepted site
// Return updated user object
```

### New route: switch site (owner only)

**POST `/api/auth/switch-site`** — Switch the active site context
```ts
// Body: { siteId } — must be a site in the owner's organisation
// Reissues the JWT with the new currentSiteId
// Returns: { token, user }
```

---

## PART 4 — Frontend Changes

### 4A — Update Auth Context (`src/lib/auth-context.tsx`)

Add to the context:
```ts
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
  refreshUser: () => Promise<void>;
  planSlug: string;
  hasFeature: (feature: string) => boolean;
  // NEW:
  currentSite: Site | null;       // the currently active site object
  allSites: Site[];               // all sites (populated for owners only)
  userRole: string;               // "owner" | "manager" | "operator"
  isOwner: boolean;               // shortcut: userRole === "owner"
  switchSite: (siteId: number) => Promise<void>;  // owner only
  canAccess: (page: string) => boolean;  // checks role-based page access
}
```

Implement `canAccess(page)` using the permissions table from Part 2:
```ts
const canAccess = (page: string): boolean => {
  const ownerPages = ["settings", "subscriptions", "reports", "analytics", "team"];
  const managerPages = ["orders", "clients", "payments", "services", "expenses", "machines", "employees", "analytics", "dashboard"];
  const operatorPages = ["orders", "clients", "payments", "dashboard"];
  
  if (userRole === "owner") return true;
  if (userRole === "manager") return managerPages.includes(page);
  if (userRole === "operator") return operatorPages.includes(page);
  return false;
};
```

Fetch `allSites` on login if `userRole === "owner"`: `GET /api/sites`.

### 4B — Site Switcher in Layout Header

In `artifacts/laundry-saas/src/components/layout.tsx`, add a **Site Switcher** in the top header bar, positioned to the LEFT of the language/currency toggles.

**For owners:** Show a dropdown button displaying the current site name (or "All Sites" if viewing consolidated). Clicking opens a dropdown with:
- List of all sites — clicking switches to that site (calls `switchSite(id)`)
- A "All Sites" option at the top for the consolidated view
- A divider then "+ Add New Site" at the bottom → navigates to `/settings/team`
- Current site has a checkmark

```tsx
// Owner site switcher:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" className="gap-2 max-w-[180px]">
      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate text-xs font-medium">
        {currentSite?.name ?? "All Sites"}
      </span>
      <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-50" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" className="w-56">
    <DropdownMenuLabel className="text-xs text-muted-foreground">Your Sites</DropdownMenuLabel>
    <DropdownMenuItem onClick={() => switchSite(null)}>
      <Building2 className="w-4 h-4 mr-2" /> All Sites
      {!currentSite && <Check className="w-4 h-4 ml-auto text-primary" />}
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    {allSites.map(site => (
      <DropdownMenuItem key={site.id} onClick={() => switchSite(site.id)}>
        <MapPin className="w-4 h-4 mr-2" /> {site.name}
        {currentSite?.id === site.id && <Check className="w-4 h-4 ml-auto text-primary" />}
      </DropdownMenuItem>
    ))}
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => navigate("/settings/team")}>
      <Plus className="w-4 h-4 mr-2" /> Add New Site
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**For managers and operators:** Show a static non-clickable badge with the site name (no dropdown). They cannot switch sites.

```tsx
// Manager/operator site indicator:
<div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md">
  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
  <span className="text-xs font-medium text-muted-foreground">{currentSite?.name}</span>
</div>
```

### 4C — Role-Based Navigation Filtering

In `layout.tsx`, filter the `navItems` array based on `canAccess(page)`:
```tsx
{navItems
  .filter(item => canAccess(item.page))
  .map(item => (
    // ... existing nav item render
  ))
}
```

Each nav item needs a `page` key added:
```ts
{ href: "/", icon: LayoutDashboard, label: "Dashboard", page: "dashboard" },
{ href: "/orders", icon: ShoppingBag, label: "Orders", page: "orders" },
// etc.
```

### 4D — ProtectedRoute with Role Guard

Update `ProtectedRoute` in `App.tsx` to accept an optional `requiredPage` prop:
```tsx
function ProtectedRoute({ component: Component, page }: { component: React.ComponentType; page?: string }) {
  const { user, loading, canAccess } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Redirect to="/login" />;
  if (page && !canAccess(page)) return <AccessDenied />;
  return <Layout><Component /></Layout>;
}

// Usage:
<Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} page="settings" />} />
<Route path="/analytics" component={() => <ProtectedRoute component={AnalyticsPage} page="analytics" />} />
```

Create a simple `AccessDenied` component:
```tsx
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <ShieldOff className="w-12 h-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        You don't have permission to access this page. Contact your account owner to request access.
      </p>
    </div>
  );
}
```

### 4E — Team Management Page (Settings sub-page)

Create `artifacts/laundry-saas/src/pages/settings-team.tsx`

This page is accessible only to owners, via `/settings/team`. Add it as a sub-tab inside the Settings page (Tab 4 — "Team & Sites", icon: Users).

The page has two sections:

#### Section 1 — Sites

A list of all sites in the organisation, each shown as a card:
- Site name, address/city, phone
- Member count badge
- Edit button → inline edit form (name, address, city, phone)
- "View Members" button → expands a member list below the card
- Delete button (disabled with tooltip "Cannot delete your only site" if it's the last one)

"+ Add New Site" button at the top → opens a Dialog:
- Fields: Site Name (required), Address, City, Phone
- On submit: `POST /api/sites`
- On success: invalidate `["sites"]` query, show success toast

#### Section 2 — Team Members & Invitations

A table showing all members across all sites:

| Name | Email/Phone | Role | Site(s) | Joined | Actions |
|---|---|---|---|---|---|
| Jean Dupont | +237 6XX | Manager | Pressing Centre | 12 Jan | Edit Role / Remove |

Below the table, a "Pending Invitations" section:
- List of unaccepted invitations showing: identifier (email/phone), role, site, sent date, expiry date
- "Copy Invite Link" button — copies `/join/{token}` to clipboard
- "Revoke" button — calls `DELETE /api/invitations/:id`

**"Invite Member" button** (prominent, top right) → opens a Dialog:
```
Title: "Invite Team Member"

Fields:
- Email or Phone * (text input, placeholder: "email@example.com or +237 6XX...")
- Role * (select): 
    - Manager — Can manage orders, clients, expenses, machines, employees
    - Operator — Can create orders and record payments only
- Site * (select from owner's sites — multi-select if manager, single for operator)

Button: "Send Invitation"
```

On submit: `POST /api/invitations` → response includes `invitationLink`.

After successful invite, show a success card:
```
✓ Invitation created!

Share this link with [identifier]:
[https://app.url/join/abc123def456...]  [Copy Link]

The link expires in 7 days.
```

The invitation link should work as follows: navigating to `/join/:token` (public route) shows an "Accept Invitation" page with the site name, role, and inviting person's name. If the user is logged in, they see a "Join [Site Name] as [Role]" button. If not logged in, they're redirected to login/register first, then automatically redirected back to accept.

#### Accept Invitation Page

Create `artifacts/laundry-saas/src/pages/accept-invitation.tsx` — public route at `/join/:token`.

```tsx
export default function AcceptInvitationPage() {
  const { token } = useParams();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => apiFetch(`/invitations/join/${token}`),
  });

  const acceptMutation = useMutation({
    mutationFn: () => apiFetch(`/invitations/accept/${token}`, { method: "POST" }),
    onSuccess: () => navigate("/"),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error || !invite) return <div>Invalid or expired invitation link.</div>;
  if (invite.status === "accepted") return <div>This invitation has already been used.</div>;

  if (!user) {
    // Store token in sessionStorage, redirect to login, then come back
    sessionStorage.setItem("pendingInviteToken", token);
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full text-center">
        <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">You've been invited!</h1>
        <p className="text-muted-foreground mb-6">
          <strong>{invite.inviterName}</strong> has invited you to join{" "}
          <strong>{invite.siteName}</strong> as a <strong className="capitalize">{invite.role}</strong>.
        </p>
        <Button size="lg" className="w-full" onClick={() => acceptMutation.mutate()}>
          {acceptMutation.isPending ? "Joining..." : `Join ${invite.siteName}`}
        </Button>
      </div>
    </div>
  );
}
```

After login, check `sessionStorage.getItem("pendingInviteToken")` in the auth context's `login` `onSuccess` and automatically navigate to `/join/:token`.

### 4F — Owner Consolidated Dashboard

When an owner has `currentSite = null` (viewing "All Sites"), the dashboard should show:

1. **Site cards row** — horizontal scrollable row of mini-cards, one per site:
   - Site name
   - Today's orders count
   - Today's revenue
   - Clicking navigates into that site (calls `switchSite(site.id)`)

2. **Consolidated KPI grid** — same 4 KPI cards as normal dashboard but aggregated across all sites:
   - Total revenue (all sites)
   - Total orders (all sites)
   - Total kg processed (all sites)
   - Best performing site (by revenue)

3. Below the consolidated view, the normal dashboard charts still show but aggregate all sites

When `currentSite` is set (owner is viewing a specific site), show the normal single-site dashboard.

Implement by passing `?siteId=all` to `GET /api/analytics/dashboard` when `currentSite === null && isOwner`.

### 4G — Site Name in Page Header

In the layout, below the page title of each main page (Dashboard, Orders, etc.), show the current site name as a small subtitle for managers and operators. This makes it clear which site they're working on.

Example in the dashboard:
```tsx
<div>
  <h1 className="text-xl font-bold">Dashboard</h1>
  {currentSite && !isOwner && (
    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
      <MapPin className="w-3 h-3" /> {currentSite.name}
    </p>
  )}
</div>
```

---

## PART 5 — Update App.tsx Routes

Add new routes:
```tsx
import AcceptInvitationPage from "@/pages/accept-invitation";
// /join/:token is a PUBLIC route (no ProtectedRoute wrapper)
<Route path="/join/:token" component={AcceptInvitationPage} />

// Settings team sub-page (already inside SettingsPage as a tab, but add direct route too)
<Route path="/settings/team" component={() => <ProtectedRoute component={SettingsPage} page="settings" />} />
```

---

## PART 6 — i18n Additions

Add these keys to BOTH EN and FR in the i18n config:

**English:**
```json
"sites": "Sites",
"team": "Team",
"team_management": "Team & Sites",
"add_site": "Add New Site",
"site_name": "Site Name",
"invite_member": "Invite Member",
"pending_invitations": "Pending Invitations",
"copy_invite_link": "Copy Invite Link",
"link_copied": "Link copied to clipboard!",
"invite_expires": "Expires in 7 days",
"role_owner": "Owner",
"role_manager": "Manager",
"role_operator": "Operator",
"join_site": "Join Site",
"invitation_invalid": "Invalid or expired invitation",
"invitation_accepted": "Invitation already accepted",
"youve_been_invited": "You've been invited!",
"all_sites": "All Sites",
"switch_site": "Switch Site",
"site_members": "Site Members",
"remove_member": "Remove Member",
"change_role": "Change Role",
"access_denied": "Access Restricted",
"access_denied_description": "You don't have permission to access this page.",
"consolidated_view": "Consolidated View",
"best_performing_site": "Best Performing Site"
```

**French:**
```json
"sites": "Sites",
"team": "Équipe",
"team_management": "Équipe & Sites",
"add_site": "Ajouter un site",
"site_name": "Nom du site",
"invite_member": "Inviter un membre",
"pending_invitations": "Invitations en attente",
"copy_invite_link": "Copier le lien d'invitation",
"link_copied": "Lien copié dans le presse-papiers !",
"invite_expires": "Expire dans 7 jours",
"role_owner": "Propriétaire",
"role_manager": "Gérant",
"role_operator": "Opérateur",
"join_site": "Rejoindre le site",
"invitation_invalid": "Invitation invalide ou expirée",
"invitation_accepted": "Invitation déjà acceptée",
"youve_been_invited": "Vous avez été invité !",
"all_sites": "Tous les sites",
"switch_site": "Changer de site",
"site_members": "Membres du site",
"remove_member": "Retirer le membre",
"change_role": "Modifier le rôle",
"access_denied": "Accès restreint",
"access_denied_description": "Vous n'avez pas la permission d'accéder à cette page.",
"consolidated_view": "Vue consolidée",
"best_performing_site": "Site le plus performant"
```

---

## Constraints — DO NOT break

1. All existing single-user data must continue to work after migration — the `migrateToMultiSite()` function must back-fill siteId on all existing records
2. The JWT structure change must remain backward compatible during the session — re-login after deployment will get the new token format
3. Keep all existing routes — just add the role guard wrapper
4. The currency switcher and language switcher must remain visible for ALL roles in the header
5. Receipt generation (from Prompt A) must continue to work — settings are org-level, not site-level
6. The subscription plan check (`hasFeature()`) remains at the organisation level — one plan covers all sites

---

## Verification Checklist

- [ ] Owner can create a new site from Settings → Team & Sites
- [ ] Owner can invite a manager by email or phone — invitation link is generated
- [ ] Navigating to `/join/:token` shows the invitation details
- [ ] Accepting invitation as a logged-in user adds the site_member record
- [ ] Accepting invitation while logged out → redirected to login → auto-accepts after login
- [ ] Manager can log in and only sees their assigned site's data
- [ ] Manager cannot access Settings, Subscriptions, or Reports
- [ ] Operator can log in and only sees Orders, Clients, Payments
- [ ] Operator cannot access Expenses, Machines, Employees, Analytics
- [ ] Owner sees site switcher dropdown in header
- [ ] Owner can switch between sites — data filters change accordingly
- [ ] Owner in "All Sites" mode sees consolidated dashboard with per-site cards
- [ ] Owner navigating to a specific site sees only that site's data
- [ ] Non-owner roles see a static site badge (not a dropdown)
- [ ] Revoking an invitation prevents acceptance
- [ ] Removing a member from a site revokes their access
- [ ] All existing data still works after multi-site migration
- [ ] No TypeScript errors (`pnpm --filter @workspace/laundry-saas run typecheck`)
- [ ] App starts without errors
