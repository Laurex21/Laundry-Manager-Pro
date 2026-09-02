import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const auth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");
const authRoutes = readFileSync(join(root, "server/replit_integrations/auth/routes.ts"), "utf8");
const index = readFileSync(join(root, "server/index.ts"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
const notifications = readFileSync(join(root, "server/lib/subscription-notifications.ts"), "utf8");

assert.match(auth, /repairKnownAccountOrganisationLinks/);
assert.match(auth, /lower\(trim\(u\.email\)\) = 'xpress@gmail\.com'/);
assert.match(auth, /owner_org\.owner_id = u\.id/);
assert.match(auth, /sm\.role = 'owner'/);
assert.match(auth, /u\.organisation_id IS DISTINCT FROM owner_site\.organisation_id/);
assert.doesNotMatch(auth, /UPDATE (customers|orders|payments|employees|site_members)/);
assert.match(auth, /eq\(sites\.organisationId, user\.organisationId\)/);
assert.match(auth, /authorizedSiteIds\.length === 0 && user\?\.organisationId/);
assert.match(auth, /req\.organisationSiteIds = isOrganisationOwner \? organisationSiteIds : authorizedSiteIds/);
assert.match(authRoutes, /eq\(sites\.organisationId, user\.organisationId\)/);
assert.match(authRoutes, /candidateSite\.organisationId === user\.organisationId/);
assert.match(index, /await repairKnownAccountOrganisationLinks\(\)/);
assert.match(routes, /canAccessCustomer[\s\S]{0,220}scopedSites\(req\)\.includes\(customer\.siteId\)/);
assert.match(routes, /canAccessService[\s\S]{0,220}scopedSites\(req\)\.includes\(service\.siteId\)/);
assert.match(routes, /UPDATE orders SET status = \$2[\s\S]{0,180}WHERE site_id = \$3/);
assert.match(routes, /INNER JOIN orders o ON o\.id = pco\.order_id AND o\.site_id = \$4/);
assert.match(routes, /CROSS_ORGANISATION_INVITATION/);
assert.match(storage, /user\.organisationId !== null && user\.organisationId !== inv\.organisationId/);
assert.match(storage, /eq\(sites\.organisationId, inv\.organisationId\)/);
assert.match(storage, /scope\.userOrganisationId !== scope\.siteOrganisationId/);
assert.match(storage, /site\.organisationId !== org\.id \|\| org\.ownerId !== inv\.invitedBy/);
assert.doesNotMatch(storage, /values\(\{ organisationId, \.\.\.data \}\)/);
assert.match(notifications, /inArray\(customers\.siteId, siteScope\)/);
assert.match(notifications, /innerJoin\(customers, eq\(subscriptionNotifications\.clientId, customers\.id\)\)/);

console.log("authentication organisation boundary regression tests passed");