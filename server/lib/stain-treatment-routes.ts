import type { Express } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { stainTreatmentPricingInputSchema } from "@shared/stain-treatment";
import { ZodError } from "zod";
import { getActiveTreatmentPrices, replaceTreatmentPrices, StainTreatmentPricingError } from "./stain-treatment";

type PricingActor = { role: string; capabilities: readonly string[] };
export function canManageStainTreatmentPricing(actor: PricingActor): boolean {
  if (actor.role === "owner") return true;
  return actor.role === "manager" && actor.capabilities.includes("manage_stain_treatment_pricing");
}

async function resolveActor(req: any, siteId: number): Promise<PricingActor> {
  const { pool } = await import("../db");
  const owner = await pool.query("SELECT owner_id FROM organisations WHERE id = $1", [req.organisationId]);
  if (owner.rows[0]?.owner_id === req.userId) return { role: "owner", capabilities: [] };
  const member = await pool.query(`
    SELECT sm.role, sm.capabilities
    FROM site_members sm JOIN sites s ON s.id = sm.site_id
    WHERE sm.user_id = $1 AND sm.site_id = $2 AND s.organisation_id = $3 AND s.is_active = true
  `, [req.userId, siteId, req.organisationId]);
  const resolved = member.rows[0];
  return resolved
    ? { role: resolved.role, capabilities: Array.isArray(resolved.capabilities) ? resolved.capabilities : [] }
    : { role: "operator", capabilities: [] };
}

function requestScope(req: any) {
  const organisationId = Number(req.organisationId);
  const siteId = Number(req.siteId);
  if (!Number.isInteger(organisationId) || !Number.isInteger(siteId) || !req.authorizedSiteIds?.includes(siteId)) {
    throw new StainTreatmentPricingError("Select an authorized site", 400, "site_required");
  }
  return { organisationId, siteId };
}

function sendError(res: any, error: unknown) {
  if (error instanceof StainTreatmentPricingError) return res.status(error.status).json({ message: error.message, code: error.code });
  if (error instanceof ZodError) return res.status(400).json({ message: "Invalid stain treatment prices", issues: error.issues });
  const reference = `stain-pricing-${Date.now().toString(36)}`;
  console.error(`[${reference}] stain treatment pricing error`, error);
  return res.status(500).json({ message: "Unable to process stain treatment pricing", reference });
}

export function registerStainTreatmentRoutes(app: Express) {
  // GET /api/stain-treatment/prices
  app.get("/api/stain-treatment/prices", isAuthenticated, async (req: any, res) => {
    try {
      const { pool } = await import("../db");
      const scope = requestScope(req);
      const actor = await resolveActor(req, scope.siteId);
      if (!canManageStainTreatmentPricing(actor)) return res.status(403).json({ message: "Forbidden" });
      res.json(await getActiveTreatmentPrices(pool, scope));
    } catch (error) { sendError(res, error); }
  });

  // PUT /api/stain-treatment/prices
  app.put("/api/stain-treatment/prices", isAuthenticated, async (req: any, res) => {
    try {
      const { pool } = await import("../db");
      const scope = requestScope(req);
      const actor = await resolveActor(req, scope.siteId);
      if (!canManageStainTreatmentPricing(actor)) return res.status(403).json({ message: "Forbidden" });
      const body = stainTreatmentPricingInputSchema.parse(req.body);
      res.json(await replaceTreatmentPrices(pool, { ...scope, actorId: req.userId, rates: body.rates }));
    } catch (error) { sendError(res, error); }
  });
}
