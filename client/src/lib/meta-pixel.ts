/** Meta tracking is deliberately limited to anonymous marketing pages. */
const CONSENT_KEY = "xpresspro.meta-marketing-consent";
const PUBLIC_PATHS = new Set(["/", "/xpresspro", "/xpress-consulting", "/xpress-clean", "/rencontre", "/calculateur", "/diagnostic", "/rentabilite"]);
const PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID ?? "").trim();
let loaded = false;
let sessionConsent: "accepted" | "rejected" | null = null;
let lastPage: string | null = null;
let anonymousMarketingContext = false;

type PixelCommand = (...args: unknown[]) => void;
declare global { interface Window { fbq?: PixelCommand & { callMethod?: PixelCommand; queue?: unknown[]; loaded?: boolean; version?: string }; _fbq?: PixelCommand; } }

export function hasConfiguredMetaPixel(): boolean { return /^\d{8,25}$/.test(PIXEL_ID); }
export function isMetaPublicPath(path: string): boolean { return PUBLIC_PATHS.has(path); }
export function isMetaAllowedPath(path: string): boolean { return isMetaPublicPath(path) || path === "/auth"; }
export function getMetaConsent(): "accepted" | "rejected" | null {
  try { const value = window.localStorage.getItem(CONSENT_KEY); return value === "accepted" || value === "rejected" ? value : null; }
  catch { return sessionConsent; }
}
export function setMetaConsent(value: "accepted" | "rejected"): void {
  sessionConsent = value;
  try { window.localStorage.setItem(CONSENT_KEY, value); } catch { /* Session-only consent if storage is disabled. */ }
  window.fbq?.("consent", value === "rejected" ? "revoke" : "grant");
}
export function isMetaPixelLoaded(): boolean { return loaded; }
export function setMetaTrackingEligibility(eligible: boolean): void { anonymousMarketingContext = eligible; }

function loadPixel(): void {
  if (loaded || !hasConfiguredMetaPixel()) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else (fbq.queue ??= []).push(args);
  } as PixelCommand & { callMethod?: PixelCommand; queue?: unknown[]; loaded?: boolean; version?: string };
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  // Do not let Meta infer extra events from clicks or form fields.
  fbq("set", "autoConfig", false, PIXEL_ID);
  fbq("init", PIXEL_ID);
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  loaded = true;
}

export function prepareMetaAuth(): void {
  if (typeof window !== "undefined" && getMetaConsent() === "accepted") loadPixel();
}

export function trackMetaPage(path: string, isAuthenticated: boolean): void {
  if (typeof window === "undefined" || isAuthenticated || !isMetaPublicPath(path) || getMetaConsent() !== "accepted") return;
  loadPixel();
  if (!loaded || lastPage === path) return;
  lastPage = path;
  window.fbq?.("track", "PageView");
}

export function trackMetaEvent(event: "Lead" | "CompleteRegistration" | "Contact", path: string): void {
  if (typeof window === "undefined" || !anonymousMarketingContext || !(isMetaPublicPath(path) || (event === "CompleteRegistration" && path === "/auth")) || getMetaConsent() !== "accepted") return;
  loadPixel();
  if (loaded) window.fbq?.("track", event);
}
