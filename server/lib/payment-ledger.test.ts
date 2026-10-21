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
assert.match(page, /data-testid="payment-ledger-redesign"/);
assert.match(page, /payments-\$\{from\}-\$\{to\}\.csv/);
assert.match(page, /data\.totals\.byMethod/);
assert.match(page, /p\.orderNumber/);
assert.match(page, /current_payment_status/);

console.log("Payment ledger regression checks passed");

// Execute the production query on synthetic data. An unpaid earlier order and
// multiple payments must not change the site's order numbering.
const { PGlite } = await import("@electric-sql/pglite");
const ledgerDb = new PGlite();
try {
  await ledgerDb.exec(`
    CREATE TABLE orders (id int, site_id int, customer_id int, created_at timestamptz, payment_status text);
    CREATE TABLE payments (id int, order_id int, amount numeric, method text, reference text, date timestamptz, collected_by_employee_id int);
    CREATE TABLE customers (id int, name text, phone text);
    CREATE TABLE sites (id int, name text);
    CREATE TABLE employees (id int, name text, user_id text);
    INSERT INTO customers VALUES (1,'QA client','');
    INSERT INTO sites VALUES (1,'QA site'),(2,'Other site');
    INSERT INTO employees VALUES (1,'QA employee','qa-user');
    INSERT INTO orders VALUES
      (10,1,1,'2026-10-01','unpaid'),
      (50,1,1,'2026-10-02','paid'),
      (51,1,1,'2026-10-03','paid'),
      (99,2,1,'2026-10-01','paid');
    INSERT INTO payments VALUES
      (1,50,500,'Cash',NULL,'2026-10-10',1),
      (2,50,1500,'Bank Transfer',NULL,'2026-10-20',1),
      (3,51,100,'Cash',NULL,'2026-11-01',1),
      (4,99,999,'Cash',NULL,'2026-10-20',1);
  `);
  const template = routes.match(/`WITH numbered_orders AS \([\s\S]*?LIMIT 5000`/)?.[0].slice(1,-1);
  assert.ok(template, "Production ledger query must be available");
  const where = 'o.site_id = ANY($1::int[]) AND p.date BETWEEN $2 AND $3';
  const params = [[1], '2026-10-01', '2026-10-31'];
  const both = await ledgerDb.query<any>(template.replace('${where}', where), params);
  assert.equal(both.rows.length, 2);
  assert.deepEqual(both.rows.map(row => Number(row.orderNumber)), [2,2]);
  assert.deepEqual(both.rows.map(row => row.orderId), [50,50]);
  const filtered = await ledgerDb.query<any>(template.replace('${where}', where + ' AND p.method = $4 AND e.user_id = $5'), [...params,'Bank Transfer','qa-user']);
  assert.equal(filtered.rows.length, 1);
  assert.equal(Number(filtered.rows[0].orderNumber), 2);
  const later = await ledgerDb.query<any>(template.replace('${where}', where), [[1], '2026-11-01', '2026-11-30']);
  assert.equal(Number(later.rows[0].orderNumber), 3);
  console.log("Payment ledger SQL: stable numbering across payments, filters and site boundaries passed");
} finally {
  await ledgerDb.close();
}
