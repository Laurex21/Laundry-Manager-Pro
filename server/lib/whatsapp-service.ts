const hasTwilio = !!(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_WHATSAPP_FROM
);

let twilioClient: any = null;
if (hasTwilio) {
  try {
    const twilio = require("twilio");
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  } catch (e) {
    console.error("Twilio init error:", e);
  }
}

export async function sendReportViaWhatsApp(params: {
  toWhatsApp: string;
  city: string;
  countryLabel: string;
  minBudget: number;
  maxBudget: number;
  currency: string;
  reportUrl: string;
}): Promise<boolean> {
  if (!twilioClient) return false;
  const { toWhatsApp, city, countryLabel, minBudget, maxBudget, currency, reportUrl } = params;
  const fmt = (n: number) => n.toLocaleString("fr-FR");

  const body =
    `Bonjour 👋\n\n` +
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
    await twilioClient.messages.create({
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

export function getReportClickToChatUrl(firstName: string, city: string, countryLabel: string): string {
  const businessNumber = process.env.BUSINESS_WHATSAPP_NUMBER ?? "237699000000";
  const message = encodeURIComponent(
    `Bonjour, je m'appelle ${firstName}. ` +
    `Je viens de calculer mon budget pressing pour ${city}, ${countryLabel} sur PressFlow. ` +
    `Pouvez-vous m'envoyer mon rapport ?`
  );
  return `https://wa.me/${businessNumber}?text=${message}`;
}
