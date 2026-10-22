import assert from "node:assert/strict";
import { campaignFromSearch, marketingPage, pixelSafeSearch } from "../../../shared/marketing.ts";
import { marketingConsent, saveMarketingConsent, setMarketingScope, trackMarketingEvent, trackMarketingPage } from "./marketing.ts";

for (const path of ["/dashboard", "/orders/53", "/customers", "/payments", "/rapport/private-token", "/reset-password/token", "/platform-admin"]) {
  assert.equal(marketingPage(path), null, `exclude operational or token-bearing route ${path}`);
}
assert.equal(marketingPage("/auth", "?tab=login"), null);
assert.equal(marketingPage("/auth", "?tab=register"), "/auth");
assert.equal(marketingPage("/xpress-consulting"), "/xpress-consulting");
assert.deepEqual(campaignFromSearch("?utm_source=tiktok&utm_medium=profile&utm_campaign=formation_pressing&utm_content=projet_tchad&email=private@example.com&phone=123"), {
  utm_source: "tiktok", utm_medium: "profile", utm_campaign: "formation_pressing", utm_content: "projet_tchad",
});
assert.deepEqual(campaignFromSearch("?utm_source=private@example.com&utm_campaign=123456789&utm_content=customer_name"), {});
assert.equal(pixelSafeSearch("?utm_source=tiktok&utm_campaign=xpresspro"), true);
assert.equal(pixelSafeSearch("?utm_source=tiktok&email=private@example.com"), false);
assert.equal(pixelSafeSearch("?tab=register&token=secret"), false);
assert.equal(pixelSafeSearch("?utm_campaign=private"), false);

const local = new Map<string, string>();
const session = new Map<string, string>();
const events: { name: string; properties: Record<string, string> }[] = [];
const location = { pathname: "/xpresspro", search: "?utm_source=tiktok&utm_medium=profile&utm_campaign=xpresspro&utm_content=profil", reload: () => {} };
const storage = (values: Map<string, string>) => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
Object.defineProperty(globalThis, "window", { configurable: true, value: {
  location, localStorage: storage(local), sessionStorage: storage(session),
  umami: { track: (name: string, properties: Record<string, string>) => events.push({ name, properties }) },
} });
assert.equal(marketingConsent(), null);
setMarketingScope(true);
trackMarketingEvent("whatsapp_clicked");
assert.equal(events.length, 0, "no acquisition tracking before consent");
assert.equal(session.size, 0, "no attribution storage before consent");
saveMarketingConsent("rejected");
trackMarketingPage();
assert.equal(events.length, 0, "refusal does not emit events");
saveMarketingConsent("accepted");
trackMarketingPage();
trackMarketingPage();
assert.equal(events.length, 1, "do not double-count initial page view");
assert.equal(events[0].properties.utm_source, "tiktok");
location.pathname = "/auth"; location.search = "?tab=register";
trackMarketingEvent("signup_completed");
assert.equal(events[1].name, "marketing_signup_completed");
assert.equal(events[1].properties.utm_source, "tiktok", "keep acquisition source through SPA registration journey");
assert.deepEqual(Object.keys(events[1].properties).sort(), ["action", "page", "utm_campaign", "utm_content", "utm_medium", "utm_source"].sort());
location.pathname = "/orders/52";
trackMarketingEvent("whatsapp_clicked");
assert.equal(events.length, 2, "operational WhatsApp links are excluded");
location.pathname = "/xpresspro";
setMarketingScope(false);
trackMarketingEvent("demo_started");
assert.equal(events.length, 2, "authenticated or loading state cannot emit acquisition events");
saveMarketingConsent("rejected");
assert.equal(session.size, 0, "withdrawal clears stored campaign");
console.log("Marketing privacy, attribution and consent tests passed");
