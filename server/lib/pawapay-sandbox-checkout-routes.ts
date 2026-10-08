import crypto from "crypto";
import type { Express } from "express";
import { pool } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { requirePlatformAdmin } from "./platform-admin-routes";
import { rateLimit } from "./rate-limit";
import { pawapaySandboxSchemaReady } from "./pawapay-sandbox-schema";

const SANDBOX_API_URL = "https://api.sandbox.pawapay.io/v2/checkouts";
const RETURN_URL = "https://superadmin.xpressclean.cm/";
const TEST_AMOUNT_XAF = "1000";

export function registerPawapaySandboxCheckoutRoutes(app: Express): void {
  app.get("/api/platform-admin/pawapay-sandbox-checkouts", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    const organisationId = Number(req.query.organisationId);
    if (!Number.isSafeInteger(organisationId) || organisationId < 1) return res.status(400).json({ message: "Valid organisation ID required" });
    try {
      await pawapaySandboxSchemaReady();
      const result = await pool.query(
        `SELECT checkout_id, amount_xaf, status, provider_status, redirect_url, callback_received_at, created_at
         FROM pawapay_sandbox_checkouts WHERE organisation_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [organisationId],
      );
      res.json(result.rows.map((row) => ({
        checkoutId: row.checkout_id, amountXaf: Number(row.amount_xaf), status: row.status,
        providerStatus: row.provider_status, redirectUrl: row.redirect_url,
        callbackReceivedAt: row.callback_received_at, createdAt: row.created_at,
      })));
    } catch (error) {
      console.error("PawaPay sandbox checkout list failed:", error);
      res.status(500).json({ message: "Could not load sandbox checkouts" });
    }
  });

  app.post("/api/platform-admin/organisations/:organisationId/pawapay-sandbox-checkouts", isAuthenticated,
    requirePlatformAdmin,
    rateLimit({ name: "pawapay-sandbox-checkout", windowMs: 60 * 60 * 1000, max: 10,
      key: (req) => String(req.session?.userId || ""), keyOnly: true }),
    async (req: any, res) => {
      const organisationId = Number(req.params.organisationId);
      if (!Number.isSafeInteger(organisationId) || organisationId < 1) return res.status(400).json({ message: "Valid organisation ID required" });
      const token = process.env.PAWAPAY_SANDBOX_API_TOKEN;
      if (!token) return res.status(503).json({ message: "PawaPay sandbox token is not configured" });
      const checkoutId = crypto.randomUUID();
      try {
        await pawapaySandboxSchemaReady();
        const organisation = await pool.query("SELECT id FROM organisations WHERE id = $1", [organisationId]);
        if (!organisation.rowCount) return res.status(404).json({ message: "Organisation not found" });
        await pool.query(
          `INSERT INTO pawapay_sandbox_checkouts (checkout_id, organisation_id, created_by_user_id, amount_xaf)
           VALUES ($1, $2, $3, $4)`,
          [checkoutId, organisationId, req.session.userId, TEST_AMOUNT_XAF],
        );
        const response = await fetch(SANDBOX_API_URL, {
          method: "POST", signal: AbortSignal.timeout(10000),
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            checkoutId, returnUrl: RETURN_URL, defaultLanguage: "fr", countries: ["CMR"], expiresAfter: 30,
            amounts: [{ country: "CMR", currency: "XAF", amount: TEST_AMOUNT_XAF }],
            clientReferenceId: `XP-SBX-${checkoutId.slice(0, 18)}`,
            reason: { fr: "Test de paiement XPress Pro", en: "XPress Pro sandbox payment test" },
            metadata: [{ organisationId: String(organisationId) }],
          }),
        });
        const result: any = await response.json().catch(() => ({}));
        if (!response.ok || result.status !== "ACCEPTED") {
          await pool.query(
            "UPDATE pawapay_sandbox_checkouts SET status = 'REJECTED', provider_status = $2, updated_at = now() WHERE checkout_id = $1",
            [checkoutId, typeof result.status === "string" ? result.status : "HTTP_ERROR"],
          );
          return res.status(502).json({ message: "PawaPay rejected the sandbox checkout", checkoutId });
        }
        const redirect = new URL(result.redirectUrl);
        if (redirect.origin !== "https://checkout.sandbox.pawapay.io" || result.checkoutId !== checkoutId ||
            typeof result.checkoutCode !== "string") {
          throw new Error("PawaPay checkout response invalid");
        }
        await pool.query(
          `UPDATE pawapay_sandbox_checkouts
           SET status = CASE WHEN status = 'CREATED' THEN 'ACCEPTED' ELSE status END,
               provider_status = 'ACCEPTED', checkout_code = $2, redirect_url = $3, updated_at = now()
           WHERE checkout_id = $1`,
          [checkoutId, result.checkoutCode, redirect.toString()],
        );
        res.status(201).json({ checkoutId, status: "ACCEPTED", redirectUrl: redirect.toString() });
      } catch (error) {
        console.error("PawaPay sandbox checkout initiation failed:", error);
        res.status(503).json({ message: "Sandbox checkout could not be started; check its status before retrying", checkoutId });
      }
    });

  app.post("/api/platform-admin/pawapay-sandbox-checkouts/:checkoutId/refresh", isAuthenticated,
    requirePlatformAdmin,
    rateLimit({ name: "pawapay-sandbox-status", windowMs: 60 * 60 * 1000, max: 30,
      key: (req) => String(req.session?.userId || ""), keyOnly: true }),
    async (req, res) => {
      const checkoutId = String(req.params.checkoutId || "");
      if (!/^[a-f\d-]{36}$/i.test(checkoutId)) return res.status(400).json({ message: "Invalid checkout ID" });
      const token = process.env.PAWAPAY_SANDBOX_API_TOKEN;
      if (!token) return res.status(503).json({ message: "PawaPay sandbox token is not configured" });
      try {
        await pawapaySandboxSchemaReady();
        const local = await pool.query(
          "SELECT checkout_code, amount_xaf, status FROM pawapay_sandbox_checkouts WHERE checkout_id = $1",
          [checkoutId],
        );
        if (!local.rowCount) return res.status(404).json({ message: "Sandbox checkout not found" });
        const response = await fetch(`${SANDBOX_API_URL}/${checkoutId}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return res.status(502).json({ message: "PawaPay status request failed" });
        const result: any = await response.json();
        if (result.status !== "FOUND" || result.data?.checkoutId !== checkoutId) {
          return res.status(502).json({ message: "PawaPay checkout status unavailable" });
        }
        const data = result.data;
        const amountMatches = Array.isArray(data.amounts) && data.amounts.some((amount: any) =>
          amount?.country === "CMR" && amount?.currency === "XAF" && Number(amount?.amount) === Number(local.rows[0].amount_xaf));
        if (!amountMatches || (local.rows[0].checkout_code && data.checkoutCode !== local.rows[0].checkout_code)) {
          return res.status(409).json({ message: "PawaPay checkout details do not match" });
        }
        const status = String(data.status || "").toUpperCase();
        if (["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"].includes(status)) {
          await pool.query(
            `UPDATE pawapay_sandbox_checkouts
             SET status = $2, provider_status = $2, updated_at = now()
             WHERE checkout_id = $1 AND status NOT IN ('COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED')`,
            [checkoutId, status],
          );
        }
        const current = await pool.query("SELECT status, callback_received_at FROM pawapay_sandbox_checkouts WHERE checkout_id = $1", [checkoutId]);
        if (["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"].includes(status) && current.rows[0].status !== status) {
          return res.status(409).json({ message: "Provider and local final statuses conflict" });
        }
        res.json({ checkoutId, status: current.rows[0].status, callbackReceivedAt: current.rows[0].callback_received_at });
      } catch (error) {
        console.error("PawaPay sandbox checkout status refresh failed:", error);
        res.status(503).json({ message: "Could not refresh sandbox checkout status" });
      }
    });
}
