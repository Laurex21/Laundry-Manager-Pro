import { pool } from "../db";

function configuredPlatformAdminEmails(): string[] {
  return Array.from(new Set(
    String(process.env.PLATFORM_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ));
}

export async function syncConfiguredPlatformAdmins(): Promise<void> {
  const emails = configuredPlatformAdminEmails();
  if (emails.length === 0) {
    console.warn("PLATFORM_ADMIN_EMAILS is empty; existing platform administrator access was left unchanged.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const users = await client.query<{ id: string; email: string }>(
      `SELECT id, lower(email) AS email
       FROM users
       WHERE lower(email) = ANY($1::text[])`,
      [emails],
    );
    const foundEmails = new Set(users.rows.map((user) => user.email));
    const missingEmails = emails.filter((email) => !foundEmails.has(email));
    if (missingEmails.length > 0) {
      throw new Error(`Configured platform administrator account not found: ${missingEmails.join(", ")}`);
    }

    await client.query(
      `UPDATE platform_admins pa
       SET is_active = false, revoked_at = COALESCE(pa.revoked_at, now())
       FROM users u
       WHERE pa.user_id = u.id
         AND pa.is_active = true
         AND NOT (lower(u.email) = ANY($1::text[]))`,
      [emails],
    );

    for (const user of users.rows) {
      await client.query(
        `INSERT INTO platform_admins (user_id, is_active, granted_at, revoked_at)
         VALUES ($1, true, now(), NULL)
         ON CONFLICT (user_id) DO UPDATE
         SET is_active = true, revoked_at = NULL`,
        [user.id],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}