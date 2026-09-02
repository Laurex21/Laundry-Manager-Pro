import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const auth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");
const authRoutes = readFileSync(join(root, "server/replit_integrations/auth/routes.ts"), "utf8");
const index = readFileSync(join(root, "server/index.ts"), "utf8");

assert.match(auth, /repairKnownAccountOrganisationLinks/);
assert.match(auth, /lower\(trim\(u\.email\)\) = 'xpress@gmail\.com'/);
assert.match(auth, /owner_org\.owner_id = u\.id/);
assert.match(auth, /sm\.role = 'owner'/);
assert.match(auth, /u\.organisation_id IS DISTINCT FROM owner_site\.organisation_id/);
assert.doesNotMatch(auth, /UPDATE (customers|orders|payments|employees|site_members)/);
assert.match(auth, /eq\(sites\.organisationId, user\.organisationId\)/);
assert.match(auth, /authorizedSiteIds\.length === 0 && user\?\.organisationId/);
assert.match(authRoutes, /eq\(sites\.organisationId, user\.organisationId\)/);
assert.match(authRoutes, /candidateSite\.organisationId === user\.organisationId/);
assert.match(index, /await repairKnownAccountOrganisationLinks\(\)/);

console.log("authentication organisation boundary regression tests passed");