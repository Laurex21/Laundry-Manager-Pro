import { SaasError } from "./saas-store";

export type SaasMode = "sandbox" | "live";
export const PAWAPAY_ENDPOINTS = {
  sandbox: { api: "https://api.sandbox.pawapay.io", checkout: "https://checkout.sandbox.pawapay.io" },
  live: { api: "https://api.pawapay.io", checkout: "https://checkout.pawapay.io" },
} as const;

export function productionOrigin(value: string | undefined): string {
  let url: URL;
  try { url = new URL(value || ""); } catch { throw new SaasError("LIVE_HTTPS_ORIGIN_REQUIRED", 503); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.hostname.endsWith(".replit.dev")) {
    throw new SaasError("LIVE_PERMANENT_HTTPS_ORIGIN_REQUIRED", 503);
  }
  return url.origin;
}

/** Configuration only: no DB, fetch, token logging or side effects. */
export function saasEnvironment(env: NodeJS.ProcessEnv = process.env): {
  mode: SaasMode; token: string | undefined; returnOrigin: string | undefined; callbackOrigin: string | undefined;
} | null {
  if (!env.SAAS_BILLING_MODE || env.SAAS_BILLING_MODE === "disabled") return null;
  if (env.SAAS_BILLING_MODE === "sandbox") {
    if (env.NODE_ENV === "production") return null;
    return { mode: "sandbox", token: env.PAWAPAY_SANDBOX_API_TOKEN, returnOrigin: env.SAAS_SANDBOX_RETURN_ORIGIN, callbackOrigin: env.SAAS_SANDBOX_CALLBACK_ORIGIN };
  }
  if (env.SAAS_BILLING_MODE !== "live") throw new SaasError("INVALID_BILLING_MODE", 503);
  if (env.NODE_ENV !== "production" || env.SAAS_LIVE_ENABLED !== "true" || env.SAAS_DATABASE_ENVIRONMENT !== "production") {
    throw new SaasError("LIVE_ACTIVATION_NOT_APPROVED", 503);
  }
  if (!env.PAWAPAY_PRODUCTION_API_TOKEN || env.PAWAPAY_PRODUCTION_API_TOKEN === env.PAWAPAY_SANDBOX_API_TOKEN) {
    throw new SaasError("LIVE_TOKEN_NOT_CONFIGURED", 503);
  }
  const origin = productionOrigin(env.SAAS_PRODUCTION_ORIGIN);
  return { mode: "live", token: env.PAWAPAY_PRODUCTION_API_TOKEN, returnOrigin: origin, callbackOrigin: origin };
}
