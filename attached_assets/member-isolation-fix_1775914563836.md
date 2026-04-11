# PressFlow — Member Isolation Fix
## Agent Implementation Prompt

---

## DIAGNOSIS SUMMARY

The app has 5 specific failures causing all members to see the owner's data.
Fix them in the exact order listed below. Do not change anything not mentioned.

---

## FIX 1 — `queryClient.ts`: Send `X-Site-Id` header on every request

This is the most critical fix. The entire site-scoping system depends on this header
being sent. Currently it is NEVER sent.

Open `client/src/lib/queryClient.ts`. Replace the entire file with this:

```ts
import { QueryClient, QueryFunction } from "@tanstack/react-query";

const SITE_ID_KEY = "pressflow_active_site_id";

function getSiteHeaders(): Record<string, string> {
  const siteId = localStorage.getItem(SITE_ID_KEY);
  return siteId ? { "X-Site-Id": siteId } : {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...getSiteHeaders(),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: getSiteHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
```

---

## FIX 2 — `server/auth/routes.ts`: Return `siteMemberships` in login/register response

Open `server/auth/routes.ts`. Replace the entire `buildUserResponse` function with this:

```ts
async function buildUserResponse(userId: string) {
  const user = await authStorage.getUser(userId);
  if (!user) return null;

  const sub = await storage.getUserSubscription(userId);
  const planSlug = sub?.plan?.slug ?? "starter";

  // Determine if user is the org owner
  let organisationRole = "member";
  let allSites: any[] = [];
  let siteMemberships: any[] = [];

  if (user.organisationId) {
    const [org] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, user.organisationId));

    if (org && String(org.ownerId) === String(userId)) {
      // This user IS the organisation owner
      organisationRole = "owner";
      allSites = await storage.getSites(user.organisationId);
    } else {
      // This user is a member — fetch their site memberships
      organisationRole = "member";

      // Try siteRole column first (new schema), fall back to role column (old schema)
      const rawMemberships = await db
        .select()
        .from(siteMembers)
        .where(eq(siteMembers.userId, userId));

      // Build siteMemberships array with site names
      siteMemberships = await Promise.all(
        rawMemberships.map(async (m) => {
          const site = await storage.getSite(m.siteId);
          return {
            siteId: m.siteId,
            siteName: site?.name ?? `Site ${m.siteId}`,
            siteCity: site?.city ?? "",
            // Support both column names for backwards compatibility
            siteRole: (m as any).siteRole ?? (m as any).role ?? "operator",
          };
        })
      );
    }
  }

  // For members: resolve currentSite from their first membership if not set
  let currentSite = null;
  if (organisationRole === "owner" && user.currentSiteId) {
    currentSite = await storage.getSite(user.currentSiteId);
  } else if (organisationRole === "member" && siteMemberships.length > 0) {
    // Members always start at their first assigned site
    currentSite = await storage.getSite(siteMemberships[0].siteId);
  }

  return {
    ...user,
    passwordHash: undefined,
    organisationRole,           // "owner" | "member"
    planSlug,
    currentSite,
    allSites,                   // populated for owners only
    siteMemberships,            // populated for members only
    subscription: sub ?? null,
  };
}
```

---

## FIX 3 — `server/auth/routes.ts`: Set `currentSiteId` on member login

Still in `server/auth/routes.ts`, in the `POST /api/auth/login` handler, after
`buildUserResponse` is called, add logic to ensure members have their `currentSiteId`
set in the database if it is not already set:

Find the login handler and add this block right after `const response = await buildUserResponse(user.id)`:

```ts
// For members with no currentSiteId set, auto-assign to their first site
if (response && response.organisationRole === "member" && !user.currentSiteId) {
  if (response.siteMemberships && response.siteMemberships.length > 0) {
    const firstSiteId = response.siteMemberships[0].siteId;
    await db
      .update(users)
      .set({ currentSiteId: firstSiteId })
      .where(eq(users.id, user.id));
  }
}
```

Apply the same block in the `POST /api/auth/register` handler (after `buildUserResponse`).

---

## FIX 4 — `server/middleware/auth.ts` (or wherever `isAuthenticated` is used):
## Read `X-Site-Id` header and attach `req.siteId`

Find the file that defines `isAuthenticated` — currently in `server/auth/replitAuth.ts`.
This middleware only checks the session. It needs to also read the `X-Site-Id` header
and validate + attach site context.

Replace the `isAuthenticated` export in `server/auth/replitAuth.ts` with this:

```ts
import { db } from "../../db";
import { siteMembers, sites, organisations } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // 1. Validate session
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = (req.session as any).userId;
  req.userId = userId;

  // 2. Resolve X-Site-Id header
  const siteIdHeader = req.headers["x-site-id"];

  if (siteIdHeader) {
    const siteId = parseInt(siteIdHeader as string, 10);
    if (!isNaN(siteId)) {

      // Verify the site exists
      const [site] = await db
        .select()
        .from(sites)
        .where(eq(sites.id, siteId));

      if (!site) {
        return res.status(403).json({ message: "Site not found" });
      }

      // Check if user is the org owner of this site
      const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, site.organisationId));

      if (org && String(org.ownerId) === String(userId)) {
        // Owner can access any site in their org
        req.siteId = siteId;
        req.siteRole = "owner";
        req.organisationId = site.organisationId;
      } else {
        // Member: verify they have an explicit membership for this site
        const [membership] = await db
          .select()
          .from(siteMembers)
          .where(
            and(
              eq(siteMembers.siteId, siteId),
              eq(siteMembers.userId, userId)
            )
          );

        if (!membership) {
          return res.status(403).json({ message: "No access to this site" });
        }

        req.siteId = siteId;
        // Support both siteRole and role column names
        req.siteRole = (membership as any).siteRole ?? (membership as any).role ?? "operator";
        req.organisationId = site.organisationId;
      }
    }
  } else {
    // No X-Site-Id — HQ mode or org-level endpoints
    req.siteId = null;
    req.siteRole = null;

    // Still resolve organisationId from user record for org-level queries
    const { db: dbConn } = await import("../../db");
    const { users } = await import("@shared/schema");
    const [user] = await dbConn.select().from(users).where(eq(users.id, userId));
    req.organisationId = user?.organisationId ?? null;
  }

  next();
};
```

Also add these type declarations. Find or create `server/types/express.d.ts` and add:

```ts
declare global {
  namespace Express {
    interface Request {
      userId: string;
      siteId: number | null;
      siteRole: string | null;
      organisationId: number | null;
    }
  }
}
export {};
```

---

## FIX 5 — All data routes: filter by `req.siteId`

Find the main routes file (likely `server/routes.ts`). Every route that returns
operational data (orders, clients, expenses, machines, employees, analytics/dashboard)
must filter by `req.siteId`.

For every data GET endpoint, apply this pattern:

```ts
// BEFORE (broken — uses userId, returns all data for the user):
app.get("/api/orders", isAuthenticated, async (req: any, res) => {
  const orders = await storage.getOrders(req.session.userId);
  res.json(orders);
});

// AFTER (correct — scoped to the active site):
app.get("/api/orders", isAuthenticated, async (req: any, res) => {
  if (!req.siteId) {
    return res.status(400).json({ message: "X-Site-Id header required" });
  }
  const orders = await storage.getOrdersBySite(req.siteId);
  res.json(orders);
});
```

Apply this to ALL of these routes:
- `GET /api/orders`
- `POST /api/orders` (set `siteId` on the created record)
- `GET /api/clients`
- `POST /api/clients` (set `siteId` or `organisationId` on the created record)
- `GET /api/expenses`
- `POST /api/expenses` (set `siteId`)
- `GET /api/machines`
- `POST /api/machines` (set `siteId`)
- `GET /api/employees`
- `POST /api/employees` (set `siteId`)
- `GET /api/analytics/dashboard`
- `GET /api/analytics/kpis`

For each storage method that currently takes `userId`, create a parallel version that
takes `siteId`. Example for orders in `server/storage.ts`:

```ts
// Add this alongside existing getOrders(userId):
async getOrdersBySite(siteId: number) {
  return await db
    .select()
    .from(orders)
    .where(eq(orders.siteId, siteId))
    .orderBy(desc(orders.createdAt));
}
```

Do the same for clients, expenses, machines, employees, and the dashboard aggregations.

---

## FIX 6 — Frontend auth context: set `activeSiteId` from `siteMemberships`

Find `client/src/hooks/use-auth.ts` or `client/src/lib/auth-context.tsx` — whichever
file manages authentication state and the login function.

After a successful login or on page load (`GET /api/auth/user`), add this logic to
set the `activeSiteId` in localStorage:

```ts
function applyUserSiteContext(userData: any) {
  const SITE_KEY = "pressflow_active_site_id";

  if (userData.organisationRole === "owner") {
    // Owners start in HQ mode — no site pre-selected
    // Only set a site if they had one stored previously
    // (don't override their existing site choice on page refresh)
    if (!localStorage.getItem(SITE_KEY) && userData.allSites?.length > 0) {
      // Default owners to HQ mode — leave SITE_KEY unset
    }
  } else if (userData.organisationRole === "member") {
    // Members always land on their first assigned site
    const currentStored = localStorage.getItem(SITE_KEY);
    if (userData.siteMemberships?.length > 0) {
      const validSiteIds = userData.siteMemberships.map((m: any) => String(m.siteId));
      // If stored site is still valid, keep it; otherwise use first membership
      if (!currentStored || !validSiteIds.includes(currentStored)) {
        localStorage.setItem(SITE_KEY, String(userData.siteMemberships[0].siteId));
      }
    } else {
      // Member with no sites — clear any stale site context
      localStorage.removeItem(SITE_KEY);
    }
  }
}
```

Call `applyUserSiteContext(userData)` in:
1. The login success handler (after setting user state)
2. The `useEffect` that fetches the user on page load
3. The register success handler

---

## FIX 7 — Frontend: add `activeSiteId` to ALL query keys

Every TanStack Query `queryKey` that fetches site-scoped data must include the
`activeSiteId` so the cache is invalidated when the site changes.

Find every `useQuery` call in the following pages and add `activeSiteId` to the key:

```ts
// Get activeSiteId in each component:
const activeSiteId = localStorage.getItem("pressflow_active_site_id");

// Dashboard
queryKey: ["dashboard", activeSiteId]

// Orders
queryKey: ["orders", activeSiteId, statusFilter]

// Clients
queryKey: ["clients", activeSiteId]

// Expenses
queryKey: ["expenses", activeSiteId, typeFilter]

// Machines
queryKey: ["machines", activeSiteId]

// Employees
queryKey: ["employees", activeSiteId]

// Analytics KPIs
queryKey: ["kpis", activeSiteId, period]

// Analytics waste
queryKey: ["waste", activeSiteId]

// Analytics performance
queryKey: ["performance-score", activeSiteId]
```

Also, wherever `switchToSite()` or site context changes, clear the query cache:
```ts
import { queryClient } from "@/lib/queryClient";
queryClient.clear(); // clears all cached data so next fetch is fresh for new site
```

---

## FIX 8 — `auth-utils.ts`: fix the redirect URL

Open `client/src/lib/auth-utils.ts`. Change the redirect from the old Replit OAuth
endpoint to the new auth page:

```ts
// BEFORE:
window.location.href = "/api/login";

// AFTER:
window.location.href = "/auth";
```

---

## VERIFICATION — Run through every item

After implementing all 8 fixes, verify in this exact order:

**Step 1 — Confirm `X-Site-Id` is being sent:**
- Open browser DevTools → Network tab
- Log in as any user
- Click any page (Orders, Clients, etc.)
- Find the API requests (e.g. `GET /api/orders`)
- Confirm the request headers include `X-Site-Id: [number]`
- If this header is missing, Fix 1 was not applied correctly — stop and recheck

**Step 2 — Confirm `siteMemberships` is returned on login:**
- Log in as a member (invited user)
- In DevTools → Network → find the login response
- Confirm the JSON response contains `siteMemberships: [{ siteId, siteName, siteRole }]`
- If missing, Fix 2 was not applied correctly

**Step 3 — Confirm member sees correct site data:**
- Log in as a member
- Confirm they land on a dashboard showing only THEIR site's orders
- Go to Orders — confirm only their site's orders are shown
- Go to Clients — confirm only their site's clients are shown

**Step 4 — Confirm owner still sees all data:**
- Log in as the owner
- Confirm site switcher still works
- Confirm switching sites changes the data shown

**Step 5 — Confirm member cannot see other sites:**
- While logged in as a member, manually set `localStorage.setItem("pressflow_active_site_id", "1")`
  (the owner's site ID) in the browser console
- Refresh the page
- The API should return 403 Forbidden because the member has no `siteMembers` record
  for that site
- Orders/Clients/etc. should show empty or an error, NOT the owner's data

**Full checklist:**
- [ ] `X-Site-Id` header visible in browser Network tab on every API request
- [ ] Login response for members contains `siteMemberships` array
- [ ] Member login sets `pressflow_active_site_id` in localStorage automatically
- [ ] Member sees only their site's orders, clients, expenses
- [ ] Member accessing a site they don't belong to gets 403
- [ ] Owner site switcher still works
- [ ] Owner switching sites refreshes all data
- [ ] No TypeScript errors
- [ ] `GET /api/auth/user` returns `organisationRole` field (not just `role`)
