import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

assert.match(read("shared/schema.ts"), /garmentItems = pgTable\("garment_items"[\s\S]*color: varchar\("color", \{ length: 40 \}\)/);
assert.match(read("shared/routes.ts"), /garmentItems: z\.array[\s\S]*color: z\.string\(\)\.trim\(\)\.max\(40\)/);
assert.match(read("server/lib/order-creation.ts"), /garmentItems\)\.values\(\{[\s\S]*color: garment\.color \|\| null/);
const corrections = read("server/lib/order-corrections.ts");
const garmentInserts = [...corrections.matchAll(/INSERT INTO garment_items\s*\(([^)]+)\)/g)];
assert.equal(garmentInserts.length, 2, "both direct correction and corrected copy must save garment details");
for (const [, columns] of garmentInserts) {
  assert.deepEqual(columns.split(",").map(column => column.trim()), ["order_id", "item_name", "quantity", "color", "textile_reserve"], "corrections must preserve color and textile reserves together");
}
assert.match(read("client/src/pages/orders.tsx"), /palette-garment-color-/);
assert.match(read("client/src/components/garment-color-picker.tsx"), /aria-pressed/);
assert.match(read("client/src/components/garment-color-picker.tsx"), /compact = false/);
assert.match(read("client/src/components/garment-color-picker.tsx"), /garment_color_recent/);
assert.match(read("client/src/components/garment-color-picker.tsx"), /GARMENT_COLOR_FAMILIES/);
assert.match(read("client/src/lib/garment-colors.ts"), /value: "burgundy"/);
assert.match(read("client/src/lib/garment-colors.ts"), /value: "turquoise"/);
assert.match(read("client/src/pages/orders.tsx"), /<GarmentColorPicker compact/);
assert.match(read("client/src/pages/orders.tsx"), /md:grid-cols-\[minmax\(0,1fr\)_5rem_minmax\(9rem,0\.65fr\)_2\.5rem\]/);
assert.match(read("client/src/lib/i18n.ts"), /"garments_count": "\{\{count\}\} garments"/);
assert.match(read("client/src/pages/order-detail.tsx"), /garmentColorSwatch/);
assert.match(read("client/src/lib/receipt.ts"), /garment\.color/);

console.log("garment color regression tests passed");
