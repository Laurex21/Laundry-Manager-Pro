import type { Express } from "express";
import { db } from "../db";
import { leadsCalculateurRentabilite } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createPublicAccessToken, publicAccessTokenFromRequest, verifyPublicAccessToken } from "./public-access-token";
import { rateLimit } from "./rate-limit";

export function registerRentabiliteRoutes(app: Express) {
  const publicToolLimiter = rateLimit({
    name: "rentabilite-public",
    windowMs: 10 * 60 * 1000,
    max: 30,
    key: (req) => String(req.params?.id || req.body?.phone || "").trim().toLowerCase(),
  });

  app.post("/api/v1/leads/rentabilite", publicToolLimiter, async (req, res) => {
    try {
      const { name, country, city, phone, email } = req.body;
      if (!name || !country || !city || !phone || !email) {
        return res.status(400).json({ message: "Tous les champs sont requis." });
      }
      const [lead] = await db.insert(leadsCalculateurRentabilite)
        .values({ name, country, city, phone, email, status: "pending_calculation" })
        .returning();
      res.json({ id: lead.id, leadAccessToken: createPublicAccessToken("rentabilite", lead.id) });
    } catch (err) {
      console.error("rentabilite lead error:", err);
      res.status(500).json({ message: "Erreur lors de l'enregistrement" });
    }
  });

  app.patch("/api/v1/leads/rentabilite/:id/complete", publicToolLimiter, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!verifyPublicAccessToken("rentabilite", id, publicAccessTokenFromRequest(req))) {
        return res.status(403).json({ message: "Invalid or expired lead access token" });
      }
      const { calculationJson } = req.body;
      await db.update(leadsCalculateurRentabilite)
        .set({ calculationJson, status: "completed", completedAt: new Date() })
        .where(eq(leadsCalculateurRentabilite.id, id));
      res.json({ success: true });
    } catch (err) {
      console.error("rentabilite complete error:", err);
      res.status(500).json({ message: "Erreur lors de la sauvegarde" });
    }
  });
}
