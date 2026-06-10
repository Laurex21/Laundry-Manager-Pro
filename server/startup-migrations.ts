import { sql } from "drizzle-orm";
import { db } from "./db";

export async function runStartupMigrations() {
  const migrations = [
    {
      name: "add customers.area",
      statement: sql`
        ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "area" text
      `,
    },
    {
      name: "add garment_items.details",
      statement: sql`
        ALTER TABLE "garment_items"
        ADD COLUMN IF NOT EXISTS "details" text
      `,
    },
  ];

  for (const migration of migrations) {
    try {
      await db.execute(migration.statement);
      console.log(`Startup migration completed: ${migration.name}`);
    } catch (error) {
      console.error(`Startup migration failed: ${migration.name}`, error);
    }
  }
}
