import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync(new URL("./platform-admin-routes.ts", import.meta.url), "utf8");
const authRoutes = readFileSync(new URL("../replit_integrations/auth/routes.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../../client/src/App.tsx", import.meta.url), "utf8");

assert.match(routes, /isAuthenticated, requirePlatformAdmin/);
assert.match(routes, /Platform administrator access required/);
assert.doesNotMatch(routes, /PLATFORM_ADMIN_EMAILS/);
assert.match(routes, /\/api\/platform-admin\/login/);
assert.match(routes, /\/api\/platform-admin\/mfa\/setup/);
assert.match(routes, /\/api\/platform-admin\/mfa\/confirm/);
assert.match(routes, /\/api\/platform-admin\/mfa\/verify/);
assert.match(routes, /ADMIN_SESSION_TTL_MS = 30 \* 60 \* 1000/);
assert.match(routes, /platformAdminVerifiedAt/);
assert.match(routes, /req\.session\.regenerate/);
assert.match(routes, /platform_admin_audit_events/);
assert.match(routes, /\/api\/platform-admin\/overview/);
assert.match(routes, /\/api\/platform-admin\/subscribers/);
assert.match(routes, /\/api\/platform-admin\/audit-events/);
assert.match(authRoutes, /isPlatformAdmin/);
assert.match(authRoutes, /session\.regenerate/);
assert.match(app, /superadmin\.xpressclean\.cm/);
assert.match(app, /\/platform-admin/);

const replit = readFileSync(new URL("../../.replit", import.meta.url), "utf8");
const serverIndex = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../migrations/20260912_platform_admin_mfa.sql", import.meta.url), "utf8");
const reviewedMigrations = readFileSync(new URL("../../scripts/run-reviewed-migrations.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../../client/src/pages/platform-admin.tsx", import.meta.url), "utf8");

assert.doesNotMatch(replit, /PLATFORM_ADMIN_EMAILS/);
assert.doesNotMatch(serverIndex, /ensurePlatformAdminSchema/);
assert.match(migration, /mfa_secret_ciphertext/);
assert.match(migration, /platform_admin_audit_events/);
assert.match(reviewedMigrations, /20260912_platform_admin_mfa\.sql/);
assert.match(reviewedMigrations, /pool\.query\(sql\)/);
assert.match(client, /Authenticator setup QR code/);
assert.match(client, /\/api\/platform-admin\/login/);

console.log("platform admin security regression tests passed");
