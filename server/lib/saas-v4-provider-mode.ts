import { pool } from "../db";

export type SaasV4ProviderEnvironment = "production" | "sandbox";

export async function saasV4ProviderEnvironment(): Promise<SaasV4ProviderEnvironment> {
  const mode = process.env.SAAS_V4_PILOT_PROVIDER ?? "production";
  if (mode === "production") return "production";
  if (mode !== "sandbox" || process.env.SAAS_V4_TEST_DATABASE !== "true") {
    throw new Error("SAAS_V4_PROVIDER_MODE_INVALID");
  }
  const configuredOrigin = process.env.SAAS_V4_PUBLIC_APP_ORIGIN;
  if (!configuredOrigin) throw new Error("SAAS_V4_TEST_ORIGIN_MISSING");
  const testHost = new URL(configuredOrigin).hostname.toLowerCase();
  if (["app.xpressclean.cm", "superadmin.xpressclean.cm", "laundry-manager-pro.replit.app"].includes(testHost)) {
    throw new Error("SAAS_V4_SANDBOX_ON_PUBLIC_HOST_FORBIDDEN");
  }
  // This marker is deliberately excluded from the v4 migration. It must be
  // created manually in the disposable test database, never production.
  const marker = await pool.query("SELECT to_regclass('saas_v4_test_environment_marker') AS marker");
  if (!marker.rows[0]?.marker) throw new Error("SAAS_V4_TEST_DATABASE_MARKER_MISSING");
  const result = await pool.query("SELECT id FROM saas_v4_test_environment_marker WHERE id = 1");
  if (!result.rowCount) throw new Error("SAAS_V4_TEST_DATABASE_MARKER_MISSING");
  return "sandbox";
}

export function saasV4CheckoutApiUrl(mode: SaasV4ProviderEnvironment): string {
  return mode === "sandbox" ? "https://api.sandbox.pawapay.io/v2/checkouts" :
    "https://api.pawapay.io/v2/checkouts";
}

export function saasV4CheckoutRedirectOrigin(mode: SaasV4ProviderEnvironment): string {
  return mode === "sandbox" ? "https://checkout.sandbox.pawapay.io" :
    "https://checkout.pawapay.io";
}

export function saasV4ApiToken(mode: SaasV4ProviderEnvironment): string {
  const token = mode === "sandbox" ? process.env.PAWAPAY_SANDBOX_API_TOKEN :
    process.env.PAWAPAY_PRODUCTION_API_TOKEN;
  if (!token) throw new Error("PAWAPAY_PILOT_TOKEN_MISSING");
  return token;
}
