import { recordAcquisition, withdrawAcquisition, waitForAcquisition } from "./acquisition";
import { marketingHostAllowed, campaignFromSearch, marketingPage, pixelSafeSearch, MARKETING_EVENTS, TIKTOK_PIXEL_ID, type MarketingEvent } from "@shared/marketing";

export const MARKETING_CONSENT_KEY = "xpresspro.marketing-consent.v1";
const CAMPAIGN_KEY = "xpresspro.marketing-campaign.v1";
type Consent = "accepted" | "rejected" | null;
type PixelQueue = any[] & Record<string, any>;
let active = false;
let pixelLoaded = false;
let memoryConsent: Consent = null;
let lastPage = "";

declare global { interface Window { ttq?: PixelQueue; TiktokAnalyticsObject?: string } }

export function marketingConsent(): Consent {
  try {
    const value = window.localStorage.getItem(MARKETING_CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : memoryConsent;
  } catch { return memoryConsent; }
}

export function saveMarketingConsent(value: Exclude<Consent, null>): void {
  memoryConsent = value;
  try { window.localStorage.setItem(MARKETING_CONSENT_KEY, value); } catch { /* Optional storage. */ }
  if (value === "rejected") {
    withdrawAcquisition();
    try { window.sessionStorage.removeItem(CAMPAIGN_KEY); } catch { /* Optional storage. */ }
    window.ttq?.revokeConsent?.();
    // A full reload removes the SDK, its event listeners and pending queues.
    if (pixelLoaded) window.location.reload();
  }
}

export function pixelWasLoaded(): boolean { return pixelLoaded; }

export async function waitForMarketingDispatch(): Promise<void> {
  await waitForAcquisition();
  if (!pixelLoaded) return;
  // Give the asynchronous SDK a bounded chance to send a completed signup.
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 450);
    window.ttq?.ready?.(() => window.setTimeout(() => {
      window.clearTimeout(timeout);
      resolve();
    }, 100));
  });
}

function loadPixel(): void {
  if (!marketingHostAllowed(window.location.hostname) || pixelLoaded || import.meta.env?.VITE_TIKTOK_PIXEL_ENABLED !== "true" || !pixelSafeSearch(window.location.search) || window.location.hash) return;
  const q = (window.ttq = [] as unknown as PixelQueue);
  window.TiktokAnalyticsObject = "ttq";
  const methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
  q.methods = methods;
  q.setAndDefer = (target: PixelQueue, name: string) => {
    target[name] = (...args: unknown[]) => target.push([name, ...args]);
  };
  for (const name of methods) q.setAndDefer(q, name);
  q._i = { [TIKTOK_PIXEL_ID]: [] };
  q._i[TIKTOK_PIXEL_ID]._u = "https://analytics.tiktok.com/i18n/pixel/events.js";
  q._t = { [TIKTOK_PIXEL_ID]: Date.now() };
  q._o = { [TIKTOK_PIXEL_ID]: {} };
  q.instance = (id: string) => {
    const instance = q._i[id] || [];
    for (const name of methods) q.setAndDefer(instance, name);
    return instance;
  };
  q.holdConsent();
  q.disableCookie();
  q.grantConsent();
  const script = document.createElement("script");
  script.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${TIKTOK_PIXEL_ID}&lib=ttq`;
  script.async = true;
  script.referrerPolicy = "no-referrer";
  script.dataset.xpressMarketing = "true";
  document.head.appendChild(script);
  pixelLoaded = true;
}

function campaign(): Record<string, string> {
  try {
    const current = campaignFromSearch(window.location.search);
    if (current.utm_source && current.utm_campaign) {
      window.sessionStorage.setItem(CAMPAIGN_KEY, JSON.stringify(current));
      return current;
    }
    const saved = JSON.parse(window.sessionStorage.getItem(CAMPAIGN_KEY) || "{}");
    return campaignFromSearch(new URLSearchParams(saved).toString());
  } catch { return {}; }
}

export function setMarketingScope(allowed: boolean): void {
  active = allowed;
  if (!allowed && pixelLoaded) {
    window.ttq?.revokeConsent?.();
    window.location.reload();
  }
}

export function trackMarketingEvent(event: MarketingEvent): void {
  const page = marketingPage(window.location.pathname, window.location.search);
  if (!marketingHostAllowed(window.location.hostname) || !active || !page || !pixelSafeSearch(window.location.search) || window.location.hash || marketingConsent() !== "accepted" || !(event in MARKETING_EVENTS)) return;
  try {
    recordAcquisition(event, page);
    const attribution = campaign();
    // Never pass form fields, phone numbers, raw URLs, referrers, or record IDs.
    const properties = { page, action: event, ...attribution };
    // Acquisition metrics have their own namespace; keep the existing app metric intact.
    window.umami?.track(event === "marketing_visit" ? event : `marketing_${event}`, properties);
    loadPixel();
    window.ttq?.track(MARKETING_EVENTS[event], { content_id: event, content_type: "product", ...properties });
  } catch { /* Measurement must not block a signup or a contact action. */ }
}

export function trackMarketingPage(): void {
  const page = marketingPage(window.location.pathname, window.location.search);
  if (!marketingHostAllowed(window.location.hostname) || !page || !active || marketingConsent() !== "accepted") return;
  const key = `${page}:${window.location.search === "?tab=register" ? "register" : "public"}`;
  if (lastPage === key) return;
  lastPage = key;
  trackMarketingEvent("marketing_visit");
}
