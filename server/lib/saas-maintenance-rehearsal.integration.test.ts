/** In-memory rehearsal: no production credentials, network, or real payments. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {businessLaunchTrial, BUSINESS_LAUNCH_CUTOFF} from '../../shared/saas-business-launch';
import type {SaasState} from '../../shared/saas-plans';

process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/isolated_scheduler';
process.env.NODE_ENV='test';
process.env.SAAS_BILLING_MODE='sandbox';
process.env.SAAS_LIVE_ENABLED='false';
process.env.SAAS_BUSINESS_LAUNCH_ENABLED='true';
process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
for(const k of ['PAWAPAY_PRODUCTION_API_TOKEN','PAWAPAY_SANDBOX_API_TOKEN','SAAS_LIVE_PILOT_ORGANISATION_ID','SAAS_LIVE_PILOT_PURPOSE'])delete process.env[k];
const pg=new PGlite();
const {pool}=await import('../db');
const query=async(sql:string,args?:any[])=>{const r=await pg.query<any>(sql,args);return {rows:r.rows,rowCount:r.affectedRows};};
(pool as any).query=query;
(pool as any).connect=async()=>({query,release(){}});
const {saasStore,startSaasJobs}=await import('./saas-runtime');
let now=new Date('2026-10-31T22:59:59.999Z');
(saasStore as any).clock=()=>new Date(now);
const nativeInterval=globalThis.setInterval, nativeFetch=globalThis.fetch, nativeWarn=console.warn;
let job:(()=>Promise<void>)|undefined;
let intervalMs=0;
const warnings:any[]=[];
globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN_IN_ISOLATED_REHEARSAL');};
console.warn=(...args:any[])=>{warnings.push(args);};
const state=(id:number)=>businessLaunchTrial(new Date('2026-01-01'),new Date('2026-10-26'),[id*10,id*10+1,id*10+2],[]);
async function stored(id:number){return (await query('SELECT state FROM saas_accounts WHERE organisation_id=$1',[id])).rows[0]?.state as SaasState;}
async function snapshot(){return (await query("SELECT jsonb_build_object('accounts',(SELECT jsonb_agg(a ORDER BY organisation_id) FROM saas_accounts a),'events',(SELECT jsonb_agg(e ORDER BY id) FROM saas_events e),'notices',(SELECT jsonb_agg(n ORDER BY id) FROM saas_notices n)) AS result")).rows[0].result;}
try{
 await pg.exec(`CREATE TABLE users(id varchar PRIMARY KEY,organisation_id integer,first_name text,last_name text,email text); CREATE TABLE organisations(id integer PRIMARY KEY,owner_id varchar,created_at timestamptz); CREATE TABLE sites(id integer PRIMARY KEY,organisation_id integer,name text,is_active boolean DEFAULT true); CREATE TABLE site_members(id serial PRIMARY KEY,site_id integer,user_id varchar,role text); CREATE TABLE subscriptions(id serial PRIMARY KEY,user_id varchar,status text,end_date timestamptz); CREATE TABLE orders(id integer PRIMARY KEY);`);
 await pg.exec(await readFile(new URL('../../migrations/20261021_saas_billing_v5.sql',import.meta.url),'utf8'));
 for(const id of [10,11,12,13,14,15,16,3,100,112,193]){
  await query('INSERT INTO users(id,organisation_id) VALUES($1,$2)',[`synthetic-${id}`,id]);
  await query('INSERT INTO organisations VALUES($1,$2,$3)',[id,`synthetic-${id}`,'2026-01-01']);
  for(let s=0;s<3;s++)await query("INSERT INTO sites(id,organisation_id,name) VALUES($1,$2,'Synthetic')",[id*10+s,id]);
  if(id===16)continue;
  const value=state(id);
  if(id===11)value.trialEndsAt='2026-11-19T00:00:00.000Z';
  if([12,13,14,15].includes(id))Object.assign(value,{phase:'active',plan:'business',extraSites:1,cycleStart:'2026-09-30T23:00:00.000Z',cycleEnd:BUSINESS_LAUNCH_CUTOFF,trialEndsAt:null,paidBaseXaf:18999,paidSiteXaf:5000});
  if(id===13)value.renewal={selection:{plan:'pro',extraSites:0,extraStaff:0},start:BUSINESS_LAUNCH_CUTOFF,end:'2026-11-30T23:00:00.000Z',paidBaseXaf:10999,paidStaffXaf:0,paidSiteXaf:0};
  if(id===14)value.pending={plan:'starter',extraSites:0,extraStaff:0};
  if(id===15)value.renewal={selection:{plan:'business',extraSites:1,extraStaff:0},start:BUSINESS_LAUNCH_CUTOFF,end:'2026-11-30T23:00:00.000Z',paidBaseXaf:18999,paidStaffXaf:0,paidSiteXaf:5000};
  await query('INSERT INTO saas_accounts(organisation_id,state) VALUES($1,$2::jsonb)',[id,JSON.stringify(value)]);
 }
 await query("INSERT INTO subscriptions(user_id,status,end_date) VALUES('synthetic-16','active','2026-11-22T12:34:56.789Z')");
 const deferredBefore=await Promise.all([3,100,112,193].map(stored));
 const linksBefore=(await query('SELECT * FROM users ORDER BY id')).rows;
 const legacyBefore=(await query('SELECT * FROM subscriptions')).rows;
 globalThis.setInterval=((fn:any,ms:any)=>{assert.equal(job,undefined);job=fn;intervalMs=ms;return {unref(){}};}) as any;
 const pausedBefore=await snapshot(); startSaasJobs();assert.equal(job,undefined);assert.deepEqual(await snapshot(),pausedBefore);
 process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='false';
 startSaasJobs();assert.ok(job);assert.equal(intervalMs,30000);
 await job!();assert.equal((await stored(10)).phase,'trialing');assert.equal((await stored(12)).phase,'active');
 const noticesBefore=(await query('SELECT count(*)::int n FROM saas_notices')).rows[0].n;
 await job!();assert.equal((await query('SELECT count(*)::int n FROM saas_notices')).rows[0].n,noticesBefore,'Reminder idempotence');
 now=new Date(BUSINESS_LAUNCH_CUTOFF);await job!();
 for(const id of [10,12,14]){const s=await stored(id);assert.equal(s.plan,'starter');assert.equal(s.phase,'starter');assert.equal(s.activeSiteIds.length,1);assert.deepEqual(s.activeStaffIds,[]);}
 assert.equal((await stored(11)).phase,'trialing','Recent trial retains its remaining days');
 assert.equal((await stored(13)).plan,'pro');assert.equal((await stored(13)).phase,'active');assert.equal((await stored(13)).cycleEnd,'2026-11-30T23:00:00.000Z');
 assert.equal((await stored(15)).plan,'business');assert.equal((await stored(15)).activeSiteIds.length,3);
 const expiredBefore=await snapshot();await job!();assert.deepEqual(await snapshot(),expiredBefore,'Repeated scheduler tick has no duplicate effects');
 assert.deepEqual(await Promise.all([3,100,112,193].map(stored)),deferredBefore,'Four excluded existing states remain identical even after their expiry');
 assert.equal(await stored(16),undefined,'Acquired legacy period is not converted');assert.deepEqual((await query('SELECT * FROM subscriptions')).rows,legacyBefore);
 assert.deepEqual((await query('SELECT * FROM users ORDER BY id')).rows,linksBefore,'Existing identity links preserved');
 assert.equal((await query('SELECT count(*)::int n FROM saas_invoices')).rows[0].n,0,'No payment invoices created');
 assert.ok(warnings.some(w=>w[1]?.code==='SAAS_ORGANISATION_DEFERRED'));
 process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';now=new Date('2026-12-01T00:00:00Z');const rePaused=await snapshot();await job!();assert.deepEqual(await snapshot(),rePaused,'Running timer honours a renewed suspension');
 console.log('PASS isolated real scheduler: suspended zero writes, 30s timer, cutoff at Douala midnight, recent trials preserved, unpaid expiry to Starter, paid renewals preserved, scheduled downgrade, idempotent notices/transitions, four excluded states/identity links unchanged, acquired legacy protected, re-suspension effective, zero invoices/network/payments');
}finally{globalThis.setInterval=nativeInterval;globalThis.fetch=nativeFetch;console.warn=nativeWarn;await pg.close();await pool.end();}
