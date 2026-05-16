import type { Express } from "express";
import { db } from "../db";
import { calculatorLeads } from "@shared/schema";
import { eq, and, or, gte, sql } from "drizzle-orm";
import { getContactZone, COUNTRY_META } from "./calculator-zones";
import { sendReportViaWhatsApp, getClickToChatUrl } from "./whatsapp-service";

const REFERENCE = {
  currencies: {
    cameroun: "FCFA", senegal: "FCFA", cote_divoire: "FCFA", mali: "FCFA",
    burkina_faso: "FCFA", guinee: "GNF", rdc: "USD", gabon: "FCFA", congo: "FCFA",
    togo: "FCFA", benin: "FCFA", maroc: "MAD", tunisie: "TND", algerie: "DZD",
    france: "EUR", belgique: "EUR", suisse: "CHF",
  } as Record<string, string>,

  baseEquipment: {
    less_50:  { washers: 1, dryers: 1, min: 1_500_000, max: 4_000_000 },
    "50_150": { washers: 2, dryers: 2, min: 4_000_000, max: 10_000_000 },
    more_150: { washers: 3, dryers: 3, min: 10_000_000, max: 25_000_000 },
  } as Record<string, { washers: number; dryers: number; min: number; max: number }>,

  typeMultiplier: { quartier: 0.7, semi_pro: 1.0, industriel: 1.8 } as Record<string, number>,

  monthly: {
    cameroun:     { rent: [150_000, 400_000], water: [30_000, 80_000],   electricity: [40_000, 120_000],  salaryPerEmp: [70_000, 120_000]  },
    senegal:      { rent: [200_000, 500_000], water: [35_000, 90_000],   electricity: [45_000, 130_000],  salaryPerEmp: [80_000, 130_000]  },
    cote_divoire: { rent: [250_000, 600_000], water: [40_000, 100_000],  electricity: [50_000, 140_000],  salaryPerEmp: [90_000, 150_000]  },
    france:       { rent: [800, 2000],        water: [80, 200],          electricity: [150, 400],          salaryPerEmp: [1_800, 2_200]     },
    belgique:     { rent: [900, 2200],        water: [90, 220],          electricity: [180, 450],          salaryPerEmp: [1_900, 2_400]     },
    maroc:        { rent: [3_000, 8_000],     water: [500, 1_500],       electricity: [800, 2_500],        salaryPerEmp: [3_000, 5_000]     },
    default:      { rent: [150_000, 500_000], water: [30_000, 100_000],  electricity: [40_000, 150_000],  salaryPerEmp: [70_000, 150_000]  },
  } as Record<string, { rent: number[]; water: number[]; electricity: number[]; salaryPerEmp: number[] }>,

  toFcfa: { EUR: 655, MAD: 65, TND: 200, GNF: 0.075, USD: 600, CHF: 720, DZD: 4.4, FCFA: 1 } as Record<string, number>,
};

async function generateAiReport(data: any) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const countryLabel = COUNTRY_META[data.country]?.label ?? data.country;

  const typeLabels: Record<string, string> = {
    quartier: "Pressing de quartier (petite clientèle locale)",
    semi_pro: "Semi-professionnel (50-150 kg/jour)",
    industriel: "Industriel (+150 kg/jour, hôtels/hôpitaux)",
  };
  const capacityLabels: Record<string, string> = {
    less_50: "Moins de 50 kg/jour",
    "50_150": "50 à 150 kg/jour",
    more_150: "Plus de 150 kg/jour",
  };
  const localLabels: Record<string, string> = { yes: "Disponible", no: "À trouver", searching: "En négociation" };
  const waterLabels: Record<string, string> = { yes: "Oui", sometimes: "Parfois", no: "Non" };
  const powerLabels: Record<string, string> = { yes: "Oui", sometimes: "Coupures fréquentes", no: "Instable" };
  const goalLabels: Record<string, string> = { primary: "Activité principale", secondary: "Activité complémentaire" };

  const prompt = `Tu es un expert-conseil senior spécialisé dans la création de pressings/blanchisseries professionnelles en Afrique francophone et Europe francophone, avec 15 ans d'expérience.

Un entrepreneur veut ouvrir un pressing :
- Localisation : ${data.city}, ${countryLabel}
- Type : ${typeLabels[data.pressingType] ?? data.pressingType}
- Capacité : ${capacityLabels[data.dailyCapacity] ?? data.dailyCapacity}
- Local : ${localLabels[data.hasLocalAlready] ?? "Non précisé"}
${data.localSurface ? `- Surface : ${data.localSurface} m²` : ""}
- Eau fiable : ${waterLabels[data.reliableWater] ?? "Non précisé"}
- Électricité stable : ${powerLabels[data.reliablePower] ?? "Non précisé"}
- Employés prévus : ${data.plannedEmployees ?? "Non précisé"}
- Capital disponible : ${data.availableCapital ?? "Non précisé"}
- Objectif : ${goalLabels[data.businessGoal] ?? "Non précisé"}

MISSION : Recherche sur internet les données actuelles pour ${data.city}, ${countryLabel} et génère une estimation DÉTAILLÉE et RÉALISTE.

Recherche spécifiquement :
1. Prix actuels machines à laver professionnelles (10-20 kg) disponibles dans ce pays
2. Prix sécheuses professionnelles disponibles dans ce pays
3. Coût moyen loyer commercial 50-100 m² dans cette ville
4. Tarifs électricité commerciale/industrielle dans ce pays
5. Coût et disponibilité générateur (si électricité instable)
6. Démarches et coûts légaux pour créer une entreprise dans ce pays
7. Prix pratiqués par les pressings existants dans cette ville (si trouvable)

Réponds UNIQUEMENT en JSON valide, aucun texte avant ou après :
{
  "summary": "résumé 2-3 phrases",
  "totalBudget": { "min": number, "max": number, "currency": "FCFA" },
  "breakdown": {
    "equipment": {
      "total": { "min": number, "max": number },
      "items": [{ "name": string, "quantity": number, "unitCost": { "min": number, "max": number }, "notes": string }]
    },
    "setup": {
      "total": { "min": number, "max": number },
      "items": [{ "name": string, "cost": { "min": number, "max": number }, "notes": string }]
    },
    "workingCapital": { "min": number, "max": number, "description": string },
    "administrative": {
      "total": { "min": number, "max": number },
      "items": [{ "name": string, "cost": { "min": number, "max": number }, "notes": string }]
    }
  },
  "monthlyCharges": {
    "total": { "min": number, "max": number },
    "items": [{ "category": string, "min": number, "max": number }]
  },
  "profitability": {
    "breakEvenKgPerMonth": number,
    "breakEvenRevenuePerMonth": { "min": number, "max": number },
    "estimatedRoiMonths": { "min": number, "max": number },
    "estimatedMonthlyRevenue": { "min": number, "max": number },
    "estimatedMonthlyProfit": { "min": number, "max": number },
    "estimatedMarginPct": { "min": number, "max": number }
  },
  "localInsights": {
    "averageRentSource": string,
    "electricityRate": string,
    "waterAvailability": string,
    "administrativeRequirements": [string],
    "marketContext": string
  },
  "risks": [string],
  "recommendations": [string],
  "nextSteps": [string],
  "sources": [string],
  "generatedAt": "${new Date().toISOString()}",
  "disclaimer": "Ces estimations sont basées sur des données collectées automatiquement et des moyennes sectorielles. Elles ne remplacent pas une étude de marché professionnelle."
}`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4000,
    tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  const clean = text.replace(/```json\n?|```\n?/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error("Échec de la génération du rapport IA");
  }
}

export function registerCalculatorRoutes(app: Express) {
  app.post("/api/calculator/quick-estimate", async (req, res) => {
    try {
      const { country, pressingType, dailyCapacity } = req.body;
      if (!country || !pressingType || !dailyCapacity) {
        return res.status(400).json({ message: "Paramètres manquants" });
      }

      const currency   = REFERENCE.currencies[country] ?? "FCFA";
      const multiplier = REFERENCE.typeMultiplier[pressingType] ?? 1;
      const equip      = REFERENCE.baseEquipment[dailyCapacity] ?? REFERENCE.baseEquipment["50_150"];
      const monthly    = REFERENCE.monthly[country] ?? REFERENCE.monthly.default;
      const toFcfa     = REFERENCE.toFcfa[currency] ?? 1;

      const equipMin = Math.round((equip.min * multiplier) / toFcfa);
      const equipMax = Math.round((equip.max * multiplier) / toFcfa);
      const setupMin = Math.round(equipMin * 0.25);
      const setupMax = Math.round(equipMax * 0.30);
      const workMin  = Math.round(equipMin * 0.15);
      const workMax  = Math.round(equipMax * 0.20);
      const adminMin = Math.round(50_000 / toFcfa);
      const adminMax = Math.round(300_000 / toFcfa);

      const defaultEmployees = ({ less_50: 1, "50_150": 2, more_150: 4 } as Record<string, number>)[dailyCapacity] ?? 2;
      const monthlyMin = monthly.rent[0] + monthly.water[0] + monthly.electricity[0] + monthly.salaryPerEmp[0] * defaultEmployees;
      const monthlyMax = monthly.rent[1] + monthly.water[1] + monthly.electricity[1] + monthly.salaryPerEmp[1] * defaultEmployees;

      const avgPricePerKg  = Math.round(800 / toFcfa);
      const breakEvenKgMin = Math.round(monthlyMin / (avgPricePerKg * 0.4));
      const breakEvenKgMax = Math.round(monthlyMax / (avgPricePerKg * 0.3));
      const roiMin = Math.round((equipMin + setupMin) / Math.max(1, (monthlyMax * 0.25)));
      const roiMax = Math.round((equipMax + setupMax) / Math.max(1, (monthlyMin * 0.15)));

      res.json({
        contactZone: getContactZone(country),
        currency,
        dialCode: COUNTRY_META[country]?.dialCode ?? "+237",
        minBudget: equipMin + setupMin + workMin + adminMin,
        maxBudget: equipMax + setupMax + workMax + adminMax,
        breakdownSummary: {
          equipment:      { min: equipMin, max: equipMax },
          setup:          { min: setupMin, max: setupMax },
          workingCapital: { min: workMin,  max: workMax  },
          administrative: { min: adminMin, max: adminMax },
        },
        monthlyCharges: { min: monthlyMin, max: monthlyMax },
        breakEvenKgPerMonth: { min: breakEvenKgMin, max: breakEvenKgMax },
        estimatedRoiMonths:  { min: Math.max(6, roiMin), max: Math.min(60, roiMax) },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/calculator/ai-report", async (req, res) => {
    try {
      const body = req.body;

      if (!body.whatsapp && !body.phone && !body.email) {
        return res.status(400).json({ message: "Un contact (WhatsApp, téléphone ou email) est requis" });
      }
      if (!body.firstName || !body.country || !body.city) {
        return res.status(400).json({ message: "Prénom, pays et ville sont requis" });
      }

      const identifier = body.whatsapp || body.email;
      if (identifier) {
        const recent = await db.select({ id: calculatorLeads.id })
          .from(calculatorLeads)
          .where(
            and(
              or(
                body.whatsapp ? eq(calculatorLeads.whatsapp, body.whatsapp) : sql`1=0`,
                body.email    ? eq(calculatorLeads.email,    body.email)    : sql`1=0`,
              ),
              gte(calculatorLeads.createdAt, new Date(Date.now() - 86_400_000))
            )
          );
        if (recent.length >= 3) {
          return res.status(429).json({ message: "Maximum 3 rapports par jour. Réessayez demain." });
        }
      }

      const contactZone = getContactZone(body.country);

      const [lead] = await db.insert(calculatorLeads).values({
        whatsapp:        body.whatsapp || null,
        phone:           body.phone    || null,
        email:           body.email    || null,
        firstName:       body.firstName,
        contactZone,
        country:         body.country,
        city:            body.city,
        pressingType:    body.pressingType,
        dailyCapacity:   body.dailyCapacity,
        hasLocalAlready: body.hasLocalAlready,
        localSurface:    body.localSurface,
        reliableWater:   body.reliableWater,
        reliablePower:   body.reliablePower,
        plannedEmployees:body.plannedEmployees,
        availableCapital:body.availableCapital,
        businessGoal:    body.businessGoal,
        utmSource:       body.utmSource,
        utmMedium:       body.utmMedium,
        utmCampaign:     body.utmCampaign,
      }).returning();

      const appUrl = process.env.APP_URL ?? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      const reportUrl = `${appUrl}/rapport/${lead.id}`;
      const countryLabel = COUNTRY_META[body.country]?.label ?? body.country;

      const report = await generateAiReport(body);

      await db.update(calculatorLeads).set({
        estimatedMinBudget:  report.totalBudget?.min,
        estimatedMaxBudget:  report.totalBudget?.max,
        currency:            report.totalBudget?.currency ?? "FCFA",
        aiReportJson:        JSON.stringify(report),
        aiReportGeneratedAt: new Date(),
        reportUrl,
      }).where(eq(calculatorLeads.id, lead.id));

      let whatsappSent = false;
      let clickToChatUrl: string | null = null;

      if (body.whatsapp) {
        whatsappSent = await sendReportViaWhatsApp({
          toWhatsApp:   body.whatsapp,
          firstName:    body.firstName,
          city:         body.city,
          countryLabel,
          minBudget:    report.totalBudget?.min ?? 0,
          maxBudget:    report.totalBudget?.max ?? 0,
          currency:     report.totalBudget?.currency ?? "FCFA",
          reportUrl,
        });

        if (!whatsappSent) {
          clickToChatUrl = getClickToChatUrl(body.firstName, body.city, countryLabel);
        }

        await db.update(calculatorLeads).set({
          whatsappSent,
          whatsappSentAt: whatsappSent ? new Date() : null,
        }).where(eq(calculatorLeads.id, lead.id));
      }

      res.json({ leadId: lead.id, reportUrl, report, whatsappSent, clickToChatUrl });
    } catch (err: any) {
      console.error("AI report error:", err);
      res.status(500).json({ message: err.message ?? "Erreur lors de la génération du rapport" });
    }
  });

  app.get("/api/calculator/report/:leadId", async (req, res) => {
    try {
      const [lead] = await db.select().from(calculatorLeads)
        .where(eq(calculatorLeads.id, parseInt(req.params.leadId)));
      if (!lead?.aiReportJson) return res.status(404).json({ message: "Rapport introuvable" });
      res.json({
        leadId: lead.id,
        firstName: lead.firstName,
        country: lead.country,
        city: lead.city,
        pressingType: lead.pressingType,
        report: JSON.parse(lead.aiReportJson),
        createdAt: lead.createdAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
