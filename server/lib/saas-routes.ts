import { saasOrganisationDeferred } from "./saas-deferred";
import { ProPilotStore, proPilotAllowed, proPilotConfigured } from "./saas-pro-pilot";
import { automaticMaintenanceSuspended } from "./automatic-maintenance";
import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth";
import { saasEnabled, saasOrganisationEnabled, saasRequestEnabled, collectionPilotRequestEnabled, saasStore, startSaasJobs, saasUserDeferred } from "./saas-runtime";
import { livePilotConfigured, pilotSelectionAllowed, collectionPilotConfigured, collectionPilotAllowed, isCollectionPilotInvoice, COLLECTION_PILOT_XAF } from "./saas-pilot";
import { saasFailure } from "./saas-access";
import { configuredSaasProvider, saasCallbackAuthority } from "./saas-pawapay";
import { SaasError } from "./saas-store";
import { pawapayPublicKeys, verifyPawapaySandboxCallback } from "./pawapay-sandbox-callback";
import { SAAS_PLANS, saasQuotas, saasMonthly, saasSelection, SAAS_CATALOGUE_VERSION } from "../../shared/saas-plans";
import { saasEnvironment } from "./saas-environment";
import { rateLimit } from "./rate-limit";

const selectionSchema = z.object({ plan: z.enum(["starter", "pro", "business"]), extraSites: z.number().int().min(0).max(1000).default(0), extraStaff: z.number().int().min(0).max(1000).default(0) }).strict();
const provider = () => configuredSaasProvider(saasStore);
const limited = rateLimit({ name: "saas-billing", windowMs: 60_000, max: 30, key: req => String(req.session?.userId), keyOnly: true });
export function registerSaasRoutes(app: Express, { backgroundJobs = true }: { backgroundJobs?: boolean } = {}) {
  if (backgroundJobs) startSaasJobs();
  let reconciling = false;
  if (backgroundJobs && !automaticMaintenanceSuspended() && !collectionPilotConfigured() && !livePilotConfigured() && saasEnabled()) {
    const timer = setInterval(async () => {
      if (automaticMaintenanceSuspended() || collectionPilotConfigured() || livePilotConfigured() || reconciling || !saasEnvironment()?.token) return; reconciling = true;
      try {
        const pending = await saasStore.db.query("SELECT id,organisation_id FROM saas_invoices WHERE status='pending' AND provider_environment=$1 ORDER BY created_at LIMIT 100", [saasStore.environment]);
        for (const row of pending.rows) { try { await provider().refresh(row.organisation_id, row.id); } catch { /* Keep pending; never invent a failure on timeout. */ } }
      } catch { console.warn("SaaS sandbox reconciliation unavailable"); } finally { reconciling = false; }
    }, 60_000); timer.unref();
  }
  app.get("/api/saas/config", async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      const pilotUserId=(req.session as any)?.userId;
      const pilotOwner=proPilotConfigured() && pilotUserId ? (await saasStore.db.query("SELECT u.organisation_id FROM users u JOIN organisations o ON o.id=u.organisation_id AND o.owner_id=u.id WHERE u.id=$1",[pilotUserId])).rows[0] : null;
      const subscriptionPilot=saasEnabled() && proPilotAllowed(pilotOwner?.organisation_id);
      const enabled = await saasRequestEnabled(req) && (!proPilotConfigured() || subscriptionPilot);
      res.json({ enabled, subscriptionPilot, mode: enabled ? saasEnvironment()?.mode : "disabled", collectionPilot: await collectionPilotRequestEnabled(req), manualRenewal: true, businessLaunch: process.env.SAAS_BUSINESS_LAUNCH_ENABLED === "true", catalogueVersion: SAAS_CATALOGUE_VERSION, plans: Object.values(SAAS_PLANS) });
    } catch { res.status(503).json({ enabled: false, mode: "disabled" }); }
  });
  const proPilot = new ProPilotStore(saasStore);
  function proRoute(method: "get"|"post", path:string, fn:(org:number,req:any,res:any)=>Promise<void>) {
    app[method](path,isAuthenticated,limited,async(req:any,res:any)=>{
      res.set("Cache-Control","private, no-store");
      try {
        if(await saasUserDeferred(req.userId) || !saasOrganisationEnabled(req.organisationId) || !proPilotAllowed(req.organisationId))throw new SaasError("PRO_PILOT_DISABLED",404);
        const row=(await saasStore.db.query("SELECT owner_id FROM organisations WHERE id=$1",[req.organisationId])).rows[0];
        if(row?.owner_id!==req.userId)throw new SaasError("OWNER_REQUIRED",403);
        if(method==="post")z.object({}).strict().parse(req.body);
        await fn(Number(req.organisationId),req,res);
      } catch(error){saasFailure(res,error);}
    });
  }
  proRoute("get","/api/saas/pro-pilot",async(org,_req,res)=>{res.json(await proPilot.current(org));});
  proRoute("post","/api/saas/pro-pilot/quote",async(org,_req,res)=>{res.status(201).json(await proPilot.quote(org));});
  for(const action of ["checkout","refresh"] as const)proRoute("post",`/api/saas/pro-pilot/:id/${action}`,async(org,req,res)=>{
    z.string().uuid().parse(req.params.id);
    const invoice=await saasStore.invoice(saasStore.db,org,req.params.id);
    if(invoice.quote.purpose!=="subscription_pilot")throw new SaasError("PRO_PILOT_INVOICE_MISMATCH");
    if(action==="refresh"){res.json(await provider().refresh(org,invoice.id));return;}
    const origin=saasEnvironment()?.returnOrigin;
    if(!origin)throw new SaasError("LIVE_HTTPS_ORIGIN_REQUIRED",503);
    res.json(await provider().start(org,invoice.id,new URL("/subscriptions",origin).toString()));
  });
  async function owner(req: any, res: any) {
    if (await saasUserDeferred(req.userId) || !saasOrganisationEnabled(req.organisationId)) { res.status(404).json({ code: "SAAS_DISABLED" }); return null; }
    if (!req.organisationId) { res.status(403).json({ code: "ORGANISATION_REQUIRED" }); return null; }
    const row = (await saasStore.db.query("SELECT owner_id FROM organisations WHERE id=$1", [req.organisationId])).rows[0];
    if (row?.owner_id !== req.userId) { res.status(403).json({ code: "OWNER_REQUIRED" }); return null; }
    return Number(req.organisationId);
  }
  function route(method: "get" | "post", path: string, fn: (org: number, req: any, res: any) => Promise<void>) {
    app[method](path, isAuthenticated, limited, async (req: any, res: any) => {
      try { const org = await owner(req, res); if (org) {
        if(proPilotConfigured() && path !== "/api/saas/notices") throw new SaasError("PRO_PILOT_USE_DEDICATED_FLOW",403);
        await fn(org, req, res);
      } }
      catch (error) { saasFailure(res, error); }
    });
  }
  function collectionRoute(method: "get" | "post", path: string, fn: (org: number, req: any, res: any) => Promise<void>) {
    app[method](path,isAuthenticated,limited,async(req:any,res:any)=>{
      res.set("Cache-Control","private, no-store");
      try {
        if (saasOrganisationDeferred(req.organisationId) || await saasUserDeferred(req.userId) || !collectionPilotConfigured() || !saasEnabled() || !collectionPilotAllowed(req.organisationId)) return res.status(404).json({code:"COLLECTION_PILOT_DISABLED"});
        const row=(await saasStore.db.query("SELECT owner_id FROM organisations WHERE id=$1",[req.organisationId])).rows[0];
        if (row?.owner_id !== req.userId) return res.status(403).json({code:"OWNER_REQUIRED"});
        await fn(Number(req.organisationId),req,res);
      } catch(error) {saasFailure(res,error);}
    });
  }
  collectionRoute("get","/api/saas/collection-pilot",async(org,_req,res)=>{
    const result=await saasStore.db.query("SELECT * FROM saas_invoices WHERE organisation_id=$1 AND provider_environment=$2 AND quote->>'purpose'='collection_pilot' ORDER BY (quote ? 'retryOf') DESC, created_at DESC LIMIT 1",[org,saasStore.environment]);
    const invoice=result.rows[0]||null;
    res.json({amountXaf:COLLECTION_PILOT_XAF,subscriptionChanged:false,invoice,retryAllowed:!!invoice&&invoice.id===process.env.SAAS_LIVE_PILOT_RETRY_INVOICE_ID&&invoice.status==="failed"&&invoice.provider_status==="FAILED"&&!invoice.paid_at&&!invoice.quote.retryOf});
  });
  collectionRoute("post","/api/saas/collection-pilot/:id/retry",async(org,req,res)=>{
    z.object({}).strict().parse(req.body);z.string().uuid().parse(req.params.id);
    if(process.env.SAAS_LIVE_PILOT_RETRY_INVOICE_ID!==req.params.id)throw new SaasError("COLLECTION_RETRY_NOT_AUTHORISED",404);
    await provider().verifyFailedCollection(org,req.params.id);
    res.status(201).json(await saasStore.retryCollectionPilotQuote(org,req.params.id));
  });
  collectionRoute("post","/api/saas/collection-pilot/quote",async(org,req,res)=>{
    z.object({}).strict().parse(req.body);
    res.status(201).json(await saasStore.createCollectionPilotQuote(org));
  });
  for (const action of ["checkout","refresh"] as const) collectionRoute("post",`/api/saas/collection-pilot/:id/${action}`,async(org,req,res)=>{
    z.object({}).strict().parse(req.body); z.string().uuid().parse(req.params.id);
    const invoice=await saasStore.invoice(saasStore.db,org,req.params.id);
    if (!isCollectionPilotInvoice(invoice)) throw new SaasError("INVOICE_NOT_FOUND",404);
    if (action === "refresh") {res.json(await provider().refresh(org,invoice.id));return;}
    const origin=saasEnvironment()?.returnOrigin;
    if (!origin) throw new SaasError("LIVE_HTTPS_ORIGIN_REQUIRED",503);
    res.json(await provider().start(org,invoice.id,new URL("/subscriptions",origin).toString()));
  });
  route("get", "/api/saas/current", async (org, _req, res) => {
    const state = await saasStore.current(org);
    const sites = (await saasStore.db.query("SELECT id,name FROM sites WHERE organisation_id=$1 AND is_active=true ORDER BY id", [org])).rows;
    const staff = (await saasStore.db.query(`SELECT DISTINCT u.id,u.first_name,u.last_name,u.email FROM users u
      JOIN site_members sm ON sm.user_id=u.id JOIN sites s ON s.id=sm.site_id JOIN organisations o ON o.id=s.organisation_id
      WHERE u.organisation_id=$1 AND s.organisation_id=$1 AND s.is_active=true AND u.id<>o.owner_id ORDER BY u.id`, [org])).rows;
    res.json({ state, quotas: saasQuotas(state), monthlyXaf: saasMonthly(state), sites, staff, sandboxConfigured: !!saasEnvironment()?.token, paymentConfigured: !!saasEnvironment()?.token, mode: saasEnvironment()?.mode });
  });
  route("get", "/api/saas/notices", async (org, req, res) => {
    if(proPilotConfigured()) return res.json([]);
    await saasStore.tick(org, req.get("X-Client-Timezone") || "Africa/Douala");
    // Atomic delivery: a second session never returns the same daily notice twice.
    const notices = await saasStore.db.query(`UPDATE saas_notices SET delivered_at=now() WHERE organisation_id=$1 AND delivered_at IS NULL
      RETURNING *`, [org]);
    res.json(notices.rows.sort((a,b) => Number(b.id)-Number(a.id)).slice(0,1));
  });
  route("get", "/api/saas/invoices", async (org, _req, res) => res.json((await saasStore.db.query("SELECT * FROM saas_invoices WHERE organisation_id=$1 AND provider_environment=$2 AND COALESCE(quote->>'purpose','subscription')<>'collection_pilot' ORDER BY created_at DESC LIMIT 100", [org, saasStore.environment])).rows));
  route("post", "/api/saas/quote", async (org, req, res) => {
    const target = selectionSchema.parse(req.body);
    if (livePilotConfigured()) {
      if (!pilotSelectionAllowed(target)) throw new SaasError("PILOT_PRO_ONLY", 403);
      const paid = await saasStore.db.query("SELECT id FROM saas_invoices WHERE organisation_id=$1 AND provider_environment='live' AND status='paid' LIMIT 1", [org]);
      if (paid.rows.length) throw new SaasError("PILOT_ALREADY_PAID", 409);
    }
    res.status(201).json(await saasStore.createQuote(org, saasSelection(target.plan, target.extraSites, target.extraStaff)));
  });
  route("post", "/api/saas/schedule", async (org, req, res) => {
    if (livePilotConfigured()) throw new SaasError("PILOT_CHANGE_NOT_ALLOWED", 403);
    const target = selectionSchema.parse(req.body);
    res.json(await saasStore.schedule(org, target));
  });
  route("post", "/api/saas/access", async (org, req, res) => {
    if (livePilotConfigured()) throw new SaasError("PILOT_CHANGE_NOT_ALLOWED", 403);
    const selection = z.object({ sites: z.array(z.number().int().positive()), staff: z.array(z.string().min(1).max(200)) }).strict().parse(req.body);
    res.json(await saasStore.selectAccess(org, selection.sites, selection.staff));
  });
  route("post", "/api/saas/invoices/:id/checkout", async (org, req, res) => {
    z.string().uuid().parse(req.params.id);
    const invoice = await saasStore.invoice(saasStore.db, org, req.params.id);
    if (livePilotConfigured()) {
      if (!pilotSelectionAllowed(invoice.quote.selection) || Number(invoice.total_xaf) !== 10999) throw new SaasError("PILOT_AMOUNT_REQUIRES_REVIEW", 409);
      const paid = await saasStore.db.query("SELECT id FROM saas_invoices WHERE organisation_id=$1 AND provider_environment='live' AND status='paid' LIMIT 1", [org]);
      if (paid.rows.length) throw new SaasError("PILOT_ALREADY_PAID", 409);
    }
    if (invoice.total_xaf === 0) { res.json(await saasStore.settleZeroInvoice(org, req.params.id)); return; }
    // Server-owned URL; client cannot redirect payer details to an arbitrary origin.
    const origin = saasEnvironment()?.returnOrigin;
    if (!origin) throw new SaasError("SANDBOX_RETURN_URL_NOT_CONFIGURED", 503);
    const url = new URL("/subscriptions", origin);
    if (!(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new SaasError("INVALID_RETURN_URL", 503);
    res.json(await provider().start(org, req.params.id, url.toString()));
  });
  route("post", "/api/saas/invoices/:id/refresh", async (org, req, res) => {
    z.string().uuid().parse(req.params.id); res.json(await provider().refresh(org, req.params.id));
  });
  app.post("/api/receipt-snapshots", isAuthenticated, limited, async (req: any, res) => {
    if (!saasOrganisationEnabled(req.organisationId) || !req.saas) return res.status(404).json({ code: "SAAS_DISABLED" });
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
  async function paymentCallback(req: any, res: any) {
    const config = saasEnvironment();
    if (!config || req.path !== `/api/saas/${config.mode}/callback`) return res.sendStatus(404);
    try {
      if (!Buffer.isBuffer(req.rawBody) || !req.is("application/json")) return res.sendStatus(400);
      const headers = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, typeof value === "string" ? value : undefined]));
      const valid = verifyPawapaySandboxCallback({ method: req.method, authority: saasCallbackAuthority(req.get("host") || "", config.callbackOrigin), path: req.path, headers, rawBody: req.rawBody, keys: await pawapayPublicKeys(config.mode) });
      if (!valid) return res.sendStatus(401);
      const event = req.body;
      // A signed deposit notification may accompany a hosted checkout. Reconcile
      // its invoice against the checkout API; never grant access from this body.
      if (!event?.checkoutId && event?.depositId) {
        z.string().uuid().parse(event.depositId);
        const invoiceId = z.string().uuid().parse(event.clientReferenceId || event.metadata?.invoiceId);
        const invoice = (await saasStore.db.query("SELECT id,organisation_id,total_xaf FROM saas_invoices WHERE id=$1 AND checkout_id IS NOT NULL AND provider_environment=$2", [invoiceId, config.mode])).rows[0];
        if (!invoice) return res.sendStatus(404);
        if (event.currency !== "XAF" || event.country !== "CMR" || !/^\d+(?:\.0+)?$/.test(String(event.amount)) || Number(event.amount) !== Number(invoice.total_xaf)) throw new SaasError("PAYMENT_MISMATCH");
        await provider().refresh(Number(invoice.organisation_id), invoice.id);
        return res.json({ received: true });
      }
      z.string().uuid().parse(event?.checkoutId);
      const invoice = (await saasStore.db.query("SELECT id,organisation_id,checkout_code,quote FROM saas_invoices WHERE checkout_id=$1 AND provider_environment=$2", [event.checkoutId, config.mode])).rows[0];
      if (!invoice) return res.sendStatus(404);
      if (event.clientReferenceId !== invoice.id) throw new SaasError("INVOICE_REFERENCE_MISMATCH");
      if (isCollectionPilotInvoice(invoice) && !invoice.checkout_code) {
        await provider().refresh(Number(invoice.organisation_id),invoice.id);
        return res.json({received:true});
      }
      await saasStore.applyProviderResult(event.checkoutId, event, config.mode === "live" ? "pawapay_live" : "pawapay_sandbox");
      res.json({ received: true });
    } catch (error) { saasFailure(res, error); }
  }
  app.post("/api/saas/sandbox/callback", paymentCallback);
  app.post("/api/saas/live/callback", paymentCallback);
}
