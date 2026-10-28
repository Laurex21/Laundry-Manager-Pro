/** Email authentication lookup against disposable PostgreSQL only; no network or production data. */
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
import { normalizeLoginEmail } from '../../shared/login-email';
import { authErrorMessage } from '../../client/src/lib/auth-errors';
import { authUiTranslations } from '../../client/src/lib/auth-ui-translations';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/email_test_only';
process.env.SAAS_BILLING_MODE='disabled';process.env.SAAS_LIVE_ENABLED='false';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN');};
const {authStorage}=await import('../replit_integrations/auth/storage');
const {pool}=await import('../db');
const pg=new PGlite();const testDb=drizzle(pg,{schema});
try {
 for(const sql of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(sql);
 const fixturePassword='FictitiousSafe_2026!89 ';const fixtureHash=await bcrypt.hash(fixturePassword,4);
 await testDb.insert(schema.users).values([{id:'owner',email:'Owner.Mixed@Example.invalid',passwordHash:fixtureHash,phone:'+237600000000'}, {id:'staff',email:'staff@example.invalid',passwordHash:'untouched-staff',userType:'staff'}]);
 const before=await pg.query('SELECT * FROM users ORDER BY id');
 assert.equal(normalizeLoginEmail('  OWNER.Mixed@Example.invalid  '),'owner.mixed@example.invalid');
 for(const value of ['+237600000000','600000000','not-email','a@@b.test',null,{},'a b@example.invalid'])assert.equal(normalizeLoginEmail(value),null);
 assert.equal((await authStorage.getUserByLoginEmail(normalizeLoginEmail('OWNER.MIXED@example.invalid')!,testDb as any))?.id,'owner');
 const matched=await authStorage.getUserByLoginEmail('owner.mixed@example.invalid',testDb as any);
 assert.ok(await bcrypt.compare(fixturePassword,matched!.passwordHash!),'Existing password hash remains usable');
 assert.equal(await bcrypt.compare(fixturePassword.trim(),matched!.passwordHash!),false,'Never trim the password');
 assert.equal((await authStorage.getUserByLoginEmail('staff@example.invalid',testDb as any))?.id,'staff');
 assert.equal(await authStorage.getUserByLoginEmail('absent@example.invalid',testDb as any),undefined);
 assert.deepEqual(await pg.query('SELECT * FROM users ORDER BY id'),before,'Lookup must not rewrite accounts or password hashes');
 await testDb.insert(schema.users).values({id:'case-collision',email:'owner.mixed@example.invalid',passwordHash:'other'});
 assert.equal(await authStorage.getUserByLoginEmail('owner.mixed@example.invalid',testDb as any),undefined,'Ambiguous historical emails fail closed');
 for(const lang of ['fr','en','pt'] as const){
  const dict=authUiTranslations[lang];const t=((key:string,options?:any)=>(dict as any)[key]?.replace('{{minutes}}',String(options?.minutes))) as any;
  assert.equal(authErrorMessage('AUTH_INVALID_CREDENTIALS',401,null,t),dict.auth_invalid_credentials);
  assert.equal(authErrorMessage('internal secret error',500,null,t),dict.auth_unavailable);
  assert.equal(authErrorMessage('Invalid or expired reset link',400,null,t),dict.auth_reset_invalid);
  assert.equal(authErrorMessage('Too many attempts',429,'61',t),dict.auth_try_later.replace('{{minutes}}','2'));
 }
 const {registerAuthRoutes}=await import('../replit_integrations/auth/routes');
 const routes=new Map<string,Function>();registerAuthRoutes({post:(path:string,...handlers:Function[])=>routes.set(path,handlers.at(-1)!),get:()=>{}} as any);
 const lookup=authStorage.getUserByLoginEmail;let observed:string|undefined;
 authStorage.getUserByLoginEmail=async(email:string)=>{observed=email;return undefined;};
 try {
  for(const path of ['/api/auth/login','/api/staff/login']){
   let status=200,body:any;const res:any={status:(code:number)=>{status=code;return res;},json:(v:any)=>{body=v;return res;}};
   observed=undefined;await routes.get(path)!({body:{email:'+237600000000',password:'fake'}},res);
   assert.equal(status,400);assert.equal(body.message,'AUTH_EMAIL_REQUIRED');assert.equal(observed,undefined,'Phone must not reach account lookup');
   await routes.get(path)!({body:{email:'  OWNER@example.invalid  ',password:'unchanged password '}},res);
   assert.equal(observed,'owner@example.invalid');assert.equal(status,401);assert.equal(body.message,'AUTH_INVALID_CREDENTIALS');
  }
  observed=undefined;let reply:any;await routes.get('/api/auth/password-reset/request')!({body:{identifier:'+237600000000'}},{status:()=>({json:(v:any)=>{reply=v;}}),json:(v:any)=>{reply=v;}});
  assert.equal(observed,undefined);assert.ok(reply.message.includes('If an account exists'),'Generic response preserves account privacy');
 } finally {authStorage.getUserByLoginEmail=lookup;}
 console.log('PASS email-only auth: normalized owner/staff matching, phone rejection, absent/ambiguous account refusal, no data or password changes, FR/EN/PT errors and retry delay');
} finally {await pg.close();await pool.end();}
