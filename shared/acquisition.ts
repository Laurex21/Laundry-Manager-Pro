import { z } from "zod";
import { campaignFromSearch, marketingPage } from "./marketing";
export const acquisitionSchema = z.object({
  eventId: z.string().uuid(), journeyId: z.string().uuid(), consent: z.literal(true),
  event: z.enum(["marketing_visit", "whatsapp_clicked", "signup_started", "demo_started"]),
  page: z.string().refine(p => marketingPage(p, p === "/auth" ? "?tab=register" : "") !== null),
  source: z.enum(["tiktok", "facebook", "whatsapp", "linkedin", "youtube", "direct_unknown"]),
  evidence: z.enum(["utm", "referrer", "unknown"]),
  campaign: z.string().max(40).default(""), content: z.string().max(40).default(""),
}).strict().refine(v => {
  const safe = campaignFromSearch(new URLSearchParams({utm_source:v.source,utm_campaign:v.campaign,utm_content:v.content}).toString());
  return (!v.campaign || safe.utm_campaign === v.campaign) && (!v.content || safe.utm_content === v.content)
    && (v.evidence === "unknown" ? v.source === "direct_unknown" : v.source !== "direct_unknown");
});
export type AcquisitionInput = z.infer<typeof acquisitionSchema>;
export function referralSource(referrer: string): string | null {
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    for (const [source, domains] of Object.entries({tiktok:["tiktok.com"],facebook:["facebook.com","fb.com"],linkedin:["linkedin.com"],youtube:["youtube.com","youtu.be"]})) {
      if (domains.some(d => host === d || host.endsWith(`.${d}`))) return source;
    }
  } catch { /* No raw referrer leaves the browser. */ }
  return null;
}
export const ACQUISITION_SESSION_MS = 30 * 60 * 1000;
