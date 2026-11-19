import assert from "node:assert/strict";
import { registerStorefrontRoutes } from "./storefront-routes";
import { StorefrontError } from "./storefront-pricing";
const routes = new Map<string, any[]>();
const app: any = Object.fromEntries(["get", "post", "put"].map(method => [method, (path: string, ...handlers: any[]) => routes.set(`${method}:${path}`, handlers)]));
let enabled = true, called = 0, limited = false;
registerStorefrontRoutes(app, {
  enabled: () => enabled,
  auth: (req: any, res, next) => { if (!req.user) res.status(401).json({ message: "Unauthorized" }); else next(); },
  actor: async (req: any) => { if (!["owner", "manager"].includes(req.user?.role)) throw new StorefrontError(403, "Forbidden"); return { siteId: 1, organisationId: 1, userId: req.user.id }; },
  limit: (_req, res, next) => { if (limited) res.status(429).json({ message: "Rate limited" }); else next(); },
  service: new Proxy({}, { get: () => async () => { called++; return { ok: true }; } }) as any,
});
async function request(method: string, path: string, overrides: any = {}) {
  const headers: any = {};
  const req: any = { method: method.toUpperCase(), protocol: "https", params: { slug: "test", id: "invalid-id" }, body: {}, get: (name: string) => name === "host" ? "xpress.test" : undefined, ...overrides };
  const result: any = { status: 200, body: null, headers };
  const res: any = { status: (code: number) => { result.status = code; return res; }, json: (body: unknown) => { result.body = body; }, setHeader: (k: string, v: string) => { headers[k] = v; } };
  for (const handler of routes.get(`${method}:${path}`)!) {
    let next = false;
    await handler(req, res, () => { next = true; });
    if (!next) break;
  }
  return result;
}
const admin = "/api/storefront/admin/current", publicPath = "/api/public/shops/:slug";
assert.equal((await request("get", admin)).status, 401);
assert.equal((await request("get", admin, { user: { id: "u", role: "operator" } })).status, 403);
assert.equal(called, 0, "no data access before authorization");
assert.equal((await request("get", admin, { user: { id: "u", role: "manager" } })).status, 200);
enabled = false;
assert.equal((await request("get", publicPath)).status, 503);
assert.equal(called, 1, "feature off does not touch new tables");
enabled = true;
limited = true;
assert.equal((await request("get", publicPath)).status, 429);
limited = false;
const foreign = await request("post", `${publicPath}/quote`, { get: (key: string) => ({ host: "xpress.test", origin: "https://other.test" } as any)[key] });
assert.equal(foreign.status, 403);
assert.equal((await request("post", "/api/public/storefront-tracking/decision", { body: { expectedVersion: -1, accept: true } })).status, 400);
assert.equal((await request("get", "/api/storefront/admin/requests/:id", { user: { id: "u", role: "owner" } })).status, 400);
const publicResult = await request("get", publicPath);
assert.equal(publicResult.headers["Cache-Control"], "no-store");
assert.equal(publicResult.headers["Referrer-Policy"], "no-referrer");
console.log("Storefront HTTP boundaries: authentication, role gate, feature flag, rate limit, origin, validation and private cache headers passed.");
