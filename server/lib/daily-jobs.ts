import { pool } from "../db";
import { checkSubscriptionNotifications } from "./subscription-notifications";
import { expireLoyaltyPoints } from "./loyalty";

export async function runDailyJobsWithLock(): Promise<void> {
  const client = await pool.connect();
  let locked = false;
  try {
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext('xpresspro_daily_jobs')) AS locked",
    );
    locked = result.rows[0]?.locked === true;
    if (!locked) return;
    await checkSubscriptionNotifications();
    await expireLoyaltyPoints();
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock(hashtext('xpresspro_daily_jobs'))");
    }
    client.release();
  }
}
