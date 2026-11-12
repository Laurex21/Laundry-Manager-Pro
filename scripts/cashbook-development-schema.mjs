import { Client } from 'pg';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
export const schema='cashbook_development';
export const migrationFiles=['20261106_cashbook_development.sql','20261109_cashbook_membership_receipts_development.sql','20261109_cashbook_reconciliations_development.sql','20261109_cashbook_closures_development.sql','20261109_cashbook_corrections_development.sql','20261110_cashbook_pilot_scope_development.sql'];
export const tables=['cashbook_accounts','cashbook_closures','cashbook_corrections','cashbook_expense_allocations','cashbook_manual_movements','cashbook_membership_receipts','cashbook_period_locks','cashbook_pilot_sites','cashbook_reconciliations','cashbook_requests'];
export function guard(e){
 assert.equal(e.NODE_ENV,'development','Development only');
 assert.ok(e.REPLIT_DEV_DOMAIN && e.REPLIT_DEPLOYMENT!=='1','Replit development workspace required');
 assert.equal(e.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED,'true','Maintenance must stay suspended');
 assert.notEqual(e.SALES_EMAIL_ENABLED,'true','Email must stay disabled');
 assert.equal(e.SAAS_LIVE_ENABLED,'false','Live payments must stay disabled');
 assert.equal(e.SAAS_BILLING_MODE,'disabled','Billing must stay disabled');
 for(const id of ['3','100','112','193'])assert.ok((e.SAAS_DEFERRED_ORGANISATION_IDS||'').split(',').map(x=>x.trim()).includes(id),'Missing exclusion');
}
const qi=s=>'"'+s.replaceAll('"','""')+'"';
async function fingerprints(c,s){const result={};for(const t of tables){result[t]=(await c.query(`SELECT count(*)::int AS count,md5(coalesce(string_agg(row_to_json(t)::text,chr(10) ORDER BY row_to_json(t)::text),'')) AS hash FROM ${qi(s)}.${qi(t)} t`)).rows[0];}return result;}
export async function main(){
 guard(process.env);
 const mode=process.argv[2];assert.ok(['--move','--verify','--install'].includes(mode),'Use --move, --verify or --install explicitly');
 const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
 try{
 const identity=(await c.query('SELECT current_database() AS db,inet_server_addr() AS addr')).rows[0];
 assert.equal(identity.db,'heliumdb','Only the known isolated Replit database is allowed');assert.equal(identity.addr,null,'Unexpected database server');assert.equal(c.connectionParameters.host,'helium','Unexpected database host');
 const found=async s=>(await c.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename LIKE 'cashbook\\_%' ESCAPE '\\' ORDER BY tablename",[s])).rows.map(x=>x.tablename);
 const old=await found('public'),current=await found(schema);
 if(mode==='--verify'){
 assert.deepEqual(old,[],'Cashbook tables must not be in public');assert.deepEqual(current,tables);
 const functions=(await c.query("SELECT proname,proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND proname LIKE 'cashbook%'",[schema])).rows;
 assert.ok(functions.length>=5);for(const f of functions)assert.ok(f.proconfig?.includes('search_path=pg_catalog, cashbook_development, public, pg_temp'),'Unpinned function search path');
 const publicFunctions=(await c.query("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname LIKE 'cashbook%'" )).rows;assert.equal(publicFunctions.length,0);
 console.log(JSON.stringify({verified:true,tables:current.length,functions:functions.length,rows:await fingerprints(c,schema)}));return;
 }
 if(old.length===0&&current.length===tables.length){console.log('Already separated; use --verify. No changes.');return;}
 if(mode==='--move'){assert.deepEqual(old,tables);assert.deepEqual(current,[]);}else{assert.deepEqual(old,[]);assert.deepEqual(current,[]);}
 const dir=`/tmp/cashbook-schema-${Date.now()}`;mkdirSync(dir,{mode:0o700});
 const p=c.connectionParameters;const env={...process.env,PGHOST:p.host,PGPORT:String(p.port),PGDATABASE:p.database,PGUSER:p.user,PGPASSWORD:p.password,PGSSLMODE:'disable'};
 const dump=spawnSync('pg_dump',['--format=custom','--file='+dir+'/development.dump'],{env,encoding:'utf8'});assert.equal(dump.status,0,'Development backup failed; no migration applied');
 await c.query('BEGIN');
 try{
 await c.query("SET LOCAL lock_timeout='3s'");
 if(mode==='--move')await c.query('LOCK TABLE '+tables.map(t=>'public.'+qi(t)).join(',')+' IN ACCESS EXCLUSIVE MODE');
 const before=mode==='--move'?await fingerprints(c,'public'):null;
 await c.query('CREATE SCHEMA IF NOT EXISTS '+schema);
 await c.query('REVOKE CREATE ON SCHEMA '+schema+' FROM PUBLIC');
 if(mode==='--move'){
 for(const t of tables)await c.query('ALTER TABLE public.'+qi(t)+' SET SCHEMA '+schema);
 const funcs=(await c.query("SELECT p.oid::regprocedure::text AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname LIKE 'cashbook%' ORDER BY p.oid")).rows;
 for(const f of funcs)await c.query('ALTER FUNCTION '+f.signature+' SET SCHEMA '+schema);
 }else{
 await c.query('SET LOCAL search_path TO '+schema+', public');
 const dir='migrations/development/cashbook';for(const f of migrationFiles)await c.query(readFileSync(dir+'/'+f,'utf8'));
 }
 const funcs=(await c.query('SELECT p.oid::regprocedure::text AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1',[schema])).rows;
 for(const f of funcs)await c.query('ALTER FUNCTION '+f.signature+' SET search_path TO pg_catalog, '+schema+', public, pg_temp');
 const after=await fingerprints(c,schema);if(before)assert.deepEqual(after,before,'Data changed; rolling back');
 await c.query('COMMIT');writeFileSync(dir+'/verification.json',JSON.stringify({before,after},null,2),{mode:0o600});console.log(JSON.stringify({separated:true,backup:dir+'/development.dump',tables:tables.length,rows:Object.values(after).reduce((n,v)=>n+v.count,0)}));
 }catch(e){await c.query('ROLLBACK');throw e;}
 }finally{await c.end();}
}
if(process.argv[1]?.endsWith('/cashbook-development-schema.mjs'))main().catch(e=>{console.error(e.message);process.exitCode=1;});
