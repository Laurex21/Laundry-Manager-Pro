import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { trialNoticeCandidateV4 } from "./saas-trial-notice-v4";

export function registerSaasTrialNoticeV4Routes(app: Express): void {
  app.post("/api/saas-v4/trial-notice/claim", isAuthenticated, async (req: any, res) => {
    if (process.env.SAAS_V4_ENFORCEMENT !== "true") return res.json({ enabled: false, notice: null });
    try {
      const org = await storage.getOrganisationByOwner(req.session.userId);
      if (!org) return res.status(403).json({ message: "Only organisation owners can view trial reminders" });
      const notice = await db.transaction(async (tx) => {
        const locked = await tx.execute(sql`
          SELECT plan_slug, state, trial_started_at, trial_ends_at,
                 cycle_started_at, cycle_ends_at, time_zone
          FROM saas_entitlements_v4 WHERE organisation_id = ${org.id} FOR UPDATE
        `);
        const row = locked.rows[0];
        if (!row) return null;
        const planSlug = row.plan_slug === "starter" ? "starter" : row.plan_slug === "pro" ? "pro" :
          row.plan_slug === "business" ? "business" : null;
        const state = row.state === "trialing" ? "trialing" : row.state === "active" ? "active" :
          row.state === "starter" ? "starter" : row.state === "past_due" ? "past_due" : null;
        if (!planSlug || !state || typeof row.time_zone !== "string") return null;
        const dateOrNull = (value: unknown): Date | null => value instanceof Date && Number.isFinite(value.getTime()) ? value : null;
        const candidate = trialNoticeCandidateV4({
          planSlug, state,
          trialStartedAt: dateOrNull(row.trial_started_at), trialEndsAt: dateOrNull(row.trial_ends_at),
          cycleStartedAt: dateOrNull(row.cycle_started_at), cycleEndsAt: dateOrNull(row.cycle_ends_at),
        }, true, new Date(), row.time_zone);
        if (!candidate) return null;
        const inserted = await tx.execute(sql`
          INSERT INTO saas_trial_notices_v4 (organisation_id, kind, local_date)
          VALUES (${org.id}, ${candidate.kind}, ${candidate.localDate}::date)
          ON CONFLICT DO NOTHING RETURNING id
        `);
        return inserted.rows.length ? candidate : null;
      });
      return res.json({ enabled: true, notice });
    } catch (error) {
      console.error("SaaS v4 trial notice claim failed", error);
      return res.status(500).json({ message: "Trial notice unavailable" });
    }
  });
}
