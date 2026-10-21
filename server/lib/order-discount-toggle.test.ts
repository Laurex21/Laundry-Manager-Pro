import assert from "node:assert/strict";
import fs from "node:fs";

const ordersPage = fs.readFileSync("client/src/pages/orders.tsx", "utf8");
const routes = fs.readFileSync("server/routes.ts", "utf8");
const contract = fs.readFileSync("shared/routes.ts", "utf8");
const i18n = fs.readFileSync("client/src/lib/i18n.ts", "utf8");

assert.match(ordersPage, /button-discount-fixed/);
assert.match(ordersPage, /button-discount-percentage/);
assert.match(ordersPage, /grid-cols-1 gap-4 sm:grid-cols-2/);
assert.match(ordersPage, /<fieldset className="space-y-1\.5">/);
assert.match(ordersPage, /bg-background text-foreground shadow-sm/);
assert.match(ordersPage, /max="100"/);
assert.match(ordersPage, /value=\{watchedDiscountPct \?\? ""\}/);
assert.match(ordersPage, /const percentage = event\.currentTarget\.value/);
assert.match(ordersPage, /field\.onChange\(percentage\)/);
// This restriction belongs to the percentage-discount control. Other fields,
// such as optional dates, legitimately use an empty string as their DOM value.
const percentageStart = ordersPage.indexOf('name="discountPct"');
assert.ok(percentageStart >= 0, "percentage discount field must exist");
const percentageField = ordersPage.slice(percentageStart, ordersPage.indexOf("</FormItem>", percentageStart));
assert.match(percentageField, /value=\{watchedDiscountPct \?\? ""\}/);
assert.doesNotMatch(percentageField, /value=\{field\.value \?\? ""\}/);
assert.match(ordersPage, /formatExactMoney\(discountAmount, symbol, i18n\.language\)/);
assert.match(contract, /discountPct: z\.coerce\.number\(\)\.min\(0\)\.max\(100\)/);
assert.match(routes, /multiplyDecimal\(subtotal, String\(discountPct \/ 100\)\)/);
assert.match(routes, /compareDecimals\(discountAmount, subtotal\) > 0/);
assert.match(routes, /discountPct: discountPct\.toString\(\)/);
assert.match(i18n, /"fixed_amount": "Montant"/);
assert.match(i18n, /"percentage": "Pourcentage"/);

console.log("order discount toggle regression tests passed");
