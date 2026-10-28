import { saasEnvironment } from "./saas-environment";
import { collectionPilotConfigured, livePilotConfigured } from "./saas-pilot";

/** Public signup terms, independent of the current visitor's payment eligibility. */
export function saasSignupOffer(env: NodeJS.ProcessEnv = process.env) {
  if (!saasEnvironment(env) || collectionPilotConfigured(env) || livePilotConfigured(env)) return null;
  return { plan: env.SAAS_BUSINESS_LAUNCH_ENABLED === "true" ? "business" as const : "pro" as const, days: 30 };
}
