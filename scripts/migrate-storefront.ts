// Explicit development migration only; never imported by application startup.
import { readFile } from "node:fs/promises";
if (process.env.NODE_ENV === "production" || process.env.XPRESSPRO_SCHEMA_CHANGE_TARGET !== "development") {
  throw new Error("Set XPRESSPRO_SCHEMA_CHANGE_TARGET=development with a reviewed development DATABASE_URL. Production is intentionally refused by this helper.");
}
const { pool } = await import("../server/db");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(20261119, 5123)");
  const result = await client.query("SELECT to_regclass('public.storefronts') AS shops, to_regclass('public.storefront_services') AS services, to_regclass('public.storefront_requests') AS requests, to_regclass('public.storefront_events') AS events");
  const found = Object.values(result.rows[0]).filter(Boolean).length;
  if (found > 0 && found < 4) throw new Error("Partial storefront schema detected. Review schema drift before continuing.");
  if (found === 4) console.log("Storefront tables already exist. No schema change; compare the Drizzle schema before activation.");
  else {
    const sql = await readFile(new URL("../migrations/20261119_storefront_v1.sql", import.meta.url), "utf8");
    await client.query(sql.replace(/^BEGIN;\s*/, "").replace(/COMMIT;\s*$/, ""));
    console.log("Storefront V1 development migration applied.");
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally { client.release(); await pool.end(); }
