import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required; refusing to use a default database");
const forbidden = [process.env.DATABASE_URL, process.env.REPLIT_DATABASE_URL, process.env.PRODUCTION_DATABASE_URL].filter(Boolean);
if (forbidden.includes(testUrl)) throw new Error("TEST_DATABASE_URL matches a configured application/production database");
const parsed = new URL(testUrl);
const testMarker = `${parsed.hostname}/${parsed.pathname}/${parsed.search}`.toLowerCase();
if (!/(^|[^a-z])(test|testing|ci|local)([^a-z]|$)/.test(testMarker)) throw new Error("TEST_DATABASE_URL is not clearly test-only");

const schemaA = `stain_money_${randomBytes(12).toString("hex")}`;
const schemaB = `stain_money_${randomBytes(12).toString("hex")}`;
const validSchema = /^stain_money_[0-9a-f]{24}$/;
assert.match(schemaA, validSchema); assert.match(schemaB, validSchema);
const pool = new pg.Pool({ connectionString: testUrl, max: 4 });
const migration = await readFile(join(process.cwd(), "migrations/20260807_order_money_foundation.sql"), "utf8");

const base = `
 CREATE TABLE organisations(id serial PRIMARY KEY,name varchar(255) NOT NULL,owner_id varchar NOT NULL,created_at timestamp DEFAULT now());
 CREATE TABLE sites(id serial PRIMARY KEY,organisation_id integer NOT NULL REFERENCES organisations(id),name varchar(255) NOT NULL);
 CREATE TABLE customers(id serial PRIMARY KEY,site_id integer);
 CREATE TABLE orders(id serial PRIMARY KEY,customer_id integer NOT NULL REFERENCES customers(id),site_id integer,total_amount numeric(10,2) NOT NULL DEFAULT 0);
 CREATE TABLE payments(id serial PRIMARY KEY,order_id integer NOT NULL REFERENCES orders(id),amount numeric(10,2) NOT NULL,idempotency_key varchar(100));
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
    await client.query(migration);
    if (rerun) await client.query(migration); // same SQL used by foundation Replit self-heal
  } finally { client.release(); }
}

async function signature(schema: string) {
  const result = await pool.query(`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name,ordinal_position`, [schema]);
  return result.rows;
}

try {
  await setup(schemaA, false);
  await setup(schemaB, true);
  assert.deepEqual(await signature(schemaA), await signature(schemaB), "migration and Replit self-heal schema must match");
  const seed = await pool.connect();
  try {
    await seed.query(`SET search_path TO "${schemaA}"`);
    await seed.query(`INSERT INTO organisations(name,owner_id) VALUES ('test','owner')`);
    await seed.query(`INSERT INTO sites(organisation_id,name) VALUES (1,'test')`);
    await seed.query(`INSERT INTO customers(site_id) VALUES (1)`);
    await seed.query(`INSERT INTO orders(customer_id,site_id,organisation_id,total_amount) VALUES (1,1,1,10)`);
    await seed.query(`INSERT INTO payments(order_id,organisation_id,site_id,amount,idempotency_key,request_fingerprint) VALUES (1,1,1,10,'race','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')`);
  } finally { seed.release(); }
  const race = async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN"); await client.query(`SET LOCAL search_path TO "${schemaA}"`);
      await client.query(`INSERT INTO order_payment_allocations(payment_id,organisation_id,site_id,service_amount) VALUES (1,1,1,7)`);
      await client.query("COMMIT"); return "ok";
    } catch { await client.query("ROLLBACK"); return "rejected"; } finally { client.release(); }
  };
  const outcomes = await Promise.all([race(), race()]);
  assert.deepEqual(outcomes.sort(), ["ok", "rejected"]);
  console.log("Order money PostgreSQL foundation checks passed");
} finally {
  for (const schema of [schemaA, schemaB]) {
    if (!validSchema.test(schema)) throw new Error("Refusing to drop an unvalidated schema name");
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
  await pool.end();
}
