// Marketing measurement is restricted to public acquisition journeys.
export const TIKTOK_PIXEL_ID = "DBCLIORC77U3JBDSA280";
export const MARKETING_PATHS = ["/", "/xpresspro", "/xpress-consulting", "/xpress-clean", "/rencontre"] as const;

export function marketingPage(pathname: string, search = ""): string | null {
  if ((MARKETING_PATHS as readonly string[]).includes(pathname)) return pathname;
  return pathname === "/auth" && new URLSearchParams(search).get("tab") === "register"
    ? "/auth" : null;
}

const CAMPAIGN_VALUES: Record<string, readonly string[]> = {
  utm_source: ["tiktok", "facebook", "whatsapp", "linkedin", "youtube"],
  utm_medium: ["organic_social", "profile", "live", "referral"],
  utm_campaign: ["formation_pressing", "xpresspro", "lancement_pressing", "fipp"],
  utm_content: ["profil", "budget_500k", "projet_tchad", "demo_gestion", "ai_flyer", "live_20261021"],
};

export function campaignFromSearch(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  return Object.fromEntries(Object.entries(CAMPAIGN_VALUES)
    .filter(([key, allowed]) => allowed.includes(params.get(key) || ""))
    .map(([key]) => [key, params.get(key)!]));
}

export function pixelSafeSearch(search: string): boolean {
  const params = new URLSearchParams(search);
  const safe = campaignFromSearch(search);
  return Array.from(params.entries()).every(([key, value]) =>
    (key === "tab" && value === "register") || safe[key] === value);
}

export const MARKETING_EVENTS = {
  marketing_visit: "ViewContent",
  whatsapp_clicked: "Contact",
  demo_started: "ViewContent",
  signup_started: "ClickButton",
  signup_completed: "CompleteRegistration",
} as const;
export type MarketingEvent = keyof typeof MARKETING_EVENTS;
