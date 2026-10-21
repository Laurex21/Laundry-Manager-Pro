import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import { DAY_MS, SAAS_PLANS, saasSelection, saasQuotas, saasMonthly, nextSaasMonth, saasTrial, quoteSaas, type SaasState } from "../../shared/saas-plans";
import { SaasStore, type SaasExecutor, type SaasDatabase } from "./saas-store";
import { SaasPawapaySandbox } from "./saas-pawapay";

// This file never imports the application DB or reads DATABASE_URL.
const pg = new PGlite();
let now = new Date("2026-01-31T12:00:00Z");
const query: SaasExecutor["query"] = async (text, params) => {
  const result = await pg.query<any>(text, params); return {rows:result.rows,rowCount:result.affectedRows};
};
const db: SaasDatabase = {query,transaction: fn=>pg.transaction(tx=>fn({query:async(text,params)=>{const r=await tx.query<any>(text,params);return{rows:r.rows,rowCount:r.affectedRows};}}))};
const store = new SaasStore(db, ()=>new Date(now));
async function seed(org:number,old=false) {
  await query("INSERT INTO users(id,organisation_id) VALUES ($1,$2)",[`owner-${org}`,org]);
  await query("INSERT INTO organisations(id,owner_id,created_at) VALUES ($1,$2,$3)",[org,`owner-${org}`,old?'2025-01-01':now.toISOString()]);
  await query("INSERT INTO sites(id,organisation_id,name) VALUES ($1,$2,$3)",[org*10,org,`Site ${org}`]);
  await store.ensure(org);
}
async function directState(org:number,state:SaasState){await query("UPDATE saas_accounts SET state=$2::jsonb WHERE organisation_id=$1",[org,JSON.stringify(state)]);}
function event(invoice:any,status='COMPLETED') {
  return {checkoutId:invoice.checkout_id,checkoutCode:'code',clientReferenceId:invoice.id,status,
    amounts:[{country:'CMR',currency:'XAF',amount:String(invoice.total_xaf)}],
    deposit:{status:'COMPLETED',country:'CMR',currency:'XAF',amount:String(invoice.total_xaf),depositId:crypto.randomUUID()}};
}
async function paid(org:number,plan:'pro'|'business',extraSites=0,extraStaff=0){
  const invoice=await store.createQuote(org,saasSelection(plan,extraSites,extraStaff));
  const pending=await store.reserveCheckout(org,invoice.id);await store.recordCheckout(org,invoice.id,'code','https://checkout.sandbox.pawapay.io/code');
  await store.applyProviderResult(pending.checkout_id!,event(pending));return pending;
}
try {
 await pg.exec(`CREATE TABLE users(id varchar PRIMARY KEY,organisation_id integer,first_name text,last_name text,email text);
 CREATE TABLE organisations(id integer PRIMARY KEY,owner_id varchar NOT NULL,created_at timestamptz NOT NULL);
 CREATE TABLE sites(id serial PRIMARY KEY,organisation_id integer NOT NULL,name text,is_active boolean DEFAULT true);
 CREATE TABLE site_members(id serial PRIMARY KEY,site_id integer,user_id varchar,role text);
 CREATE TABLE subscriptions(id serial PRIMARY KEY,user_id varchar,status text);
 CREATE TABLE orders(id integer PRIMARY KEY);`);
 await pg.exec(await readFile(new URL('../../migrations/20261021_saas_billing_v5.sql',import.meta.url),'utf8'));
 assert.equal(saasMonthly(saasSelection('pro',0,1)),12999);
 assert.equal(saasMonthly(saasSelection('business',1,1)),25999);
 assert.deepEqual(saasQuotas(saasSelection('business',1,0)),{sites:3,staff:7});
 assert.throws(()=>saasSelection('starter',0,1),/PAID_PLAN_REQUIRED/);
 assert.throws(()=>saasSelection('pro',1,0),/BUSINESS_REQUIRED/);
 assert.equal(nextSaasMonth(now).toISOString(),'2026-02-28T12:00:00.000Z');
 assert.equal(nextSaasMonth(new Date('2026-02-28T12:00:00Z'),31).toISOString(),'2026-03-31T12:00:00.000Z');
 await seed(1); await seed(2); await seed(3,true);
 const trial=await store.current(1);assert.equal(trial.trialEndsAt,new Date(now.getTime()+30*DAY_MS).toISOString());
 assert.equal((await store.current(3)).trialEndsAt,new Date(now.getTime()+7*DAY_MS).toISOString());
 await store.ensure(1);assert.equal((await store.current(1)).trialEndsAt,trial.trialEndsAt);
 const invoice=await store.createQuote(1,saasSelection('pro',0,1));
 await assert.rejects(store.invoice(db,2,invoice.id),/INVOICE_NOT_FOUND/);
 const same=await Promise.all([store.createQuote(1,saasSelection('pro',0,1)),store.createQuote(1,saasSelection('pro',0,1))]);assert.equal(same[0].id,same[1].id);
 const pending=await store.reserveCheckout(1,invoice.id);
 assert.equal((await store.current(1)).phase,'trialing');
 await store.recordCheckout(1,invoice.id,'code','https://checkout.sandbox.pawapay.io/code');
 const wrong=event(pending);wrong.deposit.amount='1';await assert.rejects(store.applyProviderResult(pending.checkout_id!,wrong),/PAYMENT_MISMATCH/);
 const {amounts: _configuredAmounts, ...callbackBase}=event(pending);
 const callback={...callbackBase,amount:`${pending.total_xaf}.00`,currency:'XAF',country:'CMR'};
 await assert.rejects(store.applyProviderResult(pending.checkout_id!,{...callback,amount:'1.00'}),/AMOUNT_MISMATCH/);
 await store.applyProviderResult(pending.checkout_id!,callback);
 const active=await store.current(1);assert.equal(active.plan,'pro');assert.equal(active.phase,'active');assert.equal(active.cycleEnd,'2026-02-28T12:00:00.000Z');
 await store.applyProviderResult(pending.checkout_id!,event(pending));assert.deepEqual(await store.current(1),active);
 await assert.rejects(store.applyProviderResult(pending.checkout_id!,event(pending,'FAILED')),/CONFLICTING_FINAL_STATUS/);
 now=new Date('2026-02-14T12:00:00Z');
 const upgrade=quoteSaas(active,saasSelection('business',1,0),now);
 assert.equal(upgrade.lines.find(l=>l.label==='creditPro')!.amountXaf,-5500);
 assert.equal(upgrade.lines.find(l=>l.label==='creditStaff')!.amountXaf,-1000);
 assert.equal(upgrade.totalXaf,17499);
 const up=await paid(1,'business',1,0);assert.equal((await store.current(1)).cycleEnd,'2026-03-14T12:00:00.000Z');
 await assert.rejects(db.transaction(tx=>store.allocateSite(tx,2,async()=>999)),/BUSINESS_REQUIRED/);
 const added=await db.transaction(tx=>store.allocateSite(tx,1,async()=>{await tx.query("INSERT INTO sites(id,organisation_id,name) VALUES(11,1,'Second')");return 11;}));assert.equal(added,11);
 await query("INSERT INTO users(id,organisation_id) VALUES ('staff-a',1),('staff-b',1)");
 await query("INSERT INTO site_members(site_id,user_id,role) VALUES(10,'staff-a','operator'),(11,'staff-a','operator'),(10,'staff-b','operator')");
 await db.transaction(tx=>store.allocateStaff(tx,1,'staff-a',10));await db.transaction(tx=>store.allocateStaff(tx,1,'staff-a',11));assert.equal((await store.current(1)).activeStaffIds.length,1);
 await store.selectAccess(1,[10,11],['staff-a','staff-b']);
 await assert.rejects(store.selectAccess(2,[10],[]),/INVALID_ACCESS_SELECTION/);
 await store.schedule(1,saasSelection('pro'));assert.equal((await store.current(1)).plan,'business');
 const renewal=await paid(1,'pro');assert.equal((await store.current(1)).plan,'business');assert.equal((await store.current(1)).renewal!.selection.plan,'pro');
 now=new Date('2026-03-14T12:00:00Z');assert.equal((await store.current(1)).plan,'pro');assert.equal((await store.current(1)).activeSiteIds.length,1);
 // Expiry without a job or browser visit still revokes access on the next request.
 now=new Date('2026-04-14T12:00:00Z');const expired=await store.current(1);assert.equal(expired.plan,'starter');assert.deepEqual(expired.activeStaffIds,[]);
 await store.current(1);assert.equal((await query("SELECT * FROM saas_notices WHERE organisation_id=1 AND kind='expired'")).rows.length,1);
 // One daily reminder across sessions, owner delivery is handled by the API.
 now=new Date('2026-02-23T12:00:00Z');await store.tick(2,'Africa/Douala');await store.tick(2,'Africa/Douala');assert.equal((await query("SELECT * FROM saas_notices WHERE organisation_id=2 AND kind='trial_ending'")).rows.length,1);
 now=new Date('2026-03-02T12:00:00Z');await store.current(2);const lateQuote=await store.createQuote(2,saasSelection('pro'));const latePending=await store.reserveCheckout(2,lateQuote.id);
 // A timeout never grants access and never creates a second payment reference.
 const calls:any[]=[];
 const fake:typeof fetch=async (url,options)=>{calls.push({url,options});const inv=await store.invoice(db,2,lateQuote.id);return new Response(JSON.stringify({status:'FOUND',data:{...event({...inv,checkout_id:latePending.checkout_id}),redirectUrl:'https://checkout.sandbox.pawapay.io/code'}}),{status:200});};
 const provider=new SaasPawapaySandbox(store,()=>"test-token",fake);
 await provider.refresh(2,lateQuote.id);assert.equal((await store.current(2)).plan,'pro');assert.ok(calls.every(c=>String(c.url).startsWith('https://api.sandbox.pawapay.io/')));
 const receipt=await store.invoice(db,2,lateQuote.id);assert.equal(receipt.status,'paid');
 const before=await query('SELECT count(*) AS n FROM saas_invoices');
 await assert.rejects(new SaasPawapaySandbox(store,()=>undefined,fake).start(2,lateQuote.id,'http://localhost/subscriptions'),/SANDBOX_TOKEN_NOT_CONFIGURED/);
 assert.equal((await query('SELECT count(*) AS n FROM saas_invoices')).rows[0].n,before.rows[0].n);
 // Unused paid staff places disappear from the next manual renewal invoice.
 const renewalState={...active,activeStaffIds:[]};
 assert.equal(quoteSaas(renewalState,saasSelection('pro',0,1),new Date('2026-02-01T12:00:00Z')).selection.extraStaff,0);
 // No silent forfeiture when a large Pro staff credit exceeds Business's invoice.
 assert.throws(()=>quoteSaas({...active,paidStaffXaf:100_000},saasSelection('business'),new Date('2026-02-01T12:00:00Z')),/EXCESS_CREDIT_REQUIRES_REVIEW/);
 // Rounded-to-zero last-instant options settle internally without a provider request.
 await seed(4);await paid(4,'pro');const zeroState=await store.current(4);
 now=new Date(Date.parse(zeroState.cycleEnd!)-1);
 const zero=await store.createQuote(4,saasSelection('pro',0,1));assert.equal(zero.total_xaf,0);
 await store.settleZeroInvoice(4,zero.id);
 const settled=await store.invoice(db,4,zero.id);assert.equal(settled.status,'paid');assert.equal((settled as any).payment_source,'credit');
 console.log('PASS SaaS: catalogue, monthly dates, trials, transition, invoices, options credit, tenant boundaries, duplicate/out-of-order payments, unique staff, access selection, manual renewal and sandbox reconciliation');
} finally { await pg.close(); }
