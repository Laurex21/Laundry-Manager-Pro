import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../shared/schema";

// Entirely synthetic: no real database, provider token, phone number or money.
process.env.DATABASE_URL="postgresql://unused:unused@127.0.0.1:1/isolated_collection";
Object.assign(process.env,{NODE_ENV:"production",SAAS_BILLING_MODE:"live",SAAS_LIVE_ENABLED:"true",SAAS_DATABASE_ENVIRONMENT:"production",SAAS_PRODUCTION_ORIGIN:"https://isolated-collection.example",PAWAPAY_PRODUCTION_API_TOKEN:"synthetic-never-sent",SAAS_LIVE_PILOT_ORGANISATION_ID:"424",SAAS_LIVE_PILOT_PURPOSE:"subscription_50",XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED:"true"});
delete process.env.PAWAPAY_SANDBOX_API_TOKEN;
const pg=new PGlite();const testDb=drizzle(pg,{schema});
const {db,pool}=await import("../db");
for(const method of ["select","insert","update","delete","execute","transaction"] as const)(db as any)[method]=testDb[method].bind(testDb);
const query=async(text:string,params?:any[])=>{const result=await pg.query(text,params);return{rows:result.rows,rowCount:result.affectedRows};};
(pool as any).query=query;
let tail=Promise.resolve();
(pool as any).connect=async()=>{const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>release=resolve);await previous;return{query,release};};
const {privateKey,publicKey}=crypto.generateKeyPairSync("ec",{namedCurve:"P-256"});
const checkouts=new Map<string,any>();let providerPosts=0;let loseCreateResponse=false;let rejectCreate=false;
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input:any,options:any)=>{
 const url=String(input);
 if(url==="https://api.pawapay.io/v2/public-key/http")return new Response(JSON.stringify([{id:"collection-fixture",key:publicKey.export({type:"spki",format:"pem"}).toString()}]));
 assert.ok(url.startsWith("https://api.pawapay.io/v2/checkouts"),"Unexpected external request blocked");
 assert.equal(options.headers.Authorization,"Bearer synthetic-never-sent");
 if(options.method==="POST"){
  providerPosts++;const body=JSON.parse(options.body);assert.deepEqual(body.amounts,[{country:"CMR",currency:"XAF",amount:"50"}]);
  // Official CheckoutReason -> CustomerMessage constraints, not just a mock accepting arbitrary text.
  for(const reason of Object.values(body.reason))assert.match(String(reason),/^[a-zA-Z0-9 ]{4,22}$/);
  if(rejectCreate){rejectCreate=false;return new Response(JSON.stringify({failureReason:{failureCode:"INVALID_PARAMETER"}}),{status:400});}
  const data={...body,status:"WAITING_PAYMENT",checkoutCode:"fixture-"+body.checkoutId,redirectUrl:"https://checkout.pawapay.io/fixture-"+body.checkoutId};checkouts.set(body.checkoutId,data);
  if(loseCreateResponse){loseCreateResponse=false;throw Error("Synthetic response loss");}
  return new Response(JSON.stringify({...data,status:"ACCEPTED"}));
 }
 const data=checkouts.get(url.split("/").pop()!);return new Response(JSON.stringify(data?{status:"FOUND",data}:{status:"NOT_FOUND"}));
};
try {
 for(const statement of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(statement);
 await pg.exec(await readFile(new URL("../../migrations/20261021_saas_billing_v5.sql",import.meta.url),"utf8"));
 await pg.exec(await readFile(new URL("../../migrations/20261021_saas_provider_environment.sql",import.meta.url),"utf8"));
 await testDb.insert(schema.users).values([{id:"pilot-owner",organisationId:424},{id:"foreign-owner",organisationId:2},{id:"pilot-staff",organisationId:424,userType:"staff"}]);
 await testDb.insert(schema.organisations).values([{id:424,name:"Synthetic collection",ownerId:"pilot-owner"},{id:2,name:"Foreign",ownerId:"foreign-owner"}]);
 await testDb.insert(schema.sites).values([{id:424,organisationId:424,name:"Synthetic primary"},{id:2,organisationId:2,name:"Foreign primary"}]);
 await query("INSERT INTO plans (name,slug,price,max_users,features) VALUES ('Starter','starter',6000,1,'[]'::jsonb)");
 await query("INSERT INTO subscriptions (user_id,plan_id,status,start_date,end_date) SELECT 'pilot-owner',id,'active','2026-10-22','2026-11-22' FROM plans WHERE slug='starter'");
 const {saasStore,saasForOrganisation}=await import("./saas-runtime");
 saasStore.clock=()=>new Date('2026-11-20T14:30:00.000Z');
 const legacy=(await query("SELECT id FROM subscriptions WHERE user_id='pilot-owner'")).rows[0];
 process.env.SAAS_PRO_PILOT_SUBSCRIPTION_ID=String(legacy.id);
 process.env.SAAS_PRO_PILOT_PROTECTED_UNTIL='2026-11-22T00:00:00.000Z';
 const {registerSaasRoutes}=await import("./saas-routes");
 const handlers=new Map<string,Function>();
 const app:any={get:(p:string,...fn:Function[])=>handlers.set("GET "+p,fn.at(-1)!),post:(p:string,...fn:Function[])=>handlers.set("POST "+p,fn.at(-1)!)};
 registerSaasRoutes(app,{backgroundJobs:false});
 const owner={organisationId:424,userId:"pilot-owner",session:{userId:"pilot-owner"},body:{}};
 async function request(method:string,path:string,extra:any={}) {
  let status=200;let body:any;const headers:Record<string,string>={};
  const res:any={set:(k:string,v:string)=>{headers[k]=v;return res;},status:(n:number)=>{status=n;return res;},json:(v:any)=>{body=v;return res;},sendStatus:(n:number)=>{status=n;return res;}};
  await handlers.get(method+" "+path)!({...owner,...extra},res);return{status,body,headers};
 }
 const snapshot=async()=>{
  const result:Record<string,any>={};for(const table of ["users","organisations","sites","plans","subscriptions","subscription_payments","saas_accounts","saas_notices","orders","payments","business_settings"])
   result[table]=(await query(`SELECT * FROM ${table} ORDER BY 1`)).rows;
  return result;
 };
 const baseline=await snapshot();
 const {ProPilotStore}=await import('./saas-pro-pilot');
 const pilot=new ProPilotStore(saasStore);
 const preview=await request('GET','/api/saas/pro-pilot');
 assert.equal(preview.status,200);assert.equal(preview.body.grantEnd,'2026-12-20T14:30:00.000Z');
 assert.deepEqual(await snapshot(),baseline,'Preview does not change Starter or create access');
 assert.equal(await saasForOrganisation(424),null);
 assert.equal((await request('GET','/api/saas/config')).body.subscriptionPilot,true);
 for(const userId of ['foreign-owner','pilot-staff'])assert.equal((await request('GET','/api/saas/config',{session:{userId}})).body.subscriptionPilot,false);
 assert.equal((await request('GET','/api/saas/pro-pilot',{organisationId:2,userId:'foreign-owner'})).status,404);
 assert.equal((await request('GET','/api/saas/pro-pilot',{userId:'pilot-staff'})).status,403);
 for(const body of [{amount:1},{amount:50},{plan:'business'}])assert.notEqual((await request('POST','/api/saas/pro-pilot/quote',{body})).status,201);
 process.env.SAAS_BILLING_MODE='disabled';process.env.SAAS_LIVE_ENABLED='false';
 assert.equal((await request('GET','/api/saas/pro-pilot')).status,404);
 assert.equal((await request('GET','/api/saas/config')).body.subscriptionPilot,false);
 assert.equal(providerPosts,0);
 process.env.SAAS_BILLING_MODE='live';process.env.SAAS_LIVE_ENABLED='true';
 const create=()=>request('POST','/api/saas/pro-pilot/quote');
 const twins=await Promise.all([create(),create()]);assert.equal(twins[0].status,201);assert.equal(twins[0].body.id,twins[1].body.id);
 let invoice=twins[0].body;assert.equal(invoice.total_xaf,50);assert.equal(invoice.quote.nextMonthlyXaf,10999);
 assert.equal(invoice.quote.pilot.grantEnd,'2026-12-20T14:30:00.000Z');
 assert.deepEqual(await snapshot(),baseline,'Quote leaves Starter, business records and access unchanged');
 const checkout=()=>request('POST','/api/saas/pro-pilot/:id/checkout',{params:{id:invoice.id}});
 assert.equal((await checkout()).status,200);assert.equal((await checkout()).status,200);assert.equal(providerPosts,1);
 invoice=await saasStore.invoice(saasStore.db,424,invoice.id);
 function completed(){return{...checkouts.get(invoice.checkout_id),status:'COMPLETED',deposit:{status:'COMPLETED',amount:'50',currency:'XAF',country:'CMR'}};}
 async function callback(event:any,valid=true){
  const rawBody=Buffer.from(JSON.stringify(event));const created=Math.floor(Date.now()/1000);const path="/api/saas/live/callback";
  const params=`("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="collection-fixture";created=${created};expires=${created+60}`;
  const headers:any={"content-type":"application/json","signature-date":new Date().toISOString(),"content-digest":`sha-512=:${crypto.createHash("sha512").update(rawBody).digest("base64")}:`,"signature-input":`sig-pp=${params}`};
  const base=`"@method": POST\n"@authority": isolated-collection.example\n"@path": ${path}\n"signature-date": ${headers["signature-date"]}\n"content-digest": ${headers["content-digest"]}\n"content-type": application/json\n"@signature-params": ${params}`;
  headers.signature=valid?`sig-pp=:${crypto.sign("sha256",Buffer.from(base),privateKey).toString("base64")}:`:"invalid";
  return request("POST",path,{method:"POST",path,headers,rawBody,body:event,is:()=>true,get:()=>"isolated-collection.example"});
 }
 const success=completed();
 assert.equal((await callback(success,false)).status,401);
 for(const event of [{...success,deposit:{...success.deposit,amount:'49'}},{...success,checkoutCode:'wrong'},{...success,deposit:{...success.deposit,currency:'USD'}}])assert.equal((await callback(event)).status,409);
 await assert.rejects(saasStore.applyProviderResult(invoice.checkout_id,success,'pawapay_sandbox'),/PROVIDER_ENVIRONMENT_MISMATCH/);
 assert.deepEqual(await snapshot(),baseline);
 // The payment completes later than the quote: the cycle must start at confirmation.
 saasStore.clock=()=>new Date('2026-11-20T15:00:00.000Z');
 assert.equal((await callback(success)).status,200);assert.equal((await callback(success)).status,200);
 const state=(await query('SELECT state FROM saas_accounts WHERE organisation_id=424')).rows[0].state as any;
 assert.equal(state.plan,'pro');assert.equal(state.phase,'active');
 assert.equal(state.cycleStart,'2026-11-20T15:00:00.000Z');
 assert.equal(state.cycleEnd,'2026-12-20T15:00:00.000Z');
 assert.notEqual(state.cycleEnd,'2026-12-22T00:00:00.000Z','No carryover from Starter');
 assert.equal((await saasForOrganisation(424))?.plan,'pro','Access changes after confirmation, even while scheduled maintenance is suspended');
 assert.equal(state.anchorDay,20);assert.equal(state.paidBaseXaf,50);assert.equal(state.protectedUntil,null);
 assert.equal((await query("SELECT count(*)::int n FROM saas_events WHERE action='subscription_pilot_paid'")).rows[0].n,1);
 assert.equal((await pilot.current(424)).grantEnd,state.cycleEnd);
 const after=await snapshot();delete after.saas_accounts;const original={...baseline};delete original.saas_accounts;
 assert.deepEqual(after,original,'Legacy subscription and business data preserved');
 assert.equal((await checkout()).status,409);assert.equal(providerPosts,1);
 // Reset only synthetic pilot records for each independent failure scenario.
 for(const status of ['FAILED','EXPIRED','CANCELLED']){
  await query('DELETE FROM saas_events');await query('DELETE FROM saas_invoices');await query('DELETE FROM saas_accounts');
  invoice=(await create()).body;await checkout();invoice=await saasStore.invoice(saasStore.db,424,invoice.id);
  assert.equal((await callback({...checkouts.get(invoice.checkout_id),status})).status,200);
  assert.deepEqual(await snapshot(),baseline);assert.equal((await create()).status,409);
 }
 await query('DELETE FROM saas_invoices');
 invoice=(await create()).body;await checkout();invoice=await saasStore.invoice(saasStore.db,424,invoice.id);
 await query("UPDATE subscriptions SET end_date='2026-11-23' WHERE user_id='pilot-owner'");
 assert.equal((await callback(completed())).status,200);
 assert.equal((await saasStore.invoice(saasStore.db,424,invoice.id)).status,'review');
 assert.equal((await query('SELECT count(*)::int n FROM saas_accounts')).rows[0].n,0,'Changed legacy account is never overwritten');
 const {nextSaasMonth}=await import('../../shared/saas-plans');
 assert.equal(nextSaasMonth(new Date('2026-01-31T12:00:00Z')).toISOString(),'2026-02-28T12:00:00.000Z');
 console.log('PASS Pro pilot: 50 XAF, owner-only, disabled gate, signed confirmation, Nov20 → Dec20 from payment time, no Starter carryover, duplicates, failures, tampering and changed-account review. Synthetic isolated database and mocked provider only; maintenance suspended.');
} finally {globalThis.fetch=nativeFetch;await pg.close();await pool.end();}
