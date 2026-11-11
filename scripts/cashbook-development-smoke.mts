import { Client } from 'pg';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guard,migrationFiles} from './cashbook-development-schema.mjs';
import {CashbookStore} from '../server/lib/cashbook-store';
guard(process.env);
const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
try{
assert.equal((await c.query('SELECT current_database() AS db')).rows[0].db,'heliumdb');
await c.query('BEGIN');
const accounts=(await c.query('SELECT * FROM cashbook_development.cashbook_accounts ORDER BY id')).rows;assert.ok(accounts.length);
const store=new CashbookStore(c,'UTC');
for(const a of accounts){assert.ok((await store.accounts(a.organisation_id,[a.site_id])).length);await store.summary(a.organisation_id,[a.site_id],a.currency,new Date().toISOString().slice(0,7));}
const fks=(await c.query("SELECT count(*)::int AS n FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='cashbook_development' AND contype='f' AND convalidated")).rows[0].n;assert.ok(fks>0);
const triggers=(await c.query("SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='cashbook_development' AND NOT t.tgisinternal")).rows[0].n;assert.ok(triggers>=5);
await c.query('SELECT cashbook_development.cashbook_guard_site(NULL,NULL)');
const receipts=(await c.query('SELECT payment_id,organisation_id,site_id FROM cashbook_development.cashbook_membership_receipts')).rows;
for(const r of receipts)await c.query('SELECT cashbook_development.cashbook_capture_membership_receipt($1,$2,$3)',[r.payment_id,r.organisation_id,r.site_id]);
const closed=(await c.query('SELECT site_id,period_end FROM cashbook_development.cashbook_closures LIMIT 1')).rows[0];
if(closed){await c.query('SAVEPOINT closed_test');await assert.rejects(c.query('SELECT cashbook_development.cashbook_guard_site($1,$2)',[closed.site_id,new Date(new Date(closed.period_end).getTime()-1000)]),/CASHBOOK_PERIOD_CLOSED/);await c.query('ROLLBACK TO SAVEPOINT closed_test');}
await c.query('INSERT INTO cashbook_development.cashbook_requests(organisation_id,idempotency_key,actor,payload,response) VALUES($1,gen_random_uuid(),$2,$3,$4)',[accounts[0].organisation_id,'isolation-test',{},{}]);
await c.query('ROLLBACK');
await c.query('BEGIN');
await c.query("SET LOCAL lock_timeout='3s'");
await c.query('CREATE SCHEMA cashbook_install_test');
await c.query('SET LOCAL search_path TO cashbook_install_test,public');
for(const file of migrationFiles)await c.query(readFileSync('migrations/development/cashbook/'+file,'utf8'));
assert.equal((await c.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='cashbook_install_test'")).rows[0].n,10);
await c.query('SELECT cashbook_install_test.cashbook_guard_site(NULL,NULL)');
await c.query('ROLLBACK');
console.log(JSON.stringify({freshInstall:'PASS',smoke:'PASS',accounts:accounts.length,validatedForeignKeys:fks,triggers,receipts:receipts.length,closedPeriodProtected:!!closed,testWrites:'rolled back'}));
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
