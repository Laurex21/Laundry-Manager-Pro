const VISIT_STORAGE_KEY = "xpresspro.analytics.last-visit";
const VISIT_TIMEOUT_MS = 30 * 60 * 1000;

declare global {
  interface Window {
    umami?: {
      track(name: string, properties?: Record<string, string>): void;
    };
  }
}

export function trackEvent(name: string): void {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(name);
  } catch {
    // Analytics must never interrupt an app flow.
  }
}

export function trackAppVisit(): void {
  if (typeof window === "undefined" || !window.umami) return;

  const now = Date.now();
  try {
    const lastVisit = Number(window.localStorage.getItem(VISIT_STORAGE_KEY));
    if (Number.isFinite(lastVisit) && lastVisit > 0 && now >= lastVisit && now - lastVisit < VISIT_TIMEOUT_MS) {
      return;
    }
    window.localStorage.setItem(VISIT_STORAGE_KEY, String(now));
  } catch {
    // Continue with one event for this page load if browser storage is unavailable.
  }

  trackEvent("app_visit");
}
