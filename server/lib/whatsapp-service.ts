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
  firstName: string;
  city: string;
  countryLabel: string;
  minBudget: number;
  maxBudget: number;
  currency: string;
  reportUrl: string;
}): Promise<boolean> {
  if (!twilioClient) return false;
  const { toWhatsApp, firstName, city, countryLabel, minBudget, maxBudget, currency, reportUrl } = params;
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  const body =
    `Bonjour ${firstName} 👋\n\n` +
    `Votre rapport de démarrage pressing est prêt !\n\n` +
    `📍 *${city}, ${countryLabel}*\n` +
    `💰 *Budget estimé : ${fmt(minBudget)} — ${fmt(maxBudget)} ${currency}*\n\n` +
    `Votre rapport inclut :\n` +
    `✅ Coûts détaillés par poste\n` +
    `✅ Analyse de rentabilité et seuil\n` +
    `✅ Démarches administratives\n` +
    `✅ Recommandations personnalisées\n\n` +
    `👉 Rapport complet :\n${reportUrl}\n\n` +
    `_PressFlow · Logiciel de gestion de pressing_`;
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to: `whatsapp:${toWhatsApp}`,
      body,
    });
    return true;
  } catch (err: any) {
    console.error("WhatsApp send error:", err.message);
    return false;
  }
}

export function getClickToChatUrl(firstName: string, city: string, countryLabel: string): string {
  const businessNumber = process.env.BUSINESS_WHATSAPP_NUMBER ?? "237699000000";
  const text = encodeURIComponent(
    `Bonjour, je m'appelle ${firstName}. Je viens de générer mon rapport pressing pour ${city}, ${countryLabel} sur PressFlow. Pouvez-vous me l'envoyer ?`
  );
  return `https://wa.me/${businessNumber}?text=${text}`;
}
