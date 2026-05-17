# PressFlow — Calculateur de Démarrage de Pressing
## Full Agent Implementation Prompt — 4-Page Flow, WhatsApp-First

---

## OVERVIEW & BUSINESS OBJECTIVE

Build a **4-page public calculator** at `/calculateur` that estimates the startup
cost of a laundry business for entrepreneurs in francophone Africa and Europe.

**Primary goal:** Capture phone/WhatsApp numbers as leads.
**Secondary goal:** Convert leads to PressFlow trials and training program signups.

**Lead capture strategy:**
- Contact information (name + phone + WhatsApp opt-in) is collected on PAGE 1
  BEFORE any business questions. A user who abandons after page 1 is still a lead.
- Pages 2 and 3 collect business context to personalize the AI report.
- Page 4 shows the AI-generated result with two CTAs:
  PDF download and direct WhatsApp contact with the expert.

**Key design principles:**
- In Sub-Saharan Africa, WhatsApp is the primary channel — email is optional
- Auto-save lead to database on page 1 submission, not on page 4
- Phone field adapts dial code based on country selected
- Pages 2 and 3 use tap-to-select cards that auto-advance — no "Next" button
- Progress bar visible on all 4 pages
- Session storage preserves form data if user navigates back or refreshes

**Stack:** React + TypeScript, Wouter routing, shadcn/ui, Tailwind CSS,
Express backend, PostgreSQL + Drizzle ORM, Anthropic Claude API with web search.

Install if not already present:
```bash
npm install @anthropic-ai/sdk twilio
```

Required environment variables:
```env
ANTHROPIC_API_KEY=sk-ant-...
TWILIO_ACCOUNT_SID=ACxxxxxxxxx          # optional — graceful fallback if missing
TWILIO_AUTH_TOKEN=xxxxxxxxxx            # optional
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  # optional
BUSINESS_WHATSAPP_NUMBER=237699000000   # your WhatsApp number, no + or spaces
APP_URL=https://pressflow.app           # used for shareable report links
```

If Twilio is not configured, the app falls back silently to a WhatsApp
click-to-chat link. No error is shown to the user.

---

## PART 1 — DATABASE SCHEMA

Add to Drizzle schema (`shared/schema.ts` or `server/db/schema.ts`):

```ts
export const calculatorLeads = pgTable("calculator_leads", {
  id: serial("id").primaryKey(),

  // ── Contact info — captured on page 1 ──
  firstName:   varchar("first_name", { length: 100 }).notNull(),
  lastName:    varchar("last_name", { length: 100 }),
  phone:       varchar("phone", { length: 50 }).notNull(),  // always required
  whatsapp:    varchar("whatsapp", { length: 50 }),         // same as phone if opt-in checked
  whatsappOptIn: boolean("whatsapp_opt_in").default(true),  // user confirmed number is WA
  email:       varchar("email", { length: 255 }),           // optional for Africa
  country:     varchar("country", { length: 100 }).notNull(),
  city:        varchar("city", { length: 100 }).notNull(),
  contactZone: varchar("contact_zone", { length: 20 }),
  // "africa" | "maghreb" | "europe"
  referralSource: varchar("referral_source", { length: 100 }),
  // "whatsapp_social" | "referral" | "google" | "other"

  // ── Business context — captured on pages 2 & 3 ──
  pressingType:  varchar("pressing_type", { length: 50 }),
  // "quartier" | "semi_pro" | "industriel"
  dailyCapacity: varchar("daily_capacity", { length: 50 }),
  // "less_50" | "50_150" | "more_150"

  // ── AI report results ──
  estimatedMinBudget: integer("estimated_min_budget"),
  estimatedMaxBudget: integer("estimated_max_budget"),
  currency:           varchar("currency", { length: 10 }).default("FCFA"),
  aiReportJson:       text("ai_report_json"),
  aiReportGeneratedAt: timestamp("ai_report_generated_at"),
  reportUrl:          varchar("report_url", { length: 500 }),
  pdfGeneratedAt:     timestamp("pdf_generated_at"),

  // ── Delivery tracking ──
  whatsappSent:   boolean("whatsapp_sent").default(false),
  whatsappSentAt: timestamp("whatsapp_sent_at"),

  // ── Conversion tracking ──
  convertedToTrial:    boolean("converted_to_trial").default(false),
  convertedToTraining: boolean("converted_to_training").default(false),
  expertContactedAt:   timestamp("expert_contacted_at"),
  // set when user clicks "Parler à un expert"

  // ── Attribution ──
  utmSource:   varchar("utm_source", { length: 100 }),
  utmMedium:   varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),

  // ── Completion tracking ──
  completedPage1: boolean("completed_page1").default(false),
  completedPage2: boolean("completed_page2").default(false),
  completedPage3: boolean("completed_page3").default(false),
  completedPage4: boolean("completed_page4").default(false),
  // This lets you see how many users abandoned at each step

  createdAt: timestamp("created_at").defaultNow(),
});
```

Run `npm run db:push` after adding the schema.

---

## PART 2 — SERVER UTILITIES

### `server/lib/calculator-config.ts`

```ts
export type ContactZone = "africa" | "maghreb" | "europe";

export const COUNTRY_ZONES: Record<string, ContactZone> = {
  cameroun: "africa", senegal: "africa", cote_divoire: "africa",
  mali: "africa", burkina_faso: "africa", guinee: "africa",
  rdc: "africa", gabon: "africa", congo: "africa",
  togo: "africa", benin: "africa", niger: "africa",
  tchad: "africa", centrafrique: "africa",
  maroc: "maghreb", tunisie: "maghreb", algerie: "maghreb",
  france: "europe", belgique: "europe", suisse: "europe",
};

export function getContactZone(countryKey: string): ContactZone {
  return COUNTRY_ZONES[countryKey] ?? "africa";
}

export interface CountryMeta {
  label: string;
  currency: string;
  cityPlaceholder: string;
  dialCode: string;
  dialCodeNumeric: string; // for pre-filling, e.g. "237"
}

export const COUNTRY_META: Record<string, CountryMeta> = {
  cameroun:     { label: "Cameroun",         currency: "FCFA", dialCode: "+237", dialCodeNumeric: "237", cityPlaceholder: "ex: Douala, Yaoundé, Bafoussam..." },
  senegal:      { label: "Sénégal",           currency: "FCFA", dialCode: "+221", dialCodeNumeric: "221", cityPlaceholder: "ex: Dakar, Thiès, Saint-Louis..." },
  cote_divoire: { label: "Côte d'Ivoire",     currency: "FCFA", dialCode: "+225", dialCodeNumeric: "225", cityPlaceholder: "ex: Abidjan, Bouaké, Yamoussoukro..." },
  mali:         { label: "Mali",              currency: "FCFA", dialCode: "+223", dialCodeNumeric: "223", cityPlaceholder: "ex: Bamako, Sikasso, Ségou..." },
  burkina_faso: { label: "Burkina Faso",      currency: "FCFA", dialCode: "+226", dialCodeNumeric: "226", cityPlaceholder: "ex: Ouagadougou, Bobo-Dioulasso..." },
  guinee:       { label: "Guinée",            currency: "GNF",  dialCode: "+224", dialCodeNumeric: "224", cityPlaceholder: "ex: Conakry, Kankan, Labé..." },
  rdc:          { label: "RD Congo",          currency: "USD",  dialCode: "+243", dialCodeNumeric: "243", cityPlaceholder: "ex: Kinshasa, Lubumbashi, Goma..." },
  gabon:        { label: "Gabon",             currency: "FCFA", dialCode: "+241", dialCodeNumeric: "241", cityPlaceholder: "ex: Libreville, Port-Gentil..." },
  congo:        { label: "Congo-Brazzaville", currency: "FCFA", dialCode: "+242", dialCodeNumeric: "242", cityPlaceholder: "ex: Brazzaville, Pointe-Noire..." },
  togo:         { label: "Togo",              currency: "FCFA", dialCode: "+228", dialCodeNumeric: "228", cityPlaceholder: "ex: Lomé, Kpalimé, Sokodé..." },
  benin:        { label: "Bénin",             currency: "FCFA", dialCode: "+229", dialCodeNumeric: "229", cityPlaceholder: "ex: Cotonou, Porto-Novo, Parakou..." },
  maroc:        { label: "Maroc",             currency: "MAD",  dialCode: "+212", dialCodeNumeric: "212", cityPlaceholder: "ex: Casablanca, Rabat, Marrakech..." },
  tunisie:      { label: "Tunisie",           currency: "TND",  dialCode: "+216", dialCodeNumeric: "216", cityPlaceholder: "ex: Tunis, Sfax, Sousse..." },
  algerie:      { label: "Algérie",           currency: "DZD",  dialCode: "+213", dialCodeNumeric: "213", cityPlaceholder: "ex: Alger, Oran, Constantine..." },
  france:       { label: "France",            currency: "EUR",  dialCode: "+33",  dialCodeNumeric: "33",  cityPlaceholder: "ex: Paris, Lyon, Marseille, Bordeaux..." },
  belgique:     { label: "Belgique",          currency: "EUR",  dialCode: "+32",  dialCodeNumeric: "32",  cityPlaceholder: "ex: Bruxelles, Liège, Anvers..." },
  suisse:       { label: "Suisse",            currency: "CHF",  dialCode: "+41",  dialCodeNumeric: "41",  cityPlaceholder: "ex: Genève, Lausanne, Zurich..." },
};

// Budget hint ranges shown on page 2 cards (in FCFA — converted for display)
export const TYPE_BUDGET_HINTS: Record<string, { min: string; max: string; machines: string }> = {
  quartier:   { min: "2M",  max: "6M",  machines: "1-2 machines" },
  semi_pro:   { min: "6M",  max: "20M", machines: "2-4 machines" },
  industriel: { min: "20M", max: "60M", machines: "4+ machines"  },
};

// Reference data for instant calculation (no AI needed)
export const REFERENCE = {
  baseEquipment: {
    less_50:  { min: 1_500_000, max: 4_000_000  },
    "50_150": { min: 4_000_000, max: 10_000_000 },
    more_150: { min: 10_000_000, max: 25_000_000 },
  },
  typeMultiplier: { quartier: 0.7, semi_pro: 1.0, industriel: 1.8 },
  defaultEmployees: { less_50: 1, "50_150": 2, more_150: 4 },
  monthly: {
    cameroun:     { rent:[150_000,400_000], water:[30_000,80_000],  elec:[40_000,120_000],  salary:[70_000,120_000]  },
    senegal:      { rent:[200_000,500_000], water:[35_000,90_000],  elec:[45_000,130_000],  salary:[80_000,130_000]  },
    cote_divoire: { rent:[250_000,600_000], water:[40_000,100_000], elec:[50_000,140_000],  salary:[90_000,150_000]  },
    mali:         { rent:[120_000,350_000], water:[25_000,70_000],  elec:[35_000,100_000],  salary:[60_000,100_000]  },
    burkina_faso: { rent:[100_000,300_000], water:[20_000,60_000],  elec:[30_000,90_000],   salary:[55_000,90_000]   },
    rdc:          { rent:[200_000,600_000], water:[30_000,100_000], elec:[50_000,150_000],  salary:[80_000,150_000]  },
    gabon:        { rent:[200_000,500_000], water:[40_000,100_000], elec:[60_000,150_000],  salary:[100_000,180_000] },
    maroc:        { rent:[3_000,8_000],     water:[500,1_500],      elec:[800,2_500],       salary:[3_000,5_000]     },
    france:       { rent:[800,2000],         water:[80,200],         elec:[150,400],         salary:[1_800,2_200]     },
    belgique:     { rent:[900,2200],         water:[90,220],         elec:[180,450],         salary:[1_900,2_400]     },
    default:      { rent:[150_000,500_000], water:[30_000,100_000], elec:[40_000,150_000],  salary:[70_000,150_000]  },
  },
  toFcfa: { FCFA:1, EUR:655, MAD:65, TND:200, GNF:0.075, USD:600, CHF:720, DZD:4.4 },
};
```

### `server/lib/whatsapp-service.ts`

```ts
import twilio from "twilio";

const hasTwilio = !!(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_WHATSAPP_FROM
);

const client = hasTwilio
  ? twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  : null;

export async function sendReportViaWhatsApp(params: {
  toWhatsApp: string;
  firstName: string;
  city: string;
  countryLabel: string;
  minBudget: number;
  maxBudget: number;
  currency: string;
  reportUrl: string;
}): Promise<boolean> {
  if (!client) return false;
  const { toWhatsApp, firstName, city, countryLabel, minBudget, maxBudget, currency, reportUrl } = params;
  const fmt = (n: number) => n.toLocaleString("fr-FR");

  const body =
    `Bonjour ${firstName} 👋\n\n` +
    `Votre estimation pressing est prête !\n\n` +
    `📍 *${city}, ${countryLabel}*\n` +
    `💰 *Budget estimé : ${fmt(minBudget)} — ${fmt(maxBudget)} ${currency}*\n\n` +
    `Votre rapport complet inclut :\n` +
    `✅ Détail des coûts par poste\n` +
    `✅ Analyse de rentabilité\n` +
    `✅ Seuil de rentabilité\n` +
    `✅ Démarches administratives\n` +
    `✅ Recommandations personnalisées\n\n` +
    `👉 Rapport complet ici :\n${reportUrl}\n\n` +
    `Répondez à ce message si vous souhaitez être accompagné(e) dans votre projet.\n\n` +
    `_PressFlow · Logiciel de gestion de pressing pour l'Afrique_`;

  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to: `whatsapp:${toWhatsApp}`,
      body,
    });
    return true;
  } catch (err: any) {
    console.error("WhatsApp send failed:", err.message);
    return false;
  }
}

// Pre-filled click-to-chat message for "Parler à un expert" button
// Opens the BUSINESS owner's WhatsApp with context already filled in
export function getExpertContactUrl(params: {
  firstName: string;
  lastName?: string;
  city: string;
  countryLabel: string;
  pressingType: string;
  minBudget: number;
  maxBudget: number;
  currency: string;
}): string {
  const typeLabels: Record<string, string> = {
    quartier:   "pressing de quartier",
    semi_pro:   "pressing semi-professionnel",
    industriel: "pressing industriel",
  };
  const typeLabel = typeLabels[params.pressingType] ?? params.pressingType;
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  const businessNumber = process.env.BUSINESS_WHATSAPP_NUMBER ?? "237699000000";

  const message = encodeURIComponent(
    `Bonjour, je m'appelle ${params.firstName}${params.lastName ? " " + params.lastName : ""}. ` +
    `Je viens d'estimer mon budget pour un ${typeLabel} à ${params.city}, ${params.countryLabel}. ` +
    `Mon estimation est de ${fmt(params.minBudget)} — ${fmt(params.maxBudget)} ${params.currency}. ` +
    `Je souhaite être accompagné(e) dans mon projet.`
  );

  return `https://wa.me/${businessNumber}?text=${message}`;
}

// Fallback: click-to-chat to receive report (when Twilio not configured)
export function getReportClickToChatUrl(firstName: string, city: string, countryLabel: string): string {
  const businessNumber = process.env.BUSINESS_WHATSAPP_NUMBER ?? "237699000000";
  const message = encodeURIComponent(
    `Bonjour, je m'appelle ${firstName}. ` +
    `Je viens de calculer mon budget pressing pour ${city}, ${countryLabel} sur PressFlow. ` +
    `Pouvez-vous m'envoyer mon rapport ?`
  );
  return `https://wa.me/${businessNumber}?text=${message}`;
}
```

---

## PART 3 — BACKEND API ROUTES

Add all routes to Express. No authentication required.

### POST `/api/calculator/save-lead` — Called after page 1

Save lead immediately on page 1 completion, before AI generation.
Returns a `leadId` stored in session/localStorage for subsequent pages.

```ts
app.post("/api/calculator/save-lead", async (req, res) => {
  const { firstName, lastName, phone, whatsappOptIn, email,
          country, city, referralSource, utmSource, utmMedium, utmCampaign } = req.body;

  if (!firstName || !phone || !country || !city) {
    return res.status(400).json({ message: "Prénom, téléphone, pays et ville sont requis" });
  }

  const contactZone = getContactZone(country);
  const countryMeta = COUNTRY_META[country];
  const dialCode    = countryMeta?.dialCodeNumeric ?? "";

  // Normalize phone: ensure it starts with dial code
  const normalizedPhone = phone.startsWith(dialCode) ? phone : dialCode + phone.replace(/^0/, "");
  const whatsapp = whatsappOptIn ? normalizedPhone : null;

  const [lead] = await db.insert(calculatorLeads).values({
    firstName, lastName: lastName || null,
    phone: normalizedPhone,
    whatsapp,
    whatsappOptIn: whatsappOptIn ?? true,
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
});
```

### PATCH `/api/calculator/update-lead/:leadId` — Called after pages 2 and 3

```ts
app.patch("/api/calculator/update-lead/:leadId", async (req, res) => {
  const { pressingType, dailyCapacity, completedPage } = req.body;
  const leadId = parseInt(req.params.leadId);

  const updates: any = {};
  if (pressingType)  { updates.pressingType  = pressingType;  }
  if (dailyCapacity) { updates.dailyCapacity = dailyCapacity; }
  if (completedPage === 2) updates.completedPage2 = true;
  if (completedPage === 3) updates.completedPage3 = true;

  await db.update(calculatorLeads).set(updates)
    .where(eq(calculatorLeads.id, leadId));

  res.json({ success: true });
});
```

### POST `/api/calculator/generate-report/:leadId` — Called on page 4

Generates the AI report for an existing lead.

```ts
app.post("/api/calculator/generate-report/:leadId", async (req, res) => {
  const leadId = parseInt(req.params.leadId);

  // Fetch the lead
  const [lead] = await db.select().from(calculatorLeads)
    .where(eq(calculatorLeads.id, leadId));

  if (!lead) return res.status(404).json({ message: "Session introuvable" });
  if (!lead.pressingType || !lead.dailyCapacity) {
    return res.status(400).json({ message: "Type et capacité requis" });
  }

  // Rate limit: max 3 reports per phone per 24h
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

  const reportUrl  = `${process.env.APP_URL ?? "https://pressflow.app"}/rapport/${leadId}`;
  const countryMeta = COUNTRY_META[lead.country];
  const countryLabel = countryMeta?.label ?? lead.country;

  // Generate AI report
  const report = await generateAiReport({
    country:      lead.country,
    city:         lead.city,
    pressingType: lead.pressingType,
    dailyCapacity:lead.dailyCapacity,
    countryLabel,
  });

  // Update lead
  await db.update(calculatorLeads).set({
    estimatedMinBudget:  report.totalBudget.min,
    estimatedMaxBudget:  report.totalBudget.max,
    currency:            report.totalBudget.currency,
    aiReportJson:        JSON.stringify(report),
    aiReportGeneratedAt: new Date(),
    reportUrl,
    completedPage4:      true,
  }).where(eq(calculatorLeads.id, leadId));

  // Send WhatsApp if opt-in
  let whatsappSent   = false;
  let clickToChatUrl: string | null = null;

  if (lead.whatsapp && lead.whatsappOptIn) {
    whatsappSent = await sendReportViaWhatsApp({
      toWhatsApp:   lead.whatsapp,
      firstName:    lead.firstName,
      city:         lead.city,
      countryLabel,
      minBudget:    report.totalBudget.min,
      maxBudget:    report.totalBudget.max,
      currency:     report.totalBudget.currency,
      reportUrl,
    });

    if (!whatsappSent) {
      clickToChatUrl = getReportClickToChatUrl(lead.firstName, lead.city, countryLabel);
    }

    await db.update(calculatorLeads).set({
      whatsappSent,
      whatsappSentAt: whatsappSent ? new Date() : null,
    }).where(eq(calculatorLeads.id, leadId));
  }

  // Build expert contact URL
  const expertUrl = getExpertContactUrl({
    firstName:    lead.firstName,
    lastName:     lead.lastName ?? undefined,
    city:         lead.city,
    countryLabel,
    pressingType: lead.pressingType,
    minBudget:    report.totalBudget.min,
    maxBudget:    report.totalBudget.max,
    currency:     report.totalBudget.currency,
  });

  res.json({ leadId, reportUrl, report, whatsappSent, clickToChatUrl, expertUrl });
});
```

### POST `/api/calculator/track-expert-contact/:leadId`

Called when the user clicks "Parler à un expert" to track the conversion:

```ts
app.post("/api/calculator/track-expert-contact/:leadId", async (req, res) => {
  await db.update(calculatorLeads).set({ expertContactedAt: new Date() })
    .where(eq(calculatorLeads.id, parseInt(req.params.leadId)));
  res.json({ success: true });
});
```

### GET `/api/calculator/report/:leadId` — Public report page

```ts
app.get("/api/calculator/report/:leadId", async (req, res) => {
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
    expertUrl:    getExpertContactUrl({
      firstName:    lead.firstName,
      lastName:     lead.lastName ?? undefined,
      city:         lead.city,
      countryLabel,
      pressingType: lead.pressingType!,
      minBudget:    lead.estimatedMinBudget!,
      maxBudget:    lead.estimatedMaxBudget!,
      currency:     lead.currency!,
    }),
  });
});
```

### `generateAiReport` function

```ts
async function generateAiReport(data: {
  country: string; city: string; pressingType: string;
  dailyCapacity: string; countryLabel: string;
}) {
  const Anthropic  = (await import("@anthropic-ai/sdk")).default;
  const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    `Recherche sur internet les données actuelles pour ${data.city}, ${data.countryLabel} :\n` +
    `1. Prix machines à laver professionnelles (10-20 kg) disponibles dans ce pays\n` +
    `2. Prix sécheuses professionnelles disponibles dans ce pays\n` +
    `3. Coût moyen loyer commercial 50-100m² dans cette ville\n` +
    `4. Tarifs électricité commerciale dans ce pays\n` +
    `5. Coût et disponibilité générateur (si pays à coupures fréquentes)\n` +
    `6. Démarches et coûts légaux pour créer une entreprise dans ce pays\n` +
    `7. Prix pratiqués par les pressings dans cette ville\n\n` +
    `Réponds UNIQUEMENT en JSON valide sans texte avant ou après :\n` +
    `{\n` +
    `  "summary": "résumé 2-3 phrases personnalisé pour ${data.city}",\n` +
    `  "totalBudget": { "min": number, "max": number, "currency": "FCFA" },\n` +
    `  "breakdown": {\n` +
    `    "equipment": {\n` +
    `      "total": { "min": number, "max": number },\n` +
    `      "items": [{ "name": string, "quantity": number, "unitCost": { "min": number, "max": number }, "notes": string }]\n` +
    `    },\n` +
    `    "setup": {\n` +
    `      "total": { "min": number, "max": number },\n` +
    `      "items": [{ "name": string, "cost": { "min": number, "max": number }, "notes": string }]\n` +
    `    },\n` +
    `    "workingCapital": { "min": number, "max": number, "description": string },\n` +
    `    "administrative": {\n` +
    `      "total": { "min": number, "max": number },\n` +
    `      "items": [{ "name": string, "cost": { "min": number, "max": number }, "notes": string }]\n` +
    `    }\n` +
    `  },\n` +
    `  "monthlyCharges": {\n` +
    `    "total": { "min": number, "max": number },\n` +
    `    "items": [{ "category": string, "min": number, "max": number }]\n` +
    `  },\n` +
    `  "profitability": {\n` +
    `    "breakEvenKgPerMonth": number,\n` +
    `    "estimatedRoiMonths": { "min": number, "max": number },\n` +
    `    "estimatedMonthlyRevenue": { "min": number, "max": number },\n` +
    `    "estimatedMonthlyProfit": { "min": number, "max": number },\n` +
    `    "estimatedMarginPct": { "min": number, "max": number }\n` +
    `  },\n` +
    `  "localInsights": {\n` +
    `    "rentContext": string,\n` +
    `    "electricityContext": string,\n` +
    `    "administrativeSteps": [string],\n` +
    `    "marketContext": string\n` +
    `  },\n` +
    `  "risks": [string],\n` +
    `  "recommendations": [string],\n` +
    `  "nextSteps": [string],\n` +
    `  "sources": [string],\n` +
    `  "generatedAt": "${new Date().toISOString()}",\n` +
    `  "disclaimer": "Ces estimations sont basées sur des données collectées automatiquement et des moyennes sectorielles. Elles ne remplacent pas une étude de marché professionnelle."\n` +
    `}`;

  const response = await anthropic.messages.create({
    model:      "claude-sonnet-4-20250514",
    max_tokens: 4000,
    tools:      [{ type: "web_search_20250305" as any, name: "web_search" }],
    messages:   [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter(b => b.type === "text")
    .map(b => (b as any).text)
    .join("");

  const clean = text.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(clean);
}
```

---

## PART 4 — FRONTEND: CALCULATOR PAGE

Create `client/src/pages/calculator.tsx`.

### 4.1 — State & session persistence

```tsx
const SESSION_KEY = "pressflow_calc";

// On mount: restore any saved state from sessionStorage
const saved = sessionStorage.getItem(SESSION_KEY);
const initial = saved ? JSON.parse(saved) : null;

const [step, setStep]         = useState<1|2|3|4>(initial?.step ?? 1);
const [leadId, setLeadId]     = useState<number|null>(initial?.leadId ?? null);
const [contactZone, setContactZone] = useState<string>(initial?.contactZone ?? "africa");
const [currency, setCurrency] = useState<string>(initial?.currency ?? "FCFA");
const [form, setForm]         = useState({
  firstName: "", lastName: "", country: "", city: "",
  phone: "", whatsappOptIn: true, email: "",
  referralSource: "",
  pressingType: "",
  dailyCapacity: "",
  ...initial?.form,
});
const [result, setResult]     = useState<any>(initial?.result ?? null);
const [isGenerating, setIsGenerating] = useState(false);
const [currentLoadingMsg, setCurrentLoadingMsg] = useState(0);

// Save to sessionStorage on every state change
useEffect(() => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    step, leadId, contactZone, currency, form, result
  }));
}, [step, leadId, contactZone, currency, form, result]);
```

### 4.2 — Progress bar (shown on all 4 steps)

```tsx
function ProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full max-w-lg mx-auto mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">Étape {step} sur 4</span>
        <span className="text-xs text-muted-foreground">{Math.round((step/4)*100)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>
      {/* Step labels */}
      <div className="flex justify-between mt-2">
        {["Vos coordonnées", "Type", "Capacité", "Résultat"].map((label, i) => (
          <span key={i} className={cn(
            "text-[10px] font-medium",
            i + 1 <= step ? "text-primary" : "text-muted-foreground/50"
          )}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
```

### 4.3 — PAGE 1: "Parlez-nous de vous"

```tsx
function Page1({ form, setForm, onSubmit, isLoading }) {
  const selectedMeta = COUNTRY_META[form.country];
  const dialCode     = selectedMeta?.dialCode ?? "+237";

  // Countries grouped for the select
  const countryGroups = [
    { label: "Afrique Centrale",   keys: ["cameroun","gabon","congo","rdc","tchad","centrafrique"] },
    { label: "Afrique de l'Ouest", keys: ["senegal","cote_divoire","mali","burkina_faso","guinee","togo","benin","niger"] },
    { label: "Afrique du Nord",    keys: ["maroc","tunisie","algerie"] },
    { label: "Europe",             keys: ["france","belgique","suisse"] },
  ];

  return (
    <div className="w-full max-w-lg mx-auto space-y-5">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Parlez-nous de vous</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pour personnaliser votre estimation selon votre marché local
        </p>
      </div>

      {/* First name + Last name — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prénom *</Label>
          <Input
            value={form.firstName}
            onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
            placeholder="Jean"
            className="mt-1"
            autoFocus
          />
        </div>
        <div>
          <Label>Nom *</Label>
          <Input
            value={form.lastName}
            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
            placeholder="Dupont"
            className="mt-1"
          />
        </div>
      </div>

      {/* Country */}
      <div>
        <Label>Pays *</Label>
        <Select
          value={form.country}
          onValueChange={v => setForm(f => ({ ...f, country: v, phone: "", city: "" }))}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Sélectionnez votre pays" />
          </SelectTrigger>
          <SelectContent>
            {countryGroups.map(group => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.keys.map(key => (
                  COUNTRY_META[key] && (
                    <SelectItem key={key} value={key}>
                      {COUNTRY_META[key].label}
                    </SelectItem>
                  )
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* City */}
      <div>
        <Label>Ville *</Label>
        <Input
          value={form.city}
          onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
          placeholder={selectedMeta?.cityPlaceholder ?? "Votre ville..."}
          className="mt-1"
          disabled={!form.country}
        />
      </div>

      {/* Phone — LAST field (progressive commitment) */}
      <div>
        <Label>
          Numéro de téléphone *
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            Pour recevoir votre rapport
          </span>
        </Label>
        <div className="flex gap-2 mt-1">
          {/* Dial code badge — auto-updates with country */}
          <div className="flex items-center justify-center px-3 min-w-[60px] bg-muted
            border border-border rounded-lg text-sm font-semibold text-muted-foreground
            flex-shrink-0">
            {dialCode}
          </div>
          <Input
            type="tel"
            value={form.phoneLocal}
            onChange={e => {
              const local = e.target.value.replace(/\D/g, "");
              setForm(f => ({
                ...f,
                phoneLocal: local,
                phone: selectedMeta?.dialCodeNumeric
                  ? selectedMeta.dialCodeNumeric + local
                  : local,
                // If WhatsApp opt-in, keep whatsapp in sync
                ...(f.whatsappOptIn ? {
                  whatsapp: selectedMeta?.dialCodeNumeric
                    ? selectedMeta.dialCodeNumeric + local
                    : local
                } : {})
              }));
            }}
            placeholder="6XX XXX XXX"
            className="flex-1"
            disabled={!form.country}
          />
        </div>

        {/* WhatsApp opt-in checkbox — immediately below phone field */}
        <label className="flex items-center gap-2.5 mt-3 cursor-pointer group">
          <div
            onClick={() => setForm(f => ({
              ...f,
              whatsappOptIn: !f.whatsappOptIn,
              whatsapp: !f.whatsappOptIn ? f.phone : null,
            }))}
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
              form.whatsappOptIn
                ? "bg-green-500 border-green-500"
                : "border-muted-foreground bg-background"
            )}
          >
            {form.whatsappOptIn && (
              <svg viewBox="0 0 12 12" className="w-3 h-3 fill-white">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2"
                  fill="none" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <span className="text-sm text-foreground group-hover:text-primary transition-colors">
            Ce numéro est mon WhatsApp — envoyer mon rapport ici
          </span>
          {/* WhatsApp logo inline */}
          <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 fill-green-500">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </label>
      </div>

      {/* Referral source — optional, last field */}
      <div>
        <Label className="flex items-center gap-2">
          Comment avez-vous entendu parler de nous ?
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            optionnel
          </span>
        </Label>
        <Select
          value={form.referralSource}
          onValueChange={v => setForm(f => ({ ...f, referralSource: v }))}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp_social">WhatsApp / Réseaux sociaux</SelectItem>
            <SelectItem value="referral">Recommandation d'un ami</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="other">Autre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Privacy note */}
      <p className="text-xs text-muted-foreground text-center">
        🔒 Vos données sont protégées et ne seront jamais partagées.
        Répondez STOP pour vous désinscrire à tout moment.
      </p>

      {/* CTA button */}
      <Button
        size="lg"
        className="w-full"
        disabled={!form.firstName || !form.lastName || !form.country || !form.city || !form.phone || isLoading}
        onClick={onSubmit}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Enregistrement...
          </span>
        ) : (
          "Continuer →"
        )}
      </Button>
    </div>
  );
}
```

### 4.4 — PAGE 2: "Votre type de pressing"

Visual tap-to-select cards. Selecting one AUTOMATICALLY advances to page 3.
No "Next" button.

```tsx
function Page2({ form, setForm, onSelect }) {
  const options = [
    {
      value: "quartier",
      emoji: "🏠",
      title: "Pressing de quartier",
      description: "Clientèle locale et résidentielle",
      machines: "1 à 2 machines",
      budgetHint: "2M – 6M FCFA",
      examples: "Particuliers, familles du quartier",
    },
    {
      value: "semi_pro",
      emoji: "🏢",
      title: "Semi-professionnel",
      description: "Entreprises et particuliers, volume moyen",
      machines: "2 à 4 machines",
      budgetHint: "6M – 20M FCFA",
      examples: "PME, restaurants, boutiques",
    },
    {
      value: "industriel",
      emoji: "🏭",
      title: "Industriel",
      description: "Gros volumes, clients institutionnels",
      machines: "4 machines et plus",
      budgetHint: "20M – 60M FCFA",
      examples: "Hôtels, hôpitaux, blanchisseries",
    },
  ];

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Votre type de pressing</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Sélectionnez le format qui correspond à votre projet
        </p>
      </div>

      <div className="space-y-3">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "w-full text-left p-5 rounded-2xl border-2 transition-all duration-150",
              "hover:border-primary hover:shadow-md hover:shadow-primary/10",
              "active:scale-[0.99]",
              form.pressingType === opt.value
                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl flex-shrink-0">{opt.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-base">{opt.title}</p>
                  <span className="text-xs font-bold text-primary bg-primary/10
                    px-2 py-1 rounded-lg flex-shrink-0">
                    {opt.budgetHint}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{opt.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground bg-muted
                    px-2 py-0.5 rounded-full">
                    {opt.machines}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {opt.examples}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Appuyez sur une option pour continuer automatiquement
      </p>
    </div>
  );
}
```

### 4.5 — PAGE 3: "Capacité journalière"

Same tap-to-select pattern, auto-advances to page 4 (triggers AI generation).

```tsx
function Page3({ form, pressingType, onSelect }) {
  const options = [
    {
      value: "less_50",
      emoji: "🌱",
      title: "Moins de 50 kg / jour",
      description: "Idéal pour démarrer et tester le marché",
      detail: "Environ 6 à 10 clients par jour",
      tip: null,
    },
    {
      value: "50_150",
      emoji: "📈",
      title: "50 à 150 kg / jour",
      description: "Activité soutenue, clientèle mixte",
      detail: "Environ 10 à 30 clients par jour",
      tip: null,
    },
    {
      value: "more_150",
      emoji: "🏆",
      title: "Plus de 150 kg / jour",
      description: "Volume industriel, contrats entreprises",
      detail: "Hôtels, hôpitaux, blanchisseries en gros",
      tip: null,
    },
  ];

  // Consistency check: warn if type and capacity seem mismatched
  const showInconsistencyWarning =
    (pressingType === "quartier"   && form.dailyCapacity === "more_150") ||
    (pressingType === "industriel" && form.dailyCapacity === "less_50");

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Capacité journalière cible</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Combien de kg souhaitez-vous traiter par jour ?
        </p>
      </div>

      {/* Helpful context for first-timers */}
      <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 mb-5">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Comment estimer ?</strong> Une famille produit environ 5 à 8 kg de
          linge par semaine. Un pressing de quartier traite en moyenne 20 à 40 kg/jour
          au démarrage. Un hôtel de 50 chambres génère environ 80 à 120 kg/jour.
        </p>
      </div>

      <div className="space-y-3">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "w-full text-left p-5 rounded-2xl border-2 transition-all duration-150",
              "hover:border-primary hover:shadow-md hover:shadow-primary/10",
              "active:scale-[0.99]",
              form.dailyCapacity === opt.value
                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl flex-shrink-0">{opt.emoji}</span>
              <div>
                <p className="font-bold text-base">{opt.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{opt.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{opt.detail}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Soft inconsistency warning — non-blocking */}
      {showInconsistencyWarning && (
        <div className="mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20
          border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <span className="text-amber-500 flex-shrink-0 mt-0.5">ℹ️</span>
          <p className="text-xs text-amber-800 dark:text-amber-400">
            Cette capacité est inhabituelle pour un {pressingType === "quartier"
              ? "pressing de quartier" : "pressing industriel"}.
            Vous pouvez continuer ou revenir modifier votre type de pressing.
          </p>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground mt-4">
        Appuyez sur une option pour lancer le calcul
      </p>
    </div>
  );
}
```

### 4.6 — PAGE 4: AI Result

This is the conversion page. Shown while AI generates and after result arrives.

**Loading state (shown while waiting for AI, ~20-40 seconds):**

```tsx
function LoadingState({ city, messages, currentMsg }) {
  return (
    <div className="w-full max-w-lg mx-auto text-center">
      {/* Animated icon */}
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center
        justify-center mx-auto mb-6">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent
          rounded-full animate-spin" />
      </div>

      <h3 className="text-xl font-bold mb-2">
        L'IA analyse votre marché...
      </h3>
      <p className="text-sm text-muted-foreground mb-8">
        Recherche des données actuelles pour {city}
      </p>

      {/* Progress messages */}
      <div className="space-y-2 text-left max-w-sm mx-auto">
        {messages.map((msg: string, i: number) => (
          <div key={i} className={cn(
            "flex items-center gap-3 text-sm transition-all duration-300",
            i < currentMsg  ? "text-green-600 dark:text-green-400" : "",
            i === currentMsg? "text-foreground font-medium" : "",
            i > currentMsg  ? "text-muted-foreground/40" : "",
          )}>
            {i < currentMsg ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : i === currentMsg ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-muted-foreground/30 flex-shrink-0" />
            )}
            <span>{msg}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Cela peut prendre 20 à 40 secondes...
      </p>
    </div>
  );
}

const LOADING_MESSAGES = (city: string, countryLabel: string) => [
  `Recherche des prix d'équipements à ${city}...`,
  `Analyse des loyers commerciaux disponibles...`,
  `Vérification des tarifs eau et électricité...`,
  `Calcul des démarches administratives pour ${countryLabel}...`,
  `Analyse du marché pressing local...`,
  `Calcul de votre seuil de rentabilité...`,
  `Rédaction de vos recommandations...`,
  `Finalisation de votre rapport...`,
];
```

**Result state (after AI returns):**

```tsx
function ResultPage({ report, lead, result, onExpertContact }) {
  const { firstName, city, country, pressingType } = lead;
  const countryLabel = COUNTRY_META[country]?.label ?? country;
  const currency     = report.totalBudget.currency;
  const fmt          = (n: number) => n.toLocaleString("fr-FR");
  const [showDetail, setShowDetail] = useState(false);

  const typeLabel: Record<string, string> = {
    quartier:   "pressing de quartier",
    semi_pro:   "pressing semi-professionnel",
    industriel: "pressing industriel",
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">

      {/* ── WhatsApp sent confirmation ── */}
      {result.whatsappSent && (
        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20
          border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-400">
              Rapport envoyé sur WhatsApp ✓
            </p>
            <p className="text-xs text-green-700 dark:text-green-500">
              Vérifiez vos messages. Vous recevrez des conseils personnalisés
              dans les prochains jours.
            </p>
          </div>
        </div>
      )}

      {/* ── Click-to-chat fallback ── */}
      {result.clickToChatUrl && (
        <div className="flex items-center gap-3 bg-muted/50 border border-border
          rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center
            justify-center flex-shrink-0">
            {/* WhatsApp SVG */}
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Recevoir ce rapport sur WhatsApp</p>
            <p className="text-xs text-muted-foreground">Cliquez pour nous envoyer un message</p>
          </div>
          <a href={result.clickToChatUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white">
              Ouvrir
            </Button>
          </a>
        </div>
      )}

      {/* ── HERO: Personal greeting + main number ── */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white
        rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 rounded-2xl" />
        <div className="relative">
          <p className="text-white/80 text-sm mb-1">
            Bonjour {firstName} 👋
          </p>
          <h2 className="text-xl font-bold mb-1">
            Votre estimation pour un {typeLabel[pressingType] ?? pressingType}
          </h2>
          <p className="text-white/70 text-sm mb-5">
            📍 {city}, {countryLabel}
          </p>

          {/* THE BIG NUMBER */}
          <p className="text-xs font-medium text-white/70 uppercase tracking-wide mb-1">
            Budget de démarrage estimé
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black">
              {fmt(report.totalBudget.min)}
            </span>
            <span className="text-2xl text-white/60">—</span>
            <span className="text-4xl font-black">
              {fmt(report.totalBudget.max)}
            </span>
            <span className="text-xl text-white/70">{currency}</span>
          </div>

          {/* 3 KPI pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
              📦 Équipements : {fmt(report.breakdown.equipment.total.min)}
              {" — "}{fmt(report.breakdown.equipment.total.max)} {currency}
            </div>
            <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
              📅 Retour invest. : {report.profitability.estimatedRoiMonths.min}
              {" — "}{report.profitability.estimatedRoiMonths.max} mois
            </div>
            <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
              📊 Marge estimée : {report.profitability.estimatedMarginPct.min}
              {" — "}{report.profitability.estimatedMarginPct.max}%
            </div>
          </div>
        </div>
      </div>

      {/* ── THE TWO CTAs — PRIMARY ACTION SECTION ── */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* PDF download */}
        <Button
          variant="outline"
          size="lg"
          className="h-14 gap-3 text-base"
          onClick={() => {
            // Trigger print to PDF
            window.print();
          }}
        >
          <Download className="w-5 h-5" />
          <div className="text-left">
            <div className="font-semibold text-sm">Télécharger le rapport</div>
            <div className="text-xs text-muted-foreground">Format PDF</div>
          </div>
        </Button>

        {/* WhatsApp expert — PRIMARY, more prominent */}
        <a
          href={result.expertUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            // Track expert contact
            fetch(`/api/calculator/track-expert-contact/${result.leadId}`, { method: "POST" });
          }}
        >
          <Button
            size="lg"
            className="w-full h-14 gap-3 text-base bg-green-600 hover:bg-green-700
              shadow-lg shadow-green-600/25"
          >
            {/* WhatsApp icon */}
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white flex-shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <div className="text-left">
              <div className="font-semibold text-sm">Parler à un expert</div>
              <div className="text-xs text-white/80">Réponse WhatsApp rapide</div>
            </div>
          </Button>
        </a>
      </div>

      {/* ── TRUST SIGNALS — below the CTAs ── */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4
        text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-green-500" />
          <span>Réponse généralement en moins de 2 heures</span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span>+5 ans d'expérience · Plus de 20 entrepreneurs accompagnés à travers l'Afrique</span>
        </div>
      </div>

      {/* ── DETAIL ACCORDION ── */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDetail(!showDetail)}
          className="w-full flex items-center justify-between px-5 py-4
            hover:bg-muted/30 transition-colors"
        >
          <span className="font-semibold text-sm">Voir le détail complet de l'estimation</span>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            showDetail && "rotate-180"
          )} />
        </button>

        {showDetail && (
          <div className="px-5 pb-5 space-y-5 border-t border-border">
            {/* Equipment */}
            <DetailSection title="Équipements" icon="⚙️" data={report.breakdown.equipment} currency={currency} />
            {/* Setup */}
            <DetailSection title="Aménagement & Installation" icon="🔨" data={report.breakdown.setup} currency={currency} />
            {/* Admin */}
            <DetailSection title="Démarches administratives" icon="📋" data={report.breakdown.administrative} currency={currency} />
            {/* Monthly charges */}
            <MonthlyChargesSection data={report.monthlyCharges} currency={currency} />
            {/* Profitability */}
            <ProfitabilitySection data={report.profitability} currency={currency} />
            {/* Local insights */}
            <LocalInsightsSection data={report.localInsights} city={city} countryLabel={countryLabel} />
            {/* Risks */}
            {report.risks?.length > 0 && (
              <div>
                <p className="font-semibold text-sm mb-2">⚠️ Points de vigilance</p>
                <ul className="space-y-1">
                  {report.risks.map((r: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="flex-shrink-0">•</span><span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Recommendations */}
            {report.recommendations?.length > 0 && (
              <div>
                <p className="font-semibold text-sm mb-2">✅ Recommandations</p>
                <ul className="space-y-1">
                  {report.recommendations.map((r: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="flex-shrink-0">•</span><span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── PRESSFLOW TRIAL CTA — soft, at the bottom ── */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900
        dark:to-blue-950 border border-border rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center
            justify-center flex-shrink-0 shadow-lg shadow-primary/20">
            {/* Waves icon */}
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-none stroke-white stroke-2">
              <path d="M2 12 C5 9, 8 15, 12 12 C16 9, 19 15, 22 12" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-base mb-1">
              Prêt à ouvrir votre pressing ?
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              PressFlow vous aide à gérer chaque commande, chaque paiement et
              votre rentabilité — conçu pour les pressings africains.
            </p>
            {/* Free trial offer */}
            <div className="bg-white dark:bg-slate-800 border border-border
              rounded-xl px-4 py-3 mb-3">
              <p className="text-sm font-semibold text-primary">
                🎁 30 jours gratuits <span className="text-muted-foreground font-normal">OU</span> vos 50 premières commandes
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                selon ce qui dure le plus longtemps
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sans carte bancaire
                </span>
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sans engagement
                </span>
              </div>
            </div>
            <Button className="w-full sm:w-auto" asChild>
              <a href="/register">Démarrer mon essai gratuit →</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Shareable link + disclaimer */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-4 py-3">
          <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 truncate">
            {result.reportUrl}
          </span>
          <Button size="sm" variant="outline" onClick={() => {
            navigator.clipboard.writeText(result.reportUrl);
            // show toast "Lien copié !"
          }}>
            Copier
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          {report.disclaimer}
        </p>
      </div>
    </div>
  );
}
```

### 4.7 — Detail sub-components

```tsx
function DetailSection({ title, icon, data, currency }) {
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm">{icon} {title}</p>
        <p className="text-sm font-bold text-primary">
          {fmt(data.total.min)} — {fmt(data.total.max)} {currency}
        </p>
      </div>
      <div className="space-y-2 pl-2">
        {data.items?.map((item: any, i: number) => (
          <div key={i} className="flex items-start justify-between gap-3
            py-1.5 border-b border-border/50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                {item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name}
              </p>
              {item.notes && (
                <p className="text-xs text-muted-foreground">{item.notes}</p>
              )}
            </div>
            <p className="text-sm font-medium flex-shrink-0 text-right">
              {fmt(item.unitCost?.min ?? item.cost?.min)}
              <br />
              <span className="text-xs text-muted-foreground">
                — {fmt(item.unitCost?.max ?? item.cost?.max)} {currency}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfitabilitySection({ data, currency }) {
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  return (
    <div>
      <p className="font-semibold text-sm mb-3">📊 Analyse de rentabilité</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Seuil de rentabilité",    value: `${data.breakEvenKgPerMonth} kg/mois` },
          { label: "Retour investissement",    value: `${data.estimatedRoiMonths.min} — ${data.estimatedRoiMonths.max} mois` },
          { label: "CA mensuel potentiel",     value: `${fmt(data.estimatedMonthlyRevenue.min)} — ${fmt(data.estimatedMonthlyRevenue.max)} ${currency}`, highlight: "green" },
          { label: "Bénéfice mensuel estimé",  value: `${fmt(data.estimatedMonthlyProfit.min)} — ${fmt(data.estimatedMonthlyProfit.max)} ${currency}`, highlight: "green" },
          { label: "Marge nette estimée",      value: `${data.estimatedMarginPct.min} — ${data.estimatedMarginPct.max}%`, highlight: "blue" },
        ].map((item, i) => (
          <div key={i} className={cn(
            "rounded-lg p-3",
            item.highlight === "green" ? "bg-green-50 dark:bg-green-900/20" :
            item.highlight === "blue"  ? "bg-blue-50 dark:bg-blue-900/20" :
            "bg-muted/50"
          )}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={cn(
              "text-sm font-bold mt-1",
              item.highlight === "green" ? "text-green-700 dark:text-green-400" :
              item.highlight === "blue"  ? "text-blue-700 dark:text-blue-400" : ""
            )}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## PART 5 — PRINT/PDF STYLES

Add to `client/src/index.css` or a dedicated `calculator-print.css`:

```css
@media print {
  /* Hide everything except the report content */
  header, nav, footer, .no-print { display: none !important; }
  .print-only { display: block !important; }
  body { background: white; }
  .rounded-2xl, .rounded-xl { border-radius: 8px; }
  /* Avoid breaking sections across pages */
  .report-section { page-break-inside: avoid; }
}
```

Add `className="no-print"` to: progress bar, WhatsApp buttons, CTAs, share link.
The printed/PDF version shows only the report content.

---

## PART 6 — PUBLIC REPORT PAGE

Create `client/src/pages/report-public.tsx` at `/rapport/:leadId`:

```tsx
export default function PublicReportPage() {
  const params = useParams();
  const leadId = params.leadId;

  const { data, isLoading } = useQuery({
    queryKey: ["public-report", leadId],
    queryFn: () => apiFetch(`/api/calculator/report/${leadId}`),
    retry: false,
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!data?.report) return (
    <div className="min-h-screen flex items-center justify-center text-center p-8">
      <div>
        <p className="text-2xl mb-2">😕</p>
        <h2 className="text-lg font-bold mb-2">Rapport introuvable</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Ce lien a peut-être expiré ou est invalide.
        </p>
        <Button asChild><a href="/calculateur">Créer un nouveau rapport</a></Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal top bar — no auth navigation */}
      <div className="bg-slate-900 px-4 sm:px-6 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-white">
          {/* Waves icon */}
          <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-blue-400 fill-none stroke-2">
            <path d="M2 12 C5 9, 8 15, 12 12 C16 9, 19 15, 22 12" strokeLinecap="round"/>
          </svg>
          <span className="font-bold text-sm">PressFlow</span>
        </a>
        <Button size="sm" asChild>
          <a href="/register">Essai gratuit 30 jours</a>
        </Button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Report header */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground">
            Rapport généré le {new Date(data.createdAt).toLocaleDateString("fr-FR")}
          </p>
          <h1 className="text-2xl font-bold mt-1">
            Estimation pressing · {data.city}, {data.countryLabel}
          </h1>
        </div>

        {/* Full result using same ResultPage component */}
        <ResultPage
          report={data.report}
          lead={{ firstName: data.firstName, city: data.city,
                  country: data.country, pressingType: data.pressingType }}
          result={{ reportUrl: window.location.href, expertUrl: data.expertUrl,
                    whatsappSent: false, clickToChatUrl: null, leadId: data.leadId }}
          onExpertContact={() => {}}
        />
      </div>
    </div>
  );
}
```

---

## PART 7 — ROUTING & LANDING PAGE INTEGRATION

### Routes to add in `App.tsx`:

```tsx
import CalculatorPage    from "@/pages/calculator";
import PublicReportPage  from "@/pages/report-public";

// Public routes — no auth required:
<Route path="/calculateur"       component={CalculatorPage} />
<Route path="/calculator"        component={() => {
  useEffect(() => { window.location.replace("/calculateur"); }, []);
  return null;
}} />
<Route path="/rapport/:leadId"   component={PublicReportPage} />
```

### Landing page navbar — add link:

```tsx
<a href="/calculateur"
  className="flex items-center gap-1.5 text-sm font-medium hover:text-primary
    transition-colors">
  📊 Calculateur de démarrage
</a>
```

### Homepage section — dark band, high visibility:

```tsx
<section className="bg-gradient-to-br from-slate-900 to-slate-800 py-20 px-4">
  <div className="max-w-4xl mx-auto text-center">
    <span className="inline-flex items-center gap-2 bg-primary/20 text-primary
      text-sm px-4 py-1.5 rounded-full mb-4">
      <Calculator className="w-4 h-4" />
      Outil gratuit · 4 questions · Résultat sur WhatsApp
    </span>
    <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 mb-4">
      Combien coûte l'ouverture d'un pressing<br className="hidden sm:block" />
      dans votre pays ?
    </h2>
    <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
      Notre calculateur IA analyse les données actuelles de votre marché
      et vous envoie une estimation personnalisée directement sur WhatsApp.
      Gratuit, sans inscription préalable.
    </p>
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <Button size="lg" className="px-10 text-base" asChild>
        <a href="/calculateur">Calculer mon budget de démarrage →</a>
      </Button>
    </div>
    <p className="text-slate-500 text-sm mt-5">
      Disponible pour 15 pays · Cameroun, Sénégal, Côte d'Ivoire,
      RDC, Maroc, France et plus
    </p>
  </div>
</section>
```

---

## PART 8 — VERIFICATION CHECKLIST

**Page 1 — Identité & Contact:**
- [ ] Fields in order: Prénom, Nom, Pays, Ville, Téléphone, WhatsApp opt-in, Source
- [ ] Dial code updates automatically when country changes
- [ ] WhatsApp checkbox pre-checked by default, shows WhatsApp logo
- [ ] Phone field disabled until country is selected
- [ ] City placeholder text matches selected country
- [ ] "Continuer" button disabled until all required fields filled
- [ ] On submit: lead saved to DB immediately, leadId returned and stored
- [ ] On submit: step advances to page 2
- [ ] Session data saved to sessionStorage

**Page 2 — Type de pressing:**
- [ ] 3 visual cards with emoji, title, description, machines count, budget hint
- [ ] Tapping a card immediately advances to page 3 (no Next button)
- [ ] Selected card shows primary border + background

**Page 3 — Capacité:**
- [ ] 3 visual cards with helpful context text
- [ ] "Comment estimer" helper box shown
- [ ] Inconsistency warning shown (non-blocking) for mismatched type/capacity
- [ ] Tapping a card immediately starts AI generation and advances to page 4

**Page 4 — Loading state:**
- [ ] Spinner + animated message progression shown
- [ ] Messages cycle every ~3 seconds
- [ ] City name appears in loading messages
- [ ] "Cela peut prendre 20 à 40 secondes" note shown

**Page 4 — Result:**
- [ ] Personal greeting uses firstName from page 1
- [ ] City and country shown
- [ ] Main budget range displayed in large bold text
- [ ] 3 KPI pills: equipment range, ROI, margin
- [ ] "Télécharger le rapport PDF" button triggers window.print()
- [ ] "Parler à un expert" opens WhatsApp with pre-filled message containing lead context
- [ ] Expert contact click tracked via POST /api/calculator/track-expert-contact/:leadId
- [ ] Trust signals: "2 heures" + "+5 ans · 20 entrepreneurs"
- [ ] Detail accordion expands/collapses with all subsections
- [ ] PressFlow CTA shows "30 jours gratuits OU vos 50 premières commandes"
- [ ] "Sans carte bancaire · Sans engagement" shown below CTA
- [ ] Shareable report link copyable
- [ ] WhatsApp sent banner shown if Twilio sent successfully
- [ ] Click-to-chat fallback shown if Twilio not configured

**WhatsApp delivery:**
- [ ] If whatsappOptIn=true: WhatsApp message sent after report generated
- [ ] WhatsApp message contains budget summary and report link
- [ ] If Twilio not configured: no error, click-to-chat link shown
- [ ] Expert WhatsApp link always has pre-filled message with name, city, type, budget

**Database:**
- [ ] `calculator_leads` table created with all columns
- [ ] completedPage1=true set on page 1 save
- [ ] completedPage2, completedPage3, completedPage4 set on each advance
- [ ] Rate limiting: max 3 reports per phone per 24h
- [ ] expertContactedAt set when user clicks WhatsApp expert button

**Session persistence:**
- [ ] Refreshing on page 2 or 3 restores form state from sessionStorage
- [ ] Navigating back to page 1 from page 2 shows pre-filled form

**Public report page `/rapport/:leadId`:**
- [ ] Loads without authentication
- [ ] Shows minimal top bar with PressFlow logo and trial CTA
- [ ] Full report rendered correctly on mobile
- [ ] Expert WhatsApp button works on mobile
- [ ] 404 state shown gracefully for invalid leadId

**Print/PDF:**
- [ ] window.print() triggered by PDF button
- [ ] Navigation, buttons, CTAs hidden in print view
- [ ] Report content renders cleanly in print layout

**No TypeScript errors · No console errors in browser**
