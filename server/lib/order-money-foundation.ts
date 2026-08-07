import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type FoundationQuery = { query(sql: string): Promise<unknown> };

export async function applyOrderMoneyFoundation(database: FoundationQuery) {
  const migration = await readFile(join(process.cwd(), "migrations/20260807_order_money_foundation.sql"), "utf8");
  await database.query(migration);
}
