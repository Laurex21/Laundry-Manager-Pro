import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
import { saasSelection } from '../../shared/saas-plans';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/isolated_test';
process.env.SAAS_BILLING_MODE='sandbox';process.env.NODE_ENV='test';
const pg=new PGlite();const testDb=drizzle(pg,{schema});
const {db,pool}=await import('../db');
for(const method of ['select','insert','update','delete','execute','transaction'] as const)(db as any)[method]=(testDb as any)[method].bind(testDb);
const query=async(text:string,params?:any[])=>{const r=await pg.query(text,params);return {rows:r.rows,rowCount:r.affectedRows};};
(pool as any).query=query;(pool as any).connect=async()=>({query,release:()=>{}});
const {saasStore,saasEnabled}=await import('./saas-runtime');
const {applySaasAccess,standardSaasSettings,routeFeature}=await import('./saas-access');
const {storage}=await import('../storage');
try{
 for(const statement of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(statement);
 await testDb.insert(schema.users).values([{id:'owner',organisationId:1},{id:'staff',organisationId:1,userType:'staff'},{id:'other',organisationId:2}]);
 await testDb.insert(schema.organisations).values([{id:1,name:'Test',ownerId:'owner'},{id:2,name:'Other',ownerId:'other'}]);
 await testDb.insert(schema.sites).values([{id:10,organisationId:1,name:'Primary'},{id:11,organisationId:1,name:'History'},{id:20,organisationId:2,name:'Foreign'}]);
 await testDb.insert(schema.siteMembers).values([{siteId:10,userId:'owner',role:'owner'},{siteId:11,userId:'owner',role:'owner'},{siteId:10,userId:'staff',role:'operator'}]);
 await saasStore.ensure(1);let state=await saasStore.current(1);
 state={...state,phase:'starter',plan:'starter',activeStaffIds:[],activeSiteIds:[10]};
 await query('UPDATE saas_accounts SET state=$2::jsonb WHERE organisation_id=$1',[1,JSON.stringify(state)]);
 async function access(path:string,method='GET',userId='owner',siteId:number|null=10){const req:any={userId,organisationId:1,method,path,siteId,authorizedSiteIds:[10,11],organisationSiteIds:[10,11],siteScope:siteId?[siteId]:[10,11],organisationSiteScope:[10,11]};let code=200;let payload:any;const res:any={status:(c:number)=>{code=c;return res;},json:(p:any)=>{payload=p;return res;}};const passed=await applySaasAccess(req,res);return{req,code,payload,passed};}
 assert.equal((await access('/api/orders','GET','owner',11)).passed,true); // Historical reads survive.
 assert.equal((await access('/api/orders','POST','owner',11)).code,403);
 const historicStatus=await access('/api/orders/1/status','PATCH','owner',11);assert.equal(historicStatus.payload.code,'SAAS_SITE_READ_ONLY');
 const activeStatus=await access('/api/orders/1/status','PATCH','owner',10);assert.equal(activeStatus.passed,true);
 assert.equal((await access('/api/analytics/customer-behavior')).payload.code,'SAAS_FEATURE_REQUIRED');
 assert.equal((await access('/api/analytics/storage-occupancy','GET','owner',11)).payload.code,'SAAS_SITE_READ_ONLY');
 const scope=await access('/api/orders/old/status','PATCH');assert.deepEqual(scope.req.authorizedSiteIds,[10]);
 assert.equal((await access('/api/orders','GET','staff')).code,403); // Existing staff session revoked.
 assert.equal((await access('/api/auth/user','GET','staff')).req.saasSuspended,true);
 for(const path of ['/api/reports','/api/machines','/api/analytics/kpis','/api/employees'])assert.equal((await access(path)).code,403,path);
 assert.equal((await access('/api/daily-site-reports')).passed,true);
 assert.equal((await access('/api/daily-site-reports/draft','POST')).code,403);
 for(const path of ['/api/orders','/api/customers','/api/payments/ledger','/api/garment-returns','/api/settings'])assert.equal((await access(path)).passed,true,path);
 assert.equal(routeFeature('/api/pilotage/overview','GET'),'machines','Overview retains the existing paid-plan boundary');
 assert.equal(routeFeature('/api/subscriptions/3/payments','POST'),null,'Existing customer contract payments must remain recordable');
 assert.equal(routeFeature('/api/customers/3/subscription','POST'),'memberships');
 assert.equal(routeFeature('/api/subscriptions/3/renew','POST'),'memberships');
 const settings={businessName:'Company',phone:'000',logoBase64:'saved-logo',receiptHeaderColor:'#123456',receiptQrCodeBase64:'saved-qr',receiptFooterNote:'Saved note'};
 assert.match(standardSaasSettings(settings,'starter').logoBase64!,/^data:image\/svg\+xml;base64,/);assert.equal(settings.logoBase64,'saved-logo');assert.equal(standardSaasSettings(settings,'pro').logoBase64,'saved-logo');
 // Quotas are enforced inside the actual existing site's storage transaction.
 await assert.rejects(storage.createSite(1,{name:'Blocked',address:'',city:'',phone:''}),/BUSINESS_REQUIRED/);
 assert.equal((await query('SELECT * FROM sites WHERE organisation_id=1')).rows.length,2);
 await testDb.insert(schema.customers).values({id:1,siteId:11,name:'Demo',phone:'000',address:'Test'});
 await testDb.insert(schema.orders).values({id:1,customerId:1,siteId:11});
 await testDb.insert(schema.customers).values({id:2,siteId:10,name:'Synthetic active customer',phone:'000',address:'Test'});
 await testDb.insert(schema.orders).values({id:2,customerId:2,siteId:10,status:'received'});
 const untouched=await storage.getOrder(1);
 if(historicStatus.passed) await storage.updateOrderStatus(1,'washing',undefined,'owner');
 assert.deepEqual(await storage.getOrder(1),untouched,'Read-only refusal leaves the historical order unchanged');
 const moved=await storage.updateOrderStatus(2,'washing',undefined,'owner');assert.equal(moved?.status,'washing','Active Starter site can advance a genuine order');
 assert.equal((await storage.getOrder(2))?.status,'washing');
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
 globalThis.fetch=async(input:any)=>{if(String(input)==='https://api.sandbox.pawapay.io/v2/public-key/http')return new Response(JSON.stringify([{id:'route-test',key:publicKey.export({type:'spki',format:'pem'}).toString()}]));throw Error('Unexpected external request in isolated test');};
 const {registerSaasRoutes}=await import('./saas-routes');
 const handlers=new Map<string,Function>();
 const app:any={get:(path:string,...fn:Function[])=>handlers.set('GET '+path,fn[fn.length-1]),post:(path:string,...fn:Function[])=>handlers.set('POST '+path,fn[fn.length-1])};registerSaasRoutes(app);
 async function snapshot(html:string,org=1){let status=200;let result:any;const res:any={status:(c:number)=>{status=c;return res;},json:(value:any)=>{result=value;return res;},sendStatus:(c:number)=>{status=c;return res;}};
 await handlers.get('POST /api/receipt-snapshots')!({saas:state,organisationId:org,authorizedSiteIds:org===1?[10,11]:[20],body:{orderId:1,kind:'deposit',html}},res);return{status,result};}
 const original='<html><body>Receipt before downgrade</body></html>';
 assert.equal((await snapshot(original)).result.html,original);
 assert.equal((await snapshot('<html><body>Changed settings</body></html>')).result.html,original,'First issued receipt remains immutable');
 assert.equal((await snapshot(original,2)).status,404,'Receipt archive cannot cross organisation boundaries');
 assert.equal((await access('/api/receipt-snapshots','POST','owner',11)).passed,true,'Historical receipt download remains available');
 // Real signed deposit callbacks identify the invoice through metadata. They
 // reconcile the checkout, never create a second paid entitlement from a body.
 const quoted=await saasStore.createQuote(1,saasSelection('pro'));
 const pending=await saasStore.reserveCheckout(1,quoted.id);
 await saasStore.recordCheckout(1,quoted.id,'route-code','https://checkout.sandbox.pawapay.io/route-code');
 await saasStore.applyProviderResult(pending.checkout_id!,{checkoutId:pending.checkout_id,checkoutCode:'route-code',status:'COMPLETED',amount:String(pending.total_xaf),currency:'XAF',country:'CMR',deposit:{status:'COMPLETED',amount:String(pending.total_xaf),currency:'XAF',country:'CMR'}});
 const paidState=await saasStore.current(1);
 process.env.SAAS_SANDBOX_CALLBACK_ORIGIN='https://isolated-test.replit.dev:3003';
 async function signedDeposit(amount:string){
  const body={depositId:crypto.randomUUID(),status:'COMPLETED',amount,currency:'XAF',country:'CMR',metadata:{invoiceId:quoted.id}};
  const rawBody=Buffer.from(JSON.stringify(body));const created=Math.floor(Date.now()/1000);
  const params=`("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="route-test";created=${created};expires=${created+60}`;
  const headers:any={'content-type':'application/json','signature-date':new Date().toISOString(),'content-digest':`sha-512=:${crypto.createHash('sha512').update(rawBody).digest('base64')}:`,'signature-input':`sig-pp=${params}`};
  const base=`"@method": POST\n"@authority": isolated-test.replit.dev:3003\n"@path": /api/saas/sandbox/callback\n"signature-date": ${headers['signature-date']}\n"content-digest": ${headers['content-digest']}\n"content-type": application/json\n"@signature-params": ${params}`;
  headers.signature=`sig-pp=:${crypto.sign('sha256',Buffer.from(base),privateKey).toString('base64')}:`;
  let status=200;let result:any;const res:any={status:(code:number)=>{status=code;return res;},sendStatus:(code:number)=>{status=code;return res;},json:(value:any)=>{result=value;return res;}};
  await handlers.get('POST /api/saas/sandbox/callback')!({method:'POST',path:'/api/saas/sandbox/callback',headers,rawBody,body,is:()=>true,get:()=> 'isolated-test.replit.dev'},res);
  return{status,result};
 }
 assert.equal((await signedDeposit(String(pending.total_xaf)+'.00')).status,200);
 assert.equal((await signedDeposit(String(pending.total_xaf)+'.00')).status,200);
 assert.deepEqual(await saasStore.current(1),paidState,'Duplicate signed deposit notifications never extend the cycle twice');
 assert.equal((await signedDeposit('1.00')).status,409,'Mismatched deposit amount cannot reconcile another invoice');
 delete process.env.SAAS_SANDBOX_CALLBACK_ORIGIN;
 // The compatibility flag does not activate the new schema or provider in production.
 process.env.NODE_ENV='production';assert.equal(saasEnabled(),false);process.env.NODE_ENV='test';
 assert.equal(saasSelection('business',1,0).extraSites,1);
 console.log('PASS SaaS access: archived sites, direct mutation scopes, open staff sessions, premium APIs, standard receipts, atomic site quota and production opt-out');
}finally{await pg.close();await pool.end();delete process.env.SAAS_BILLING_MODE;}
