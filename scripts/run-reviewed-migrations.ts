import { pool } from "../server/db";
import { ensureAuthSchema } from "../server/replit_integrations/auth/replitAuth";

async function main() {
  await ensureAuthSchema();
  console.log("Reviewed application migrations completed.");
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error("Reviewed application migrations failed:", error);
    await pool.end();
    process.exit(1);
  });
