// Explicit development-only command. Never imported from startup/build/release.
import { readFile } from "node:fs/promises";
const target = new URL(process.env.DATABASE_URL || "postgresql://missing/invalid");
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT ||
    process.env.XPRESSPRO_SCHEMA_CHANGE_TARGET !== "development" ||
    !["helium", "localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    (target.hostname === "helium" && target.pathname !== "/heliumdb")) {
  throw new Error("Use a reviewed local development database with XPRESSPRO_SCHEMA_CHANGE_TARGET=development. Deployments and remote production databases are refused.");
}
const { pool } = await import("../server/db");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(20261120, 5133)");
  const { rows } = await client.query("SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'storefronts' AND column_name = 'branding'");
  if (rows.length) {
    if (rows[0].data_type !== "jsonb" || rows[0].is_nullable !== "NO" || !rows[0].column_default) throw new Error("Unexpected branding column. Review schema drift before continuing.");
    console.log("Storefront branding column already exists; no schema changes.");
  } else {
    const sql = await readFile(new URL("../migrations/20261120_storefront_branding.sql", import.meta.url), "utf8");
    await client.query(sql.replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, ""));
    console.log("Storefront branding migration applied to the reviewed development database.");
  }
  await client.query("COMMIT");
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { client.release(); await pool.end(); }
