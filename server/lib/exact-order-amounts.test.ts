import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addDecimals, formatExactMoney, isIntegerDecimal, multiplyDecimal, normalizeDecimalInput } from "../../shared/exact-decimal";

assert.equal(normalizeDecimalInput("2,66"), "2.66");
assert.equal(multiplyDecimal("2.66", "386.3"), "1027.558");
assert.equal(addDecimals("1027.558", "25.04", "-0.008"), "1052.59");
assert.equal(formatExactMoney("1027.558", "FCFA", "fr-FR"), "1 027,558 FCFA");
assert.equal(isIntegerDecimal("2"), true);
assert.equal(isIntegerDecimal("2.5"), false);

const server = readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
const corrections = readFileSync(new URL("./order-corrections.ts", import.meta.url), "utf8");
const ordersPage = readFileSync(new URL("../../client/src/pages/orders.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../migrations/20260916_exact_order_amounts.sql", import.meta.url), "utf8");

assert.match(server, /service\.siteId !== siteId/);
assert.match(server, /La quantité doit être entière pour un service facturé à la pièce/);
assert.match(corrections, /sv\.site_id = \$3/);
assert.match(corrections, /multiplyDecimal/);
assert.match(ordersPage, /inputMode=\{isWeightService \? "decimal" : "numeric"\}/);
assert.match(ordersPage, /formatExactMoney\(total/);
assert.doesNotMatch(ordersPage, /subtotal\.toFixed\(2\)/);
assert.match(migration, /order_items[\s\S]*quantity TYPE numeric\(16,6\)/);
assert.match(migration, /payments ALTER COLUMN amount TYPE numeric\(18,6\)/);

console.log("exact order amount regression checks passed");
