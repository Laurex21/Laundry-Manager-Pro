import { META_PIXEL_ID, marketingPage, metaPixelSafeSearch, type MarketingEvent } from "@shared/marketing";

interface MetaQueue {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: MetaQueue;
  loaded: boolean;
  version: string;
  disablePushState: boolean;
}

declare global { interface Window { fbq?: MetaQueue; _fbq?: MetaQueue } }

const events: Record<MarketingEvent, string> = {
  marketing_visit: "PageView",
  whatsapp_clicked: "Contact",
  demo_started: "ViewContent",
  signup_started: "SignupStarted",
  signup_completed: "CompleteRegistration",
};

let pixel: MetaQueue | undefined;

export function metaPixelLoaded(): boolean { return Boolean(pixel); }
export function revokeMetaConsent(): void { pixel?.("consent", "revoke"); }

export function trackMetaEvent(event: MarketingEvent): void {
  // The SDK includes document.referrer automatically. Refuse documents reached
  // from a private or parameter-bearing referrer that could identify someone.
  if (document.referrer) {
    const from = new URL(document.referrer);
    const safePath = from.origin === window.location.origin ? marketingPage(from.pathname, from.search) : from.pathname === "/";
    if (!safePath || !metaPixelSafeSearch(from.search) || from.hash) return;
  }
  if (!pixel) {
    // Never initialise or send through a queue owned by another integration.
    if (window.fbq || window._fbq) return;
    const fbq: MetaQueue = Object.assign((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    }, { queue: [] as unknown[][], loaded: true, version: "2.0", disablePushState: true }) as MetaQueue;
    fbq.push = fbq;
    pixel = window.fbq = window._fbq = fbq;
    fbq("consent", "grant");
    fbq("set", "autoConfig", false, META_PIXEL_ID);
    fbq("init", META_PIXEL_ID);
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.async = true;
    script.referrerPolicy = "no-referrer";
    document.head.appendChild(script);
  }
  pixel(event === "signup_started" ? "trackSingleCustom" : "trackSingle", META_PIXEL_ID, events[event]);
}
