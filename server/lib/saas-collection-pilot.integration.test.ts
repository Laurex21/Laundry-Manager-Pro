import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../shared/schema";

// Entirely synthetic: no real database, provider token, phone number or money.
process.env.DATABASE_URL="postgresql://unused:unused@127.0.0.1:1/isolated_collection";
Object.assign(process.env,{NODE_ENV:"production",SAAS_BILLING_MODE:"live",SAAS_LIVE_ENABLED:"true",SAAS_DATABASE_ENVIRONMENT:"production",SAAS_PRODUCTION_ORIGIN:"https://isolated-collection.example",PAWAPAY_PRODUCTION_API_TOKEN:"synthetic-never-sent",SAAS_LIVE_PILOT_ORGANISATION_ID:"424",SAAS_LIVE_PILOT_PURPOSE:"collection",XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED:"true"});
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
 await query("INSERT INTO plans (name,slug,price) VALUES ('Starter','starter',6000)");
 await query("INSERT INTO subscriptions (user_id,plan_id,status,start_date,end_date) SELECT 'pilot-owner',id,'active','2026-10-22','2026-11-22' FROM plans WHERE slug='starter'");
 const {saasStore,saasForOrganisation}=await import("./saas-runtime");
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
 const config=await request("GET","/api/saas/config");assert.equal(config.body.enabled,false);assert.equal(config.body.collectionPilot,true);
 for(const extra of [{session:undefined},{session:{userId:"foreign-owner"}},{session:{userId:"pilot-staff"}}])assert.equal((await request("GET","/api/saas/config",extra)).body.collectionPilot,false);
 assert.equal(await saasForOrganisation(424),null);assert.equal(await saasForOrganisation(2),null);
 for(const path of ["/api/saas/current","/api/saas/invoices"])assert.equal((await request("GET",path)).status,404);
 assert.equal((await request("POST","/api/saas/quote",{body:{plan:"pro"}})).status,404);
 assert.equal((await request("POST","/api/saas/collection-pilot/quote",{organisationId:2,userId:"foreign-owner"})).status,404);
 assert.equal((await request("POST","/api/saas/collection-pilot/quote",{userId:"pilot-staff"})).status,403);
 for(const body of [{amount:50},{amount:1},{plan:"pro"}])assert.notEqual((await request("POST","/api/saas/collection-pilot/quote",{body})).status,201);
 process.env.SAAS_BILLING_MODE="disabled";process.env.SAAS_LIVE_ENABLED="false";
 assert.equal((await request("GET","/api/saas/config")).body.collectionPilot,false);
 assert.equal((await request("POST","/api/saas/collection-pilot/quote")).status,404);
 assert.equal(providerPosts,0);assert.equal((await query("SELECT count(*)::int n FROM saas_invoices")).rows[0].n,0);
 process.env.SAAS_BILLING_MODE="live";process.env.SAAS_LIVE_ENABLED="true";
 for(const id of [undefined,"","424 ","2,424"]){if(id===undefined)delete process.env.SAAS_LIVE_PILOT_ORGANISATION_ID;else process.env.SAAS_LIVE_PILOT_ORGANISATION_ID=id;assert.equal((await request("POST","/api/saas/collection-pilot/quote")).status,404);}
 process.env.SAAS_LIVE_PILOT_ORGANISATION_ID="424";
 const create=()=>request("POST","/api/saas/collection-pilot/quote");
 const twins=await Promise.all([create(),create()]);assert.equal(twins[0].body.id,twins[1].body.id);assert.equal((await query("SELECT count(*)::int n FROM saas_invoices")).rows[0].n,1);
 let invoice=twins[0].body;assert.equal(invoice.total_xaf,50);assert.equal(invoice.quote.purpose,"collection_pilot");
 const validExpiry=invoice.quote.expiresAt;
 await query("UPDATE saas_invoices SET quote=jsonb_set(quote,'{expiresAt}',$2::jsonb) WHERE id=$1",[invoice.id,JSON.stringify("2000-01-01T00:00:00.000Z")]);
 assert.equal((await request("POST","/api/saas/collection-pilot/:id/checkout",{params:{id:invoice.id}})).body.code,"QUOTE_EXPIRED");
 assert.equal((await create()).body.id,invoice.id);assert.equal(providerPosts,0);
 await query("UPDATE saas_invoices SET quote=jsonb_set(quote,'{expiresAt}',$2::jsonb) WHERE id=$1",[invoice.id,JSON.stringify(validExpiry)]);
 await query("UPDATE saas_invoices SET total_xaf=1 WHERE id=$1",[invoice.id]);
 assert.equal((await request("POST","/api/saas/collection-pilot/:id/checkout",{params:{id:invoice.id}})).body.code,"COLLECTION_PILOT_MISMATCH");assert.equal(providerPosts,0);
 await query("UPDATE saas_invoices SET total_xaf=50 WHERE id=$1",[invoice.id]);
 const checkout=()=>request("POST","/api/saas/collection-pilot/:id/checkout",{params:{id:invoice.id}});
 assert.equal((await checkout()).status,200);invoice=await saasStore.invoice(saasStore.db,424,invoice.id);
 assert.equal((await checkout()).status,200);assert.equal(providerPosts,1);
 function completed(){return{...checkouts.get(invoice.checkout_id),status:"COMPLETED",deposit:{status:"COMPLETED",amount:"50",currency:"XAF",country:"CMR",depositId:crypto.randomUUID()}};}
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
 for(const event of [{...success,clientReferenceId:crypto.randomUUID()},{...success,deposit:{...success.deposit,amount:"49"}},{...success,deposit:undefined},{...success,checkoutCode:"wrong"},{...success,amounts:[{country:"CMR",currency:"USD",amount:"50"}]}])assert.equal((await callback(event)).status,409);
 assert.equal((await saasStore.invoice(saasStore.db,424,invoice.id)).status,"pending");
 await assert.rejects(saasStore.applyProviderResult(invoice.checkout_id,success,"pawapay_sandbox"),/PROVIDER_ENVIRONMENT_MISMATCH/);
 assert.equal((await callback(success)).status,200);assert.equal((await callback(success)).status,200);
 assert.equal((await saasStore.invoice(saasStore.db,424,invoice.id)).status,"paid");
 assert.equal((await query("SELECT count(*)::int n FROM saas_events WHERE action='collection_pilot_paid'")).rows[0].n,1);
 assert.equal((await create()).body.id,invoice.id);assert.equal((await checkout()).status,409);assert.equal(providerPosts,1);
 delete process.env.SAAS_LIVE_PILOT_PURPOSE;
 assert.deepEqual((await request("GET","/api/saas/invoices")).body,[],"Collection record must not be presented as a subscription invoice");
 process.env.SAAS_LIVE_PILOT_PURPOSE="collection";
 assert.equal((await callback({...success,status:"FAILED"})).status,409);
 // In-flight results remain valid if the pilot scope is later removed.
 delete process.env.SAAS_LIVE_PILOT_ORGANISATION_ID;assert.equal((await callback(success)).status,200);process.env.SAAS_LIVE_PILOT_ORGANISATION_ID="424";
 assert.deepEqual(await snapshot(),baseline,"Collection must preserve all subscription/access/business records, including legacy Starter");
 // Disposable reset only: each failure mode gets its own synthetic run.
 for(const status of ["FAILED","EXPIRED","CANCELLED"]){
  await query("DELETE FROM saas_invoices");invoice=(await create()).body;await checkout();invoice=await saasStore.invoice(saasStore.db,424,invoice.id);
  assert.equal((await callback({...checkouts.get(invoice.checkout_id),status})).status,200);
  assert.equal((await saasStore.invoice(saasStore.db,424,invoice.id)).status,"failed");
  assert.equal((await create()).body.id,invoice.id);assert.equal((await checkout()).status,409);
  assert.deepEqual(await snapshot(),baseline);
 }
 // Lost create response: signed callback must recover by provider GET, without a second POST.
 await query("DELETE FROM saas_invoices");invoice=(await create()).body;loseCreateResponse=true;const postsBefore=providerPosts;
 assert.equal((await checkout()).status,503);invoice=await saasStore.invoice(saasStore.db,424,invoice.id);const recovered=completed();checkouts.set(invoice.checkout_id,recovered);
 assert.equal((await callback(recovered)).status,200);assert.equal(providerPosts,postsBefore+1);
 assert.equal((await saasStore.invoice(saasStore.db,424,invoice.id)).status,"paid");assert.deepEqual(await snapshot(),baseline);
 // Rejected creation followed by NOT_FOUND: explicit recovery reuses the persisted UUID and invoice.
 await query("DELETE FROM saas_invoices");invoice=(await create()).body;rejectCreate=true;const postsBeforeReject=providerPosts;
 assert.equal((await checkout()).status,503);invoice=await saasStore.invoice(saasStore.db,424,invoice.id);
 const reservedId=invoice.checkout_id;assert.ok(reservedId);assert.equal(invoice.redirect_url,null);
 assert.equal((await request("POST","/api/saas/collection-pilot/:id/refresh",{params:{id:invoice.id}})).status,404);
 assert.equal((await checkout()).status,200);invoice=await saasStore.invoice(saasStore.db,424,invoice.id);
 assert.equal(invoice.checkout_id,reservedId);assert.ok(invoice.redirect_url);assert.equal(providerPosts,postsBeforeReject+2);
 assert.equal((await query("SELECT count(*)::int n FROM saas_invoices")).rows[0].n,1);assert.deepEqual(await snapshot(),baseline);
 // Individually authorised MTN follow-up: final provider failure, no successful deposit, one new quote, old history preserved.
 await query("DELETE FROM saas_invoices");invoice=(await create()).body;await checkout();invoice=await saasStore.invoice(saasStore.db,424,invoice.id);
 await callback({...checkouts.get(invoice.checkout_id),status:"FAILED"});
 const parentId=invoice.id;const parentCheckout=invoice.checkout_id!;
 const parentBefore=await saasStore.invoice(saasStore.db,424,parentId);
 const retry=()=>request("POST","/api/saas/collection-pilot/:id/retry",{params:{id:parentId}});
 delete process.env.SAAS_LIVE_PILOT_RETRY_INVOICE_ID;assert.equal((await retry()).status,404);
 process.env.SAAS_LIVE_PILOT_RETRY_INVOICE_ID=parentId;
 const parentEvent={...checkouts.get(parentCheckout),status:"FAILED",deposit:{status:"FAILED",amount:"50",currency:"XAF",country:"CMR"}};
 checkouts.set(parentCheckout,{...parentEvent,deposit:{status:"COMPLETED",amount:"50",currency:"XAF",country:"CMR"}});
 assert.equal((await retry()).status,409,"A provider-reported success must block a second collection");
 checkouts.set(parentCheckout,{...parentEvent,deposit:{...parentEvent.deposit,status:"PROCESSING"}});
 assert.equal((await retry()).status,409,"Unfinished attempts must block another collection");
 checkouts.set(parentCheckout,parentEvent);
 const retryTwins=await Promise.all([retry(),retry()]);assert.equal(retryTwins[0].status,201);assert.equal(retryTwins[0].body.id,retryTwins[1].body.id);
 invoice=retryTwins[0].body;assert.notEqual(invoice.id,parentId);assert.equal(invoice.quote.retryOf,parentId);
 assert.equal((await create()).body.id,invoice.id);assert.equal((await request("GET","/api/saas/collection-pilot")).body.invoice.id,invoice.id);
 assert.equal((await query("SELECT count(*)::int n FROM saas_invoices")).rows[0].n,2);
 assert.deepEqual(await saasStore.invoice(saasStore.db,424,parentId),parentBefore);assert.deepEqual(await snapshot(),baseline);
 await checkout();invoice=await saasStore.invoice(saasStore.db,424,invoice.id);await callback(completed());
 assert.equal((await retry()).status,409,"No retry after any collection was paid");
 assert.deepEqual(await snapshot(),baseline);delete process.env.SAAS_LIVE_PILOT_RETRY_INVOICE_ID;
 // The same collection must also preserve a pre-existing paid legacy/SaaS state.
 await query("DELETE FROM saas_invoices");
 await query("UPDATE plans SET name='Enterprise',slug='enterprise',price=50000");
 const {saasTrial}=await import("../../shared/saas-plans");
 await query("INSERT INTO saas_accounts (organisation_id,state) VALUES ($1,$2::jsonb)",[424,JSON.stringify(saasTrial(new Date('2026-01-01'),new Date('2026-01-01'),[424],[]))]);
 const paidLegacyBaseline=await snapshot();invoice=(await create()).body;await checkout();invoice=await saasStore.invoice(saasStore.db,424,invoice.id);
 assert.equal((await callback(completed())).status,200);assert.deepEqual(await snapshot(),paidLegacyBaseline);
 console.log("PASS collection pilot 50 XAF: disabled/foreign/staff denied, strict amount, single concurrent invoice, single checkout, signed success/duplicates/tampering, failure/expiry/cancellation, lost-response recovery, legacy Starter and all subscription/business/access records unchanged. No real provider or database contacted.");
} finally {globalThis.fetch=nativeFetch;await pg.close();await pool.end();}
