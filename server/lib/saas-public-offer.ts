import { saasEnvironment } from "./saas-environment";
import { collectionPilotConfigured, livePilotConfigured } from "./saas-pilot";

export function businessTrialEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.SAAS_BUSINESS_LAUNCH_ENABLED === "true" && !collectionPilotConfigured(env) && !livePilotConfigured(env);
}

/** Public signup terms, independent of the current visitor's payment eligibility. */
export function saasSignupOffer(env: NodeJS.ProcessEnv = process.env) {
  if (businessTrialEnabled(env)) return { plan: "business" as const, days: 30 };
  if (!saasEnvironment(env) || collectionPilotConfigured(env) || livePilotConfigured(env)) return null;
  return { plan: env.SAAS_BUSINESS_LAUNCH_ENABLED === "true" ? "business" as const : "pro" as const, days: 30 };
}
