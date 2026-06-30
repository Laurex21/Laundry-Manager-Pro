import type { Express } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import {
  CURRENT_LEGAL_DOCUMENTS,
  clientIp,
  getCurrentLegalAcceptanceStatus,
  recordCurrentLegalAcceptance,
} from "./legal";
import { db } from "../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

async function legalContext(userId: string) {
  const [user] = await db
    .select({
      organisationId: users.organisationId,
      currentSiteId: users.currentSiteId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    organisationId: user?.organisationId ?? null,
    siteId: user?.currentSiteId ?? null,
  };
}

export function registerLegalRoutes(app: Express): void {
  app.get("/api/legal/current", (_req, res) => {
    res.json(CURRENT_LEGAL_DOCUMENTS);
  });

  app.get("/api/legal/status", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await getCurrentLegalAcceptanceStatus(req.session.userId));
    } catch (error) {
      console.error("Legal status error:", error);
      res.status(500).json({ message: "Failed to fetch legal acceptance status" });
    }
  });

  app.post("/api/legal/accept", isAuthenticated, async (req: any, res) => {
    try {
      const accepted = req.body?.accepted === true || req.body?.acceptedLegal === true;
      if (!accepted) {
        return res.status(400).json({ message: "You must accept the current Terms, Privacy Policy, and Cookie Policy to continue." });
      }

      const context = await legalContext(req.session.userId);
      const acceptance = await recordCurrentLegalAcceptance({
        userId: req.session.userId,
        organisationId: context.organisationId,
        siteId: context.siteId,
        source: "login_gate",
        ipAddress: clientIp(req),
        userAgent: req.get("user-agent") ?? null,
        metadata: {
          documents: CURRENT_LEGAL_DOCUMENTS.documents,
        },
      });

      res.status(201).json({
        acceptance,
        legalAcceptance: await getCurrentLegalAcceptanceStatus(req.session.userId),
      });
    } catch (error) {
      console.error("Legal acceptance error:", error);
      res.status(500).json({ message: "Failed to record legal acceptance" });
    }
  });
}
