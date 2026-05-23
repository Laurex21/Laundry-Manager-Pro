import type { Express } from "express";
import { db } from "../db";
import { calculatorLeads } from "@shared/schema";
import { eq, and, isNotNull, gte } from "drizzle-orm";
import { getContactZone, COUNTRY_META, REFERENCE } from "./calculator-config";
import { sendReportViaWhatsApp, getExpertContactUrl, getReportClickToChatUrl } from "./whatsapp-service";

async function generateAiReport(data: {
  country: string; city: string; countryLabel: string;
  pressingType: string; pressingSize: string;
  services: string[]; objective: string;
  budget: string; experience: string;
}) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite-preview-06-17",
    tools: [{ googleSearch: {} } as any],
  });

  const typeLabels: Record<string, string> = {
    standard:    "Pressing Standard (clientèle résidentielle et bureaux)",
    premium:     "Pressing Premium (clientèle haut de gamme, vêtements luxe)",
    industriel:  "Blanchisserie Industrielle (hôtels, hôpitaux, grandes entreprises)",
    laverie:     "Laverie Automatique en libre-service",
    mobile:      "Pressing Mobile (service à domicile et livraison)",
    quartier:    "Pressing de quartier (petite clientèle locale, 1-2 machines)",
    semi_pro:    "Pressing semi-professionnel (50-150 kg/jour)",
  };
  const sizeLabels: Record<string, string> = {
    petit: "Petit (< 50m², investissement minimal)",
    moyen: "Moyen (50-150m², format intermédiaire)",
    grand: "Grand (150m²+, format professionnel complet)",
    less_50:  "Moins de 50 kg/jour",
    "50_150": "50 à 150 kg/jour",
    more_150: "Plus de 150 kg/jour",
  };
  const objectiveLabels: Record<string, string> = {
    complementaire: "Revenu complémentaire",
    principale:     "Activité principale",
    expansion:      "Expansion d'une activité existante",
    franchise:      "Modèle franchise ou multi-sites",
  };

  const servicesLabel = data.services.length > 0
    ? data.services.join(", ")
    : "Services standards";

  const prompt =
    `Tu es un consultant expert senior spécialisé dans la création de pressings et blanchisseries ` +
    `professionnelles en Afrique francophone et Europe francophone.\n\n` +
    `Un entrepreneur souhaite ouvrir :\n` +
    `- Localisation : ${data.city}, ${data.countryLabel}\n` +
    `- Type de pressing : ${typeLabels[data.pressingType] ?? data.pressingType}\n` +
    `- Taille du projet : ${sizeLabels[data.pressingSize] ?? data.pressingSize}\n` +
    `- Services envisagés : ${servicesLabel}\n` +
    `- Objectif principal : ${objectiveLabels[data.objective] ?? data.objective}\n` +
    `- Budget disponible déclaré : ${data.budget || "Non précisé"}\n` +
    `- Niveau d'expérience : ${data.experience || "Non précisé"}\n\n` +
    `Utilise Google Search pour trouver les données actuelles pour ${data.city}, ${data.countryLabel} :\n` +
    `1. Prix machines à laver professionnelles (10-20 kg) disponibles dans ce pays\n` +
    `2. Prix sécheuses professionnelles disponibles dans ce pays\n` +
    `3. Coût moyen loyer commercial 30-150m² dans cette ville\n` +
    `4. Tarifs électricité commerciale dans ce pays (prix kWh)\n` +
    `5. Coûts légaux pour créer une entreprise dans ce pays\n` +
    `6. Prix pratiqués par les pressings dans cette ville\n` +
    `7. Demande et concurrence pressing dans cette ville\n\n` +
    `TRÈS IMPORTANT : Génère exactement 3 scénarios de budget distincts et réalistes :\n` +
    `1. MINIMUM VIABLE : Budget d'entrée minimal pour commencer, équipements d'occasion ou basiques\n` +
    `2. PROFESSIONNEL STANDARD : Budget intermédiaire recommandé, équipements neufs professionnels\n` +
    `3. PREMIUM ÉVOLUTIF : Budget optimal, équipements haut de gamme, positionnement premium\n\n` +
    `Utilise la devise locale appropriée pour ${data.countryLabel}.\n` +
    `Affiche "Estimations basées sur les données marché disponibles" dans le disclaimer.\n\n` +
    `Réponds UNIQUEMENT en JSON valide sans markdown, sans texte avant ou après. Schéma JSON attendu :\n` +
    `{\n` +
    `  "summary": "résumé personnalisé 2-3 phrases pour ${data.city}",\n` +
    `  "currency": "devise locale ex FCFA",\n` +
    `  "totalBudget": { "min": number, "max": number, "currency": "devise" },\n` +
    `  "tiers": [\n` +
    `    {\n` +
    `      "id": "minimum",\n` +
    `      "label": "Pressing Minimum Viable",\n` +
    `      "emoji": "🌱",\n` +
    `      "tagline": "string courte descriptive",\n` +
    `      "totalBudget": { "min": number, "max": number },\n` +
    `      "breakdown": {\n` +
    `        "equipment": { "min": number, "max": number, "description": "string" },\n` +
    `        "premises": { "min": number, "max": number, "description": "string" },\n` +
    `        "admin": { "min": number, "max": number, "description": "string" },\n` +
    `        "workingCapital": { "min": number, "max": number, "description": "string" }\n` +
    `      },\n` +
    `      "monthlyCharges": { "min": number, "max": number },\n` +
    `      "monthlyRevenue": { "min": number, "max": number },\n` +
    `      "monthlyProfit": { "min": number, "max": number },\n` +
    `      "roiMonths": { "min": number, "max": number },\n` +
    `      "feasibilityScore": number_0_to_100,\n` +
    `      "riskLevel": "Faible|Moyen|Élevé",\n` +
    `      "suitableFor": "string description profil adapté",\n` +
    `      "keyEquipment": ["string", "string", "string"]\n` +
    `    },\n` +
    `    { "id": "standard", "label": "Pressing Professionnel Standard", "emoji": "⭐", ... },\n` +
    `    { "id": "premium", "label": "Pressing Premium Évolutif", "emoji": "🚀", ... }\n` +
    `  ],\n` +
    `  "marketAnalysis": {\n` +
    `    "demandLevel": "Forte|Moyenne|Faible",\n` +
    `    "competition": "string description concurrence locale",\n` +
    `    "opportunity": "string opportunité principale",\n` +
    `    "averagePriceRange": "string fourchette prix pratiqués localement"\n` +
    `  },\n` +
    `  "breakdown": {\n` +
    `    "equipment": { "total": { "min": number, "max": number }, "items": [{ "name": "string", "quantity": 1, "unitCost": { "min": number, "max": number }, "notes": "string" }] },\n` +
    `    "setup": { "total": { "min": number, "max": number }, "items": [{ "name": "string", "cost": { "min": number, "max": number }, "notes": "string" }] },\n` +
    `    "workingCapital": { "min": number, "max": number, "description": "string" },\n` +
    `    "administrative": { "total": { "min": number, "max": number }, "items": [{ "name": "string", "cost": { "min": number, "max": number }, "notes": "string" }] }\n` +
    `  },\n` +
    `  "monthlyCharges": { "total": { "min": number, "max": number }, "items": [{ "category": "string", "min": number, "max": number }] },\n` +
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
    `  "disclaimer": "Estimations basées sur les données marché disponibles. Ne remplace pas une étude de marché professionnelle.",\n` +
    `  "generatedAt": "${new Date().toISOString()}"\n` +
    `}`;

  const result = await model.generateContent(prompt);
  const text   = result.response.text();
  const clean  = text.replace(/```json\n?|```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(clean);
    // If tiers missing, build a compatibility shim
    if (!parsed.tiers && parsed.totalBudget) {
      parsed.tiers = [
        {
          id: "minimum", label: "Pressing Minimum Viable", emoji: "🌱",
          tagline: "Budget d'entrée minimal",
          totalBudget: { min: Math.round(parsed.totalBudget.min * 0.5), max: Math.round(parsed.totalBudget.min * 0.8) },
          breakdown: { equipment: { min: 0, max: 0, description: "" }, premises: { min: 0, max: 0, description: "" }, admin: { min: 0, max: 0, description: "" }, workingCapital: { min: 0, max: 0, description: "" } },
          monthlyCharges: parsed.monthlyCharges?.total ?? { min: 0, max: 0 },
          monthlyRevenue: parsed.profitability?.estimatedMonthlyRevenue ?? { min: 0, max: 0 },
          monthlyProfit: parsed.profitability?.estimatedMonthlyProfit ?? { min: 0, max: 0 },
          roiMonths: { min: 24, max: 36 }, feasibilityScore: 60, riskLevel: "Moyen",
          suitableFor: "Entrepreneurs débutants avec budget limité", keyEquipment: [],
        },
        {
          id: "standard", label: "Pressing Professionnel Standard", emoji: "⭐",
          tagline: "Budget recommandé",
          totalBudget: parsed.totalBudget,
          breakdown: parsed.breakdown ? {
            equipment: { ...parsed.breakdown.equipment?.total, description: "" },
            premises: { ...parsed.breakdown.setup?.total, description: "" },
            admin: { ...parsed.breakdown.administrative?.total, description: "" },
            workingCapital: { ...parsed.breakdown.workingCapital, description: "" },
          } : { equipment: { min: 0, max: 0, description: "" }, premises: { min: 0, max: 0, description: "" }, admin: { min: 0, max: 0, description: "" }, workingCapital: { min: 0, max: 0, description: "" } },
          monthlyCharges: parsed.monthlyCharges?.total ?? { min: 0, max: 0 },
          monthlyRevenue: parsed.profitability?.estimatedMonthlyRevenue ?? { min: 0, max: 0 },
          monthlyProfit: parsed.profitability?.estimatedMonthlyProfit ?? { min: 0, max: 0 },
          roiMonths: parsed.profitability?.estimatedRoiMonths ?? { min: 12, max: 24 },
          feasibilityScore: 75, riskLevel: "Moyen", suitableFor: "Entrepreneurs avec expérience", keyEquipment: [],
        },
        {
          id: "premium", label: "Pressing Premium Évolutif", emoji: "🚀",
          tagline: "Budget optimal",
          totalBudget: { min: Math.round(parsed.totalBudget.max * 1.2), max: Math.round(parsed.totalBudget.max * 1.8) },
          breakdown: { equipment: { min: 0, max: 0, description: "" }, premises: { min: 0, max: 0, description: "" }, admin: { min: 0, max: 0, description: "" }, workingCapital: { min: 0, max: 0, description: "" } },
          monthlyCharges: parsed.monthlyCharges?.total ?? { min: 0, max: 0 },
          monthlyRevenue: { min: Math.round((parsed.profitability?.estimatedMonthlyRevenue?.min ?? 0) * 1.5), max: Math.round((parsed.profitability?.estimatedMonthlyRevenue?.max ?? 0) * 2) },
          monthlyProfit: { min: Math.round((parsed.profitability?.estimatedMonthlyProfit?.min ?? 0) * 1.5), max: Math.round((parsed.profitability?.estimatedMonthlyProfit?.max ?? 0) * 2) },
          roiMonths: { min: 8, max: 18 }, feasibilityScore: 85, riskLevel: "Faible",
          suitableFor: "Entrepreneurs expérimentés visant le premium", keyEquipment: [],
        },
      ];
    }
    return parsed;
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
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

      const contactZone    = getContactZone(country);
      const countryMeta    = COUNTRY_META[country];
      const dialCodeNumeric = countryMeta?.dialCodeNumeric ?? "";

      const normalizedPhone = phone.startsWith(dialCodeNumeric)
        ? phone
        : dialCodeNumeric + phone.replace(/^0/, "");
      const whatsapp = whatsappOptIn !== false ? normalizedPhone : null;

      const [lead] = await db.insert(calculatorLeads).values({
        firstName, lastName: lastName || null,
        phone: normalizedPhone,
        whatsapp, whatsappOptIn: whatsappOptIn !== false,
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

  // ── Update lead with business context ──
  app.patch("/api/calculator/update-lead/:leadId", async (req, res) => {
    try {
      const { pressingType, dailyCapacity, completedPage } = req.body;
      const leadId = parseInt(req.params.leadId);

      const updates: any = {};
      if (pressingType)  updates.pressingType  = pressingType;
      if (dailyCapacity) updates.dailyCapacity = dailyCapacity;
      if (completedPage === 2) updates.completedPage2 = true;
      if (completedPage === 3) updates.completedPage3 = true;

      await db.update(calculatorLeads).set(updates)
        .where(eq(calculatorLeads.id, leadId));

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Generate AI report (3-tier) ──
  app.post("/api/calculator/generate-report/:leadId", async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ message: "La génération de rapport n'est pas encore configurée." });
    }
    try {
      const leadId = parseInt(req.params.leadId);
      const { services, objective, budget, experience } = req.body;

      const [lead] = await db.select().from(calculatorLeads)
        .where(eq(calculatorLeads.id, leadId));

      if (!lead) return res.status(404).json({ message: "Session introuvable" });

      // Rate limit
      if (lead.phone) {
        const recent = await db.select({ id: calculatorLeads.id })
          .from(calculatorLeads)
          .where(and(
            eq(calculatorLeads.phone, lead.phone),
            isNotNull(calculatorLeads.aiReportJson),
            gte(calculatorLeads.createdAt, new Date(Date.now() - 86_400_000))
          ));
        if (recent.length >= 3) {
          return res.status(429).json({ message: "Maximum 3 rapports par jour. Réessayez demain." });
        }
      }

      const appUrl      = process.env.APP_URL ?? `https://${process.env.REPL_SLUG ?? "pressflow"}.replit.app`;
      const reportUrl   = `${appUrl}/rapport/${leadId}`;
      const countryMeta = COUNTRY_META[lead.country];
      const countryLabel= countryMeta?.label ?? lead.country;

      const report = await generateAiReport({
        country:      lead.country,
        city:         lead.city,
        countryLabel,
        pressingType: lead.pressingType ?? "standard",
        pressingSize: lead.dailyCapacity ?? "moyen",
        services:     Array.isArray(services) ? services : [],
        objective:    objective ?? "",
        budget:       budget ?? "",
        experience:   experience ?? "",
      });

      // Use standard tier for DB budget fields
      const standardTier = report.tiers?.find((t: any) => t.id === "standard") ?? report.tiers?.[0];
      await db.update(calculatorLeads).set({
        estimatedMinBudget:  standardTier?.totalBudget?.min ?? report.totalBudget?.min,
        estimatedMaxBudget:  standardTier?.totalBudget?.max ?? report.totalBudget?.max,
        currency:            report.currency ?? report.totalBudget?.currency ?? "FCFA",
        aiReportJson:        JSON.stringify(report),
        aiReportGeneratedAt: new Date(),
        reportUrl,
        completedPage4: true,
      }).where(eq(calculatorLeads.id, leadId));

      let whatsappSent   = false;
      let clickToChatUrl: string | null = null;

      if (lead.whatsapp && lead.whatsappOptIn) {
        const minB = standardTier?.totalBudget?.min ?? report.totalBudget?.min ?? 0;
        const maxB = standardTier?.totalBudget?.max ?? report.totalBudget?.max ?? 0;
        whatsappSent = await sendReportViaWhatsApp({
          toWhatsApp: lead.whatsapp,
          firstName:  lead.firstName ?? "",
          city:       lead.city,
          countryLabel,
          minBudget:  minB,
          maxBudget:  maxB,
          currency:   report.currency ?? "FCFA",
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
        minBudget:    standardTier?.totalBudget?.min ?? report.totalBudget?.min ?? 0,
        maxBudget:    standardTier?.totalBudget?.max ?? report.totalBudget?.max ?? 0,
        currency:     report.currency ?? "FCFA",
      });

      res.json({ leadId, reportUrl, report, whatsappSent, clickToChatUrl, expertUrl });
    } catch (err: any) {
      console.error("generate-report error:", err);
      res.status(500).json({ message: err.message ?? "Erreur lors de la génération du rapport" });
    }
  });

  // ── Track expert contact ──
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
