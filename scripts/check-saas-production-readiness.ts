/** Offline-only configuration preflight. Never imports DB or calls a provider. */
import { saasEnvironment, PAWAPAY_ENDPOINTS } from "../server/lib/saas-environment";
const example = process.argv.includes("--example");
const env: NodeJS.ProcessEnv = example ? {
  NODE_ENV: "production", SAAS_BILLING_MODE: "live", SAAS_LIVE_ENABLED: "true", SAAS_DATABASE_ENVIRONMENT: "production",
  PAWAPAY_PRODUCTION_API_TOKEN: "example-placeholder-not-a-credential", SAAS_PRODUCTION_ORIGIN: "https://laundry.example.com",
} : process.env;
try {
  const config = saasEnvironment(env);
  const configurationValid = config?.mode === "live";
  console.log(JSON.stringify({ example, configurationValid, deploymentApproved: false, databaseAccessed: false, providerContacted: false,
    mode: config?.mode ?? "disabled", ...(configurationValid ? { api: PAWAPAY_ENDPOINTS.live.api, callback: `${config.callbackOrigin}/api/saas/live/callback` } : {}),
    remainingChecks: ["verified backup and restore", "live merchant CMR/XAF access and fees", "permanent domain and signed callbacks", "review legacy subscriptions and excess credits", "explicit deployment approval", "authorised real pilot payment"],
  }, null, 2));
  if (!configurationValid) process.exitCode = 1;
} catch (error: any) {
  console.log(JSON.stringify({ configurationValid: false, code: error.code || "CONFIGURATION_INVALID", databaseAccessed: false, providerContacted: false }));
  process.exitCode = 1;
}
