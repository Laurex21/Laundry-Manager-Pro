import assert from "node:assert/strict";
import { pawapayPrivateDiagnostic } from "./pawapay-private-diagnostic";

const env = {
  XPRESSPRO_PRIVATE_PAWAPAY_DIAGNOSTIC: "true", SAAS_BILLING_MODE: "disabled",
  SAAS_LIVE_ENABLED: "false", XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED: "true",
  SAAS_DATABASE_ENVIRONMENT: "production", PAWAPAY_PRODUCTION_API_TOKEN: "synthetic-live-secret",
  PAWAPAY_SANDBOX_API_TOKEN: "synthetic-sandbox-secret",
};
let calls = 0;
const request: typeof fetch = async (url, options) => {
  calls++;
  assert.equal(url, "https://api.pawapay.io/v2/active-conf?country=CMR");
  assert.equal(options?.method, "GET");
  assert.equal(options?.redirect, "error");
  assert.equal((options?.headers as Record<string, string>).Authorization, `Bearer ${env.PAWAPAY_PRODUCTION_API_TOKEN}`);
  return new Response("sensitive-provider-body", { status: 200 });
};
assert.equal(await pawapayPrivateDiagnostic({}, request), null);
for (const override of [{ SAAS_BILLING_MODE: "live" }, { SAAS_LIVE_ENABLED: "true" }, { XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED: "false" }]) {
  assert.equal((await pawapayPrivateDiagnostic({ ...env, ...override }, request))?.status, "SKIPPED_UNSAFE_CONFIGURATION");
}
assert.equal(calls, 0);
const result = await pawapayPrivateDiagnostic(env, request);
assert.equal(result?.status, "AUTHENTICATED");
assert.equal(calls, 1);
assert.ok(!JSON.stringify(result).includes(env.PAWAPAY_PRODUCTION_API_TOKEN));
assert.ok(!JSON.stringify(result).includes("sensitive-provider-body"));
assert.equal((await pawapayPrivateDiagnostic({ ...env, PAWAPAY_PRODUCTION_API_TOKEN: "" }, request))?.status, "TOKEN_NOT_READY");
assert.equal((await pawapayPrivateDiagnostic({ ...env, PAWAPAY_PRODUCTION_API_TOKEN: env.PAWAPAY_SANDBOX_API_TOKEN }, request))?.status, "TOKEN_NOT_READY");
const reject: typeof fetch = async () => new Response(null, { status: 401 });
assert.equal((await pawapayPrivateDiagnostic(env, reject))?.status, "PROVIDER_REJECTED");
const fail: typeof fetch = async () => { throw new Error(env.PAWAPAY_PRODUCTION_API_TOKEN); };
const failure = await pawapayPrivateDiagnostic(env, fail);
assert.equal(failure?.status, "PROVIDER_UNREACHABLE");
assert.ok(!JSON.stringify(failure).includes(env.PAWAPAY_PRODUCTION_API_TOKEN));
assert.equal((await pawapayPrivateDiagnostic({ ...env, SAAS_DATABASE_ENVIRONMENT: "" }, request) as any).databaseEnvironmentProduction, false);
console.log("PASS private diagnostic: opt-in, safety gates, GET-only, redaction, token separation, rejection and network failure");
