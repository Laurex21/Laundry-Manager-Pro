import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type StainTreatmentSchemaQuery = { query(sql: string): Promise<unknown> };

export async function applyStainTreatmentSchema(database: StainTreatmentSchemaQuery) {
  const migration = await readFile(join(process.cwd(), "migrations/20260807_stain_treatment_pricing.sql"), "utf8");
  await database.query(migration);
}
