import type { Express } from "express";
import { pool } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { requirePlatformAdmin } from "./platform-admin-routes";
import { rateLimit } from "./rate-limit";
import { pawapaySandboxSchemaReady } from "./pawapay-sandbox-schema";
import { createSandboxCheckout, reconcileSandboxCheckout, SandboxCheckoutError, startSandboxCheckoutReconciliation } from "./pawapay-sandbox-service";

const ADMIN_RETURN_URL = "https://superadmin.xpressclean.cm/";
const USER_RETURN_URL = "https://app.xpressclean.cm/subscriptions";
const checkoutRateLimit = () => rateLimit({ name: "pawapay-sandbox-checkout", windowMs: 60 * 60 * 1000, max: 10,
  key: (req) => String(req.session?.userId || ""), keyOnly: true });

async function ownerOrganisation(userId: string): Promise<{ id: number; email: string } | null> {
  const result = await pool.query(
    "SELECT organisation.id, owner.email FROM organisations organisation JOIN users owner ON owner.id = organisation.owner_id WHERE organisation.owner_id = $1 LIMIT 1",
    [userId],
  );
  return result.rows[0] ?? null;
}

function sandboxUserEnabled(owner: { id: number; email: string }): boolean {
  const allowedEmail = process.env.PAWAPAY_USER_SANDBOX_EMAIL?.trim().toLowerCase();
  return !!allowedEmail && owner.email.toLowerCase() === allowedEmail;
}

function handleError(res: any, error: unknown, fallback: string): void {
  if (error instanceof SandboxCheckoutError) {
    res.status(error.httpStatus).json({ message: error.message, checkoutId: error.checkoutId });
  } else {
    console.error(fallback, error);
    res.status(503).json({ message: fallback });
  }
}

export function registerPawapaySandboxCheckoutRoutes(app: Express): void {
  startSandboxCheckoutReconciliation();

  app.get("/api/platform-admin/pawapay-sandbox-checkouts", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    const organisationId = Number(req.query.organisationId);
    if (!Number.isSafeInteger(organisationId) || organisationId < 1) return res.status(400).json({ message: "Valid organisation ID required" });
    try {
      await pawapaySandboxSchemaReady();
      const result = await pool.query(
        `SELECT checkout_id, plan_id, amount_xaf, status, provider_status, redirect_url, callback_received_at, created_at
         FROM pawapay_sandbox_checkouts WHERE organisation_id = $1 ORDER BY created_at DESC LIMIT 10`, [organisationId],
      );
      res.json(result.rows.map((row) => ({
        checkoutId: row.checkout_id, planId: row.plan_id, amountXaf: Number(row.amount_xaf), status: row.status,
        providerStatus: row.provider_status, redirectUrl: row.redirect_url,
        callbackReceivedAt: row.callback_received_at, createdAt: row.created_at,
      })));
    } catch (error) { handleError(res, error, "Could not load sandbox checkouts"); }
  });

  app.post("/api/platform-admin/organisations/:organisationId/pawapay-sandbox-checkouts", isAuthenticated,
    requirePlatformAdmin, checkoutRateLimit(), async (req: any, res) => {
      const organisationId = Number(req.params.organisationId);
      if (!Number.isSafeInteger(organisationId) || organisationId < 1) return res.status(400).json({ message: "Valid organisation ID required" });
      try {
        const organisation = await pool.query("SELECT id FROM organisations WHERE id = $1", [organisationId]);
        if (!organisation.rowCount) return res.status(404).json({ message: "Organisation not found" });
        const result = await createSandboxCheckout({ organisationId, userId: req.session.userId, returnUrl: ADMIN_RETURN_URL });
        res.status(201).json({ ...result, status: "ACCEPTED" });
      } catch (error) { handleError(res, error, "Sandbox checkout could not be started; check its status before retrying"); }
    });

  app.post("/api/platform-admin/pawapay-sandbox-checkouts/:checkoutId/refresh", isAuthenticated,
    requirePlatformAdmin,
    rateLimit({ name: "pawapay-sandbox-status", windowMs: 60 * 60 * 1000, max: 30,
      key: (req) => String(req.session?.userId || ""), keyOnly: true }),
    async (req, res) => {
      const checkoutId = String(req.params.checkoutId || "");
      if (!/^[a-f\d-]{36}$/i.test(checkoutId)) return res.status(400).json({ message: "Invalid checkout ID" });
      try { res.json({ checkoutId, ...await reconcileSandboxCheckout(checkoutId) }); }
      catch (error) { handleError(res, error, "Could not refresh sandbox checkout status"); }
    });

  app.get("/api/subscriptions/sandbox-test", isAuthenticated, async (req: any, res) => {
    try {
      const owner = await ownerOrganisation(req.session.userId);
      if (!owner) return res.status(403).json({ message: "Organisation owner required" });
      if (!sandboxUserEnabled(owner)) return res.json({ enabled: false, checkouts: [] });
      await pawapaySandboxSchemaReady();
      const result = await pool.query(
        `SELECT checkout_id, plan_id, amount_xaf, status, redirect_url, created_at
         FROM pawapay_sandbox_checkouts WHERE organisation_id = $1 AND plan_id IS NOT NULL
         ORDER BY created_at DESC LIMIT 10`, [owner.id],
      );
      res.json({ enabled: true, checkouts: result.rows.map((row) => ({
        checkoutId: row.checkout_id, planId: row.plan_id, amountXaf: Number(row.amount_xaf),
        status: row.status, redirectUrl: row.redirect_url, createdAt: row.created_at,
      })) });
    } catch (error) { handleError(res, error, "Could not load sandbox test"); }
  });

  app.post("/api/subscriptions/sandbox-test", isAuthenticated, checkoutRateLimit(), async (req: any, res) => {
    const planId = Number(req.body?.planId);
    if (!Number.isSafeInteger(planId) || planId < 1) return res.status(400).json({ message: "Valid planId required" });
    try {
      const owner = await ownerOrganisation(req.session.userId);
      if (!owner) return res.status(403).json({ message: "Organisation owner required" });
      if (!sandboxUserEnabled(owner)) return res.status(404).json({ message: "Sandbox user test is not enabled" });
      const plan = await pool.query("SELECT id FROM plans WHERE id = $1 AND active = true", [planId]);
      if (!plan.rowCount) return res.status(404).json({ message: "Plan not found" });
      const result = await createSandboxCheckout({ organisationId: owner.id, userId: req.session.userId, planId, returnUrl: USER_RETURN_URL });
      res.status(201).json({ ...result, status: "ACCEPTED" });
    } catch (error) { handleError(res, error, "Sandbox checkout could not be started; check its status before retrying"); }
  });
}
