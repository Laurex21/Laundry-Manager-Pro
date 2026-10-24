import { pool } from "../db";

// Missing schema requires a reviewed migration while maintenance is suspended.
export async function requireExistingColumns(table: string, names: string[]): Promise<void> {
  const { rows } = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2::text[])`,
    [table, names],
  );
  const found = new Set(rows.map(row => row.column_name));
  if (names.some(name => !found.has(name))) {
    throw new Error(`Reviewed schema migration required for ${table}; automatic maintenance is suspended`);
  }
}
