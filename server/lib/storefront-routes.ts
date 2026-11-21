import type { Express, Request, RequestHandler } from "express";
import { z, ZodError } from "zod";
import { StorefrontService, type StorefrontActor } from "./storefront-service";
import type { StorefrontFlowSignup } from "./storefront-flow-signup";
import { StorefrontError } from "./storefront-pricing";

export function registerStorefrontRoutes(app: Express, deps: {
  service: StorefrontService; auth: RequestHandler; limit: RequestHandler; enabled: () => boolean;
  actor: (req: Request) => Promise<StorefrontActor>;
  signup?: StorefrontFlowSignup;
}) {
  const gate: RequestHandler = (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (!deps.enabled()) { res.status(503).json({ message: "La boutique pilote n’est pas encore activée sur cet environnement." }); return; }
    if (!["GET", "HEAD"].includes(req.method)) {
      // Applies to guest mutations too; never trust an arbitrary Origin.
      const origin = req.get("origin");
      if (req.get("sec-fetch-site") === "cross-site" || (origin && origin !== `${req.protocol}://${req.get("host")}`)) { res.status(403).json({ message: "Origine non autorisée" }); return; }
    }
    next();
  };
  const route = (fn: (req: Request) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (error: any) {
      if (error instanceof ZodError) { res.status(400).json({ message: error.issues.map(i => `${i.path.join(".")} : ${i.message}`).join(" ; ") }); return; }
      if (error instanceof StorefrontError) { res.status(error.status).json({ message: error.message }); return; }
      if (error?.code === "23505" || error?.cause?.code === "23505") { res.status(409).json({ message: "Ce lien ou cette demande existe déjà." }); return; }
      console.error("Storefront request failed", { code: error?.code ?? error?.cause?.code ?? "unknown" });
      res.status(500).json({ message: "La demande n’a pas pu être traitée. Réessayez avec le même lien." });
    }
  };
  const secret = (req: Request) => req.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const id = (req: Request) => z.string().uuid().parse(req.params.id);
  const action = z.object({ expectedVersion: z.number().int().positive(), accept: z.boolean(), note: z.string().trim().min(2).max(600) });
  const pub = "/api/public/shops/:slug";
  app.get(pub, gate, deps.limit, route(req => deps.service.publicShop(String(req.params.slug))));
  app.post(`${pub}/quote`, gate, deps.limit, route(req => deps.service.quote(String(req.params.slug), req.body)));
  app.post(`${pub}/requests`, gate, deps.limit, route(req => deps.service.submit(String(req.params.slug), req.body)));
  app.get("/api/public/storefront-tracking", gate, deps.limit, route(req => deps.service.tracking(secret(req))));
  app.post("/api/public/storefront-tracking/decision", gate, deps.limit, route(req => {
    const body = action.omit({ note: true }).parse(req.body);
    return deps.service.decision(secret(req), body.expectedVersion, body.accept);
  }));
  const base = "/api/storefront/admin";
  app.get(`${base}/current`, deps.auth, gate, route(async req => deps.service.admin(await deps.actor(req))));
  app.put(`${base}/current`, deps.auth, gate, route(async req => deps.service.save(await deps.actor(req), req.body)));
  const signup = deps.signup;
  if (signup) {
    const connect = `${base}/flow-signup`;
    app.get(connect, deps.auth, gate, deps.limit, route(async req => signup.status(await deps.actor(req))));
    app.post(`${connect}/start`, deps.auth, gate, deps.limit, route(async req => signup.start(await deps.actor(req), req.sessionID)));
    app.post(`${connect}/finish`, deps.auth, gate, deps.limit, route(async req => signup.finish(await deps.actor(req), req.sessionID, req.body)));
  }
  app.get(`${base}/requests`, deps.auth, gate, route(async req => deps.service.inbox(await deps.actor(req))));
  app.get(`${base}/requests/:id`, deps.auth, gate, route(async req => deps.service.detail(await deps.actor(req), id(req))));
  app.post(`${base}/requests/:id/disposition`, deps.auth, gate, route(async req => {
    const body = action.parse(req.body);
    return deps.service.disposition(await deps.actor(req), id(req), body.expectedVersion, body.accept, body.note);
  }));
  app.post(`${base}/requests/:id/review`, deps.auth, gate, route(async req => deps.service.review(await deps.actor(req), id(req), req.body)));
  app.post(`${base}/requests/:id/convert`, deps.auth, gate, route(async req => {
    const body = z.object({ expectedVersion: z.number().int().positive(), customerId: z.number().int().positive().optional() }).parse(req.body);
    return deps.service.convert(await deps.actor(req), id(req), body.expectedVersion, body.customerId);
  }));
}
