import { storage } from "../server/storage";
import { pool } from "../server/db";

async function main() {
  await storage.seedPlans();
  console.log("Subscription plans seeded or updated.");
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error("Plan seeding failed:", error);
    await pool.end();
    process.exit(1);
  });
