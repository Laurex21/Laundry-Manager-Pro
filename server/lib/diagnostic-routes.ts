import type { Express } from "express";
import { db } from "../db";
import { diagnosticLeads } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerDiagnosticRoutes(app: Express) {
  app.post("/api/diagnostic/save", async (req, res) => {
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

      res.json({ id: lead.id });
    } catch (err) {
      console.error("diagnostic save error:", err);
      res.status(500).json({ message: "Erreur lors de la sauvegarde" });
    }
  });

  app.patch("/api/diagnostic/complete/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
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
