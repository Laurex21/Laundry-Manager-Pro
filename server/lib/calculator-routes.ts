import type { Express } from "express";
import { db } from "../db";
import { calculatorLeads } from "@shared/schema";
import { eq, and, isNotNull, gte } from "drizzle-orm";
import { getContactZone, COUNTRY_META, REFERENCE } from "./calculator-config";
import { sendReportViaWhatsApp, getExpertContactUrl, getReportClickToChatUrl } from "./whatsapp-service";

async function generateAiReport(data: {
  country: string; city: string; pressingType: string;
  dailyCapacity: string; countryLabel: string;
}) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite-preview-06-17",
    tools: [{ googleSearch: {} } as any],
  });

  const typeLabels: Record<string, string> = {
    quartier:   "Pressing de quartier (petite clientèle locale, 1-2 machines)",
    semi_pro:   "Pressing semi-professionnel (50-150 kg/jour, entreprises et particuliers)",
    industriel: "Pressing industriel (+150 kg/jour, hôtels et hôpitaux)",
  };
  const capacityLabels: Record<string, string> = {
    less_50:  "Moins de 50 kg/jour",
    "50_150": "50 à 150 kg/jour",
    more_150: "Plus de 150 kg/jour",
  };

  const prompt =
    `Tu es un expert-conseil senior spécialisé dans la création de pressings/blanchisseries ` +
    `professionnelles en Afrique francophone et Europe francophone.\n\n` +
    `Un entrepreneur veut ouvrir :\n` +
    `- Localisation : ${data.city}, ${data.countryLabel}\n` +
    `- Type : ${typeLabels[data.pressingType] ?? data.pressingType}\n` +
    `- Capacité : ${capacityLabels[data.dailyCapacity] ?? data.dailyCapacity}\n\n` +
    `Utilise Google Search pour trouver les données actuelles pour ${data.city}, ${data.countryLabel} :\n` +
    `1. Prix machines à laver professionnelles (10-20 kg) disponibles dans ce pays\n` +
    `2. Prix sécheuses professionnelles disponibles dans ce pays\n` +
    `3. Coût moyen loyer commercial 50-100m² dans cette ville\n` +
    `4. Tarifs électricité commerciale dans ce pays\n` +
    `5. Coût et disponibilité générateur (si pays à coupures fréquentes)\n` +
    `6. Démarches et coûts légaux pour créer une entreprise dans ce pays\n` +
    `7. Prix pratiqués par les pressings dans cette ville\n\n` +
    `Réponds UNIQUEMENT en JSON valide sans markdown, sans texte avant ou après. ` +
    `Utilise la devise locale appropriée pour ${data.countryLabel}. ` +
    `Voici le schéma JSON attendu :\n` +
    `{\n` +
    `  "summary": "résumé 2-3 phrases personnalisé pour ${data.city}",\n` +
    `  "totalBudget": { "min": number, "max": number, "currency": "FCFA" },\n` +
    `  "breakdown": {\n` +
    `    "equipment": {\n` +
    `      "total": { "min": number, "max": number },\n` +
    `      "items": [{ "name": "string", "quantity": number, "unitCost": { "min": number, "max": number }, "notes": "string" }]\n` +
    `    },\n` +
    `    "setup": {\n` +
    `      "total": { "min": number, "max": number },\n` +
    `      "items": [{ "name": "string", "cost": { "min": number, "max": number }, "notes": "string" }]\n` +
    `    },\n` +
    `    "workingCapital": { "min": number, "max": number, "description": "string" },\n` +
    `    "administrative": {\n` +
    `      "total": { "min": number, "max": number },\n` +
    `      "items": [{ "name": "string", "cost": { "min": number, "max": number }, "notes": "string" }]\n` +
    `    }\n` +
    `  },\n` +
    `  "monthlyCharges": {\n` +
    `    "total": { "min": number, "max": number },\n` +
    `    "items": [{ "category": "string", "min": number, "max": number }]\n` +
    `  },\n` +
    `  "profitability": {\n` +
    `    "breakEvenKgPerMonth": number,\n` +
    `    "estimatedRoiMonths": { "min": number, "max": number },\n` +
    `    "estimatedMonthlyRevenue": { "min": number, "max": number },\n` +
    `    "estimatedMonthlyProfit": { "min": number, "max": number },\n` +
    `    "estimatedMarginPct": { "min": number, "max": number }\n` +
    `  },\n` +
    `  "localInsights": {\n` +
    `    "rentContext": "string",\n` +
    `    "electricityContext": "string",\n` +
    `    "administrativeSteps": ["string"],\n` +
    `    "marketContext": "string"\n` +
    `  },\n` +
    `  "risks": ["string"],\n` +
    `  "recommendations": ["string"],\n` +
    `  "nextSteps": ["string"],\n` +
    `  "sources": ["string"],\n` +
    `  "generatedAt": "${new Date().toISOString()}",\n` +
    `  "disclaimer": "Ces estimations sont basées sur des données de marché actuelles et des moyennes sectorielles. Elles ne remplacent pas une étude de marché professionnelle."\n` +
    `}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const clean = text.replace(/```json\n?|```\n?/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Échec de la génération du rapport IA — format invalide");
  }
}

export function registerCalculatorRoutes(app: Express) {

  // ── PAGE 1: Save lead immediately ──
  app.post("/api/calculator/save-lead", async (req, res) => {
    try {
      const { firstName, lastName, phone, whatsappOptIn, email,
              country, city, referralSource, utmSource, utmMedium, utmCampaign } = req.body;

      if (!firstName || !phone || !country || !city) {
        return res.status(400).json({ message: "Prénom, téléphone, pays et ville sont requis" });
      }

      const contactZone = getContactZone(country);
      const countryMeta = COUNTRY_META[country];
      const dialCodeNumeric = countryMeta?.dialCodeNumeric ?? "";

      const normalizedPhone = phone.startsWith(dialCodeNumeric)
        ? phone
        : dialCodeNumeric + phone.replace(/^0/, "");
      const whatsapp = whatsappOptIn !== false ? normalizedPhone : null;

      const [lead] = await db.insert(calculatorLeads).values({
        firstName, lastName: lastName || null,
        phone: normalizedPhone,
        whatsapp,
        whatsappOptIn: whatsappOptIn !== false,
        email: email || null,
        country, city, contactZone,
        referralSource: referralSource || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        completedPage1: true,
      }).returning();

      res.json({
        leadId: lead.id,
        contactZone,
        currency: countryMeta?.currency ?? "FCFA",
        dialCode: countryMeta?.dialCode ?? "+237",
      });
    } catch (err: any) {
      console.error("save-lead error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ── PAGES 2 & 3: Update lead with business context ──
  app.patch("/api/calculator/update-lead/:leadId", async (req, res) => {
    try {
      const { pressingType, dailyCapacity, completedPage } = req.body;
      const leadId = parseInt(req.params.leadId);

      const updates: any = {};
      if (pressingType)   updates.pressingType  = pressingType;
      if (dailyCapacity)  updates.dailyCapacity = dailyCapacity;
      if (completedPage === 2) updates.completedPage2 = true;
      if (completedPage === 3) updates.completedPage3 = true;

      await db.update(calculatorLeads).set(updates)
        .where(eq(calculatorLeads.id, leadId));

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PAGE 4: Generate AI report ──
  app.post("/api/calculator/generate-report/:leadId", async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        message: "La génération de rapport n'est pas encore configurée. Veuillez contacter l'administrateur.",
      });
    }
    try {
      const leadId = parseInt(req.params.leadId);

      const [lead] = await db.select().from(calculatorLeads)
        .where(eq(calculatorLeads.id, leadId));

      if (!lead) return res.status(404).json({ message: "Session introuvable" });
      if (!lead.pressingType || !lead.dailyCapacity) {
        return res.status(400).json({ message: "Type et capacité requis" });
      }

      // Rate limit: max 3 reports per phone per 24h
      if (lead.phone) {
        const recent = await db.select({ id: calculatorLeads.id })
          .from(calculatorLeads)
          .where(
            and(
              eq(calculatorLeads.phone, lead.phone),
              isNotNull(calculatorLeads.aiReportJson),
              gte(calculatorLeads.createdAt, new Date(Date.now() - 86_400_000))
            )
          );
        if (recent.length >= 3) {
          return res.status(429).json({ message: "Maximum 3 rapports par jour. Réessayez demain." });
        }
      }

      const appUrl = process.env.APP_URL ?? `https://${process.env.REPL_SLUG ?? "pressflow"}.replit.app`;
      const reportUrl  = `${appUrl}/rapport/${leadId}`;
      const countryMeta  = COUNTRY_META[lead.country];
      const countryLabel = countryMeta?.label ?? lead.country;

      const report = await generateAiReport({
        country:       lead.country,
        city:          lead.city,
        pressingType:  lead.pressingType,
        dailyCapacity: lead.dailyCapacity,
        countryLabel,
      });

      await db.update(calculatorLeads).set({
        estimatedMinBudget:  report.totalBudget?.min,
        estimatedMaxBudget:  report.totalBudget?.max,
        currency:            report.totalBudget?.currency ?? "FCFA",
        aiReportJson:        JSON.stringify(report),
        aiReportGeneratedAt: new Date(),
        reportUrl,
        completedPage4:      true,
      }).where(eq(calculatorLeads.id, leadId));

      let whatsappSent   = false;
      let clickToChatUrl: string | null = null;

      if (lead.whatsapp && lead.whatsappOptIn) {
        whatsappSent = await sendReportViaWhatsApp({
          toWhatsApp:   lead.whatsapp,
          firstName:    lead.firstName ?? "",
          city:         lead.city,
          countryLabel,
          minBudget:    report.totalBudget?.min ?? 0,
          maxBudget:    report.totalBudget?.max ?? 0,
          currency:     report.totalBudget?.currency ?? "FCFA",
          reportUrl,
        });

        if (!whatsappSent) {
          clickToChatUrl = getReportClickToChatUrl(lead.firstName ?? "", lead.city, countryLabel);
        }

        await db.update(calculatorLeads).set({
          whatsappSent,
          whatsappSentAt: whatsappSent ? new Date() : null,
        }).where(eq(calculatorLeads.id, leadId));
      }

      const expertUrl = getExpertContactUrl({
        firstName:    lead.firstName ?? "",
        lastName:     lead.lastName ?? undefined,
        city:         lead.city,
        countryLabel,
        pressingType: lead.pressingType,
        minBudget:    report.totalBudget?.min ?? 0,
        maxBudget:    report.totalBudget?.max ?? 0,
        currency:     report.totalBudget?.currency ?? "FCFA",
      });

      res.json({ leadId, reportUrl, report, whatsappSent, clickToChatUrl, expertUrl });
    } catch (err: any) {
      console.error("generate-report error:", err);
      res.status(500).json({ message: err.message ?? "Erreur lors de la génération du rapport" });
    }
  });

  // ── Track expert contact click ──
  app.post("/api/calculator/track-expert-contact/:leadId", async (req, res) => {
    try {
      await db.update(calculatorLeads).set({ expertContactedAt: new Date() })
        .where(eq(calculatorLeads.id, parseInt(req.params.leadId)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Public report page ──
  app.get("/api/calculator/report/:leadId", async (req, res) => {
    try {
      const [lead] = await db.select().from(calculatorLeads)
        .where(eq(calculatorLeads.id, parseInt(req.params.leadId)));
      if (!lead?.aiReportJson) return res.status(404).json({ message: "Rapport introuvable" });

      const countryLabel = COUNTRY_META[lead.country]?.label ?? lead.country;
      res.json({
        leadId:       lead.id,
        firstName:    lead.firstName,
        country:      lead.country,
        countryLabel,
        city:         lead.city,
        pressingType: lead.pressingType,
        report:       JSON.parse(lead.aiReportJson),
        createdAt:    lead.createdAt,
        expertUrl: lead.pressingType ? getExpertContactUrl({
          firstName:    lead.firstName ?? "",
          lastName:     lead.lastName ?? undefined,
          city:         lead.city,
          countryLabel,
          pressingType: lead.pressingType,
          minBudget:    lead.estimatedMinBudget ?? 0,
          maxBudget:    lead.estimatedMaxBudget ?? 0,
          currency:     lead.currency ?? "FCFA",
        }) : null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
