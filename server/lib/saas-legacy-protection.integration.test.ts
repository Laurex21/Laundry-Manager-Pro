import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {generateDrizzleJson,generateMigration} from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
import {saasSelection} from '../../shared/saas-plans';
import {legacyLaunchProtection} from './saas-legacy-protection';
import {previewDualRoleSeparation} from './saas-dual-role-preview';
// No real environment/credentials. All application DB methods use in-memory PG.
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/isolated_legacy';
process.env.NODE_ENV='test';process.env.SAAS_BILLING_MODE='sandbox';
process.env.SAAS_LIVE_ENABLED='false';process.env.SAAS_BUSINESS_LAUNCH_ENABLED='true';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
delete process.env.SAAS_LIVE_PILOT_ORGANISATION_ID;delete process.env.SAAS_LIVE_PILOT_PURPOSE;
let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw Error('NETWORK_FORBIDDEN');};
const pg=new PGlite();const testDb=drizzle(pg,{schema});
const {db,pool}=await import('../db');
for(const key of ['select','insert','update','delete','execute','transaction'] as const)(db as any)[key]=(testDb as any)[key].bind(testDb);
const query=async(sql:string,args?:any[])=>{const r=await pg.query<any>(sql,args);return {rows:r.rows,rowCount:r.affectedRows};};
(pool as any).query=query;(pool as any).connect=async()=>({query,release(){}});
const {saasStore,saasForOrganisation}=await import('./saas-runtime');
const {SaasStore}=await import('./saas-store');
const {applySaasAccess}=await import('./saas-access');
const {isAuthenticated}=await import('../replit_integrations/auth/replitAuth');
const {storage}=await import('../storage');
const now=new Date('2026-10-26T00:00:00Z');
(saasStore as any).clock=()=>new Date(now);
const cases=[
 {org:327,end:'2026-11-15T00:12:27.931Z',max:10,slug:'business',features:['analytics','custom-design']},
 {org:470,end:'2026-11-08T01:24:06.425Z',max:null,slug:'enterprise',features:['Full Analytics','Custom API access']},
 {org:485,end:'2026-11-18T01:51:10.717Z',max:null,slug:'enterprise-2',features:['Full Analytics','Custom API access']},
];
async function tenant(userId:string,siteId:number|null){
 const req:any={path:'/api/auth/user',method:'GET',session:{userId,currentSiteId:siteId,save:(fn:Function)=>fn()}};
 let passed=false;let status=200;const res:any={status:(s:number)=>{status=s;return res;},json:()=>res};
 await isAuthenticated(req,res,()=>{passed=true;});assert.equal(status,200);assert.ok(passed);return req;
}
try{
 for(const sql of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(sql);
 for(const c of cases){
  await testDb.insert(schema.users).values({id:`owner-${c.org}`,organisationId:c.org,currentSiteId:c.org,userType:'owner'});
  await testDb.insert(schema.organisations).values({id:c.org,name:`Copy ${c.org}`,ownerId:`owner-${c.org}`,createdAt:new Date('2026-01-01')});
  await testDb.insert(schema.sites).values({id:c.org,organisationId:c.org,name:'Copy'});
  await testDb.insert(schema.plans).values({id:c.org,name:c.slug,slug:c.slug,maxUsers:c.max,price:'0',features:c.features});
  await testDb.insert(schema.subscriptions).values({id:c.org,userId:`owner-${c.org}`,planId:c.org,status:'active',startDate:new Date('2026-10-01'),endDate:new Date(c.end)});
 }
 const legacyBefore=(await query('SELECT * FROM subscriptions ORDER BY id')).rows;
 const plansBefore=(await query('SELECT * FROM plans ORDER BY id')).rows;
 for(const c of cases){
  assert.equal(await saasForOrganisation(c.org),null,'Runtime must retain legacy access, not return a reduced SaaS trial');
  await assert.rejects(saasStore.current(c.org),/LEGACY_SUBSCRIPTION_REQUIRES_REVIEW/);
  await assert.rejects(saasStore.createQuote(c.org,saasSelection('business')),/LEGACY_SUBSCRIPTION_REQUIRES_REVIEW/);
  const req=await tenant(`owner-${c.org}`,c.org);assert.equal(req.organisationId,c.org);assert.equal(req.saas,undefined);
  assert.equal(await applySaasAccess({...req,path:'/api/analytics/kpis'},{} as any),true);
  const legacy=await storage.getUserSubscription(`owner-${c.org}`);assert.equal(legacy!.endDate!.toISOString(),c.end);assert.equal(legacy!.plan!.maxUsers,c.max);assert.deepEqual(legacy!.plan!.features,c.features);
  const boundary=new SaasStore(saasStore.db,()=>new Date(Date.parse(c.end)-1));
  await assert.rejects(boundary.ensure(c.org),/LEGACY_SUBSCRIPTION_REQUIRES_REVIEW/);
  assert.equal(legacyLaunchProtection([{end_milliseconds:Date.parse(c.end)}],new Date(c.end)).defer,false,'Protection ends exactly at the existing date');
 }
 assert.equal((await query('SELECT count(*)::int n FROM saas_accounts')).rows[0].n,0);
 assert.equal((await query('SELECT count(*)::int n FROM saas_events')).rows[0].n,0);
 assert.equal((await query('SELECT count(*)::int n FROM saas_invoices')).rows[0].n,0);
 await query('UPDATE subscriptions SET end_date=NULL WHERE id=327');
 assert.equal(await saasForOrganisation(327),null,'An open-ended legacy period must not be replaced');
 await assert.rejects(saasStore.createQuote(327,saasSelection('business')),/LEGACY_SUBSCRIPTION_REQUIRES_REVIEW/);
 await query('UPDATE subscriptions SET end_date=$1 WHERE id=327',[cases[0].end]);
 for(const value of [null,'invalid'])assert.equal(legacyLaunchProtection([{end_milliseconds:value}],now).defer,true);
 assert.equal(legacyLaunchProtection([{end_milliseconds:Date.parse('2026-10-01')},{end_milliseconds:Date.parse(cases[0].end)}],now).protectedUntil,cases[0].end);
 // Exact expiry permits the ordinary launch rule, without an invented renewal.
 const expiredStore=new SaasStore(saasStore.db,()=>new Date(cases[0].end));
 const expired=await expiredStore.current(327);assert.equal(expired.plan,'starter');
 assert.deepEqual((await query('SELECT * FROM subscriptions ORDER BY id')).rows,legacyBefore);
 assert.deepEqual((await query('SELECT * FROM plans ORDER BY id')).rows,plansBefore);
 // A paid SaaS state is authoritative even if a future legacy row remains.
 const paid={...expired,plan:'pro',phase:'active',cycleStart:'2026-10-26T00:28:39.750Z',cycleEnd:'2026-11-26T00:28:39.750Z',paidBaseXaf:50,version:1};
 await query('INSERT INTO saas_accounts(organisation_id,state) VALUES($1,$2)',[470,paid]);await saasStore.ensure(470);
 assert.deepEqual((await query('SELECT state FROM saas_accounts WHERE organisation_id=470')).rows[0].state,paid);
 // Four real-shaped double roles, synthetic identities only. No production executor.
 const roles=[{org:3,foreign:2,role:'operator'},{org:100,foreign:93,role:'operator'},{org:112,foreign:101,role:'operator'},{org:193,foreign:1,role:'manager'}];
 for(const c of roles){
  await testDb.insert(schema.users).values([{id:`dual-${c.org}`,organisationId:c.foreign,userType:'owner'},{id:`host-${c.foreign}`,organisationId:c.foreign,userType:'owner'}]);
  await testDb.insert(schema.organisations).values([{id:c.org,name:'Owned copy',ownerId:`dual-${c.org}`},{id:c.foreign,name:'Employer copy',ownerId:`host-${c.foreign}`}]);
  await testDb.insert(schema.sites).values([{id:c.org,organisationId:c.org,name:'Owned'},{id:c.foreign,organisationId:c.foreign,name:'Employer'}]);
  await testDb.insert(schema.siteMembers).values([{userId:`dual-${c.org}`,siteId:c.org,role:'owner'},{userId:`dual-${c.org}`,siteId:c.foreign,role:c.role}]);
  const evidence={ownerId:`dual-${c.org}`,ownedOrganisationId:c.org,linkedOrganisationId:c.foreign,ownedCount:1,memberships:[{siteId:c.org,organisationId:c.org,role:'owner'},{siteId:c.foreign,organisationId:c.foreign,role:c.role}]};
  const preview=previewDualRoleSeparation(evidence);assert.equal(preview.status,'ready_for_isolated_separation');
  assert.equal(previewDualRoleSeparation({...evidence,memberships:[evidence.memberships[0],{...evidence.memberships[1],role:'owner'}]}).status,'review_required');
  const staffBefore=await saasStore.staffCandidates(saasStore.db,c.foreign);
  // Disabled billing tests the existing tenant boundary without creating SaaS states.
  process.env.SAAS_BILLING_MODE='disabled';
  const before=await tenant(`dual-${c.org}`,c.foreign);assert.deepEqual(before.siteScope,[c.foreign]);
  const membersBefore=(await query('SELECT * FROM site_members WHERE user_id=$1 ORDER BY id',[`dual-${c.org}`])).rows;
  async function separate(fail=false){await pg.transaction(async tx=>{
   await tx.query("INSERT INTO users(id,organisation_id,user_type,role) VALUES($1,$2,'staff',$3)",[`staff-copy-${c.org}`,c.foreign,c.role]);
   await tx.query('UPDATE site_members SET user_id=$1 WHERE user_id=$2 AND site_id=$3',[`staff-copy-${c.org}`,`dual-${c.org}`,c.foreign]);
   await tx.query("UPDATE users SET organisation_id=$1,user_type='owner',role='owner',current_site_id=$1 WHERE id=$2",[c.org,`dual-${c.org}`]);
   if(fail)throw Error('SIMULATED_INTERRUPTION');
  });}
  await assert.rejects(separate(true),/SIMULATED_INTERRUPTION/);
  assert.equal((await query('SELECT id FROM users WHERE id=$1',[`staff-copy-${c.org}`])).rows.length,0);
  assert.deepEqual((await query('SELECT * FROM site_members WHERE user_id=$1 ORDER BY id',[`dual-${c.org}`])).rows,membersBefore);
  await separate();
  const owner=await tenant(`dual-${c.org}`,c.org);const staff=await tenant(`staff-copy-${c.org}`,c.foreign);
  assert.equal(owner.organisationId,c.org);assert.deepEqual(owner.authorizedSiteIds,[c.org]);
  assert.equal(staff.organisationId,c.foreign);assert.deepEqual(staff.authorizedSiteIds,[c.foreign]);
  assert.ok(!(await tenant(`dual-${c.org}`,c.foreign)).authorizedSiteIds.includes(c.foreign));
  assert.ok(!(await tenant(`staff-copy-${c.org}`,c.org)).authorizedSiteIds.includes(c.org));
  const kept=(await query('SELECT role FROM site_members WHERE user_id=$1',[`staff-copy-${c.org}`])).rows[0];assert.equal(kept.role,c.role);
  const staffAfter=await saasStore.staffCandidates(saasStore.db,c.foreign);assert.equal(staffAfter.length,staffBefore.length,'Separation must not consume an additional employee place');
 }
 assert.deepEqual((await query('SELECT * FROM subscriptions ORDER BY id')).rows,legacyBefore);
 assert.equal((await query('SELECT count(*)::int n FROM saas_invoices')).rows[0].n,0);
 assert.equal(process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED,'true');assert.equal(process.env.SAAS_BILLING_MODE,'disabled');assert.equal(networkCalls,0);
 console.log('PASS integrated legacy protection: runtime/auth fallback, no reduced rights or invoice, exact expiry, invalid dates, paid SaaS precedence; 4 double-role separations rehearsed with actual auth, exact roles, no cross-tenant access, same staff count and rollback; maintenance suspended, zero payment calls');
}finally{await pg.close();await pool.end();}
