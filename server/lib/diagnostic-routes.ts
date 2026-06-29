import type { Express } from "express";
import { db } from "../db";
import { diagnosticLeads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createPublicAccessToken, publicAccessTokenFromRequest, verifyPublicAccessToken } from "./public-access-token";
import { rateLimit } from "./rate-limit";

export function registerDiagnosticRoutes(app: Express) {
  const publicToolLimiter = rateLimit({
    name: "diagnostic-public",
    windowMs: 10 * 60 * 1000,
    max: 30,
    key: (req) => String(req.params?.id || req.body?.phone || "").trim().toLowerCase(),
  });

  app.post("/api/diagnostic/save", publicToolLimiter, async (req, res) => {
    try {
      const {
        fullName, phone, email, country, city,
        businessName, yearCreated, employees, activityType, objectives,
      } = req.body;

      const [lead] = await db.insert(diagnosticLeads).values({
        fullName, phone, email, country, city,
        businessName, yearCreated, employees, activityType,
        objectives: objectives ?? [],
      }).returning();

      res.json({ id: lead.id, leadAccessToken: createPublicAccessToken("diagnostic", lead.id) });
    } catch (err) {
      console.error("diagnostic save error:", err);
      res.status(500).json({ message: "Erreur lors de la sauvegarde" });
    }
  });

  app.patch("/api/diagnostic/complete/:id", publicToolLimiter, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!verifyPublicAccessToken("diagnostic", id, publicAccessTokenFromRequest(req))) {
        return res.status(403).json({ message: "Invalid or expired lead access token" });
      }
      const { answers, totalScore, level, riskIndex } = req.body;

      await db.update(diagnosticLeads).set({
        answers,
        totalScore,
        level,
        riskIndex,
        completedAt: new Date(),
      }).where(eq(diagnosticLeads.id, id));

      res.json({ success: true });
    } catch (err) {
      console.error("diagnostic complete error:", err);
      res.status(500).json({ message: "Erreur lors de la completion" });
    }
  });
}
