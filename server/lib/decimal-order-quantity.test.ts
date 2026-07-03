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

assert.equal(valid.items[0].quantity, 2.5);
assert.throws(() => createOrderWithItemsSchema.parse({
  customerId: 1,
  items: [{ serviceId: 1, quantity: 0 }],
}));

assert.match(schema, /quantity: decimal\("quantity", \{ precision: 10, scale: 2, mode: "number" \}\)\.notNull\(\)/);
assert.match(schema, /garmentItems = pgTable\("garment_items"[\s\S]*quantity: integer\("quantity"\)\.notNull\(\)\.default\(1\)/);
assert.match(routes, /quantity: z\.number\(\)\.min\(0\.01, "Quantity must be greater than 0"\)/);
assert.match(ordersPage, /name=\{`items\.\$\{index\}\.quantity`\}[\s\S]*min="0\.01"[\s\S]*step="0\.01"/);
assert.match(ordersPage, /name=\{`garmentItems\.\$\{index\}\.quantity`\}[\s\S]*min="1"/);
assert.match(auth, /ensureOrderItemQuantitySupportsDecimals/);
assert.match(storage, /ensureOrderItemQuantitySupportsDecimals\(\)/);
assert.match(orderItemQuantitySchema, /ALTER COLUMN quantity TYPE numeric\(10, 2\)/);
assert.match(orderItemQuantitySchema, /USING quantity::numeric/);
assert.match(orderItemQuantitySchema, /order_items\.quantity must be numeric\(10,2\)/);
assert.match(storage, /::float8/);

console.log("decimal order quantity regression tests passed");
