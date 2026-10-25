import { proPilotConfigured } from "./saas-pro-pilot";
import { automaticMaintenanceSuspended } from "./automatic-maintenance";
import { livePilotConfigured, pilotOrganisationAllowed, collectionPilotConfigured, collectionPilotAllowed } from "./saas-pilot";
import { sql } from "drizzle-orm";
import { pool } from "../db";
import { SaasError, SaasStore, type SaasExecutor, type SaasDatabase } from "./saas-store";

import { saasEnvironment } from "./saas-environment";

// Live requires explicit approval, production-only credentials and a permanent origin.
export function saasEnabled() {
  return saasEnvironment() !== null;
}
export function saasOrganisationEnabled(org: unknown) {
  return saasEnabled() && !collectionPilotConfigured() && pilotOrganisationAllowed(org);
}
export async function saasRequestEnabled(req: any) {
  if (!saasEnabled() || collectionPilotConfigured()) return false;
  if (!livePilotConfigured()) return true;
  const userId = req.session?.userId;
  if (!userId) return false;
  const row = (await pool.query("SELECT organisation_id FROM users WHERE id=$1", [userId])).rows[0];
  return saasOrganisationEnabled(row?.organisation_id);
}
export function drizzleSaasExecutor(tx: any): SaasExecutor {
  return { query: async (text, params = []) => {
    const pieces = text.split(/\$(\d+)/);
    const query = sql.join(pieces.map((piece, index) => index % 2 ? sql`${sql.param(params[Number(piece) - 1])}` : sql.raw(piece)), sql.raw(""));
    const result = await tx.execute(query);
    return { rows: result.rows, rowCount: result.rowCount };
  } };
}
const database: SaasDatabase = {
  query: (text, params) => pool.query(text, params),
  transaction: async fn => {
    const client = await pool.connect();
    try { await client.query("BEGIN"); const value = await fn(client); await client.query("COMMIT"); return value; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  },
};
export const saasStore = new SaasStore(database, undefined, process.env.SAAS_BILLING_MODE === "live" ? "live" : "sandbox");
export async function saasForOrganisation(org: number) {
  if (!saasOrganisationEnabled(org)) return null;
  if(proPilotConfigured() && !(await saasStore.db.query("SELECT organisation_id FROM saas_accounts WHERE organisation_id=$1",[org])).rows.length) return null;
  try { return await saasStore.current(org); } catch (error) {
    if (error instanceof SaasError && error.code === "LEGACY_SUBSCRIPTION_REQUIRES_REVIEW") return null;
    throw error;
  }
}
let timer: ReturnType<typeof setInterval> | undefined;
export function startSaasJobs() {
  if (automaticMaintenanceSuspended() || collectionPilotConfigured() || livePilotConfigured() || !saasEnabled() || timer) return;
  const run = async () => {
    const organisations = await database.query("SELECT id FROM organisations ORDER BY id");
    for (const { id } of organisations.rows) {
      try { await saasStore.tick(id); }
      catch (error: any) { console.warn("SaaS transition deferred", { organisationId: id, code: error.code || "SAAS_UNAVAILABLE" }); }
    }
  };
  let running = false;
  timer = setInterval(async () => {
    if (automaticMaintenanceSuspended() || collectionPilotConfigured() || livePilotConfigured() || running) return; running = true;
    try { await run(); } catch { console.warn("SaaS scheduler unavailable"); } finally { running = false; }
  }, 30_000);
  timer.unref();
}

export async function collectionPilotRequestEnabled(req: any) {
  if (!collectionPilotConfigured() || !saasEnabled() || !req.session?.userId) return false;
  const row=(await pool.query("SELECT o.id FROM organisations o WHERE o.owner_id=$1",[req.session.userId])).rows[0];
  return collectionPilotAllowed(row?.id);
}
