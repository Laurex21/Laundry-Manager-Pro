/** Owner and staff sign-in against disposable PostgreSQL only. */
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
const realQuery = pool.query;
(pool as any).query = async (query: string | { text: string; rowMode?: "array" }, values?: unknown[]) => {
 const result = typeof query === "string"
  ? await pg.query(query, values)
  : await pg.query(query.text, values, { rowMode: query.rowMode });
 return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
};
try {
 for(const sql of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(sql);
 const fixturePassword='FictitiousSafe_2026!89 ';const fixtureHash=await bcrypt.hash(fixturePassword,4);
 await testDb.insert(schema.users).values([
  { id: "owner", email: "Owner.Mixed@Example.invalid", passwordHash: fixtureHash, phone: "+237600000000" },
  { id: "staff", email: "staff@example.invalid", passwordHash: fixtureHash, userType: "staff" },
 ]);
 await testDb.insert(schema.organisations).values({ id: 101, name: "Legacy phone account", ownerId: "legacy-owner" });
 await testDb.insert(schema.users).values([
  { id: "legacy-owner", email: null, phone: "6 00 00 00 01", passwordHash: fixtureHash, organisationId: 101 },
  { id: "legacy-staff", email: null, phone: "00237 (600) 000-002", passwordHash: fixtureHash, userType: "staff", role: "operator", organisationId: 101 },
  { id: "international-staff", email: null, phone: "351 910 000 002", passwordHash: fixtureHash, userType: "staff", role: "operator", organisationId: 101 },
 ]);
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
 const { registerAuthRoutes } = await import('../replit_integrations/auth/routes');
 const routes = new Map<string, Function[]>();
 registerAuthRoutes({ post: (path: string, ...handlers: Function[]) => routes.set(path, handlers), get: () => {} } as any);

 async function attempt(path: string, payload: Record<string, unknown>, ip = "test-network") {
  let status = 200;
  let body: any;
  let regenerated = false;
  let saved = false;
  const session = {
   userId: undefined,
   regenerate(done: () => void) { regenerated = true; done(); },
   save(done: () => void) { saved = true; done(); },
  };
  const res = {
   locals: {},
   setHeader() {},
   status(code: number) { status = code; return res; },
   json(response: unknown) { body = response; return res; },
  };
  for (const handler of routes.get(path)!) {
   let advance = false;
   await handler({ body: payload, ip, session }, res, () => { advance = true; });
   if (!advance) break;
  }
  return { status, body, userId: session.userId, regenerated, saved };
 }

 const ownerLogin = "/api/auth/login";
 const staffLogin = "/api/staff/login";
 for (const identifier of ["600000001", "+237 600 000 001", "237600000001", "00237-600-000-001"]) {
  const response = await attempt(ownerLogin, { identifier, password: fixturePassword });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.id, "legacy-owner");
  assert.equal(response.body.passwordHash, undefined);
  assert.equal(response.userId, "legacy-owner");
  assert.ok(response.regenerated && response.saved);
 }
 const staff = await attempt(staffLogin, { email: "+237 600 000 002", password: fixturePassword });
 assert.equal(staff.status, 200, JSON.stringify(staff.body));
 assert.equal(staff.userId, "legacy-staff");
 assert.ok(staff.regenerated && staff.saved);
 const international = await attempt(staffLogin, { identifier: "+351 910 000 002", password: fixturePassword });
 assert.equal(international.userId, "international-staff");
 const email = await attempt(staffLogin, { email: " STAFF@example.invalid ", password: fixturePassword });
 assert.equal(email.userId, "staff");
 for (const [path, identifier, password, status, message] of [
  [ownerLogin, "600000002", fixturePassword, 403, "AUTH_USE_STAFF_LOGIN"],
  [staffLogin, "600000001", fixturePassword, 403, "AUTH_USE_OWNER_LOGIN"],
  [ownerLogin, "600000001", fixturePassword.trim(), 401, "AUTH_INVALID_CREDENTIALS"],
  [ownerLogin, "600000009", fixturePassword, 401, "AUTH_INVALID_CREDENTIALS"],
  [ownerLogin, "Call 600000001", fixturePassword, 400, "AUTH_IDENTIFIER_REQUIRED"],
  [ownerLogin, "  OWNER.MIXED@example.invalid  ", fixturePassword, 401, "AUTH_INVALID_CREDENTIALS"],
 ] as const) {
  const response = await attempt(path, { identifier, password });
  assert.equal(response.status, status);
  assert.equal(response.body.message, message);
  assert.equal(response.userId, undefined);
  assert.equal(response.regenerated, false);
 }
 const after = await pg.query("SELECT * FROM users WHERE id <> 'case-collision' ORDER BY id");
 assert.deepEqual(after.rows, before.rows, "Sign-in preserves existing account records");

 await testDb.insert(schema.users).values({ id: "duplicate-phone", phone: "+237 600 000 001" });
 const ambiguous = await attempt(ownerLogin, { identifier: "600000001", password: fixturePassword });
 assert.equal(ambiguous.status, 401);
 assert.equal(ambiguous.userId, undefined);

 // Formatting and switching between the two forms cannot reset the quotas.
 for (let i = 0; i < 10; i++) {
  const response = await attempt(i % 2 ? ownerLogin : staffLogin, {
   identifier: i % 2 ? "600000007" : "+237 600 000 007", password: fixturePassword,
  });
  assert.equal(response.status, 401);
 }
 assert.equal((await attempt(ownerLogin, { identifier: "00237600000007", password: fixturePassword })).status, 429);

 await testDb.insert(schema.users).values({
  id: "two-identifiers", email: "two@example.invalid", phone: "600000008", passwordHash: fixtureHash,
 });
 for (let i = 0; i < 20; i++) {
  const response = await attempt(ownerLogin, {
   identifier: i % 2 ? "600000008" : "two@example.invalid", password: "WrongPassword",
  }, `rotating-${i}`);
  assert.equal(response.status, 401);
 }
 assert.equal((await attempt(staffLogin, { email: "two@example.invalid", password: "WrongPassword" }, "another-ip")).status, 429);

 const reset = await attempt("/api/auth/password-reset/request", { identifier: "600000002", accountType: "staff" });
 assert.equal(reset.status, 200);
 assert.equal(reset.body.resetLink, undefined);
 assert.ok(reset.body.message.includes("If an account exists"));
 console.log("PASS owner/staff sign-in with email or existing phone, role boundaries and shared attempt limits");
} finally {(pool as any).query=realQuery;await pg.close();await pool.end();}
