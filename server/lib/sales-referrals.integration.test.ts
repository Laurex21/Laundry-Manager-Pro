import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {generateDrizzleJson,generateMigration} from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
import {SALES_COUNTRIES,SALES_CODE} from '../../shared/sales-referrals';
process.env.DATABASE_URL='postgresql://isolated-only:unused@127.0.0.1:1/test';
process.env.NODE_ENV='development';process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
const pg=new PGlite();const testDb=drizzle(pg,{schema});
const {db,pool}=await import('../db');
for(const method of ['select','insert','update','delete','execute','transaction'] as const)(db as any)[method]=testDb[method].bind(testDb);
(pool as any).query=(sql:string,params?:any[])=>pg.query(sql,params);
(pool as any).connect=()=>{throw Error('External connection forbidden');};
const {registerSalesRoutes,createSalesRegistrationUser,completeSalesRegistration,salesEnvironment}=await import('./sales-referrals');
const {requirePlatformAdmin}=await import('./platform-admin-routes');
const routes=new Map<string,any[]>();const app:any={get:(p:string,...h:any[])=>routes.set('GET '+p,h),post:(p:string,...h:any[])=>routes.set('POST '+p,h),patch:(p:string,...h:any[])=>routes.set('PATCH '+p,h)};
registerSalesRoutes(app,requirePlatformAdmin);
async function call(method:string,path:string,body:any={},params:any={},query:any={},admin='admin'){
 const q:any={body,params,query,session:{userId:admin==='expired'?'admin':admin,platformAdminVerifiedAt:admin==='expired'?0:Date.now()},ip:'fictitious-local-test',setHeader(){},get:(n:string)=>n==='host'?'localhost':undefined};
 const r:any={code:200,data:null,headers:{},setHeader(k:string,v:string){this.headers[k]=v;},status(n:number){this.code=n;return this;},json(v:any){this.data=v;return this;},send(v:any){this.data=v;return this;},redirect(n:number,v:string){this.code=n;this.data=v;},end(){}};
 for(const h of routes.get(method+' '+path)!){let next=false;await h(q,r,()=>{next=true;});if(!next)break;}
 return r;
}
try{
 for(const sql of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(sql);
 for(const file of ['20260912_platform_admin_mfa.sql','20261021_saas_billing_v5.sql','20261101_sales_referrals.sql','20261101_sales_referrals.sql'])await pg.exec(await readFile('migrations/'+file,'utf8'));
 await testDb.insert(schema.users).values([{id:'admin',email:'admin@example.invalid'},{id:'ordinary',email:'ordinary@example.invalid'}]);
 await pg.query(`INSERT INTO platform_admins(user_id,mfa_enabled_at,is_active) VALUES('admin',now(),true)`);
 assert.ok(SALES_COUNTRIES.includes('CM')&&SALES_COUNTRIES.includes('CI'));
 assert.equal((await call('GET','/api/platform-admin/sales',{}, {}, {},'ordinary')).code,403);
 assert.equal((await call('GET','/api/platform-admin/sales',{}, {}, {},'expired')).code,401);
 assert.equal((await call('POST','/api/platform-admin/sales',{name:'Denied',country:'CM'}, {}, {},'ordinary')).code,403);
 assert.equal((await call('POST','/api/platform-admin/sales',{name:'Bad',country:'ZZ'})).code,400);
 assert.equal((await call('POST','/api/platform-admin/sales',{name:'Bad',country:'CM',admin:true})).code,400);
 const created=await call('POST','/api/platform-admin/sales',{name:'Commercial fictif CM',country:'CM'});assert.equal(created.code,201);const rep=created.data;assert.match(rep.code,SALES_CODE);
 const other=(await call('POST','/api/platform-admin/sales',{name:'Commercial fictif CI',country:'CI'})).data;
 assert.notEqual(rep.code,other.code);
 assert.equal((await call('GET','/r/:code',{}, {code:rep.code})).data,`/auth?tab=register&sales=${rep.code}`);
 assert.equal((await call('GET','/r/:code',{}, {code:'https://evil.example'})).data,'/auth?tab=register&salesUnavailable=1');
 const publicInfo=await call('GET','/api/public/sales-referral/:code',{}, {code:rep.code});assert.deepEqual(publicInfo.data,{name:rep.name,country:'CM'});
 const user=await createSalesRegistrationUser({id:'referred-a',email:'referred-a@example.invalid',businessName:'Pressing fictif A'},rep.code);
 await testDb.insert(schema.organisations).values({id:1,ownerId:user.id,name:'Pressing fictif A'});
 await completeSalesRegistration(user.id,1);await completeSalesRegistration(user.id,1);
 assert.equal((await pg.query<any>('SELECT count(*)::int n FROM sales_registrations')).rows[0].n,1);
 await assert.rejects(()=>completeSalesRegistration(user.id,4),/SALES_REFERRAL_UNAVAILABLE/);
 await assert.rejects(()=>createSalesRegistrationUser({id:user.id},other.code));
 assert.equal((await pg.query<any>('SELECT representative_id FROM sales_registrations WHERE user_id=$1',[user.id])).rows[0].representative_id,rep.id,'Attribution cannot be overwritten');
 await call('PATCH','/api/platform-admin/sales/:id',{active:false},{id:rep.id});
 assert.equal((await call('GET','/r/:code',{}, {code:rep.code})).data,'/auth?tab=register&salesUnavailable=1');
 await assert.rejects(()=>createSalesRegistrationUser({id:'rejected'},rep.code),/SALES_REFERRAL_UNAVAILABLE/);
 assert.equal((await pg.query<any>("SELECT count(*)::int n FROM users WHERE id='rejected'")).rows[0].n,0,'Rejected code leaves no user');
 // Disabling a referral does not remove its historical attribution or account access.
 assert.equal((await call('GET','/api/platform-admin/sales')).data.items.find((r:any)=>r.id===rep.id).registrations,1);
 await call('PATCH','/api/platform-admin/sales/:id',{active:true},{id:rep.id});
 // Plain signup is untouched and does not require an attribution.
 await createSalesRegistrationUser({id:'direct',email:'direct@example.invalid'},undefined);
 assert.equal((await pg.query<any>("SELECT count(*)::int n FROM sales_registrations WHERE user_id='direct'")).rows[0].n,0);
 // Foreign environment codes must not be usable in development.
 process.env.NODE_ENV='production';process.env.SAAS_DATABASE_ENVIRONMENT='production';assert.equal(salesEnvironment(),'production');
 await assert.rejects(()=>createSalesRegistrationUser({id:'foreign'},rep.code),/SALES_REFERRAL_UNAVAILABLE/);
 process.env.NODE_ENV='development';
 const clock=Date.now();
 const invoice=async(status:string,provider:string,env:string,purpose:string,amount:number,applied=true,delta=1000)=>{
  const id=crypto.randomUUID();await pg.query(`INSERT INTO saas_invoices(id,organisation_id,provider_environment,quote,total_xaf,status,provider_status,paid_at) VALUES($1,1,$2,$3,$4,$5,$6,$7)`,[id,env,{purpose},amount,status,provider,new Date(clock+delta)]);
  if(applied)await pg.query(`INSERT INTO saas_events(organisation_id,action,details) VALUES(1,'payment_applied',$1)`,[{invoiceId:id}]);return id;
 };
 // Use timestamps in the past for confirmed payments while retaining attribution-before-payment.
 await pg.query("UPDATE sales_registrations SET created_at=now()-interval '2 days'");
 await invoice('paid','COMPLETED','sandbox','subscription',10999,true,-1000);
 await invoice('paid','COMPLETED','sandbox','subscription',10999,true,-1000);
 await invoice('pending','COMPLETED','sandbox','subscription',12345,true,-1000);
 await invoice('failed','FAILED','sandbox','subscription',12345,true,-1000);
 await invoice('paid','COMPLETED','live','subscription',12345,true,-1000);
 await invoice('paid','COMPLETED','sandbox','subscription_pilot',50,true,-1000);
 await invoice('paid','COMPLETED','sandbox','collection_pilot',50,true,-1000);
 await invoice('paid','COMPLETED','sandbox','subscription',12345,false,-1000);
 await invoice('paid','COMPLETED','sandbox','subscription',12345,true,-3*86400000);
 await invoice('paid','COMPLETED','sandbox','subscription',12345,true,86400000);
 const summary=await call('GET','/api/platform-admin/sales',{}, {}, {country:'CM'});assert.equal(summary.code,200);
 const metrics=summary.data.items[0];assert.equal(metrics.registrations,1);assert.equal(metrics.payments,2);assert.equal(metrics.paying_accounts,1);assert.equal(metrics.amount_xaf,21998);
 const detail=await call('GET','/api/platform-admin/sales/:id/registrations',{}, {id:rep.id});assert.equal(detail.data.items[0].payments,2);assert.equal(detail.data.items[0].business_name,'Pressing fictif A');
 process.env.SAAS_DEFERRED_ORGANISATION_IDS='1,3,100,112,193';
 assert.equal((await call('GET','/api/platform-admin/sales')).data.items.find((r:any)=>r.id===rep.id).registrations,0,'Excluded organisations not counted');
 assert.equal((await call('GET','/api/platform-admin/sales/:id/registrations',{}, {id:rep.id})).data.total,0);
 process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
 assert.equal((await call('GET','/api/platform-admin/sales',{}, {}, {page:'2'})).data.items.length,0);
 assert.equal((await call('GET','/api/platform-admin/sales',{}, {}, {page:'0'})).code,400);
 assert.equal((await call('PATCH','/api/platform-admin/sales/:id',{active:true,code:'forged'},{id:rep.id})).code,400);
 assert.equal((await pg.query<any>('SELECT count(*)::int n FROM sales_admin_events')).rows[0].n,4);
 const auth=await readFile('server/replit_integrations/auth/routes.ts','utf8');assert.match(auth,/createSalesRegistrationUser/);assert.match(auth,/completeSalesRegistration/);
 console.log('PASS sales: country validation, MFA admin boundaries, audited mutations, fixed referral redirect, atomic user attribution, first attribution retained, disable/reactivate, direct signup, environment separation, verified payments only, duplicate-safe totals, pilot exclusions and deferred organisations');
}finally{await pool.end();await pg.close();}
