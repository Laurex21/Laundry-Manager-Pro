import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth";
import { saasEnabled, saasStore, startSaasJobs } from "./saas-runtime";
import { saasFailure } from "./saas-access";
import { SaasPawapaySandbox } from "./saas-pawapay";
import { SaasError } from "./saas-store";
import { sandboxPublicKeys, verifyPawapaySandboxCallback } from "./pawapay-sandbox-callback";
import { SAAS_PLANS, saasQuotas, saasMonthly, saasSelection, SAAS_CATALOGUE_VERSION } from "../../shared/saas-plans";
import { rateLimit } from "./rate-limit";

const selectionSchema = z.object({ plan: z.enum(["starter", "pro", "business"]), extraSites: z.number().int().min(0).max(1000).default(0), extraStaff: z.number().int().min(0).max(1000).default(0) }).strict();
const provider = new SaasPawapaySandbox(saasStore, () => process.env.PAWAPAY_SANDBOX_API_TOKEN);
const limited = rateLimit({ name: "saas-billing", windowMs: 60_000, max: 30, key: req => String(req.session?.userId), keyOnly: true });
export function registerSaasRoutes(app: Express) {
  startSaasJobs();
  let reconciling = false;
  if (saasEnabled()) {
    const timer = setInterval(async () => {
      if (reconciling || !process.env.PAWAPAY_SANDBOX_API_TOKEN) return; reconciling = true;
      try {
        const pending = await saasStore.db.query("SELECT id,organisation_id FROM saas_invoices WHERE status='pending' ORDER BY created_at LIMIT 100");
        for (const row of pending.rows) { try { await provider.refresh(row.organisation_id, row.id); } catch { /* Keep pending; never invent a failure on timeout. */ } }
      } catch { console.warn("SaaS sandbox reconciliation unavailable"); } finally { reconciling = false; }
    }, 60_000); timer.unref();
  }
  app.get("/api/saas/config", (_req, res) => res.json({ enabled: saasEnabled(), mode: "sandbox", manualRenewal: true, catalogueVersion: SAAS_CATALOGUE_VERSION, plans: Object.values(SAAS_PLANS) }));
  async function owner(req: any, res: any) {
    if (!saasEnabled()) { res.status(404).json({ code: "SAAS_DISABLED" }); return null; }
    if (!req.organisationId) { res.status(403).json({ code: "ORGANISATION_REQUIRED" }); return null; }
    const row = (await saasStore.db.query("SELECT owner_id FROM organisations WHERE id=$1", [req.organisationId])).rows[0];
    if (row?.owner_id !== req.userId) { res.status(403).json({ code: "OWNER_REQUIRED" }); return null; }
    return Number(req.organisationId);
  }
  function route(method: "get" | "post", path: string, fn: (org: number, req: any, res: any) => Promise<void>) {
    app[method](path, isAuthenticated, limited, async (req: any, res: any) => {
      try { const org = await owner(req, res); if (org) await fn(org, req, res); }
      catch (error) { saasFailure(res, error); }
    });
  }
  route("get", "/api/saas/current", async (org, _req, res) => {
    const state = await saasStore.current(org);
    const sites = (await saasStore.db.query("SELECT id,name FROM sites WHERE organisation_id=$1 AND is_active=true ORDER BY id", [org])).rows;
    const staff = (await saasStore.db.query(`SELECT DISTINCT u.id,u.first_name,u.last_name,u.email FROM users u
      JOIN site_members sm ON sm.user_id=u.id JOIN sites s ON s.id=sm.site_id JOIN organisations o ON o.id=s.organisation_id
      WHERE u.organisation_id=$1 AND s.organisation_id=$1 AND s.is_active=true AND u.id<>o.owner_id ORDER BY u.id`, [org])).rows;
    res.json({ state, quotas: saasQuotas(state), monthlyXaf: saasMonthly(state), sites, staff, sandboxConfigured: !!process.env.PAWAPAY_SANDBOX_API_TOKEN });
  });
  route("get", "/api/saas/notices", async (org, req, res) => {
    await saasStore.tick(org, req.get("X-Client-Timezone") || "Africa/Douala");
    // Atomic delivery: a second session never returns the same daily notice twice.
    const notices = await saasStore.db.query(`UPDATE saas_notices SET delivered_at=now() WHERE organisation_id=$1 AND delivered_at IS NULL
      RETURNING *`, [org]);
    res.json(notices.rows.sort((a,b) => Number(b.id)-Number(a.id)).slice(0,1));
  });
  route("get", "/api/saas/invoices", async (org, _req, res) => res.json((await saasStore.db.query("SELECT * FROM saas_invoices WHERE organisation_id=$1 ORDER BY created_at DESC LIMIT 100", [org])).rows));
  route("post", "/api/saas/quote", async (org, req, res) => {
    const target = selectionSchema.parse(req.body);
    res.status(201).json(await saasStore.createQuote(org, saasSelection(target.plan, target.extraSites, target.extraStaff)));
  });
  route("post", "/api/saas/schedule", async (org, req, res) => {
    const target = selectionSchema.parse(req.body);
    res.json(await saasStore.schedule(org, target));
  });
  route("post", "/api/saas/access", async (org, req, res) => {
    const selection = z.object({ sites: z.array(z.number().int().positive()), staff: z.array(z.string().min(1).max(200)) }).strict().parse(req.body);
    res.json(await saasStore.selectAccess(org, selection.sites, selection.staff));
  });
  route("post", "/api/saas/invoices/:id/checkout", async (org, req, res) => {
    z.string().uuid().parse(req.params.id);
    const invoice = await saasStore.invoice(saasStore.db, org, req.params.id);
    if (invoice.total_xaf === 0) { res.json(await saasStore.settleZeroInvoice(org, req.params.id)); return; }
    // Server-owned URL; client cannot redirect payer details to an arbitrary origin.
    const origin = process.env.SAAS_SANDBOX_RETURN_ORIGIN;
    if (!origin) throw new SaasError("SANDBOX_RETURN_URL_NOT_CONFIGURED", 503);
    const url = new URL("/subscriptions", origin);
    if (!(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new SaasError("INVALID_RETURN_URL", 503);
    res.json(await provider.start(org, req.params.id, url.toString()));
  });
  route("post", "/api/saas/invoices/:id/refresh", async (org, req, res) => {
    z.string().uuid().parse(req.params.id); res.json(await provider.refresh(org, req.params.id));
  });
  app.post("/api/receipt-snapshots", isAuthenticated, limited, async (req: any, res) => {
    if (!saasEnabled() || !req.saas) return res.status(404).json({ code: "SAAS_DISABLED" });
    try {
      const data = z.object({ orderId: z.number().int().positive(), paymentId: z.number().int().positive().optional(), kind: z.enum(["deposit","payment","subscriber"]), html: z.string().min(20).max(2_000_000) }).strict().parse(req.body);
      const row = (await saasStore.db.query(`SELECT o.site_id FROM orders o JOIN sites s ON s.id=o.site_id WHERE o.id=$1 AND s.organisation_id=$2`, [data.orderId, req.organisationId])).rows[0];
      if (!row || !req.authorizedSiteIds.includes(row.site_id)) return res.sendStatus(404);
      if (data.kind === "payment") {
        if (!data.paymentId || !(await saasStore.db.query("SELECT id FROM payments WHERE id=$1 AND order_id=$2", [data.paymentId,data.orderId])).rows.length) return res.sendStatus(404);
      }
      const key = `${data.kind}:${data.orderId}:${data.paymentId || 0}`;
      // Client-rendered business document, never a proof of SaaS payment. JSON only;
      // this HTML is never served as active markup on the application's origin.
      await saasStore.db.query(`INSERT INTO saas_receipt_snapshots (organisation_id,order_id,receipt_key,html) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [req.organisationId,data.orderId,key,data.html]);
      const saved = (await saasStore.db.query("SELECT html FROM saas_receipt_snapshots WHERE organisation_id=$1 AND receipt_key=$2", [req.organisationId,key])).rows[0];
      res.json({ html: saved.html });
    } catch(error) { saasFailure(res,error); }
  });
  app.post("/api/saas/sandbox/callback", async (req: any, res) => {
    if (!saasEnabled()) return res.sendStatus(404);
    try {
      if (!Buffer.isBuffer(req.rawBody) || !req.is("application/json")) return res.sendStatus(400);
      const headers = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, typeof value === "string" ? value : undefined]));
      const valid = verifyPawapaySandboxCallback({ method: req.method, authority: req.get("host") || "", path: req.path, headers, rawBody: req.rawBody, keys: await sandboxPublicKeys() });
      if (!valid) return res.sendStatus(401);
      const event = req.body; z.string().uuid().parse(event?.checkoutId);
      const invoice = (await saasStore.db.query("SELECT id FROM saas_invoices WHERE checkout_id=$1", [event.checkoutId])).rows[0];
      if (!invoice) return res.sendStatus(404);
      if (event.clientReferenceId !== invoice.id) throw new SaasError("INVOICE_REFERENCE_MISMATCH");
      await saasStore.applyProviderResult(event.checkoutId, event);
      res.json({ received: true });
    } catch (error) { saasFailure(res, error); }
  });
}
