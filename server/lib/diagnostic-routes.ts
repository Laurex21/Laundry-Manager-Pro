import type { Express } from "express";
import { db } from "../db";
import { diagnosticLeads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createPublicAccessToken, publicAccessTokenFromRequest, verifyPublicAccessToken } from "./public-access-token";
import { rateLimit } from "./rate-limit";
import { z } from "zod";

const diagnosticLeadSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  phone: z.string().trim().min(5).max(50),
  email: z.string().trim().email().max(255),
  country: z.string().trim().min(2).max(100),
  city: z.string().trim().min(1).max(100),
  businessName: z.string().trim().min(1).max(200),
  yearCreated: z.string().trim().max(10),
  employees: z.string().trim().max(20),
  activityType: z.string().trim().max(50),
  objectives: z.array(z.string().trim().min(1).max(100)).max(10),
}).strict();

const diagnosticCompletionSchema = z.object({
  answers: z.array(z.number().int().min(1).max(3)).min(1).max(50),
  totalScore: z.number().int().min(1).max(150),
  level: z.string().trim().min(1).max(100),
  riskIndex: z.string().trim().min(1).max(50),
  leadAccessToken: z.string().max(500).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.answers.reduce((sum, answer) => sum + answer, 0) !== value.totalScore) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Score does not match answers", path: ["totalScore"] });
  }
});

export function registerDiagnosticRoutes(app: Express) {
  const publicToolLimiter = rateLimit({
    name: "diagnostic-public",
    windowMs: 10 * 60 * 1000,
    max: 30,
    key: (req) => String(req.params?.id || req.body?.phone || "").trim().toLowerCase(),
  });

  app.post("/api/diagnostic/save", publicToolLimiter, async (req, res) => {
    try {
      const parsed = diagnosticLeadSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid diagnostic details" });
      const {
        fullName, phone, email, country, city,
        businessName, yearCreated, employees, activityType, objectives,
      } = parsed.data;

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
      const parsed = diagnosticCompletionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid diagnostic results" });
      const { answers, totalScore, level, riskIndex } = parsed.data;

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
