import type { Express } from "express";
import { pool } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { rateLimit } from "./rate-limit";
import { createShadowSandboxCheckout, reconcileShadowSandboxCheckout, shadowTestEnabledForEmail } from "./saas-v4-shadow-sandbox";
import { SAAS_PLANS_V4 } from "./saas-plan-v4";

async function allowedOrganisation(userId: string): Promise<number | null> {
  const result = await pool.query(
    `SELECT o.id, u.email FROM organisations o JOIN users u ON u.id = o.owner_id
     WHERE o.owner_id = $1 LIMIT 1`, [userId],
  );
  const row = result.rows[0];
  return row && shadowTestEnabledForEmail(String(row.email)) ? Number(row.id) : null;
}

export function registerSaasV4ShadowSandboxRoutes(app: Express): void {
  app.get("/api/subscriptions/v4/shadow-test", isAuthenticated, async (req: any, res) => {
    try {
      const organisationId = await allowedOrganisation(req.session.userId);
      if (!organisationId) return res.json({ enabled: false });
      const [entitlement, checkouts] = await Promise.all([
        pool.query("SELECT plan_slug, cycle_started_at, cycle_ends_at FROM saas_v4_shadow_entitlements WHERE organisation_id = $1", [organisationId]),
        pool.query(`SELECT checkout_id, target_plan_slug, amount_xaf, status, redirect_url, created_at
          FROM saas_v4_shadow_sandbox_checkouts WHERE organisation_id = $1
          ORDER BY created_at DESC LIMIT 5`, [organisationId]),
      ]);
      res.json({ enabled: true, prices: { pro: SAAS_PLANS_V4.pro.monthlyXaf,
        business: SAAS_PLANS_V4.business.monthlyXaf },
        entitlement: entitlement.rows[0] ?? null, checkouts: checkouts.rows });
    } catch (error) {
      console.error("Shadow Sandbox status unavailable", error);
      res.status(503).json({ message: "Shadow Sandbox status unavailable" });
    }
  });

  app.post("/api/subscriptions/v4/shadow-test", isAuthenticated,
    rateLimit({ name: "saas-v4-shadow-create", windowMs: 60 * 60 * 1000, max: 5,
      key: (req) => String(req.session?.userId || ""), keyOnly: true }),
    async (req: any, res) => {
      const organisationId = await allowedOrganisation(req.session.userId);
      if (!organisationId) return res.status(404).json({ message: "Test unavailable" });
      const targetPlanSlug = req.body?.targetPlanSlug;
      if (targetPlanSlug !== "pro" && targetPlanSlug !== "business") {
        return res.status(400).json({ message: "Invalid test plan" });
      }
      try {
        res.status(201).json(await createShadowSandboxCheckout({
          organisationId, userId: req.session.userId, targetPlanSlug,
        }));
      } catch (error) {
        console.error("Shadow Sandbox checkout unavailable", error);
        res.status(503).json({ message: "Could not create test checkout" });
      }
    });

  app.post("/api/subscriptions/v4/shadow-test/:checkoutId/refresh", isAuthenticated,
    rateLimit({ name: "saas-v4-shadow-refresh", windowMs: 60 * 60 * 1000, max: 30,
      key: (req) => String(req.session?.userId || ""), keyOnly: true }),
    async (req: any, res) => {
      const organisationId = await allowedOrganisation(req.session.userId);
      if (!organisationId) return res.status(404).json({ message: "Test unavailable" });
      const checkoutId = String(req.params.checkoutId || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutId)) {
        return res.status(400).json({ message: "Invalid checkout ID" });
      }
      try { res.json({ status: await reconcileShadowSandboxCheckout(checkoutId, organisationId) }); }
      catch (error) {
        console.error("Shadow Sandbox verification unavailable", error);
        res.status(503).json({ message: "Could not verify test checkout" });
      }
    });
}
