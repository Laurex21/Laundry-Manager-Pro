import { sql } from "drizzle-orm";
import { pool } from "../db";
import { SaasError, SaasStore, type SaasExecutor, type SaasDatabase } from "./saas-store";

// No live mode exists in this implementation. Production is never enabled by default.
export function saasEnabled() {
  return process.env.SAAS_BILLING_MODE === "sandbox" && process.env.NODE_ENV !== "production";
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
export const saasStore = new SaasStore(database);
export async function saasForOrganisation(org: number) {
  if (!saasEnabled()) return null;
  try { return await saasStore.current(org); } catch (error) {
    if (error instanceof SaasError && error.code === "LEGACY_SUBSCRIPTION_REQUIRES_REVIEW") return null;
    throw error;
  }
}
let timer: ReturnType<typeof setInterval> | undefined;
export function startSaasJobs() {
  if (!saasEnabled() || timer) return;
  const run = async () => {
    const organisations = await database.query("SELECT id FROM organisations ORDER BY id");
    for (const { id } of organisations.rows) {
      try { await saasStore.tick(id); }
      catch (error: any) { console.warn("SaaS transition deferred", { organisationId: id, code: error.code || "SAAS_UNAVAILABLE" }); }
    }
  };
  let running = false;
  timer = setInterval(async () => {
    if (running) return; running = true;
    try { await run(); } catch { console.warn("SaaS scheduler unavailable"); } finally { running = false; }
  }, 30_000);
  timer.unref();
}
