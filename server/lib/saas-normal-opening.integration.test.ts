/** Normal-price opening rehearsal. In-memory PostgreSQL + locally signed provider responses ONLY. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {generateDrizzleJson,generateMigration} from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
import {saasQuotas} from '../../shared/saas-plans';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/normal_opening_memory_only';
process.env.NODE_ENV='test';process.env.SAAS_BILLING_MODE='sandbox';process.env.SAAS_LIVE_ENABLED='false';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';process.env.SAAS_BUSINESS_LAUNCH_ENABLED='true';
process.env.PAWAPAY_SANDBOX_API_TOKEN='synthetic-token-never-transmitted';
process.env.SAAS_SANDBOX_RETURN_ORIGIN='https://normal-opening.example';
process.env.SAAS_SANDBOX_CALLBACK_ORIGIN='https://normal-opening.example';
for(const key of ['PAWAPAY_PRODUCTION_API_TOKEN','SAAS_LIVE_PILOT_ORGANISATION_ID','SAAS_LIVE_PILOT_PURPOSE','SAAS_LIVE_PILOT_RETRY_INVOICE_ID','SAAS_PRO_PILOT_SUBSCRIPTION_ID','SAAS_PRO_PILOT_PROTECTED_UNTIL'])delete process.env[key];
const pg=new PGlite();const testDb=drizzle(pg,{schema});
const {db,pool}=await import('../db');
for(const key of ['select','insert','update','delete','execute','transaction'] as const)(db as any)[key]=(testDb as any)[key].bind(testDb);
const query=async(sql:string,args?:any[])=>{const r=await pg.query<any>(sql,args);return {rows:r.rows,rowCount:r.affectedRows};};
(pool as any).query=query;(pool as any).connect=async()=>({query,release(){}});
const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
const requests:any[]=[];
globalThis.fetch=async(input:any,init:any)=>{
 const url=String(input);assert.ok(url.startsWith('https://api.sandbox.pawapay.io/v2/'),'Live/network provider forbidden');
 if(url.endsWith('/public-key/http'))return new Response(JSON.stringify([{id:'normal-opening-test',key:publicKey.export({type:'spki',format:'pem'}).toString()}]));
 assert.equal(url,'https://api.sandbox.pawapay.io/v2/checkouts');assert.equal(init.method,'POST');
 const b=JSON.parse(init.body);requests.push(b);assert.notEqual(b.amounts[0].amount,'50');
 return new Response(JSON.stringify({status:'ACCEPTED',checkoutId:b.checkoutId,checkoutCode:b.checkoutId,redirectUrl:'https://checkout.sandbox.pawapay.io/'+b.checkoutId}));
};
const {saasStore}=await import('./saas-runtime');
let now=new Date('2026-11-02T12:00:00Z');(saasStore as any).clock=()=>new Date(now);
const {registerSaasRoutes}=await import('./saas-routes');
const {applySaasAccess}=await import('./saas-access');
const {isAuthenticated}=await import('../replit_integrations/auth/replitAuth');
const handlers=new Map<string,Function>();
const app:any={get:(p:string,...f:Function[])=>handlers.set('GET '+p,f.at(-1)!),post:(p:string,...f:Function[])=>handlers.set('POST '+p,f.at(-1)!)};
registerSaasRoutes(app,{backgroundJobs:false});
async function call(method:string,path:string,org:number,body:any={},params:any={},userId=`normal-owner-${org}`){
 let status=200;let result:any;const res:any={set:()=>res,status:(s:number)=>{status=s;return res;},json:(r:any)=>{result=r;return res;},sendStatus:(s:number)=>{status=s;return res;}};
 await handlers.get(method+' '+path)!({organisationId:org,userId,session:{userId},body,params},res);return {status,body:result};
}
async function signed(invoice:any,status='COMPLETED',valid=true){
 const body={checkoutId:invoice.checkout_id,checkoutCode:invoice.checkout_code,clientReferenceId:invoice.id,status,...(status==='COMPLETED'?{deposit:{depositId:crypto.randomUUID(),status,amount:String(invoice.total_xaf),currency:'XAF',country:'CMR'}}:{})};
 const rawBody=Buffer.from(JSON.stringify(body));const created=Math.floor(Date.now()/1000);const path='/api/saas/sandbox/callback';
 const params=`("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="normal-opening-test";created=${created};expires=${created+60}`;
 const headers:any={'content-type':'application/json','signature-date':new Date().toISOString(),'content-digest':`sha-512=:${crypto.createHash('sha512').update(rawBody).digest('base64')}:`,'signature-input':`sig-pp=${params}`};
 const base=`"@method": POST\n"@authority": normal-opening.example\n"@path": ${path}\n"signature-date": ${headers['signature-date']}\n"content-digest": ${headers['content-digest']}\n"content-type": application/json\n"@signature-params": ${params}`;
 headers.signature=valid?`sig-pp=:${crypto.sign('sha256',Buffer.from(base),privateKey).toString('base64')}:`:'invalid';
 let code=200;const res:any={status:(c:number)=>{code=c;return res;},json:()=>res,sendStatus:(c:number)=>{code=c;return res;}};
 await handlers.get('POST '+path)!({method:'POST',path,headers,rawBody,body,is:()=>true,get:()=> 'normal-opening.example'},res);return code;
}
async function checkout(org:number,selection:any,expected:number){
 const q=await call('POST','/api/saas/quote',org,selection);assert.equal(q.status,201);assert.equal(Number(q.body.total_xaf),expected);assert.equal(q.body.quote.purpose,undefined);
 const repeat=await call('POST','/api/saas/quote',org,selection);assert.equal(repeat.body.id,q.body.id);
 const started=await call('POST','/api/saas/invoices/:id/checkout',org,{}, {id:q.body.id});assert.equal(started.status,200);assert.ok(started.body.redirect_url.startsWith('https://checkout.sandbox.pawapay.io/'));return started.body;
}
try{
 for(const sql of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(sql);
 for(const org of [950,951,952,953,954,955]){
  await testDb.insert(schema.users).values({id:`normal-owner-${org}`,organisationId:org,currentSiteId:org,userType:'owner'});
  await testDb.insert(schema.organisations).values({id:org,name:`Normal price test ${org}`,ownerId:`normal-owner-${org}`,createdAt:new Date('2026-01-01')});
  await testDb.insert(schema.sites).values({id:org,name:'Synthetic test shop',organisationId:org});
 }
 await testDb.insert(schema.users).values({id:'normal-staff',organisationId:950,userType:'staff'});
 await testDb.insert(schema.siteMembers).values({siteId:950,userId:'normal-staff',role:'operator'});
 await testDb.insert(schema.plans).values({id:954,name:'Legacy acquired',slug:'legacy-acquired',price:'0',maxUsers:null,features:['Custom API access']});
 await testDb.insert(schema.subscriptions).values({id:954,userId:'normal-owner-954',planId:954,status:'active',endDate:new Date('2026-11-18T01:51:10.717Z')});
 const legacyBefore=(await query('SELECT * FROM subscriptions')).rows;
 for(const [org,selection,amount] of [[950,{plan:'pro'},10999],[951,{plan:'business'},18999],[952,{plan:'business',extraSites:1,extraStaff:1},25999]] as const){
  assert.notEqual(org,424);const config=await call('GET','/api/saas/config',org);assert.equal(config.body.enabled,true);assert.equal(config.body.subscriptionPilot,false);assert.equal(config.body.mode,'sandbox');
  const initial=await saasStore.current(org);assert.equal(initial.plan,'starter');
  const invoice=await checkout(org,selection,amount);
  assert.deepEqual(await saasStore.current(org),initial,'Pending checkout cannot activate access');
  assert.equal(await signed(invoice,'COMPLETED',false),401);assert.deepEqual(await saasStore.current(org),initial);
  assert.equal(await signed(invoice),200);const paid=await saasStore.current(org);assert.equal(paid.plan,selection.plan);assert.equal(paid.cycleStart,now.toISOString());assert.equal(paid.cycleEnd,'2026-12-02T12:00:00.000Z');
  assert.equal(await signed(invoice),200);assert.deepEqual(await saasStore.current(org),paid,'Duplicate notification cannot extend period twice');
  if(org===952)assert.deepEqual(saasQuotas(paid),{sites:3,staff:8});
 }
 assert.equal((await call('POST','/api/saas/quote',950,{plan:'pro'},{},'normal-staff')).status,403);
 const ownInvoice=(await query('SELECT id FROM saas_invoices WHERE organisation_id=950')).rows[0];
 assert.equal((await call('POST','/api/saas/invoices/:id/checkout',951,{}, {id:ownInvoice.id})).status,404);
 assert.equal((await call('POST','/api/saas/pro-pilot/quote',950)).status,404,'50 XAF endpoint unavailable outside pilot');
 assert.equal((await call('POST','/api/saas/quote',954,{plan:'business'})).body.code,'LEGACY_SUBSCRIPTION_REQUIRES_REVIEW');
 assert.deepEqual((await query('SELECT * FROM subscriptions')).rows,legacyBefore);
 const failedBefore=await saasStore.current(955);const failed=await checkout(955,{plan:'pro'},10999);assert.equal(await signed(failed,'FAILED'),200);assert.deepEqual(await saasStore.current(955),failedBefore);
 // During the existing offered Business period, payment is a deferred renewal.
 now=new Date('2026-10-26T12:00:00Z');const offered=await saasStore.current(953);assert.equal(offered.plan,'business');assert.equal(offered.trialEndsAt,'2026-10-31T23:00:00.000Z');
 const early=await checkout(953,{plan:'pro'},10999);assert.equal(await signed(early),200);const preserved=await saasStore.current(953);assert.equal(preserved.plan,'business');assert.equal(preserved.trialEndsAt,offered.trialEndsAt);assert.equal(preserved.renewal!.start,offered.trialEndsAt);
 now=new Date('2026-10-31T23:00:00Z');assert.equal((await saasStore.current(953)).plan,'pro');
 now=new Date('2026-11-02T12:00:00Z');
 const paid950=await saasStore.current(950);
 await saasStore.selectAccess(950,[950],['normal-staff']);
 const req:any={path:'/api/auth/user',method:'GET',session:{userId:'normal-staff',currentSiteId:950,save:(f:Function)=>f()}};let passed=false;
 await isAuthenticated(req,{status:(s:number)=>{throw Error('AUTH_FAILED_'+s);}} as any,()=>{passed=true;});assert.ok(passed);assert.deepEqual(req.authorizedSiteIds,[950]);
 assert.equal(await applySaasAccess({...req,path:'/api/orders'},{} as any),true);
 assert.equal(paid950.plan,'pro');assert.equal(process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED,'true');assert.equal(process.env.SAAS_LIVE_ENABLED,'false');
 assert.equal((await query('SELECT count(*)::int n FROM saas_invoices WHERE total_xaf=50')).rows[0].n,0);
 console.log('PASS normal opening: nonpilot Pro 10999, Business 18999, Custom 25999; real quote/checkout handlers with mocked Sandbox only; signed confirmation, duplicate and failure, exact month, offered days retained, old contract protected, employee access and tenant isolation; maintenance suspended, ZERO real payments');
}finally{await pg.close();await pool.end();}
