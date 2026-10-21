import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createOrderWithItemsSchema } from "../../shared/routes";

const root = process.cwd();
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const routes = readFileSync(join(root, "shared/routes.ts"), "utf8");
const ordersPage = readFileSync(join(root, "client/src/pages/orders.tsx"), "utf8");
const auth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
const orderItemQuantitySchema = readFileSync(join(root, "server/lib/order-item-quantity-schema.ts"), "utf8");

const valid = createOrderWithItemsSchema.parse({
  customerId: 1,
  items: [{ serviceId: 1, quantity: 2.5 }],
});

assert.equal(valid.items[0].quantity, "2.5");
assert.throws(() => createOrderWithItemsSchema.parse({
  customerId: 1,
  items: [{ serviceId: 1, quantity: 0 }],
}));

assert.match(schema, /quantity: decimal\("quantity", \{ precision: 16, scale: 6 \}\)\.notNull\(\)/);
assert.match(schema, /garmentItems = pgTable\("garment_items"[\s\S]*quantity: integer\("quantity"\)\.notNull\(\)\.default\(1\)/);
assert.match(routes, /quantity: z\.union\(\[z\.string\(\), z\.number\(\)\]\)\.transform\(String\)/);
assert.match(ordersPage, /name=\{`items\.\$\{index\}\.quantity`\}[\s\S]*inputMode=\{isWeightService \? "decimal" : "numeric"\}/);
assert.match(ordersPage, /name=\{`garmentItems\.\$\{index\}\.quantity`\}[\s\S]*min="1"/);
assert.match(auth, /ensureOrderItemQuantitySupportsDecimals/);
assert.match(storage, /ensureOrderItemQuantitySupportsDecimals\(\)/);
assert.match(orderItemQuantitySchema, /ALTER COLUMN quantity TYPE numeric\(16, 6\)/);
assert.match(orderItemQuantitySchema, /USING quantity::numeric/);
assert.match(orderItemQuantitySchema, /order_items\.quantity must be numeric\(16,6\)/);
assert.match(storage, /::float8/);

for (const quantity of ["0.000001", "2,123456", "999.123456"]) {
  assert.equal(createOrderWithItemsSchema.parse({ customerId: 1, items: [{ serviceId: 1, quantity }] }).items[0].quantity, quantity);
}
for (const quantity of ["0", "-1", "1.1234567", "invalid", Infinity, NaN]) {
  assert.throws(() => createOrderWithItemsSchema.parse({ customerId: 1, items: [{ serviceId: 1, quantity }] }));
}

// Exercise the actual startup guard against disposable PostgreSQL only.
process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/test_only";
const { PGlite } = await import("@electric-sql/pglite");
const pg = new PGlite();
const { pool } = await import("../db");
let migrationSql = "";
(pool as any).query = (text: string, params?: unknown[]) => {
  if (text.includes("DO $$")) migrationSql = text;
  return pg.query(text, params);
};
(pool as any).connect = () => { throw new Error("Network database access forbidden"); };
try {
  await pg.exec("CREATE TABLE order_items (quantity numeric(10,2) NOT NULL); INSERT INTO order_items VALUES (2.66)");
  const { ensureOrderItemQuantitySupportsDecimals } = await import("./order-item-quantity-schema");
  await ensureOrderItemQuantitySupportsDecimals();
  await pg.exec("INSERT INTO order_items VALUES (1234567890.123456)");
  // A later startup must preserve all six decimals too.
  await pg.exec(migrationSql);
  const result = await pg.query<{ quantity: string }>("SELECT quantity::text AS quantity FROM order_items ORDER BY order_items.quantity");
  assert.deepEqual(result.rows.map(row => row.quantity), ["2.660000", "1234567890.123456"]);
} finally {
  await pg.close();
  await pool.end();
}
console.log("decimal order quantity regression tests passed");
