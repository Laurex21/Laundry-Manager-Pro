import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
const auth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");

assert.match(auth, /req\.authorizedSiteIds = authorizedSiteIds/);
assert.match(auth, /req\.siteScope = currentSiteId === null \? authorizedSiteIds/);
assert.match(auth, /!authorizedSiteIds\.includes\(Number\(currentSiteId\)\)/);

assert.match(routes, /function scopedSites/);
assert.match(routes, /storage\.getOrdersBySite\(scopedSites\(req\)\)/);
assert.match(routes, /storage\.getCustomersBySite\(scopedSites\(req\)\)/);
assert.match(routes, /storage\.getReportData\(startDate, endDate, scopedSites\(req\)\)/);
assert.match(routes, /storage\.getDashboardData\(allSites \? scopedSites\(req\)/);
assert.match(routes, /resolvedSiteId !== null && !\(await canAccessSite\(req, resolvedSiteId\)\)/);

assert.doesNotMatch(routes, /storage\.getOrdersBySite\(req\.siteId\)/);
assert.doesNotMatch(routes, /storage\.getReportData\(startDate, endDate, req\.siteId\)/);
assert.doesNotMatch(routes, /storage\.getDashboardData\(allSites \? null/);

assert.match(storage, /private siteWhere/);
assert.match(storage, /return \[\];/);
assert.match(storage, /inArray\(sites\.id, scopedSiteIds\)/);
assert.match(storage, /scopedSiteIds\.length > 0/);
assert.doesNotMatch(storage, /from\(sites\)\.where\(eq\(sites\.isActive, true\)\)/);

console.log("tenant isolation regression tests passed");
