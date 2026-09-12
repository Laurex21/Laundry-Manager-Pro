import { pool } from "../server/db";
import { ensureAuthSchema } from "../server/replit_integrations/auth/replitAuth";
import { readFile } from "node:fs/promises";

async function runReviewedMigration(path: URL): Promise<void> {
  const sql = await readFile(path, "utf8");
  await pool.query(sql);
}

async function main() {
  await ensureAuthSchema();
  await runReviewedMigration(new URL("../migrations/20260912_platform_admin_mfa.sql", import.meta.url));
  console.log("Reviewed application migrations completed.");
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error("Reviewed application migrations failed:", error);
    await pool.end();
    process.exit(1);
  });
