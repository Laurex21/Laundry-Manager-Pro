import { pool } from "../db";

// Replit deployment builds and starts the server without running reviewed migrations.
// These additive, idempotent columns must exist before any order query uses the new schema.
export async function ensureGarmentVerificationSchema(): Promise<void> {
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS requires_garment_verification boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS quality_checked_quantity integer NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS handed_over_quantity integer NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS quality_checked_at timestamp`);
  await pool.query(`ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS quality_checked_by varchar`);
  await pool.query(`ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS handed_over_at timestamp`);
  await pool.query(`ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS handed_over_by varchar`);
}
