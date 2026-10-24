/** Disposable local QA server. Never uses a configured database or a real token. */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { generateDrizzleJson,generateMigration } from 'drizzle-kit/api';
import express from 'express';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import * as schema from '../shared/schema';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/isolated_saas_preview';
process.env.SAAS_BUSINESS_LAUNCH_ENABLED='true';process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
process.env.NODE_ENV='development';process.env.SAAS_BILLING_MODE='sandbox';
process.env.PAWAPAY_SANDBOX_API_TOKEN='local-fixture-not-a-real-token';
process.env.SAAS_SANDBOX_RETURN_ORIGIN='http://127.0.0.1:5184';
const pg=new PGlite();const testDb=drizzle(pg,{schema});
const {db,pool}=await import('../server/db');
for(const method of ['select','insert','update','delete','execute','transaction'] as const)(db as any)[method]=(testDb as any)[method].bind(testDb);
const query=async(text:string,params?:any[])=>{const r=await pg.query(text,params);return{rows:r.rows,rowCount:r.affectedRows};};
(pool as any).query=query;(pool as any).connect=async()=>({query,release:()=>{}});
for(const statement of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(statement);
await testDb.insert(schema.users).values({id:'qa-owner',firstName:'Compte',lastName:'Démonstration',organisationId:1,currentSiteId:10});
await testDb.insert(schema.organisations).values({id:1,ownerId:'qa-owner',name:'Pressing Démonstration',createdAt:new Date('2026-01-01T00:00:00Z')});
await testDb.insert(schema.sites).values([{id:10,organisationId:1,name:'Boutique principale'},{id:11,organisationId:1,name:'Deuxième boutique'},{id:12,organisationId:1,name:'Troisième boutique'}]);
await testDb.insert(schema.siteMembers).values({siteId:10,userId:'qa-owner',role:'owner'});
const {recordCurrentLegalAcceptance}=await import('../server/lib/legal');
await recordCurrentLegalAcceptance({userId:'qa-owner',organisationId:1,siteId:10,source:'registration',ipAddress:'127.0.0.1',userAgent:'isolated-QA'});
const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
const nativeFetch=globalThis.fetch;const checkouts=new Map<string,any>();
globalThis.fetch=async(input:any,options:any)=>{
 const url=String(input);
 if(url==='https://api.sandbox.pawapay.io/v2/public-key/http')return new Response(JSON.stringify([{id:'local-qa',key:publicKey.export({type:'spki',format:'pem'}).toString()}]));
 if(url.startsWith('https://api.sandbox.pawapay.io/v2/checkouts')){
  if(options?.method==='POST'){
   const payload=JSON.parse(options.body);const data={...payload,status:'WAITING_PAYMENT',checkoutCode:payload.checkoutId,redirectUrl:`https://checkout.sandbox.pawapay.io/${payload.checkoutId}`};checkouts.set(payload.checkoutId,data);
   return new Response(JSON.stringify({...data,status:'ACCEPTED'}));
  }
  const data=checkouts.get(url.split('/').pop()!);return new Response(JSON.stringify(data?{status:'FOUND',data}:{status:'NOT_FOUND'}));
 }
 throw Error('Unexpected external request blocked by isolated preview');
};
const {registerSaasRoutes}=await import('../server/lib/saas-routes');const {saasStore}=await import('../server/lib/saas-runtime');
const app=express();app.use(express.json({verify:(req:any,_res,buf)=>{req.rawBody=buf;}}));
app.use((req:any,_res,next)=>{req.session={userId:'qa-owner',currentSiteId:10,save:(cb:any)=>cb?.()};next();});
registerSaasRoutes(app);app.get('/api/auth/user',async(_req,res)=>res.json({id:'qa-owner',role:'owner',saas:await saasStore.current(1),currentSite:{id:10}}));
app.post('/__qa/complete',async(_req,res)=>{
 try{
 const entry=[...checkouts.values()].find(value=>value.status==='WAITING_PAYMENT');if(!entry)return res.status(409).json({error:'No pending local checkout'});
 entry.status='COMPLETED';entry.deposit={depositId:crypto.randomUUID(),status:'COMPLETED',amount:entry.amounts[0].amount,currency:'XAF',country:'CMR'};
 const body=JSON.stringify(entry);const now=new Date();const created=Math.floor(now.getTime()/1000);
 const params=`("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="local-qa";created=${created};expires=${created+60}`;
 const headers:any={'content-type':'application/json','signature-date':now.toISOString(),'content-digest':`sha-512=:${crypto.createHash('sha512').update(body).digest('base64')}:`,'signature-input':`sig-pp=${params}`};
 const base=`"@method": POST\n"@authority": 127.0.0.1:5184\n"@path": /api/saas/sandbox/callback\n"signature-date": ${headers['signature-date']}\n"content-digest": ${headers['content-digest']}\n"content-type": application/json\n"@signature-params": ${params}`;
 headers.signature=`sig-pp=:${crypto.sign('sha256',Buffer.from(base),privateKey).toString('base64')}:`;
 const callback=await nativeFetch('http://127.0.0.1:5184/api/saas/sandbox/callback',{method:'POST',headers,body});
 res.status(callback.status).json({status:callback.status,body:await callback.text()});
 }catch{res.status(500).json({error:'Local callback simulation failed'});}
});
const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.get('/saas-qa.html',async(_req,res)=>{const html=(await readFile(path.resolve('scripts/fixtures/saas-qa.html'),'utf8')).replace('/__SAAS_QA_ENTRY__','/@fs/'+path.resolve('scripts/fixtures/business-launch-qa.tsx'));res.type('html').send(await vite.transformIndexHtml('/saas-qa.html',html));});
app.get('/saas-mobile-qa.html',(_req,res)=>res.type('html').send('<!doctype html><title>Mobile QA 390px</title><body style="margin:0;background:#ddd"><iframe title="Mobile 390px" src="/saas-qa.html" style="width:390px;height:844px;border:0"></iframe>'));
app.use(vite.middlewares);
app.listen(5184,'127.0.0.1',()=>console.log('ISOLATED_SAAS_PREVIEW http://127.0.0.1:5184/saas-qa.html — in-memory data and simulated provider only'));
