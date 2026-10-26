import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {generateDrizzleJson,generateMigration} from 'drizzle-kit/api';
import bcrypt from 'bcryptjs';
import * as schema from '../../shared/schema';
import {saasTrial,saasQuotas} from '../../shared/saas-plans';
import {IsolatedDualRoleCutover,type CopyCutover} from '../../scripts/fixtures/dual-role-isolated-cutover';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/dual_role_memory_only';
process.env.NODE_ENV='test';process.env.SAAS_BILLING_MODE='disabled';process.env.SAAS_LIVE_ENABLED='false';process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
let externalCalls=0;globalThis.fetch=async()=>{externalCalls++;throw Error('NETWORK_FORBIDDEN');};
const memory=new PGlite();const copy=drizzle(memory,{schema});
const {db,pool}=await import('../db');
for(const key of ['select','insert','update','delete','execute','transaction'] as const)(db as any)[key]=(copy as any)[key].bind(copy);
const query=async(sql:string,args?:any[])=>{const r=await memory.query<any>(sql,args);return{rows:r.rows,rowCount:r.affectedRows};};
(pool as any).query=query;(pool as any).connect=async()=>({query,release(){}});
const {isAuthenticated}=await import('../replit_integrations/auth/replitAuth');
const {SaasStore}=await import('./saas-store');
const store=new SaasStore({query,transaction:fn=>memory.transaction(tx=>fn({query:async(sql,args)=>{const r=await tx.query<any>(sql,args);return{rows:r.rows,rowCount:r.affectedRows};}}))},()=>new Date('2026-10-26T12:00:00Z'));
const cutover=new IsolatedDualRoleCutover(memory);
const cases:CopyCutover[]=[
 {ownerId:'copy-owner-3',staffId:'copy-staff-3',ownedOrg:3,employerOrg:2,ownedSite:3,employerSite:2,role:'operator'},
 {ownerId:'copy-owner-100',staffId:'copy-staff-100',ownedOrg:100,employerOrg:93,ownedSite:101,employerSite:94,role:'operator'},
 {ownerId:'copy-owner-112',staffId:'copy-staff-112',ownedOrg:112,employerOrg:101,ownedSite:113,employerSite:102,role:'operator'},
 {ownerId:'copy-owner-193',staffId:'copy-staff-193',ownedOrg:193,employerOrg:1,ownedSite:196,employerSite:195,role:'manager'},
];
async function tenant(userId:string,siteId:number|null){const req:any={path:'/api/auth/user',method:'GET',session:{userId,currentSiteId:siteId,save:(fn:Function)=>fn()}};let passed=false;await isAuthenticated(req,{status:(s:number)=>{throw Error('AUTH_FAILED_'+s);}} as any,()=>{passed=true;});assert.ok(passed);return req;}
const financialTables=['orders','order_items','payments','employee_activities','subscriptions','plans','organisations','saas_invoices'];
async function history(){return Promise.all(financialTables.map(table=>query(`SELECT * FROM ${table} ORDER BY id`).then(r=>r.rows)));}
async function operational(){return Promise.all(['users','site_members','employees','saas_accounts','sessions','isolated_cutover_audit'].map(table=>query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`).then(r=>r.rows)));}
try{
 for(const sql of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await memory.exec(sql);
 await memory.exec('CREATE TABLE isolated_cutover_audit(owner_id varchar PRIMARY KEY,review text NOT NULL,context_hash text NOT NULL,after_hash text NOT NULL,mapping jsonb NOT NULL)');
 const oldHash=await bcrypt.hash('fictitious owner password',4),newHash=await bcrypt.hash('fictitious staff password',4);
 for(const c of cases){
  const host='host-'+c.employerOrg;
  await copy.insert(schema.users).values([{id:c.ownerId,email:`owner-${c.ownedOrg}@example.invalid`,passwordHash:oldHash,organisationId:c.employerOrg,currentSiteId:c.employerSite,userType:'owner'},{id:host,organisationId:c.employerOrg,userType:'owner'}]);
  await copy.insert(schema.organisations).values([{id:c.ownedOrg,name:'Synthetic owned',ownerId:c.ownerId},{id:c.employerOrg,name:'Synthetic employer',ownerId:host}]);
  await copy.insert(schema.sites).values([{id:c.ownedSite,organisationId:c.ownedOrg,name:'Owned'},{id:c.employerSite,organisationId:c.employerOrg,name:'Employer'}]);
  await copy.insert(schema.siteMembers).values([{siteId:c.ownedSite,userId:c.ownerId,role:'owner'},{siteId:c.employerSite,userId:c.ownerId,role:c.role}]);
  const staffIds=[c.ownerId];
  for(let i=0;i<4;i++){const id=`other-${c.ownedOrg}-${i}`;staffIds.push(id);await copy.insert(schema.users).values({id,organisationId:c.employerOrg,userType:'staff'});await copy.insert(schema.siteMembers).values({siteId:c.employerSite,userId:id,role:'operator'});}
  const base=saasTrial(new Date('2026-01-01'),new Date('2026-10-26'),[c.ownedSite],[]);
  const own={...base,plan:'pro',phase:'active',cycleStart:'2026-10-01T00:00:00Z',cycleEnd:'2026-11-01T00:00:00Z',paidBaseXaf:10999};
  await query('INSERT INTO saas_accounts(organisation_id,state) VALUES($1,$2)',[c.ownedOrg,own]);
  if(c.ownedOrg!==100){const foreign={...own,plan:'business',paidBaseXaf:18999,activeSiteIds:[c.employerSite],activeStaffIds:staffIds};await query('INSERT INTO saas_accounts(organisation_id,state) VALUES($1,$2)',[c.employerOrg,foreign]);assert.equal(staffIds.length,saasQuotas(foreign as any).staff);}
  await copy.insert(schema.plans).values({id:c.ownedOrg,name:'Synthetic contract',slug:'copy-'+c.ownedOrg,price:'10999',maxUsers:10});
  await copy.insert(schema.subscriptions).values({id:c.ownedOrg,userId:c.ownerId,planId:c.ownedOrg,endDate:new Date('2026-11-15T09:12:34Z')});
  await copy.insert(schema.customers).values({id:c.ownedOrg,siteId:c.employerSite,name:'Synthetic customer',phone:'000',address:'Copy'});
  await copy.insert(schema.orders).values({id:c.ownedOrg,siteId:c.employerSite,customerId:c.ownedOrg,totalAmount:'1000'});
  await copy.insert(schema.payments).values({id:c.ownedOrg,orderId:c.ownedOrg,siteId:c.employerSite,amount:'1000',method:'Cash'});
  await copy.insert(schema.employees).values({id:c.ownedOrg,userId:host,authUserId:c.ownerId,siteId:c.employerSite,name:'Synthetic employee',role:c.role,ordersHandled:7,kgProcessed:'23'});
  await copy.insert(schema.employeeActivities).values({employeeId:c.ownedOrg,actorUserId:c.ownerId,siteId:c.employerSite,orderId:c.ownedOrg,actionType:'order_created',amount:'1000'});
  await copy.insert(schema.sessions).values([{sid:'old-'+c.ownedOrg,sess:{userId:c.ownerId},expire:new Date('2027-01-01')},{sid:'other-'+c.ownedOrg,sess:{userId:host},expire:new Date('2027-01-01')}]);
 }
 const originalHistory=await history();const results=[];
 for(const c of cases){
  const email=`staff-${c.ownedOrg}@example.invalid`;
  const candidateCount=(await store.staffCandidates(store.db,c.employerOrg)).length;assert.equal(candidateCount,5);
  await assert.rejects(cutover.prepare(c,'not-a-test@example.com',newHash),/SYNTHETIC_CREDENTIALS_REQUIRED/);
  assert.equal(await cutover.prepare(c,email,newHash),'prepared_without_access');assert.equal(await cutover.prepare(c,email,newHash),'already_prepared');
  assert.equal((await tenant(c.staffId,null)).authorizedSiteIds.length,0);assert.equal((await store.staffCandidates(store.db,c.employerOrg)).length,candidateCount);
  await assert.rejects(cutover.prepare({...c,staffId:'copy-staff-999'},email,newHash),/IDENTIFIER_CONFLICT/);
  const review=await cutover.review(c);const baseline=await operational();
  const pendingId=crypto.randomUUID();
  await query("INSERT INTO saas_invoices(id,organisation_id,quote,total_xaf,status,provider_environment) VALUES($1,$2,'{}'::jsonb,10999,'pending','sandbox')",[pendingId,c.employerOrg]);
  const pendingReview=await cutover.review(c);
  await assert.rejects(cutover.apply(c,pendingReview),/PAYMENT_PENDING_REQUIRES_REVIEW/);
  await query('DELETE FROM saas_invoices WHERE id=$1',[pendingId]);
  assert.equal(await cutover.review(c),review);
  await query('UPDATE site_members SET role=$1 WHERE user_id=$2 AND site_id=$3',['manager',c.ownerId,c.ownedSite]);
  await assert.rejects(cutover.apply(c,review),/STALE_REVIEW/);await query("UPDATE site_members SET role='owner' WHERE user_id=$1 AND site_id=$2",[c.ownerId,c.ownedSite]);
  for(const checkpoint of ['membership','employee','saas','sessions'] as const){await assert.rejects(cutover.apply(c,review,checkpoint),/SIMULATED_INTERRUPTION/);assert.deepEqual(await operational(),baseline,'Interrupted step must roll back every write');}
  const ownBefore=(await query('SELECT state FROM saas_accounts WHERE organisation_id=$1',[c.ownedOrg])).rows[0].state;
  const foreignBefore=(await query('SELECT state FROM saas_accounts WHERE organisation_id=$1',[c.employerOrg])).rows[0]?.state;
  assert.equal(await cutover.apply(c,review),'applied_in_isolated_copy');const after=await operational();
  assert.equal(await cutover.apply(c,review),'already_applied');assert.deepEqual(await operational(),after);
  assert.deepEqual(await history(),originalHistory,'Historical authors, financial records and contracts unchanged');
  assert.equal((await store.staffCandidates(store.db,c.employerOrg)).length,5);
  assert.deepEqual((await query('SELECT state FROM saas_accounts WHERE organisation_id=$1',[c.ownedOrg])).rows[0].state,ownBefore);
  const foreignAfter=(await query('SELECT state FROM saas_accounts WHERE organisation_id=$1',[c.employerOrg])).rows[0]?.state;
  if(foreignBefore){assert.deepEqual(foreignAfter,{...foreignBefore,activeStaffIds:foreignBefore.activeStaffIds.map((id:string)=>id===c.ownerId?c.staffId:id),version:foreignBefore.version+1});}
  else assert.equal(foreignAfter,undefined,'No new SaaS account for a legacy employer');
  const employee=(await query('SELECT * FROM employees WHERE id=$1',[c.ownedOrg])).rows[0];assert.equal(employee.auth_user_id,c.staffId);assert.equal(employee.orders_handled,7);assert.equal(Number(employee.kg_processed),23);
  const staff=(await query('SELECT * FROM users WHERE id=$1',[c.staffId])).rows[0];assert.ok(await bcrypt.compare('fictitious staff password',staff.password_hash));assert.notEqual(staff.password_hash,oldHash);
  assert.equal((await query('SELECT sid FROM sessions WHERE sid=$1',['old-'+c.ownedOrg])).rows.length,0);assert.equal((await query('SELECT sid FROM sessions WHERE sid=$1',['other-'+c.ownedOrg])).rows.length,1);
  const ownerReq=await tenant(c.ownerId,c.ownedSite),staffReq=await tenant(c.staffId,c.employerSite);
  assert.deepEqual(ownerReq.authorizedSiteIds,[c.ownedSite]);assert.deepEqual(staffReq.authorizedSiteIds,[c.employerSite]);
  assert.ok(!(await tenant(c.ownerId,c.employerSite)).authorizedSiteIds.includes(c.employerSite));assert.ok(!(await tenant(c.staffId,c.ownedSite)).authorizedSiteIds.includes(c.ownedSite));
  results.push({ownerOrg:c.ownedOrg,ownerSite:c.ownedSite,employerOrg:c.employerOrg,employerSite:c.employerSite,role:c.role,beforePlaces:5,afterPlaces:5});
 }
 assert.equal((await query('SELECT count(*)::int n FROM isolated_cutover_audit')).rows[0].n,4);
 assert.equal((await query('SELECT count(*)::int n FROM saas_invoices')).rows[0].n,0);assert.equal(externalCalls,0);
 process.env.SAAS_BILLING_MODE='sandbox';await assert.rejects(cutover.review(cases[0]),/ISOLATED_SAFETY_FLAGS_REQUIRED/);process.env.SAAS_BILLING_MODE='disabled';
 console.log('PASS atomic cutover: 4 fictitious dual roles; pending identities without access; full-capacity 5 -> 5 staff; SaaS slots substituted once; legacy employer unchanged; 16 rollback checkpoints; stale evidence and identifier conflicts rejected; idempotency; scoped employee auth links, historical authors/counters preserved; old sessions removed, unrelated sessions retained; real tenant middleware rejects cross-access; ZERO payments/network/production writes');
 console.log(JSON.stringify(results));
}finally{await memory.close();await pool.end();}
