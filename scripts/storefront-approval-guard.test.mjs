import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const install = readFileSync(fileURLToPath(new URL('./sql/install-storefront-approval-guard.sql', import.meta.url)), 'utf8');

async function rejected(db, sql) {
  await assert.rejects(db.exec(sql), error => error.code === '42501' && error.message.includes('STOREFRONT_APPROVAL_REQUIRED'));
}

test('blocks the first migration, including dynamic and renamed objects, without creating them', async () => {
  const db = new PGlite();
  try {
    await db.exec(install);
    for (const sql of [
      'CREATE TABLE public.storefronts(id serial PRIMARY KEY)',
      'CREATE TABLE public.storefront_requests(id int)',
      'CREATE TABLE public."STOREFRONT_SERVICES"(id int)',
      'CREATE SEQUENCE public.storefront_events_id_seq',
      "DO $$ BEGIN EXECUTE 'CREATE TABLE public.' || 'store' || 'fronts(id int)'; END $$",
    ]) await rejected(db, sql);
    await db.exec('CREATE TABLE normal_table(id int)');
    await rejected(db, 'ALTER TABLE normal_table RENAME TO storefronts');
    assert.equal((await db.query("SELECT to_regclass('public.storefronts') AS protected, to_regclass('public.normal_table') AS normal")).rows[0].protected, null);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_class WHERE relname LIKE 'storefront%'")).rows[0].n, 0);
  } finally { await db.close(); }
});

test('protects an existing schema and leaves normal data access and unrelated migrations working', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE storefronts(id int PRIMARY KEY, name text); CREATE INDEX shop_name_idx ON storefronts(name); INSERT INTO storefronts VALUES (1, \'Example\'); CREATE TABLE normal_table(id int); CREATE ROLE app_reader; GRANT SELECT, INSERT, UPDATE, DELETE ON storefronts TO app_reader;');
    await db.exec(install);
    for (const sql of [
      'ALTER TABLE storefronts ADD COLUMN surprise text',
      'ALTER TABLE storefronts RENAME TO another_name',
      'DROP TABLE storefronts',
      'DROP SCHEMA public CASCADE',
      'CREATE INDEX another_idx ON storefronts(name)',
      'DROP INDEX shop_name_idx',
      'ALTER INDEX shop_name_idx RENAME TO renamed_idx',
      "DO $$ BEGIN EXECUTE 'ALTER TABLE ' || 'store' || 'fronts RENAME TO renamed_table'; END $$",
    ]) await rejected(db, sql);
    await db.exec("INSERT INTO storefronts VALUES(2,'Test'); UPDATE storefronts SET name='Updated' WHERE id=2; DELETE FROM storefronts WHERE id=2;");
    await db.exec('ALTER TABLE normal_table ADD COLUMN note text');
    assert.deepEqual((await db.query('SELECT * FROM storefronts')).rows, [{ id: 1, name: 'Example' }]);
    await db.exec('SET ROLE app_reader');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM storefronts')).rows[0].n, 1);
    await db.exec('RESET ROLE');
    await db.exec(install);
    assert.deepEqual((await db.query("SELECT evtenabled FROM pg_event_trigger WHERE evtname LIKE 'xpresspro_storefront_approval_%' ORDER BY evtname")).rows, [{ evtenabled: 'A' }, { evtenabled: 'A' }, { evtenabled: 'A' }]);
    await rejected(db, 'ALTER TABLE storefronts ADD COLUMN still_blocked text');
  } finally { await db.close(); }
});

test('a failed migration rolls back its transaction and replication mode cannot bypass the guard', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE ordinary_data(id int)');
    await db.exec(install);
    await db.exec('SET session_replication_role = replica');
    await rejected(db, 'CREATE TABLE storefront_events(id int)');
    await db.exec('BEGIN; INSERT INTO ordinary_data VALUES (1);');
    await rejected(db, 'CREATE TABLE storefronts(id int)');
    await db.exec('ROLLBACK');
    assert.deepEqual((await db.query('SELECT * FROM ordinary_data')).rows, []);
    assert.equal((await db.query("SELECT to_regclass('public.storefronts') AS table_name")).rows[0].table_name, null);
  } finally { await db.close(); }
});
