import assert from "node:assert/strict";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { MARKETING_CONSENT_KEY, META_PIXEL_ID } from "../../../shared/marketing";
import { buildSync } from "esbuild";
import { securityHeaders } from "../../../server/lib/http-security.ts";

const bundle = buildSync({ entryPoints: ["client/src/lib/marketing.ts"], bundle: true, write: false,
  format: "iife", platform: "browser", globalName: "Marketing",
  define: { "import.meta.env": '{"VITE_TIKTOK_PIXEL_ENABLED":"true"}' },
}).outputFiles[0].text;

function browser(pathname = "/xpresspro", search = "", hash = "", hostname = "localhost", referrer = "") {
  const local = new Map(); const session = new Map(); const scripts: any[] = [];
  let reloads = 0;
  const store = (map: Map<any, any>) => ({ getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => map.set(k, v), removeItem: (k: string) => map.delete(k) });
  const window: any = { localStorage: store(local), sessionStorage: store(session), location: { hostname, origin: "https://" + hostname, pathname, search, hash, reload: () => { reloads++; } } };
  const ctx: any = { window, URL, URLSearchParams, crypto: { randomUUID }, fetch: async () => ({ ok: true }), document: { referrer, createElement: () => ({ dataset: {} }), head: { appendChild: (script: any) => scripts.push(script) } } };
  vm.runInNewContext(bundle, ctx);
  return { api: ctx.Marketing, window, scripts, reloads: () => reloads };
}

const b = browser();
b.api.setMarketingScope(true);
b.api.trackMarketingEvent("marketing_visit");
assert.equal(b.scripts.length, 0);
b.api.saveMarketingConsent("rejected");
b.api.trackMarketingEvent("marketing_visit");
assert.equal(b.scripts.length, 0);
b.api.saveMarketingConsent("accepted");
b.api.trackMarketingEvent("marketing_visit");
assert.equal(b.scripts.length, 1);
assert.match(b.scripts[0].src, /^https:\/\/analytics\.tiktok\.com\/i18n\/pixel\/events\.js\?sdkid=DBCLIORC77U3JBDSA280&lib=ttq$/);
assert.equal(b.scripts[0].referrerPolicy, "no-referrer");
assert.equal(b.window.ttq.some((event: any[]) => event[0] === "identify"), false);
assert.equal(b.window.ttq.filter((event: any[]) => event[0] === "track").length, 1);
assert.equal(b.window.ttq.filter((event: any[]) => event[0] === "track")[0][1], "ViewContent");
b.api.trackMarketingEvent("whatsapp_clicked");
assert.equal(b.scripts.length, 1, "SDK loaded once");
b.window.location.search = "?email=private@example.com";
const beforeUnsafeUrl = b.window.ttq.filter((event: any[]) => event[0] === "track").length;
b.api.trackMarketingEvent("whatsapp_clicked");
assert.equal(b.window.ttq.filter((event: any[]) => event[0] === "track").length, beforeUnsafeUrl, "unsafe URLs cannot emit through an already loaded SDK");
b.window.location.search = "";
b.api.saveMarketingConsent("rejected");
assert.equal(b.reloads(), 1, "withdrawal removes the SDK by reloading");
const count = b.window.ttq.filter((event: any[]) => event[0] === "track").length;
b.api.trackMarketingEvent("whatsapp_clicked");
assert.equal(b.window.ttq.filter((event: any[]) => event[0] === "track").length, count);

for (const [path, search, hash] of [["/orders/52", "", ""], ["/xpresspro", "?email=person@example.com", ""], ["/auth", "?tab=register&token=private", ""], ["/xpresspro", "", "#secret"]]) {
  const excluded = browser(path, search, hash);
  excluded.api.saveMarketingConsent("accepted"); excluded.api.setMarketingScope(true);
  excluded.api.trackMarketingEvent("marketing_visit");
  assert.equal(excluded.scripts.length, 0, `No SDK on ${path}${search}${hash}`);
}
const privateNavigation = browser();
privateNavigation.api.saveMarketingConsent("accepted");privateNavigation.api.setMarketingScope(true);
privateNavigation.api.trackMarketingEvent("marketing_visit");
privateNavigation.window.location.pathname = "/dashboard";
privateNavigation.api.setMarketingScope(false);
assert.equal(privateNavigation.reloads(), 1);

const oldFlag = process.env.VITE_TIKTOK_PIXEL_ENABLED;
process.env.VITE_TIKTOK_PIXEL_ENABLED = "true";
function csp(path: string, query = {}, hostname = "localhost") {
  const headers: Record<string, string> = {};
  securityHeaders({ path, query, hostname } as any, { setHeader: (k: string, v: string) => { headers[k] = v; } } as any, () => {});
  return headers["Content-Security-Policy"];
}
assert.match(csp("/xpresspro"), /script-src 'self' https:\/\/analytics\.tiktok\.com/);
assert.match(csp("/auth", { tab: "register" }), /analytics\.tiktok\.com/);
for (const route of ["/dashboard", "/customers", "/auth", "/api/auth/user", "/platform-admin"]) assert.doesNotMatch(csp(route), /tiktok\.com/);
delete process.env.VITE_TIKTOK_PIXEL_ENABLED;
assert.doesNotMatch(csp("/xpresspro"), /tiktok\.com/);
if (oldFlag !== undefined) process.env.VITE_TIKTOK_PIXEL_ENABLED = oldFlag;
console.log("Pixel SDK isolation, consent, URL filtering and CSP tests passed");

const host = "app.xpressclean.cm";
const meta = browser("/xpresspro", "", "", host);
meta.api.setMarketingScope(true);
const store = meta.window.localStorage;
store.setItem("xpresspro.marketing-consent.v1", "rejected");
assert.equal(meta.api.marketingConsent(), "rejected");
store.setItem("xpresspro.marketing-consent.v1", "accepted");
meta.api.trackMarketingPage();
assert.equal(meta.api.marketingConsent(), null);
assert.equal(meta.scripts.length, 0);
meta.api.saveMarketingConsent("accepted");
assert.equal(store.getItem(MARKETING_CONSENT_KEY), "accepted");
meta.api.trackMarketingPage();
meta.api.trackMarketingPage();
meta.api.trackMarketingEvent("whatsapp_clicked");
meta.api.trackMarketingEvent("signup_completed");
assert.equal(meta.scripts.filter(s => s.src === "https://connect.facebook.net/en_US/fbevents.js").length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(meta.window.fbq.queue)), [
  ["consent", "grant"], ["set", "autoConfig", false, META_PIXEL_ID], ["init", META_PIXEL_ID],
  ["trackSingle", META_PIXEL_ID, "PageView"], ["trackSingle", META_PIXEL_ID, "Contact"],
  ["trackSingle", META_PIXEL_ID, "CompleteRegistration"],
]);
meta.api.saveMarketingConsent("rejected");
const stopped = meta.window.fbq.queue.length;
assert.equal(meta.window.fbq.queue.at(-1)[1], "revoke");
meta.api.trackMarketingEvent("whatsapp_clicked");
assert.equal(meta.window.fbq.queue.length, stopped);
assert.equal(meta.reloads(), 1);
for (const [pathname, search, hash, hostname, referrer] of [
  ["/orders/52", "", "", host, ""], ["/auth", "?tab=login", "", host, ""],
  ["/xpresspro", "?email=test@example.com", "", host, ""], ["/xpresspro", "", "#token", host, ""],
  ["/xpresspro", "?fbclid=not-an-id&phone=123456789", "", host, ""],
  ["/xpresspro", "", "", "superadmin.xpressclean.cm", ""], ["/xpresspro", "", "", "preview.replit.dev", ""],
  ["/xpresspro", "", "", host, "https://app.xpressclean.cm/orders/52"],
]) {
  const blocked = browser(pathname, search, hash, hostname, referrer);
  blocked.api.saveMarketingConsent("accepted");
  blocked.api.setMarketingScope(true);
  blocked.api.trackMarketingPage();
  assert.equal(blocked.window.fbq, undefined);
}
const ad = browser("/xpresspro", "?fbclid=IwZXh0bgNhZW0CMTEA123", "", host);
ad.api.setMarketingScope(true);
ad.api.saveMarketingConsent("accepted");
ad.api.trackMarketingPage();
assert.equal(ad.scripts.length, 1);
assert.match(ad.scripts[0].src, /connect\.facebook\.net/);
assert.equal(ad.window.ttq, undefined);
assert.match(csp("/auth", { tab: "register" }, host), /https:\/\/connect\.facebook\.net/);
for (const path of ["/orders", "/auth", "/privacy", "/platform-admin"]) assert.doesNotMatch(csp(path, {}, host), /facebook/);
console.log("Meta manual events, Facebook ad links, private routes, previous consent and withdrawal passed.");
