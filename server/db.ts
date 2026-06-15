import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { PoolConfig } from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;
const requiresSsl =
  process.env.DATABASE_SSL === "true" ||
  databaseUrl.includes("sslmode=require") ||
  databaseUrl.includes("supabase.co");

export const pgPoolConfig: PoolConfig = {
  connectionString: databaseUrl,
  ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
};

export const pool = new Pool(pgPoolConfig);

pool.on("error", (err) => {
  console.error("PG Pool idle client error (non-fatal):", err.message);
});

export const db = drizzle(pool, { schema });
