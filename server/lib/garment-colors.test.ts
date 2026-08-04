import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

assert.match(read("shared/schema.ts"), /garmentItems = pgTable\("garment_items"[\s\S]*color: varchar\("color", \{ length: 40 \}\)/);
assert.match(read("shared/routes.ts"), /garmentItems: z\.array[\s\S]*color: z\.string\(\)\.trim\(\)\.max\(40\)/);
assert.match(read("server/storage.ts"), /garmentItems\)\.values\(\{[\s\S]*color: garment\.color \|\| null/);
assert.match(read("server/lib/order-corrections.ts"), /INSERT INTO garment_items \(order_id, item_name, quantity, color\)/);
assert.match(read("client/src/pages/orders.tsx"), /palette-garment-color-/);
assert.match(read("client/src/components/garment-color-picker.tsx"), /aria-pressed/);
assert.match(read("client/src/pages/order-detail.tsx"), /garmentColorSwatch/);
assert.match(read("client/src/lib/receipt.ts"), /garment\.color/);

console.log("garment color regression tests passed");
