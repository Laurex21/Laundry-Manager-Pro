import { createHash } from "node:crypto";

/** Opt-in startup diagnostic. No DB imports, public route, payment or retry. */
export async function pawapayPrivateDiagnostic(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
) {
  if (env.XPRESSPRO_PRIVATE_PAWAPAY_DIAGNOSTIC !== "true") return null;
  if (env.SAAS_BILLING_MODE !== "disabled" || env.SAAS_LIVE_ENABLED !== "false" ||
      env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED !== "true") {
    return { status: "SKIPPED_UNSAFE_CONFIGURATION" };
  }
  const token = env.PAWAPAY_PRODUCTION_API_TOKEN;
  const result = {
    databaseEnvironmentProduction: env.SAAS_DATABASE_ENVIRONMENT === "production",
    tokenPresent: !!token,
    tokenDistinctFromSandbox: !!token && token !== env.PAWAPAY_SANDBOX_API_TOKEN,
    // Private logs only: compare this one-way digest across environments.
    tokenSha256: token ? createHash("sha256").update(token).digest("hex") : null,
    providerHttp: null as number | null,
    status: "TOKEN_MISSING",
  };
  if (!token || !result.tokenDistinctFromSandbox) return { ...result, status: "TOKEN_NOT_READY" };
  try {
    const response = await request("https://api.pawapay.io/v2/active-conf?country=CMR", {
      method: "GET", headers: { Authorization: `Bearer ${token}` },
      redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    result.providerHttp = response.status;
    // Do not log provider bodies, token claims, headers or exception messages.
    result.status = response.status === 200 ? "AUTHENTICATED" : "PROVIDER_REJECTED";
    await response.body?.cancel();
  } catch { result.status = "PROVIDER_UNREACHABLE"; }
  return result;
}
