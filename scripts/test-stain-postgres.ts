import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { applyOrderMoneyFoundation } from "../server/lib/order-money-foundation";
import { createOrReplayPayment, OrderMoneyConflictError } from "../server/lib/order-money";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required; refusing to use a default database");
const forbidden = [process.env.DATABASE_URL, process.env.REPLIT_DATABASE_URL, process.env.PRODUCTION_DATABASE_URL].filter(Boolean);
if (forbidden.includes(testUrl)) throw new Error("TEST_DATABASE_URL matches a configured application/production database");
const parsed = new URL(testUrl);
const host = parsed.hostname.toLowerCase();
const database = parsed.pathname.replace(/^\//, "").toLowerCase();
const safeMarker = /(^|[^a-z])(test|testing|ci|local)([^a-z]|$)/;
if (!safeMarker.test(host) && !safeMarker.test(database)) throw new Error("TEST_DATABASE_URL host or database name is not clearly test-only");

const schemaA = `stain_money_${randomBytes(12).toString("hex")}`;
const schemaB = `stain_money_${randomBytes(12).toString("hex")}`;
const schemaC = `stain_money_${randomBytes(12).toString("hex")}`;
const validSchema = /^stain_money_[0-9a-f]{24}$/;
assert.match(schemaA, validSchema); assert.match(schemaB, validSchema);
const pool = new pg.Pool({ connectionString: testUrl, max: 4 });
const migration = await readFile(join(process.cwd(), "migrations/20260807_order_money_foundation.sql"), "utf8");

const base = `
 CREATE TABLE organisations(id serial PRIMARY KEY,name varchar(255) NOT NULL,owner_id varchar NOT NULL,created_at timestamp DEFAULT now());
 CREATE TABLE sites(id serial PRIMARY KEY,organisation_id integer NOT NULL REFERENCES organisations(id),name varchar(255) NOT NULL);
 CREATE TABLE customers(id serial PRIMARY KEY,site_id integer);
 CREATE TABLE orders(
   id serial PRIMARY KEY,
   customer_id integer NOT NULL REFERENCES customers(id),
   site_id integer,
   total_amount numeric(10,2) NOT NULL DEFAULT 0,
   original_price numeric(10,2) NOT NULL DEFAULT 0,
   discount_amount numeric(10,2) NOT NULL DEFAULT 0,
   discount numeric(10,2) NOT NULL DEFAULT 0,
   pickup_cost numeric(10,2) NOT NULL DEFAULT 0
 );
 CREATE TABLE payments(id serial PRIMARY KEY,order_id integer NOT NULL REFERENCES orders(id),collected_by_employee_id integer,amount numeric(10,2) NOT NULL,method varchar(50) NOT NULL,reference varchar(255),date timestamp DEFAULT now(),is_advance boolean DEFAULT false,idempotency_key varchar(100));
 CREATE TABLE site_members(id serial PRIMARY KEY,site_id integer NOT NULL REFERENCES sites(id),user_id varchar NOT NULL,role varchar(50) NOT NULL);
 CREATE TABLE membership_subscription_payments(id serial PRIMARY KEY,organisation_id integer NOT NULL REFERENCES organisations(id),amount numeric(12,2) NOT NULL);
 CREATE TABLE credit_transactions(id serial PRIMARY KEY,organisation_id integer NOT NULL REFERENCES organisations(id),amount numeric(12,2) NOT NULL);
`;

async function setup(schema: string, rerun: boolean) {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(base);
    if (rerun) {
      await client.query(`
        CREATE TABLE order_refunds(id serial PRIMARY KEY, order_id integer, amount numeric(10,2));
        CREATE TABLE order_payment_allocations(id serial PRIMARY KEY, payment_id integer, unallocated_amount numeric(10,2));
        CREATE TABLE order_refund_allocations(id serial PRIMARY KEY, refund_id integer, unallocated_amount numeric(10,2));
      `);
    }
    await client.query(`INSERT INTO organisations(name,owner_id) VALUES ('legacy','owner'); INSERT INTO sites(organisation_id,name) VALUES (1,'legacy'); INSERT INTO customers(site_id) VALUES (1); INSERT INTO orders(customer_id,site_id,total_amount,original_price,discount_amount,discount,pickup_cost) VALUES (1,1,10,10,0,0,0); INSERT INTO payments(order_id,amount,method) VALUES (1,2,'cash')`);
    if (rerun) await client.query(`
      INSERT INTO order_refunds(order_id,amount) VALUES (1,1);
      INSERT INTO order_payment_allocations(payment_id,unallocated_amount) VALUES (1,2);
      INSERT INTO order_refund_allocations(refund_id,unallocated_amount) VALUES (1,1);
    `);
    if (rerun) await applyOrderMoneyFoundation(client);
    else {
      await client.query(migration);
      await client.query(`
        INSERT INTO order_refunds(organisation_id,site_id,order_id,amount,reason,status,idempotency_key,request_fingerprint)
        VALUES (1,1,1,1,'legacy correction','approved_internal','legacy-refund','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
        INSERT INTO order_refund_allocations(refund_id,organisation_id,site_id,unallocated_amount)
        VALUES (1,1,1,1);
      `);
    }
  } finally { client.release(); }
}

async function signature(schema: string) {
  const [columns, indexes, constraints, triggers, functions] = await Promise.all([
    pool.query(`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name,column_name`, [schema]),
    pool.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=$1 ORDER BY tablename,indexname`, [schema]),
    pool.query(`SELECT c.conrelid::regclass::text AS table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=$1 ORDER BY 1,2`, [schema]),
    pool.query(`SELECT event_object_table,trigger_name,event_manipulation,action_statement FROM information_schema.triggers WHERE trigger_schema=$1 ORDER BY 1,2,3`, [schema]),
    pool.query(`SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 ORDER BY 1`, [schema]),
  ]);
  const normalize = (rows: any[]) => rows.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) => [key, typeof value === "string" ? value.replaceAll(schema, "<schema>") : value])));
  return { columns: normalize(columns.rows), indexes: normalize(indexes.rows), constraints: normalize(constraints.rows), triggers: normalize(triggers.rows), functions: normalize(functions.rows) };
}

try {
  await setup(schemaA, false);
  await setup(schemaB, true);
  const broken = await pool.connect();
  try {
    await broken.query(`CREATE SCHEMA "${schemaC}"; SET search_path TO "${schemaC}"; ${base}`);
    await broken.query(`CREATE TABLE order_refunds(id serial PRIMARY KEY,order_id integer,amount numeric(10,2)); CREATE TABLE order_payment_allocations(id serial PRIMARY KEY,payment_id integer); CREATE TABLE order_refund_allocations(id serial PRIMARY KEY,refund_id integer); INSERT INTO order_refunds(order_id,amount) VALUES (999999,1)`);
    await assert.rejects(applyOrderMoneyFoundation(broken), /cannot safely repair legacy order_refunds/);
    await broken.query("ROLLBACK");
  } finally { broken.release(); }
  const concurrentFoundation = async () => {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaB}"`);
      await applyOrderMoneyFoundation(client);
    } finally { client.release(); }
  };
  await Promise.all([concurrentFoundation(), concurrentFoundation()]);
  assert.deepEqual(await signature(schemaA), await signature(schemaB), "migration and Replit self-heal schema must match");
  const seed = await pool.connect();
  try {
    await seed.query(`SET search_path TO "${schemaA}"`);
    assert.equal((await seed.query(`SELECT organisation_id,site_id FROM orders WHERE id=1`)).rows[0].organisation_id, 1);
    assert.equal((await seed.query(`SELECT organisation_id,site_id FROM payments WHERE id=1`)).rows[0].organisation_id, 1);
    assert.equal((await seed.query(`SELECT unallocated_amount FROM order_payment_allocations WHERE payment_id=1`)).rows[0].unallocated_amount, "2.00");
    assert.equal((await seed.query(`SELECT unallocated_amount FROM order_refund_allocations WHERE refund_id=1`)).rows[0].unallocated_amount, "1.00");
    await seed.query(`INSERT INTO organisations(name,owner_id) VALUES ('other','owner2'); INSERT INTO sites(organisation_id,name) VALUES (2,'other'); INSERT INTO customers(site_id) VALUES (2); INSERT INTO orders(customer_id,site_id,organisation_id,total_amount) VALUES (2,2,2,10)`);
    await assert.rejects(seed.query(`UPDATE orders SET organisation_id=2,site_id=2 WHERE id=1`));
    await assert.rejects(seed.query(`INSERT INTO orders(customer_id,site_id,organisation_id,total_amount) VALUES (1,1,2,10)`));
    await assert.rejects(seed.query(`UPDATE payments SET amount=3 WHERE id=1`));
    await assert.rejects(seed.query(`DELETE FROM payments WHERE id=1`));
    await assert.rejects(seed.query(`INSERT INTO order_payment_allocations(payment_id,organisation_id,site_id,service_amount,pickup_delivery_amount) VALUES (1,1,1,1,1)`));
    await assert.rejects(seed.query(`INSERT INTO order_payment_allocations(payment_id,organisation_id,site_id,service_amount) VALUES (1,2,2,1)`));
    const scopedPool = { connect: async () => { const client = await pool.connect(); await client.query(`SET search_path TO "${schemaA}"`); return client; } };
    const paymentInput = { organisationId:1,siteId:1,orderId:1,idempotencyKey:"behavioral-payment-key",amount:"5",method:"cash" };
    const created = await createOrReplayPayment(scopedPool, paymentInput);
    assert.equal(created.replayed, false); assert.deepEqual(created.allocations, [{ target:"service",amount:"5.00" }]);
    assert.equal((await createOrReplayPayment(scopedPool, paymentInput)).replayed, true);
    await assert.rejects(createOrReplayPayment(scopedPool, { ...paymentInput, amount:"6" }), OrderMoneyConflictError);
    const rollbackKey = "behavioral-rollback-key";
    await assert.rejects(createOrReplayPayment(scopedPool, { ...paymentInput, idempotencyKey: rollbackKey, amount:"-1" }));
    assert.equal((await seed.query(`SELECT count(*)::int AS count FROM payments WHERE idempotency_key=$1`, [rollbackKey])).rows[0].count, 0);
    await seed.query(`INSERT INTO order_refunds(organisation_id,site_id,order_id,amount,reason,status,idempotency_key,request_fingerprint) VALUES (1,1,1,1,'correction','approved_internal','internal-only','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')`);
    await assert.rejects(seed.query(`UPDATE order_refunds SET amount=2 WHERE id=1`));
    await assert.rejects(seed.query(`DELETE FROM order_refunds WHERE id=1`));
    await assert.rejects(seed.query(`UPDATE organisations SET currency='ZAR' WHERE id=1`));
    await seed.query(`INSERT INTO payments(order_id,organisation_id,site_id,amount,method,idempotency_key,request_fingerprint) VALUES (1,1,1,10,'cash','race','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')`);
  } finally { seed.release(); }
  const race = async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN"); await client.query(`SET LOCAL search_path TO "${schemaA}"`);
      await client.query(`INSERT INTO order_payment_allocations(payment_id,organisation_id,site_id,service_amount) VALUES (3,1,1,7)`);
      await client.query("COMMIT"); return "ok";
    } catch { await client.query("ROLLBACK"); return "rejected"; } finally { client.release(); }
  };
  const outcomes = await Promise.all([race(), race()]);
  assert.deepEqual(outcomes.sort(), ["ok", "rejected"]);
  console.log("Order money PostgreSQL foundation checks passed");
} finally {
  for (const schema of [schemaA, schemaB, schemaC]) {
    if (!validSchema.test(schema)) throw new Error("Refusing to drop an unvalidated schema name");
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
  await pool.end();
}
