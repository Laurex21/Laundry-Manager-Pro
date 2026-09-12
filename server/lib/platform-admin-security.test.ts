import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync(new URL("./platform-admin-routes.ts", import.meta.url), "utf8");
const authRoutes = readFileSync(new URL("../replit_integrations/auth/routes.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../../client/src/App.tsx", import.meta.url), "utf8");

assert.match(routes, /CREATE TABLE IF NOT EXISTS platform_admins/);
assert.match(routes, /isAuthenticated, requirePlatformAdmin/);
assert.match(routes, /Platform administrator access required/);
assert.match(routes, /PLATFORM_ADMIN_EMAILS/);
assert.match(routes, /\/api\/platform-admin\/overview/);
assert.match(routes, /\/api\/platform-admin\/subscribers/);
assert.match(routes, /\/api\/platform-admin\/audit-events/);
assert.match(authRoutes, /isPlatformAdmin/);
assert.match(app, /superadmin\.xpressclean\.cm/);
assert.match(app, /\/platform-admin/);

console.log("platform admin security regression tests passed");