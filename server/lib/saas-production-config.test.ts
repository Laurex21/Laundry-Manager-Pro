import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { saasEnvironment, productionOrigin, PAWAPAY_ENDPOINTS } from "./saas-environment";
import { SaasPawapay } from "./saas-pawapay";

assert.equal(saasEnvironment({}), null);
assert.equal(saasEnvironment({ NODE_ENV: "production", SAAS_BILLING_MODE: "sandbox", PAWAPAY_SANDBOX_API_TOKEN: "test" }), null);
const env = {
  NODE_ENV: "production", SAAS_BILLING_MODE: "live", SAAS_LIVE_ENABLED: "true", SAAS_DATABASE_ENVIRONMENT: "production",
  SAAS_PRODUCTION_ORIGIN: "https://laundry.example.com", PAWAPAY_PRODUCTION_API_TOKEN: "fake-live-key", PAWAPAY_SANDBOX_API_TOKEN: "fake-sandbox-key",
};
const config = saasEnvironment(env)!;
assert.equal(config.mode, "live");
assert.equal(config.token, "fake-live-key");
for (const key of ["SAAS_LIVE_ENABLED", "SAAS_DATABASE_ENVIRONMENT", "PAWAPAY_PRODUCTION_API_TOKEN", "SAAS_PRODUCTION_ORIGIN"] as const) {
  const invalid: NodeJS.ProcessEnv = { ...env }; delete invalid[key];
  assert.throws(() => saasEnvironment(invalid), /LIVE_/);
}
assert.throws(() => saasEnvironment({ ...env, NODE_ENV: "test" }), /LIVE_ACTIVATION_NOT_APPROVED/);
assert.throws(() => saasEnvironment({ ...env, PAWAPAY_PRODUCTION_API_TOKEN: env.PAWAPAY_SANDBOX_API_TOKEN }), /LIVE_TOKEN_NOT_CONFIGURED/);
for (const origin of ["http://laundry.example.com", "https://localhost", "https://test.replit.dev", "https://user:pass@laundry.example.com", "https://laundry.example.com/path", "https://laundry.example.com/?test=1"]) {
  assert.throws(() => productionOrigin(origin), /LIVE_/);
}

// Exercise the live adapter with injected transport only. No real provider call.
const calls: { url: string; options: any }[] = [];
const invoice: any = { id: "invoice", checkout_id: "checkout", status: "pending", total_xaf: 10999, newlyReserved: true };
let redirect = PAWAPAY_ENDPOINTS.live.checkout + "/live-code";
let source = "";
const store: any = {
  environment: "live", db: {}, reserveCheckout: async () => invoice, recordCheckout: async () => {}, invoice: async () => invoice,
  applyProviderResult: async (_id: string, _event: any, paymentSource: string) => { source = paymentSource; },
};
const fake: typeof fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  const data = { checkoutId: invoice.checkout_id, checkoutCode: "live-code", redirectUrl: redirect, clientReferenceId: invoice.id };
  return new Response(JSON.stringify(options?.method === "POST" ? { status: "ACCEPTED", ...data } : { status: "FOUND", data }));
};
const provider = new SaasPawapay(store, () => "fake-live-key", fake, "live");
await provider.start(1, invoice.id, config.returnOrigin! + "/subscriptions");
await provider.refresh(1, invoice.id);
assert.equal(source, "pawapay_live");
assert.ok(calls.every(call => call.url.startsWith("https://api.pawapay.io/v2/checkouts")));
assert.ok(calls.every(call => call.options.headers.Authorization === "Bearer fake-live-key"));
redirect = PAWAPAY_ENDPOINTS.sandbox.checkout + "/wrong-environment";
await assert.rejects(provider.start(1, invoice.id, config.returnOrigin! + "/subscriptions"), /INVALID_CHECKOUT_RESPONSE/);
assert.throws(() => new SaasPawapay({ ...store, environment: "sandbox" }, () => "test", fake, "live"), /PROVIDER_ENVIRONMENT_MISMATCH/);
console.log("PASS production preparation: explicit activation, separate token, permanent HTTPS origin, fixed live hosts, rejected Sandbox redirect and invoice isolation; no external calls");

// Fresh process loads the actual runtime in live mode, still using PGlite and
// generated callback signatures. Any provider API request throws in the child.
const live = spawnSync(process.execPath, ["--import", "tsx", "server/lib/saas-launch-verification.integration.test.ts", "--live"], { encoding: "utf8", timeout: 60000 });
assert.equal(live.status, 0, live.stdout + live.stderr);
console.log(live.stdout.trim());
