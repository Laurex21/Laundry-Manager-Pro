import type { Express } from "express";
import { pool } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { rateLimit } from "./rate-limit";
import { createProductionPlanCheckoutV4 } from "./pawapay-production-create-v4";
import { reconcileProductionCheckoutV4 } from "./pawapay-production-reconcile-v4";

async function ownerOrganisationId(userId: string): Promise<number | null> {
  const result = await pool.query(
    "SELECT id FROM organisations WHERE owner_id = $1 LIMIT 1", [userId],
  );
  return result.rowCount ? Number(result.rows[0].id) : null;
}

function pilotEnabled(organisationId: number): boolean {
  return process.env.SAAS_V4_PAID_BILLING === "true" &&
    (process.env.SAAS_V4_PILOT_ORGANISATION_IDS ?? "")
      .split(",").some((id) => Number(id.trim()) === organisationId);
}

export function registerSaasPaidCheckoutRoutesV4(app: Express): void {
  app.post("/api/subscriptions/v4/paid-checkouts", isAuthenticated,
    rateLimit({ name: "saas-paid-checkout-v4", windowMs: 60 * 60 * 1000, max: 5,
      key: (req) => String(req.session?.userId || ""), keyOnly: true }),
    async (req: any, res) => {
      try {
        const organisationId = await ownerOrganisationId(req.session.userId);
        if (!organisationId) return res.status(403).json({ message: "Organisation owner required" });
        if (!pilotEnabled(organisationId)) return res.status(404).json({ message: "Paid pilot unavailable" });
        const targetPlanSlug = req.body?.targetPlanSlug;
        if (targetPlanSlug !== "pro" && targetPlanSlug !== "business") {
          return res.status(400).json({ message: "Invalid paid plan" });
        }
        const result = await createProductionPlanCheckoutV4({
          organisationId, createdByUserId: req.session.userId, targetPlanSlug,
        });
        res.status(201).json(result);
      } catch (error) {
        console.error("Could not start paid subscription checkout", error);
        res.status(503).json({ message: "Could not start checkout; check status before retrying" });
      }
    });

  app.post("/api/subscriptions/v4/paid-checkouts/:checkoutId/refresh", isAuthenticated,
    rateLimit({ name: "saas-paid-checkout-refresh-v4", windowMs: 60 * 60 * 1000, max: 30,
      key: (req) => String(req.session?.userId || ""), keyOnly: true }),
    async (req: any, res) => {
      try {
        const organisationId = await ownerOrganisationId(req.session.userId);
        if (!organisationId) return res.status(403).json({ message: "Organisation owner required" });
        if (!pilotEnabled(organisationId)) return res.status(404).json({ message: "Paid pilot unavailable" });
        const checkoutId = String(req.params.checkoutId || "");
        const intent = await pool.query(
          "SELECT 1 FROM saas_payment_intents_v4 WHERE checkout_id = $1 AND organisation_id = $2",
          [checkoutId, organisationId],
        );
        if (!intent.rowCount) return res.status(404).json({ message: "Checkout not found" });
        res.json({ checkoutId, status: await reconcileProductionCheckoutV4(checkoutId) });
      } catch (error) {
        console.error("Could not refresh paid subscription checkout", error);
        res.status(503).json({ message: "Could not verify checkout status" });
      }
    });
}
