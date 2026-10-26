import type { SaasExecutor } from "./saas-store";

/** Temporary review scope; never supplied by the browser. No account mutation. */
export function deferredSaasOrganisations(env: NodeJS.ProcessEnv = process.env): number[] {
  const value = env.SAAS_DEFERRED_ORGANISATION_IDS;
  if (value === undefined) return [];
  const parts = value.split(",");
  if (!parts.length || parts.some(id => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))) {
    throw new Error("INVALID_SAAS_DEFERRED_ORGANISATIONS");
  }
  const ids = parts.map(Number);
  if (new Set(ids).size !== ids.length) throw new Error("INVALID_SAAS_DEFERRED_ORGANISATIONS");
  return ids;
}
export function saasOrganisationDeferred(org: unknown) {
  return deferredSaasOrganisations().includes(Number(org));
}
export async function saasIdentityDeferred(db: SaasExecutor, userId: unknown) {
  const ids = deferredSaasOrganisations();
  if (!ids.length || typeof userId !== "string" || !userId) return false;
  // Resolve the owner identity on the server, including their existing employee
  // context in another business. Do not exempt that business's other users.
  return (await db.query("SELECT id FROM organisations WHERE id=ANY($1::int[]) AND owner_id=$2 LIMIT 1", [ids,userId])).rows.length > 0;
}
