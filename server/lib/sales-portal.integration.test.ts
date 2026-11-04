import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {generateDrizzleJson,generateMigration} from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
process.env.DATABASE_URL='postgresql://isolated:unused@127.0.0.1:1/test';
process.env.NODE_ENV='development';
process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
process.env.SAAS_BILLING_MODE='disabled';process.env.SAAS_LIVE_ENABLED='false';process.env.SALES_EMAIL_ENABLED='false';
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('External HTTP/email/payments forbidden');};
const pg=new PGlite(),testDb=drizzle(pg,{schema});
const {db,pool}=await import('../db');
for(const method of ['select','insert','update','delete','execute','transaction'] as const)(db as any)[method]=testDb[method].bind(testDb);
(pool as any).query=(s:string,v?:any[])=>pg.query(s,v);
(pool as any).connect=()=>{throw Error('External database forbidden');};
const {AmbassadorAccess}=await import('./ambassador-access');
const {registerAmbassadorRoutes}=await import('./ambassador-routes');
const {registerSalesPortalRoutes}=await import('./sales-portal-routes');
const {registerSalesRoutes}=await import('./sales-referrals');
const {requirePlatformAdmin}=await import('./platform-admin-routes');
const {isAuthenticated}=await import('../replit_integrations/auth/replitAuth');
const {routeFeature}=await import('./saas-access');
let failAudit=false;
// Embedded PostgreSQL, serialized transactions; no network or real accounts.
const database={query:(s:string,v?:any[])=>pg.query(s,v),transaction:<T>(fn:(tx:any)=>Promise<T>)=>pg.transaction(tx=>fn({query:(s:string,v?:any[])=>{if(failAudit&&s.includes('INSERT INTO sales_user_access_events'))throw Error('Audit failure');return tx.query(s,v);}}))};
const store=new AmbassadorAccess(database);
const routes=new Map<string,any[]>();
const app:any={get:(p:string,...h:any[])=>routes.set('GET '+p,h),post:(p:string,...h:any[])=>routes.set('POST '+p,h),patch:(p:string,...h:any[])=>routes.set('PATCH '+p,h)};
// Real application tenant/subscription/legal middleware, not a mock of its access rules.
registerAmbassadorRoutes(app,requirePlatformAdmin,isAuthenticated,store);
registerSalesPortalRoutes(app,requirePlatformAdmin);registerSalesRoutes(app,requirePlatformAdmin);
function request(body:any={},params:any={},userId='admin',query:any={}){
 const q:any={body,params,query,protocol:'https',method:'GET',path:'',ip:crypto.randomUUID(),get:(name:string)=>({host:'isolated.replit.dev',origin:'https://isolated.replit.dev','sec-fetch-site':'same-origin'}[name])};
 q.session={userId,platformAdminVerifiedAt:Date.now(),save:(cb:any)=>cb()};return q;
}
async function call(method:string,path:string,q=request()){
 q.method=method;q.path=path;
 const r:any={code:200,data:null,headers:{},setHeader(k:string,v:string){this.headers[k]=v;},status(n:number){this.code=n;return this;},json(v:any){this.data=v;return this;},send(v:any){this.data=v;return this;},redirect(n:number,v:string){this.code=n;this.data=v;},end(){}};
 for(const h of routes.get(method+' '+path)!){let next=false;await h(q,r,()=>{next=true;});if(!next)break;}return r;
}
const activate=(userId:string,representativeId?:number)=>call('POST','/api/platform-admin/ambassadors',request({userId,name:'Ambassadeur fictif',country:'CM',...(representativeId?{representativeId}:{})}));
const snapshot=async()=>{
 const tables=['users','organisations','sites','site_members','saas_accounts','saas_invoices','sales_accounts','sales_invitations','sales_registrations'];
 const result:Record<string,any>={}; for(const table of tables)result[table]=(await pg.query(`SELECT * FROM ${table} ORDER BY 1`)).rows; return result;
};
try{
 for(const sql of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(sql);
 await pg.exec('DROP TABLE sales_user_access_events; DROP TABLE sales_user_access; ALTER TABLE sales_representatives DROP COLUMN public_code;');
 for(const file of ['20260912_platform_admin_mfa.sql','20261021_saas_billing_v5.sql','20261101_sales_referrals.sql','20261101_sales_portal.sql'])await pg.exec(await readFile('migrations/'+file,'utf8'));
 await testDb.insert(schema.users).values([
  {id:'admin',email:'admin@example.invalid',organisationId:1},
  {id:'owner-a',email:'a@example.invalid',businessName:'Pressing fictif A',passwordHash:'unchanged-merchant-hash',organisationId:1},
  {id:'owner-b',email:'b@example.invalid',businessName:'Pressing fictif B',organisationId:2},
  {id:'staff-a',email:'staff@example.invalid',userType:'staff',organisationId:1},
  {id:'unlinked',email:'unlinked@example.invalid',organisationId:1},
  ...[3,100,112,193].map(id=>({id:'deferred-'+id,email:`deferred-${id}@example.invalid`,organisationId:id})),
 ]);
 await testDb.insert(schema.organisations).values([{id:1,name:'A',ownerId:'owner-a'},{id:2,name:'B',ownerId:'owner-b'},...[3,100,112,193].map(id=>({id,name:'Excluded '+id,ownerId:'deferred-'+id}))]);
 await testDb.insert(schema.sites).values([{id:1,name:'Site A',organisationId:1},{id:2,name:'Site B',organisationId:2}]);
 await testDb.insert(schema.siteMembers).values({siteId:1,userId:'staff-a',role:'staff'});
 await pg.query("INSERT INTO platform_admins(user_id,mfa_enabled_at,is_active) VALUES('admin',now(),true)");
 const {CURRENT_LEGAL_DOCUMENTS}=await import('./legal');
 await pg.query(`INSERT INTO legal_acceptances(user_id,terms_version,privacy_version,cookie_version,document_hash,source) SELECT id,$1,$2,$3,$4,'admin' FROM users`,[CURRENT_LEGAL_DOCUMENTS.termsVersion,CURRENT_LEGAL_DOCUMENTS.privacyVersion,CURRENT_LEGAL_DOCUMENTS.cookieVersion,CURRENT_LEGAL_DOCUMENTS.documentHash]);
 // Existing links/legacy passwords and recorded referrals are preserved during explicit linking.
 await pg.query(`INSERT INTO sales_representatives(id,name,country,code,environment,created_by) VALUES(11,'Legacy A','CM',$1,'test','admin'),(22,'Legacy B','CI',$2,'test','admin')`,['CM-'+'A'.repeat(20),'CI-'+'B'.repeat(20)]);
 await pg.query(`INSERT INTO sales_accounts(id,representative_id,email,password_hash,active,environment) VALUES($1,11,'a@example.invalid','legacy-hash',true,'test')`,[crypto.randomUUID()]);
 await pg.query(`INSERT INTO sales_registrations(user_id,organisation_id,representative_id,country,environment,created_at) VALUES('owner-a',1,11,'CM','test',now()-interval '2 days'),('owner-b',2,22,'CI','test',now()-interval '2 days')`);
 for(const org of [1,2]){const id=crypto.randomUUID();await pg.query(`INSERT INTO saas_invoices(id,organisation_id,provider_environment,quote,total_xaf,status,provider_status,paid_at) VALUES($1,$2,'sandbox','{}',$3,'paid','COMPLETED',now()-interval '1 hour')`,[id,org,org*10999]);await pg.query("INSERT INTO saas_events(organisation_id,action,details) VALUES($1,'payment_applied',$2)",[org,{invoiceId:id}]);}
 const beforeMigration=await snapshot();
 for(let i=0;i<2;i++)await pg.exec(await readFile('migrations/20261104_ambassador_user_access.sql','utf8'));
 assert.deepEqual(await snapshot(),beforeMigration,'Additive migration preserves existing data, including repeated execution');
 const before=await snapshot();
 assert.equal(await store.principal('owner-a'),null,'Legacy matching email does not grant new access');
 assert.equal((await call('GET','/api/ambassador/summary',request({}, {}, 'owner-a'))).code,403);
 const denied=request({userId:'owner-a',name:'Denied',country:'CM'},{},'owner-b');
 assert.equal((await call('POST','/api/platform-admin/ambassadors',denied)).code,403);
 const expired=request({userId:'owner-a',name:'Denied',country:'CM'});expired.session.platformAdminVerifiedAt=0;
 assert.equal((await call('POST','/api/platform-admin/ambassadors',expired)).code,401);
 const csrf=request({userId:'owner-a',name:'Denied',country:'CM'});csrf.get=(n:string)=>({host:'isolated.replit.dev',origin:'https://evil.example','sec-fetch-site':'cross-site'}[n]);
 assert.equal((await call('POST','/api/platform-admin/ambassadors',csrf)).code,403);
 for(const bad of [{userId:'owner-a',name:'Bad',country:'ZZ'},{userId:'owner-a',name:'Bad',country:'CM',role:'admin'}])assert.equal((await call('POST','/api/platform-admin/ambassadors',request(bad))).code,400);
 assert.equal((await activate('does-not-exist')).code,404);
 for(const id of [3,100,112,193])assert.equal((await activate('deferred-'+id)).code,403);
 const candidates=await call('GET','/api/platform-admin/ambassadors/users',request({}, {}, 'admin',{search:'a@example.invalid'}));
 assert.equal(candidates.code,200);assert.ok(!JSON.stringify(candidates.data).includes('password'));assert.equal(candidates.data.items[0].id,'owner-a');
 assert.equal((await call('GET','/api/platform-admin/ambassadors/users',request({}, {}, 'owner-a',{search:'a@'}))).code,403);
 assert.equal((await call('GET','/api/platform-admin/ambassadors/users',request({}, {}, 'admin',{search:'%_'}))).data.items.length,0,'Search wildcard escaping');
 const bound=await activate('owner-a',11);assert.equal(bound.code,200,JSON.stringify(bound.data));assert.equal(bound.data.code,'CM-'+'A'.repeat(20));
 assert.equal((await activate('owner-a',11)).code,200);
 assert.equal((await pg.query<any>('SELECT count(*)::int n FROM sales_user_access_events')).rows[0].n,1,'Activation retries are idempotent');
 assert.equal((await activate('owner-b',11)).code,409,'Cannot steal existing link');
 assert.equal((await activate('owner-a',22)).code,409,'Cannot switch existing personal history');
 assert.equal((await activate('owner-b',22)).code,200);
 const staff=await activate('staff-a');assert.equal(staff.code,200,JSON.stringify(staff.data));assert.match(staff.data.code,/^CM-[A-F0-9]{8}$/);
 const canonical=(await pg.query<any>('SELECT code FROM sales_representatives WHERE id=$1',[staff.data.id])).rows[0].code;
 assert.equal((await call('GET','/r/:code',request({}, {code:staff.data.code}))).data,`/auth?tab=register&sales=${canonical}`);
 assert.equal((await call('GET','/api/public/sales-referral/:code',request({}, {code:staff.data.code}))).data.name,'Ambassadeur fictif');
 assert.equal((await call('GET','/r/:code',request({}, {code:'CM-'+'A'.repeat(20)}))).data,'/auth?tab=register&sales=CM-'+'A'.repeat(20));
 assert.equal((await call('GET','/api/ambassador/access',request({}, {}, 'owner-a'))).data.enabled,true);
 const own=await call('GET','/api/ambassador/summary',request({}, {}, 'owner-a'));assert.equal(own.code,200,JSON.stringify(own.data));assert.equal(own.data.amount_xaf,10999);
 assert.equal((await call('GET','/api/ambassador/summary',request({}, {}, 'owner-b'))).data.amount_xaf,21998);
 const rows=(await call('GET','/api/ambassador/registrations',request({}, {}, 'owner-a'))).data.items;assert.equal(rows.length,1);assert.equal(rows[0].organisation_id,1);assert.equal(rows[0].user_id,undefined);assert.ok(!JSON.stringify(rows).includes('email'));
 for(const path of ['/api/ambassador/summary','/api/ambassador/registrations'])assert.equal((await call('GET',path,request({}, {}, 'owner-a',{representativeId:22}))).code,400);
 assert.equal((await call('GET','/api/ambassador/summary',request({}, {}, 'staff-a'))).data.registrations,0,'Same organisation never shares ambassador results');
 assert.equal((await call('GET','/api/ambassador/access',request({}, {}, 'unlinked'))).data.enabled,false);
 const noUser=request();delete noUser.session.userId;noUser.session.salesAccountId=crypto.randomUUID();
 assert.equal((await call('GET','/api/ambassador/summary',noUser)).code,401,'Old commercial session is not a user session');
 // Starter/Business feature rules are unchanged; the new workspace is not a paid entitlement.
 assert.equal(routeFeature('/api/ambassador/summary','GET'),null);assert.equal(routeFeature('/api/analytics/customers','GET'),'reports');
 const suspended=await call('PATCH','/api/platform-admin/ambassadors/:id',request({active:false},{id:11}));assert.equal(suspended.code,200);
 assert.equal((await call('GET','/api/ambassador/summary',request({}, {}, 'owner-a'))).code,403,'No cached session bypass after suspension');
 assert.equal((await call('GET','/api/ambassador/access',request({}, {}, 'owner-a'))).data.enabled,false);
 assert.equal((await call('GET','/r/:code',request({}, {code:'CM-'+'A'.repeat(20)}))).data,'/auth?tab=register&salesUnavailable=1');
 assert.deepEqual(await snapshot(),before,'Merchant identity, seats, history, invoices and legacy credentials unchanged');
 assert.equal((await activate('owner-a',11)).data.code,bound.data.code,'Reactivation preserves link');
 failAudit=true;const failed=await activate('unlinked');assert.equal(failed.code,503);failAudit=false;
 assert.equal(await store.principal('unlinked'),null,'Audit failure rolls back role and link creation');
 process.env.SAAS_DEFERRED_ORGANISATION_IDS='1,3,100,112,193';
 assert.equal((await call('GET','/api/ambassador/summary',request({}, {}, 'owner-a'))).code,403,'Exclusion also blocks an already granted role');
 process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
 process.env.NODE_ENV='production';process.env.SAAS_DATABASE_ENVIRONMENT='production';
 assert.equal(await store.principal('owner-a'),null,'Test role is not available in production');
 assert.equal((await activate('unlinked',11)).code,404,'Cannot link a representative across environments');
 process.env.NODE_ENV='development';
 // Every old authentication/invitation API is inert, even with valid old credentials.
 for(const [key] of routes){if(key.startsWith('GET /api/sales/')||key.startsWith('POST /api/sales/')||key.includes('/sales/:id/account')||key.includes('/sales/:id/invitation')){
  const [method,path]=key.split(' ');const q=request({email:'a@example.invalid',password:'legacy',token:'irrelevant'},{id:11});
  const sessionBefore={...q.session};assert.equal((await call(method,path,q)).code,410,key);assert.deepEqual(q.session,sessionBefore);
 }}
 assert.deepEqual(await snapshot(),before,'Retired routes do not mutate merchant/legacy records or send emails');
 const directory=await call('GET','/api/platform-admin/sales');assert.equal(directory.data.items.find((r:any)=>r.id===11).user_email,'a@example.invalid');
 assert.equal((await call('GET','/api/ambassador/summary',request({}, {}, 'owner-a'))).headers['Cache-Control'],'no-store');
 console.log('PASS ambassadors: MFA + CSRF, explicit binding, no email matching, existing user login, legacy link preservation, short links, own results, immutable attribution, Starter feature boundary, staff seats unchanged, idempotency, immediate suspension, audit rollback, four exclusions, environment isolation, retired email/password endpoints and zero external calls');
}catch(error){console.error(error);throw error;}finally{globalThis.fetch=originalFetch;await pool.end();await pg.close();}
