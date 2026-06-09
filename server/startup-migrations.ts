import { sql } from "drizzle-orm";
import { db } from "./db";

export async function runStartupMigrations() {
  await db.execute(sql`
    ALTER TABLE "customers"
    ADD COLUMN IF NOT EXISTS "area" text
  `);

  await db.execute(sql`
    ALTER TABLE "garment_items"
    ADD COLUMN IF NOT EXISTS "details" text
  `);
}
