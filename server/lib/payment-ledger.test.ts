import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("server/routes.ts", "utf8");
const page = readFileSync("client/src/pages/payments.tsx", "utf8");

assert.match(routes, /app\.get\("\/api\/payments\/ledger"/);
assert.match(routes, /o\.site_id = ANY\(\$1::int\[\]\)/);
assert.match(routes, /AND e\.user_id =/);
assert.match(routes, /LIMIT 5000/);
assert.match(routes, /ROW_NUMBER\(\) OVER \(PARTITION BY o\.site_id ORDER BY o\.created_at, o\.id\) AS "orderNumber"/);
assert.match(routes, /o\.payment_status AS "paymentStatus"/);
assert.match(page, /data-testid="payment-ledger"/);
assert.match(page, /payments-\$\{from\}-\$\{to\}\.csv/);
assert.match(page, /data\.totals\.byMethod/);
assert.match(page, /p\.orderNumber/);
assert.match(page, /current_payment_status/);

console.log("Payment ledger regression checks passed");
