/** Optional live pilot scope. Invalid/missing request identity fails closed. */
export function livePilotConfigured(env: NodeJS.ProcessEnv = process.env) {
  return env.SAAS_BILLING_MODE === "live" && env.SAAS_LIVE_PILOT_ORGANISATION_ID !== undefined;
}
export function pilotOrganisationAllowed(org: unknown, env: NodeJS.ProcessEnv = process.env) {
  if (!livePilotConfigured(env)) return true;
  const configured = env.SAAS_LIVE_PILOT_ORGANISATION_ID || "";
  return /^[1-9]\d*$/.test(configured) && Number.isSafeInteger(Number(configured)) &&
    typeof org === "number" && Number.isSafeInteger(org) && org === Number(configured);
}
export function pilotSelectionAllowed(selection: { plan: string; extraSites?: number; extraStaff?: number }) {
  return selection.plan === "pro" && !selection.extraSites && !selection.extraStaff;
}

/** Collection-only rehearsal: never enrol or change a subscription. */
export const COLLECTION_PILOT_XAF = 50;
export function collectionPilotConfigured(env: NodeJS.ProcessEnv = process.env) {
  return env.SAAS_LIVE_PILOT_PURPOSE === "collection";
}
export function collectionPilotAllowed(org: unknown, env: NodeJS.ProcessEnv = process.env) {
  return collectionPilotConfigured(env) && livePilotConfigured(env) && pilotOrganisationAllowed(org, env);
}
export function isCollectionPilotInvoice(invoice: { quote?: { purpose?: string } }) {
  return invoice.quote?.purpose === "collection_pilot";
}
