import assert from "node:assert/strict";
import vm from "node:vm";
import { buildSync } from "esbuild";
import { securityHeaders } from "../../../server/lib/http-security.ts";

const bundle = buildSync({ entryPoints: ["client/src/lib/marketing.ts"], bundle: true, write: false,
  format: "iife", platform: "browser", globalName: "Marketing",
  define: { "import.meta.env": '{"VITE_TIKTOK_PIXEL_ENABLED":"true"}' },
}).outputFiles[0].text;

function browser(pathname = "/xpresspro", search = "", hash = "") {
  const local = new Map(); const session = new Map(); const scripts: any[] = [];
  let reloads = 0;
  const store = (map: Map<any, any>) => ({ getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => map.set(k, v), removeItem: (k: string) => map.delete(k) });
  const window: any = { localStorage: store(local), sessionStorage: store(session), location: { pathname, search, hash, reload: () => { reloads++; } } };
  const ctx: any = { window, URLSearchParams, document: { createElement: () => ({ dataset: {} }), head: { appendChild: (script: any) => scripts.push(script) } } };
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
function csp(path: string, query = {}) {
  const headers: Record<string, string> = {};
  securityHeaders({ path, query } as any, { setHeader: (k: string, v: string) => { headers[k] = v; } } as any, () => {});
  return headers["Content-Security-Policy"];
}
assert.match(csp("/xpresspro"), /script-src 'self' https:\/\/analytics\.tiktok\.com/);
assert.match(csp("/auth", { tab: "register" }), /analytics\.tiktok\.com/);
for (const route of ["/dashboard", "/customers", "/auth", "/api/auth/user", "/platform-admin"]) assert.doesNotMatch(csp(route), /tiktok\.com/);
delete process.env.VITE_TIKTOK_PIXEL_ENABLED;
assert.doesNotMatch(csp("/xpresspro"), /tiktok\.com/);
if (oldFlag !== undefined) process.env.VITE_TIKTOK_PIXEL_ENABLED = oldFlag;
console.log("Pixel SDK isolation, consent, URL filtering and CSP tests passed");
