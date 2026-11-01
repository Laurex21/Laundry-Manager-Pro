import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {generateDrizzleJson,generateMigration} from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/admin_access_isolated';
process.env.NODE_ENV='test';process.env.SAAS_BILLING_MODE='disabled';process.env.SAAS_LIVE_ENABLED='false';process.env.SALES_EMAIL_ENABLED='false';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
const pg=new PGlite(),testDb=drizzle(pg,{schema});
const {db,pool}=await import('../db');
for(const method of ['select','insert','update','delete','execute','transaction'] as const)(db as any)[method]=(testDb as any)[method].bind(testDb);
const query=async(sql:string,params?:any[])=>{const r=await pg.query(sql,params);return{rows:r.rows,rowCount:r.affectedRows??r.rows.length};};
(pool as any).query=query;(pool as any).connect=async()=>({query,release(){}});
const {adminUserDirectory,requestAdminPasswordReset,adminResetTokenMatchesEmail,AdminUserError}=await import('./admin-password-reset');
const {registerPlatformAdminRoutes}=await import('./platform-admin-routes');
const {registerAuthRoutes}=await import('../replit_integrations/auth/routes');
const routes=new Map<string,Function[]>();const app:any={get:(p:string,...fn:Function[])=>routes.set('GET '+p,fn),post:(p:string,...fn:Function[])=>routes.set('POST '+p,fn)};
registerPlatformAdminRoutes(app);registerAuthRoutes(app);
let sent:any[]=[];globalThis.fetch=async(input:any,init:any)=>{
 assert.equal(String(input),'https://api.resend.com/emails','No external service beyond the fake email endpoint');
 sent.push(JSON.parse(init.body));return new Response('{}',{status:202});
};
const userId='admin';
async function route(path:string,options:any={}){
 let status=200,body:any;const headers:Record<string,string>={};
 const req:any={query:{},params:{userId:'owner-1'},body:{expectedEmail:'owner-1@example.invalid',reason:'Fictitious support request'},protocol:'https',ip:'synthetic-ip',session:{userId,platformAdminVerifiedAt:Date.now()},get:(name:string)=>({'host':'superadmin.example.invalid',origin:'https://superadmin.example.invalid','sec-fetch-site':'same-origin'} as any)[name],...options};
 const res:any={status:(n:number)=>{status=n;return res;},json:(v:any)=>{body=v;return res;},setHeader:(k:string,v:string)=>headers[k]=v};
 for(const handler of routes.get(path)!){let next=false;await handler(req,res,()=>{next=true;});if(!next)break;}
 return {status,body,headers};
}
const resetPath='POST /api/platform-admin/users/:userId/password-reset';
const hash=(v:string)=>crypto.createHash('sha256').update(v).digest('hex');
function deliveredToken(){return new URL(sent.at(-1).text.match(/https:\/\/[^\s]+/)![0]).pathname.split('/').pop()!;}
try{
 for(const statement of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(statement);
 await pg.exec('CREATE TABLE IF NOT EXISTS security_rate_limits(bucket_key text PRIMARY KEY,count int NOT NULL,reset_at timestamptz NOT NULL)');
 const fixtureHash=await bcrypt.hash('Fictional_Old_9!ak',4);
 await testDb.insert(schema.users).values({id:'admin',email:'admin@example.invalid',passwordHash:fixtureHash});
 await testDb.insert(schema.platformAdmins).values({userId:'admin',mfaEnabledAt:new Date()});
 for(const org of [1,2,3,100,112,193]){
  await testDb.insert(schema.users).values({id:`owner-${org}`,email:`owner-${org}@example.invalid`,passwordHash:fixtureHash,organisationId:org});
  await testDb.insert(schema.organisations).values({id:org,name:`Fictitious shop ${org}`,ownerId:`owner-${org}`});
  await testDb.insert(schema.sites).values({id:org,organisationId:org,name:`Fictitious site ${org}`});
 }
 await testDb.insert(schema.users).values([{id:'staff',email:'staff@example.invalid',passwordHash:fixtureHash,userType:'staff',organisationId:1},{id:'no-mail',email:null,userType:'staff',organisationId:1},{id:'collision',email:'OWNER-2@example.invalid',organisationId:2}]);
 await testDb.insert(schema.siteMembers).values({siteId:1,userId:'staff',role:'manager'});
 await testDb.insert(schema.sessions).values([{sid:'staff-session',sess:{userId:'staff'},expire:new Date(Date.now()+86400000)},{sid:'owner-session',sess:{userId:'owner-1'},expire:new Date(Date.now()+86400000)},{sid:'admin-session',sess:{userId:'admin',platformAdminVerifiedAt:Date.now()},expire:new Date(Date.now()+86400000)}]);
 let page=await adminUserDirectory(pool,{search:'staff@example.invalid'});assert.equal(page.total,1);assert.equal(page.items[0].role,'manager');assert.equal(page.items[0].loginType,'staff');assert.equal(page.mode,'preview');
 assert.ok(!JSON.stringify(page).includes('passwordHash'));assert.ok(!JSON.stringify(page).includes(fixtureHash));
 assert.equal((await adminUserDirectory(pool,{search:"' OR 1=1 --"})).total,0);
 assert.ok((await adminUserDirectory(pool,{organisationId:1})).items.every(u=>u.organisationId===1));
 assert.equal((await adminUserDirectory(pool,{search:'owner-2@example.invalid'})).items.find(u=>u.id==='owner-2')!.resetBlockedReason,'ADMIN_USER_AMBIGUOUS_EMAIL');
 assert.equal((await adminUserDirectory(pool,{search:'no-mail'})).items[0].resetAllowed,false);
 await assert.rejects(adminUserDirectory(pool,{offset:-1}),/ADMIN_USER_INVALID_FILTER/);
 const beforeUsers=(await query('SELECT * FROM users ORDER BY id')).rows,beforeSessions=(await query('SELECT * FROM sessions ORDER BY sid')).rows;
 for(const session of [{},{userId:'staff'},{userId:'owner-1'},{userId:'admin'},{userId:'admin',platformAdminVerifiedAt:Date.now()-31*60000}]){
  assert.ok([401,403].includes((await route('GET /api/platform-admin/users',{session})).status));
  assert.ok([401,403].includes((await route(resetPath,{session})).status));
 }
 assert.equal((await route('GET /api/platform-admin/users')).status,200);
 assert.equal((await route(resetPath,{get:(name:string)=>name==='host'?'superadmin.example.invalid':name==='origin'?'https://evil.example.invalid':'cross-site'})).status,403);
 assert.equal((await route(resetPath,{get:()=>undefined})).status,403);
 assert.equal((await route(resetPath,{session:{userId:'admin',platformAdminVerifiedAt:Date.now()-6*60000}})).body.message,'ADMIN_RESET_REAUTH_REQUIRED');
 await requestAdminPasswordReset(pool,'admin','owner-1',{expectedEmail:'owner-1@example.invalid',reason:'Fictitious direct preview check'});
 const preview=await route(resetPath);assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.status,'preview');assert.equal(preview.headers['Cache-Control'],'no-store');
 assert.equal(sent.length,0);assert.equal((await query('SELECT * FROM password_reset_tokens')).rows.length,0);
 assert.deepEqual((await query('SELECT * FROM users ORDER BY id')).rows,beforeUsers);assert.deepEqual((await query('SELECT * FROM sessions ORDER BY sid')).rows,beforeSessions);
 for(const org of [3,100,112,193])await assert.rejects(requestAdminPasswordReset(pool,'admin',`owner-${org}`,{expectedEmail:`owner-${org}@example.invalid`,reason:'Fictitious excluded account test'}),/ADMIN_USER_EXCLUDED/);
 // A protected owner retains protection in a different employee context.
 await query("UPDATE users SET organisation_id=1,user_type='staff' WHERE id='owner-3'");
 await assert.rejects(requestAdminPasswordReset(pool,'admin','owner-3',{expectedEmail:'owner-3@example.invalid',reason:'Fictitious identity protection'}),/ADMIN_USER_EXCLUDED/);
 await query("UPDATE users SET organisation_id=3,user_type='owner' WHERE id='owner-3'");
 await assert.rejects(requestAdminPasswordReset(pool,'admin','owner-1',{expectedEmail:'wrong@example.invalid',reason:'Fictitious changed account test'}),/ADMIN_USER_CHANGED/);
 await assert.rejects(requestAdminPasswordReset(pool,'admin','staff',{expectedEmail:'staff@example.invalid',reason:'tiny'}),/ADMIN_RESET_REASON_REQUIRED/);
 process.env.NODE_ENV='production';
 await assert.rejects(requestAdminPasswordReset(pool,'admin','staff',{expectedEmail:'staff@example.invalid',reason:'Fictitious disabled delivery'}),/ADMIN_RESET_EMAIL_NOT_CONFIGURED/);
 assert.equal((await query('SELECT * FROM password_reset_tokens')).rows.length,0);
 process.env.ADMIN_PASSWORD_RESET_EMAIL_ENABLED='true';process.env.RESEND_API_KEY='synthetic-no-real-key';process.env.PASSWORD_RESET_EMAIL_FROM='XpressPro <support@example.invalid>';process.env.APP_BASE_URL='https://app.example.invalid';
 await query(`INSERT INTO password_reset_tokens(id,user_id,token_hash,account_type,expires_at) VALUES('old','staff',$1,'staff',now()+interval '30 minutes')`,[hash('old-fictitious-link')]);
 const sentReply=await route(resetPath,{params:{userId:'staff'},body:{expectedEmail:'staff@example.invalid',reason:'Fictitious staff account recovery'}});
 assert.equal(sentReply.status,200);assert.equal(sentReply.body.status,'sent');assert.deepEqual(Object.keys(sentReply.body).sort(),['expiresInMinutes','recipient','status']);
 assert.equal(sent.length,1);assert.deepEqual(sent[0].to,['staff@example.invalid']);const token=deliveredToken();assert.equal(adminResetTokenMatchesEmail(token,'staff@example.invalid'),true);assert.equal(adminResetTokenMatchesEmail(token,'different@example.invalid'),false);
 assert.ok((await query("SELECT used_at FROM password_reset_tokens WHERE id='old'")).rows[0].used_at);
 const pending=(await query('SELECT * FROM password_reset_tokens WHERE token_hash=$1',[hash(token)])).rows[0];assert.ok(pending);assert.equal(pending.account_type,'staff');const ttl=Number((await query('SELECT extract(epoch FROM (expires_at-$2::timestamp)) AS seconds FROM password_reset_tokens WHERE id=$1',[pending.id,new Date().toISOString()])).rows[0].seconds);assert.ok(ttl>29*60&&ttl<=30*60,'Expiry is exactly 30 minutes in the UTC timestamp domain, independent of local driver date parsing');assert.ok(!JSON.stringify(await adminUserDirectory(pool,{})).includes(token));
 await assert.rejects(requestAdminPasswordReset(pool,'admin','staff',{expectedEmail:'staff@example.invalid',reason:'Fictitious duplicate request'}),/ADMIN_RESET_RECENT_REQUEST/);
 assert.equal(sent.length,1);
 assert.equal((await query("SELECT password_hash FROM users WHERE id='staff'")).rows[0].password_hash,fixtureHash,'Request never changes the current password');
 await query(`INSERT INTO password_reset_tokens(id,user_id,token_hash,account_type,expires_at) VALUES('other-public','staff',$1,'staff','2099-01-01')`,[hash('other-fictitious-link')]);
 const newPassword='Fictional_New_92!Qa';
 const confirmed=await route('POST /api/auth/password-reset/confirm',{body:{token,password:newPassword}});assert.equal(confirmed.status,200);
 assert.ok(await bcrypt.compare(newPassword,(await query("SELECT password_hash FROM users WHERE id='staff'")).rows[0].password_hash));
 assert.equal((await query("SELECT * FROM sessions WHERE sess->>'userId'='staff'")).rows.length,0);assert.equal((await query("SELECT * FROM sessions WHERE sess->>'userId'='owner-1'")).rows.length,1);
 assert.equal((await route('POST /api/auth/password-reset/confirm',{body:{token,password:newPassword}})).status,400);
 assert.ok((await query("SELECT used_at FROM password_reset_tokens WHERE id='other-public'")).rows[0].used_at,'Other outstanding reset links are revoked after password change');
 const adminMfaBefore=(await query('SELECT * FROM platform_admins')).rows;
 await requestAdminPasswordReset(pool,'admin','owner-1',{expectedEmail:'owner-1@example.invalid',reason:'Fictitious owner account recovery'});const ownerToken=deliveredToken();
 await query("UPDATE users SET email='changed-owner@example.invalid' WHERE id='owner-1'");
 assert.equal((await route('POST /api/auth/password-reset/confirm',{body:{token:ownerToken,password:newPassword}})).status,400);
 await query("UPDATE users SET email='owner-1@example.invalid' WHERE id='owner-1'");
 await query('UPDATE password_reset_tokens SET expires_at=timestamp \'2000-01-01 00:00:00\' WHERE token_hash=$1',[hash(ownerToken)]);
 assert.equal((await route('POST /api/auth/password-reset/confirm',{body:{token:ownerToken,password:newPassword}})).status,400);
 globalThis.fetch=async()=>new Response('private provider error',{status:500});
 await query("UPDATE platform_admin_audit_events SET created_at=now()-interval '6 minutes' WHERE metadata->>'targetUserId'='owner-1'");
 await assert.rejects(requestAdminPasswordReset(pool,'admin','owner-1',{expectedEmail:'owner-1@example.invalid',reason:'Fictitious failed email delivery'}),/ADMIN_RESET_EMAIL_FAILED/);
 assert.equal((await query("SELECT * FROM password_reset_tokens WHERE user_id='owner-1' AND used_at IS NULL")).rows.length,0);
 globalThis.fetch=async(input:any,init:any)=>{assert.equal(String(input),'https://api.resend.com/emails');sent.push(JSON.parse(init.body));return new Response('{}',{status:202});};
 await query("UPDATE platform_admin_audit_events SET created_at=now()-interval '6 minutes' WHERE metadata->>'targetUserId'='owner-1'");
 await requestAdminPasswordReset(pool,'admin','owner-1',{expectedEmail:'owner-1@example.invalid',reason:'Fictitious successful owner recovery'});
 const ownerSuccess=await route('POST /api/auth/password-reset/confirm',{body:{token:deliveredToken(),password:newPassword}});assert.equal(ownerSuccess.status,200);assert.equal(ownerSuccess.body.accountType,'owner');
 assert.equal((await query("SELECT * FROM sessions WHERE sess->>'userId'='owner-1'")).rows.length,0);
 await requestAdminPasswordReset(pool,'admin','admin',{expectedEmail:'admin@example.invalid',reason:'Fictitious platform administrator recovery'});
 assert.equal((await route('POST /api/auth/password-reset/confirm',{body:{token:deliveredToken(),password:newPassword}})).status,429,'Existing public password-hash throttling stays enforced');
 assert.equal((await route('POST /api/auth/password-reset/confirm',{ip:'separate-fictitious-admin-recovery',body:{token:deliveredToken(),password:newPassword}})).status,200);
 assert.equal((await query("SELECT * FROM sessions WHERE sess->>'userId'='admin'")).rows.length,0,'Super Admin sessions are revoked after its password change');
 assert.deepEqual((await query('SELECT * FROM platform_admins')).rows,adminMfaBefore,'MFA state remains untouched');
 const audit=(await query('SELECT * FROM platform_admin_audit_events')).rows;assert.ok(audit.some((r:any)=>r.user_id==='admin'&&r.metadata.targetUserId==='staff'&&r.metadata.mode==='sent'));
 assert.ok(!JSON.stringify(audit).includes(token));assert.ok(!JSON.stringify(audit).includes(fixtureHash));assert.ok(!JSON.stringify(audit).includes(newPassword));
 await pg.exec('CREATE TABLE IF NOT EXISTS security_audit_events(id bigserial PRIMARY KEY,organisation_id int,actor_user_id text,action text,target_type text,target_id text,created_at timestamptz DEFAULT now(),request_id text)');
 await pg.exec('CREATE TABLE IF NOT EXISTS saas_events(id bigserial PRIMARY KEY,organisation_id int,action text,details jsonb,created_at timestamptz DEFAULT now())');
 const {adminAudit}=await import('./platform-admin-saas');const visibleAudit=await adminAudit({query},100,1);
 assert.ok(visibleAudit.some((r:any)=>r.target_email==='staff@example.invalid'&&r.actor_email==='admin@example.invalid'&&r.reset_mode==='sent'),'Unified audit identifies actor, target and delivery phase without secrets');
 process.env.NODE_ENV='test';await query('DELETE FROM security_rate_limits');
 for(let i=0;i<10;i++)assert.equal((await route(resetPath)).status,200);
 assert.equal((await route(resetPath)).status,429);
 assert.equal(process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED,'true');assert.equal(process.env.SALES_EMAIL_ENABLED,'false');
 console.log('PASS isolated Super Admin user access: MFA/CSRF/reauth/rate limits, scoped directory without secrets, four exclusions, preview without email or tokens, hashed single-use expiring email-bound links, owner/staff recovery, session revocation, delivery failure cleanup and audit without secrets; no production/network');
}finally{await pg.close();await pool.end();}
