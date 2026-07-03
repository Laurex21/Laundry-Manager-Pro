import { pool } from "../db";

let decimalQuantitySchemaPromise: Promise<void> | null = null;

async function migrateOrderItemQuantityToDecimal() {
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = ANY (current_schemas(false))
          AND table_name = 'order_items'
          AND column_name = 'quantity'
          AND (
            data_type <> 'numeric'
            OR numeric_precision IS DISTINCT FROM 10
            OR numeric_scale IS DISTINCT FROM 2
          )
      ) THEN
        ALTER TABLE order_items
        ALTER COLUMN quantity TYPE numeric(10, 2)
        USING quantity::numeric;
      END IF;
    END $$;
  `);

  const { rows } = await pool.query<{
    data_type: string;
    numeric_precision: number | null;
    numeric_scale: number | null;
  }>(`
    SELECT data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = ANY (current_schemas(false))
      AND table_name = 'order_items'
      AND column_name = 'quantity'
    LIMIT 1
  `);

  const column = rows[0];
  if (
    !column ||
    column.data_type !== "numeric" ||
    column.numeric_precision !== 10 ||
    column.numeric_scale !== 2
  ) {
    throw new Error("order_items.quantity must be numeric(10,2) before decimal order quantities can be saved");
  }
}

export async function ensureOrderItemQuantitySupportsDecimals() {
  if (!decimalQuantitySchemaPromise) {
    decimalQuantitySchemaPromise = migrateOrderItemQuantityToDecimal().catch((error) => {
      decimalQuantitySchemaPromise = null;
      throw error;
    });
  }

  await decimalQuantitySchemaPromise;
}
