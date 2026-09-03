import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("server/routes.ts", "utf8");
const page = readFileSync("client/src/pages/payments.tsx", "utf8");

assert.match(routes, /app\.get\("\/api\/payments\/ledger"/);
assert.match(routes, /o\.site_id = ANY\(\$1::int\[\]\)/);
assert.match(routes, /AND e\.user_id =/);
assert.match(routes, /LIMIT 5000/);
assert.match(page, /data-testid="payment-ledger"/);
assert.match(page, /payments-\$\{from\}-\$\{to\}\.csv/);
assert.match(page, /data\.totals\.byMethod/);

console.log("Payment ledger regression checks passed");
