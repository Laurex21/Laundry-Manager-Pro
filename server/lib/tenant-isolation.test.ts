import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
const auth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");
const authRoutes = readFileSync(join(root, "server/replit_integrations/auth/routes.ts"), "utf8");
const authModel = readFileSync(join(root, "shared/models/auth.ts"), "utf8");

assert.match(auth, /req\.authorizedSiteIds = authorizedSiteIds/);
assert.match(auth, /req\.organisationSiteIds = organisationSiteIds\.length > 0 \? organisationSiteIds : authorizedSiteIds/);
assert.match(auth, /req\.siteScope = currentSiteId === null \? authorizedSiteIds/);
assert.match(auth, /req\.organisationSiteScope = req\.organisationSiteIds/);
assert.match(auth, /!authorizedSiteIds\.includes\(Number\(currentSiteId\)\)/);
assert.match(auth, /storage\.migrateToMultiSite\(\)/);
assert.match(auth, /user\?\.userType !== "staff"/);
assert.match(auth, /function ensureAuthSchema/);
assert.match(auth, /ADD COLUMN IF NOT EXISTS user_type/);

assert.match(authModel, /userType: varchar\("user_type"/);
assert.match(authRoutes, /\/api\/staff\/onboard\/:token/);
assert.match(authRoutes, /\/api\/staff\/login/);
assert.match(authRoutes, /userType: "owner"/);
assert.match(authRoutes, /Staff accounts must use the staff login page/);
assert.match(authRoutes, /Owner accounts must use the owner login page/);
assert.match(authRoutes, /storage\.getUserSubscription\(subscriptionOwnerId\)/);

assert.match(routes, /function scopedSites/);
assert.match(routes, /function orgScopedSites/);
assert.match(routes, /function requireWriteSite/);
assert.match(routes, /function pickSiteUpdate/);
assert.match(routes, /resolveWriteSiteId/);
assert.match(routes, /storage\.getOrdersBySite\(scopedSites\(req\)\)/);
assert.match(routes, /storage\.getCustomersBySite\(orgScopedSites\(req\)\)/);
assert.match(routes, /storage\.getServicesBySite\(orgScopedSites\(req\)\)/);
assert.match(routes, /storage\.getReportData\(startDate, endDate, scopedSites\(req\)\)/);
assert.match(routes, /storage\.getDashboardData\(allSites \? scopedSites\(req\)/);
assert.match(routes, /resolvedSiteId !== null && !\(await canAccessSite\(req, resolvedSiteId\)\)/);
assert.match(routes, /Select a specific site before saving/);
assert.match(routes, /\(req\.session as any\)\.currentSiteId = result\.siteId/);
assert.match(routes, /Only organisation owners can access this resource/);
assert.match(routes, /Only organisation owners can create sites/);
assert.match(routes, /Site name is required/);
assert.match(routes, /Customer does not belong to this organisation/);
assert.match(routes, /Service \$\{item\.serviceId\} does not belong to this organisation/);

assert.doesNotMatch(routes, /storage\.getOrdersBySite\(req\.siteId\)/);
assert.doesNotMatch(routes, /storage\.getReportData\(startDate, endDate, req\.siteId\)/);
assert.doesNotMatch(routes, /storage\.getDashboardData\(allSites \? null/);
assert.doesNotMatch(routes, /backfillNullSiteIds\(\)/);
assert.doesNotMatch(routes, /storage\.createCustomer\(\{ \.\.\.input, siteId: req\.siteId \}\)/);
assert.doesNotMatch(routes, /siteId: \(req as any\)\.siteId/);

assert.match(storage, /private siteWhere/);
assert.match(storage, /return \[\];/);
assert.match(storage, /inArray\(sites\.id, scopedSiteIds\)/);
assert.match(storage, /innerJoin\(orders, eq\(garmentItems\.orderId, orders\.id\)\)/);
assert.match(storage, /and\(siteWhere, eq\(garmentItems\.returnedForTreatment, true\)/);
assert.match(storage, /scopedSiteIds\.length > 0/);
assert.doesNotMatch(storage, /from\(sites\)\.where\(eq\(sites\.isActive, true\)\)/);
assert.match(storage, /automatic tenant data reassignment is unsafe/);
assert.match(storage, /createStaffFromInvitation/);
assert.match(storage, /userType: "staff"/);
assert.match(storage, /if \(user\.userType === "staff"\) continue/);
assert.match(storage, /from\(organisations\)/);
assert.match(storage, /ne\(users\.userType, "staff"\)/);
assert.doesNotMatch(storage, /db\.update\(orders\)\.set\(\{ siteId:/);
assert.doesNotMatch(storage, /db\.update\(customers\)\.set\(\{ siteId:/);
assert.doesNotMatch(storage, /db\.update\(expenditures\)\.set\(\{ siteId:/);

console.log("tenant isolation regression tests passed");
