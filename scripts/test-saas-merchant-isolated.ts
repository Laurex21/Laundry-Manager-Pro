/** Real merchant sandbox test. Synthetic PGlite data only; private API + signed callback listener. */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { generateDrizzleJson,generateMigration } from 'drizzle-kit/api';
import express from 'express';
import {readFile, appendFile} from 'node:fs/promises';
import * as schema from '../shared/schema';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/isolated_saas_preview';
process.env.NODE_ENV='development';process.env.SAAS_BILLING_MODE='sandbox';
if(!process.env.PAWAPAY_SANDBOX_API_TOKEN)throw new Error('SANDBOX_TOKEN_NOT_CONFIGURED');
process.env.SAAS_SANDBOX_RETURN_ORIGIN=process.env.ISOLATED_TEST_RETURN_ORIGIN;
if(!process.env.SAAS_SANDBOX_RETURN_ORIGIN?.startsWith('https://'))throw new Error('HTTPS_TEST_RETURN_ORIGIN_REQUIRED');
process.env.SAAS_SANDBOX_CALLBACK_ORIGIN=process.env.ISOLATED_TEST_CALLBACK_ORIGIN;
if(!process.env.SAAS_SANDBOX_CALLBACK_ORIGIN?.startsWith('https://'))throw new Error('HTTPS_TEST_CALLBACK_ORIGIN_REQUIRED');
const pg=new PGlite();const testDb=drizzle(pg,{schema});
const {db,pool}=await import('../server/db');
for(const method of ['select','insert','update','delete','execute','transaction'] as const)(db as any)[method]=(testDb as any)[method].bind(testDb);
const query=async(text:string,params?:any[])=>{const r=await pg.query(text,params);return{rows:r.rows,rowCount:r.affectedRows};};
(pool as any).query=query;(pool as any).connect=async()=>({query,release:()=>{}});
for(const statement of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(statement);
await testDb.insert(schema.users).values({id:'qa-owner',firstName:'Compte',lastName:'Démonstration',organisationId:1,currentSiteId:10});
await testDb.insert(schema.organisations).values({id:1,ownerId:'qa-owner',name:'Pressing Démonstration'});
await testDb.insert(schema.sites).values({id:10,organisationId:1,name:'Boutique de démonstration'});
await testDb.insert(schema.siteMembers).values({siteId:10,userId:'qa-owner',role:'owner'});
const {recordCurrentLegalAcceptance}=await import('../server/lib/legal');
await recordCurrentLegalAcceptance({userId:'qa-owner',organisationId:1,siteId:10,source:'registration',ipAddress:'127.0.0.1',userAgent:'isolated-QA'});
const {registerSaasRoutes}=await import('../server/lib/saas-routes');const {saasStore}=await import('../server/lib/saas-runtime');
const app=express();app.use(express.json({verify:(req:any,_res,buf)=>{req.rawBody=buf;}}));
app.use((req:any,res,next)=>{
 let responseBody:unknown;
 if(req.path==='/api/saas/sandbox/callback'){const json=res.json.bind(res);res.json=(body:unknown)=>{responseBody=body;return json(body);};}
 if(req.path==='/api/saas/sandbox/callback')res.on('finish',()=>{
  void (async()=>{
   const account=(await pg.query('SELECT state FROM saas_accounts WHERE organisation_id=1')).rows;
   const invoices=(await pg.query('SELECT id,status,provider_status,paid_at FROM saas_invoices ORDER BY created_at')).rows;
   const audit={receivedAt:new Date().toISOString(),status:res.statusCode,responseBody,event:{checkoutId:req.body?.checkoutId,depositId:req.body?.depositId,status:req.body?.status,checkoutCode:req.body?.checkoutCode,clientReferenceId:req.body?.clientReferenceId,metadata:req.body?.metadata,amount:req.body?.amount,currency:req.body?.currency,country:req.body?.country,deposit:req.body?.deposit&&{status:req.body.deposit.status,amount:req.body.deposit.amount,currency:req.body.deposit.currency,country:req.body.deposit.country}},account,invoices};
   await appendFile('/tmp/xpresspro-saas-isolated-20261021/callback-only-audit.jsonl',JSON.stringify(audit)+'\n');
   console.log('CALLBACK_ONLY_RESULT',JSON.stringify(audit));
  })().catch(()=>console.error('CALLBACK_AUDIT_FAILED'));
 });
 next();
});
app.use((req:any,_res,next)=>{req.session={userId:'qa-owner',currentSiteId:10,save:(cb:any)=>cb?.()};next();});
registerSaasRoutes(app, { backgroundJobs: false });
console.log("CALLBACK_ONLY_TEST: background reconciliation and subscription jobs disabled");
// Only the signed callback route can be reached from outside the container.
const {createServer}=await import('node:http');
const callbackServer=createServer((req,res)=>{
 if(req.method==='POST'&&req.url==='/api/saas/sandbox/callback')return app(req,res);
 res.statusCode=404;res.end();
});
// Optional synthetic snapshots from an earlier instance of THIS disposable test.
if(process.env.ISOLATED_TEST_RESTORE==='1'){
 const fixture=JSON.parse(await readFile('/tmp/xpresspro-saas-isolated-20261021/snapshot.json','utf8'));
 await pg.query('INSERT INTO saas_accounts (organisation_id,state) VALUES (1,$1::jsonb) ON CONFLICT (organisation_id) DO UPDATE SET state=EXCLUDED.state',[JSON.stringify(fixture.state)]);
 for(const invoice of fixture.invoices)await pg.query('INSERT INTO saas_invoices SELECT * FROM json_populate_record(null::saas_invoices,$1::json)',[JSON.stringify(invoice)]);
 console.log('ISOLATED_SYNTHETIC_SNAPSHOT_RESTORED');
}
const privateServer=app.listen(5174,'127.0.0.1',()=>console.log('PRIVATE_TEST_API_READY 127.0.0.1:5174; database=PGlite_memory; fixture=qa-owner; no production DB'));
callbackServer.listen(3001,'0.0.0.0',()=>console.log('SIGNED_CALLBACK_ONLY_READY port=3001 path=/api/saas/sandbox/callback'));
console.log('ISOLATED_TEST_CREATED',JSON.stringify({organisationId:1,siteId:10,state:await saasStore.current(1)}));
process.on('SIGINT',()=>{privateServer.close();callbackServer.close();pg.close().finally(()=>process.exit());});
