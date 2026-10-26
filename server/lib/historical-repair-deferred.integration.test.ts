/** Real repair and auth middleware, PostgreSQL in memory, no production access. */
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {generateDrizzleJson,generateMigration} from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/isolated_repair';
process.env.SAAS_BILLING_MODE='disabled';
process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
const pg=new PGlite();const testDb=drizzle(pg,{schema});
const {db,pool}=await import('../db');
for(const m of ['select','insert','update','delete','execute','transaction'] as const)(db as any)[m]=testDb[m].bind(testDb);
let queries=0;
(pool as any).query=async(sql:string,args?:any[])=>{queries++;const r=await pg.query(sql,args);return {rows:r.rows,rowCount:r.affectedRows};};
const {repairKnownAccountOrganisationLinks,isAuthenticated}=await import('../replit_integrations/auth/replitAuth');
const cases=[{org:3,host:2,site:2,role:'operator'},{org:100,host:93,site:94,role:'operator'},{org:112,host:101,site:102,role:'operator'},{org:193,host:1,site:195,role:'manager'}];
async function snapshot(){const out:Record<string,unknown>={};for(const t of ['users','organisations','sites','site_members','saas_accounts','saas_invoices'])out[t]=(await pg.query(`SELECT to_jsonb(t) row FROM ${t} t ORDER BY to_jsonb(t)::text`)).rows;return out;}
async function employeeAccess(c:typeof cases[number]){
 const req:any={method:'GET',path:'/api/auth/user',session:{userId:`copy-dual-${c.org}`,currentSiteId:c.site,save:(cb:Function)=>cb()}};
 let passed=false;await isAuthenticated(req,{status:(n:number)=>{throw Error('ACCESS_REJECTED_'+n);}} as any,()=>{passed=true;});
 assert.ok(passed);assert.deepEqual(req.authorizedSiteIds,[c.site]);assert.deepEqual(req.siteScope,[c.site]);return {organisation:req.organisationId,sites:req.siteScope};
}
try{
 for(const sql of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(sql);
 for(const c of cases){
  await testDb.insert(schema.users).values([{id:`copy-host-${c.host}`,email:`host-${c.host}@example.invalid`,organisationId:c.host,currentSiteId:c.site},{id:`copy-dual-${c.org}`,email:`dual-${c.org}@example.invalid`,organisationId:c.host,currentSiteId:c.site,userType:'owner',role:c.role}]);
  await testDb.insert(schema.organisations).values([{id:c.host,name:'Synthetic employer',ownerId:`copy-host-${c.host}`},{id:c.org,name:'Synthetic deferred owner',ownerId:`copy-dual-${c.org}`}]);
  await testDb.insert(schema.sites).values([{id:c.site,name:'Synthetic employer site',organisationId:c.host},{id:10000+c.org,name:'Synthetic owner site',organisationId:c.org}]);
  await testDb.insert(schema.siteMembers).values([{siteId:c.site,userId:`copy-dual-${c.org}`,role:c.role},{siteId:10000+c.org,userId:`copy-dual-${c.org}`,role:'owner'}]);
 }
 const accesses=await Promise.all(cases.map(employeeAccess));
 // Use the exact selector required by this legacy routine on one synthetic
 // identity at a time. No email, request, or message leaves the in-memory DB.
 for(const c of cases){
  await pg.query('UPDATE users SET email=$1 WHERE id=$2',['xpress@gmail.com',`copy-dual-${c.org}`]);
  const before=await snapshot();const beforeQueries=queries;
  await repairKnownAccountOrganisationLinks();assert.equal(queries,beforeQueries,'Suspension still bypasses SQL');
  process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='false';
  await repairKnownAccountOrganisationLinks();await repairKnownAccountOrganisationLinks();
  assert.deepEqual(await snapshot(),before,'Excluded identity and every membership must remain byte-for-byte unchanged');
  assert.deepEqual(await employeeAccess(c),accesses[cases.indexOf(c)],'Actual tenant middleware keeps existing employee access');
  await pg.query('UPDATE users SET email=$1 WHERE id=$2',[`dual-${c.org}@example.invalid`,`copy-dual-${c.org}`]);
  process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
 }
 // Invalid exclusion config must fail closed before issuing repair SQL.
 process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='false';
 const beforeInvalid=await snapshot();const q=queries;
 process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,invalid';
 await assert.rejects(repairKnownAccountOrganisationLinks(),/INVALID_SAAS_DEFERRED/);assert.equal(queries,q);assert.deepEqual(await snapshot(),beforeInvalid);
 // The original repair still works when this identity is explicitly not deferred.
 process.env.SAAS_DEFERRED_ORGANISATION_IDS='100,112,193';
 await pg.query("UPDATE users SET email='xpress@gmail.com' WHERE id='copy-dual-3'");
 await pg.exec('BEGIN');
 try{await repairKnownAccountOrganisationLinks();const row=(await pg.query<any>("SELECT organisation_id,current_site_id,role FROM users WHERE id='copy-dual-3'")).rows[0];assert.deepEqual(row,{organisation_id:3,current_site_id:10003,role:'owner'});}finally{await pg.exec('ROLLBACK');}
 console.log('PASS protected historic repair: all four synthetic dual roles, matching legacy selector on each, exact user/membership/state preservation, actual employee access unchanged, repeated repair idempotent, suspension zero SQL, malformed list fail-closed, non-deferred repair still functional; zero production/network/payment');
}finally{process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';await pg.close();await pool.end();}
