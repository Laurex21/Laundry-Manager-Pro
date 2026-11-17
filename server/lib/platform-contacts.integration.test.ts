/** Isolated PostgreSQL. No production database, delivery provider or background job. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
import { businessLaunchTrial } from '../../shared/saas-business-launch';
import { platformContactDetail, platformContactDirectory, writePlatformContact } from './platform-contacts';
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/platform_contacts_isolated';
process.env.NODE_ENV = 'test'; process.env.SAAS_BUSINESS_LAUNCH_ENABLED = 'true';
process.env.SAAS_BILLING_MODE = 'disabled'; process.env.SAAS_LIVE_ENABLED = 'false'; process.env.SALES_EMAIL_ENABLED = 'false';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED = 'true'; process.env.SAAS_DEFERRED_ORGANISATION_IDS = '3,100,112,193';
globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN'); };
const pg = new PGlite(), database = drizzle(pg, { schema });
const query = async (sql: string, args?: any[]) => { const r = await pg.query<any>(sql, args); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; };
const { pool } = await import('../db');
(pool as any).query = query; (pool as any).connect = async () => ({ query, release() {} });
const { registerPlatformAdminRoutes } = await import('./platform-admin-routes');
const routes = new Map<string, Function[]>();
registerPlatformAdminRoutes({ get: (path: string, ...handlers: Function[]) => routes.set('GET ' + path, handlers), post: (path: string, ...handlers: Function[]) => routes.set('POST ' + path, handlers) } as any);
const now = new Date('2026-11-17T23:30:00Z'), actor = { id: 'admin', ip: 'test-only', requestId: 'test-request' };
const detail = (org = 201) => platformContactDetail({ query }, org, 0, now);
async function write(input: any, org = 201, executor = { query }) {
  await query('BEGIN');
  try { const result = await writePlatformContact(executor, org, actor, input, now); await query('COMMIT'); return result; }
  catch (error) { await query('ROLLBACK'); throw error; }
}
async function command(part: any, org = 201) { return { requestId: randomUUID(), expectedVersion: (await detail(org)).tracking.version, ...part }; }
async function route(path: string, overrides: any = {}) {
  let code = 200, body: any; const headers: Record<string, string> = {};
  const req = { session: { userId: 'admin', platformAdminVerifiedAt: Date.now() }, params: { organisationId: '201' }, query: {}, body: {}, protocol: 'https', ip: 'test-ip', get: (key: string) => ({ host: 'superadmin.example.invalid', origin: 'https://superadmin.example.invalid', 'sec-fetch-site': 'same-origin' } as any)[key], ...overrides };
  const res: any = { status: (n: number) => { code = n; return res; }, json: (v: any) => { body = v; return res; }, setHeader: (k: string, v: string) => { headers[k] = v; } };
  for (const handler of routes.get(path)!) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
  return { code, body, headers };
}
const protectedTables = ['users', 'organisations', 'orders', 'subscriptions', 'saas_accounts', 'saas_invoices', 'saas_events'];
const businessSnapshot = async () => Object.fromEntries(await Promise.all(protectedTables.map(async table => [table, (await query(`SELECT * FROM ${table} ORDER BY 1`)).rows])));
try {
  for (const sql of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))) await pg.exec(sql);
  const migration = await readFile(new URL('../../migrations/20261118_platform_contacts.sql', import.meta.url), 'utf8');
  await pg.exec(migration); await pg.exec(migration);
  await pg.exec('CREATE TABLE IF NOT EXISTS security_rate_limits(bucket_key text PRIMARY KEY,count int NOT NULL,reset_at timestamptz NOT NULL)');
  await database.insert(schema.users).values({ id: 'admin', email: 'admin@example.invalid', firstName: 'Synthetic', lastName: 'Admin' });
  await database.insert(schema.platformAdmins).values({ userId: 'admin', mfaEnabledAt: now });
  for (const id of [201, 202, 203, 3]) {
    await database.insert(schema.users).values({ id: `owner-${id}`, email: `owner-${id}@example.invalid`, phone: id === 203 ? null : '+237600000000', firstName: 'Fictitious', organisationId: id });
    await database.insert(schema.organisations).values({ id, name: `Fictitious pressing ${id}`, ownerId: `owner-${id}`, createdAt: new Date(id === 202 ? '2026-01-01' : '2026-11-12T10:00:00Z') });
    await database.insert(schema.sites).values({ id, name: 'Synthetic site', organisationId: id });
  }
  const before = await businessSnapshot();
  await query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const empty = await detail();
  assert.equal(empty.tracking.version, 0); assert.equal(empty.history.total, 0);
  assert.match(empty.suggestion.fr, /Fictitious pressing 201/); assert.match(empty.suggestion.en, /first order/);
  assert.equal((await platformContactDirectory({ query }, {}, now)).total, 2, 'Deferred and old untracked accounts are omitted');
  await query('COMMIT');
  assert.equal((await query('SELECT count(*)::int AS n FROM platform_contact_cases')).rows[0].n, 0, 'GET never creates tracking');
  const plan = await command({ action: 'plan', status: 'in_progress', nextAction: 'Synthetic onboarding call', nextActionDate: '2026-11-18', note: 'Requested onboarding assistance' });
  assert.equal((await write(plan)).version, 1);
  assert.equal((await write(plan)).duplicate, true);
  await assert.rejects(write({ ...plan, note: 'Different request' }), /CONTACT_REQUEST_CONFLICT/);
  await assert.rejects(write({ ...plan, requestId: randomUUID() }), /CONTACT_STATE_CHANGED/);
  await assert.rejects(write({ ...plan, requestId: randomUUID() }, 3), /CONTACT_ORGANISATION_UNAVAILABLE/);
  await assert.rejects(write(await command({ action: 'plan', status: 'open', nextAction: 'Call', nextActionDate: '2026-11-17', note: 'Yesterday in Douala' })), /CONTACT_INVALID_SCHEDULE/);
  await assert.rejects(write(await command({ action: 'plan', status: 'open', nextAction: 'Call', nextActionDate: null, note: 'Missing date' })), /CONTACT_INVALID_SCHEDULE/);
  const contact = await command({ action: 'contact', channel: 'call', outcome: 'needs_help', contactAt: '2026-11-17T20:00:00Z', status: 'in_progress', nextAction: 'Guide first order', nextActionDate: '2026-11-18', note: 'Synthetic call: owner needs onboarding help' });
  await write(contact);
  const afterContact = await detail();
  assert.equal(afterContact.tracking.lastContactAt, '2026-11-17T20:00:00.000Z');
  assert.equal(afterContact.tracking.lastContactOutcome, 'needs_help');
  assert.equal(afterContact.history.items[0].actorName, 'Synthetic Admin');
  assert.equal(afterContact.due, true, 'Due dates use Douala, not UTC');
  await assert.rejects(write({ ...contact, expectedVersion: afterContact.tracking.version, requestId: randomUUID(), contactAt: '2027-01-01T00:00:00Z' }), /CONTACT_INVALID_DATE/);
  const saveMessage = async (org = 201, text = 'Synthetic personalised onboarding assistance') => write(await command({ action: 'save_message', language: 'fr', channel: 'whatsapp', text, contextFingerprint: (await detail(org)).contextFingerprint }, org), org);
  await saveMessage();
  const saved = await detail(); assert.equal(saved.tracking.message?.status, 'draft');
  await write(await command({ action: 'approve_message' }));
  assert.equal((await detail()).tracking.message?.status, 'approved');
  assert.equal((await detail()).tracking.lastContactAt, afterContact.tracking.lastContactAt, 'Approval is never recorded as contact or delivery');
  await assert.rejects(write(await command({ action: 'approve_message' })), /CONTACT_STATE_CHANGED/);
  const oldPlan = await command({ action: 'plan', status: 'open', nextAction: 'Review old account', nextActionDate: '2026-11-18', note: 'Explicit continuing follow-up' }, 202);
  await write(oldPlan, 202);
  const directory = await platformContactDirectory({ query }, { days: 7 }, now);
  assert.equal(directory.total, 3); assert.ok(directory.items.some(e => e.account.id === 202), 'Tracked account survives registration window');
  assert.equal((await platformContactDirectory({ query }, { filter: 'due' }, now)).total, 2);
  assert.equal((await platformContactDirectory({ query }, { search: "' OR 1=1 --" }, now)).total, 0);
  await saveMessage(203);
  await assert.rejects(write(await command({ action: 'approve_message' }, 203), 203), /CONTACT_RECIPIENT_MISSING/);
  // Fail closed if mandatory audit storage fails: no case change, history entry or partial approval.
  const version = (await detail()).tracking.version, events = (await query('SELECT * FROM platform_contact_events ORDER BY id')).rows;
  const failing = { query: (sql: string, args?: any[]) => { if (sql.includes('INSERT INTO platform_admin_audit_events')) throw Error('AUDIT_FAILURE'); return query(sql, args); } };
  await assert.rejects(write(await command({ action: 'plan', status: 'closed', nextAction: '', nextActionDate: null, note: 'Synthetic close' }), 201, failing), /AUDIT_FAILURE/);
  assert.equal((await detail()).tracking.version, version); assert.deepEqual((await query('SELECT * FROM platform_contact_events ORDER BY id')).rows, events);
  assert.deepEqual(await businessSnapshot(), before, 'Contact workflow never changes business data');
  // A new order invalidates an approved message and changes the proposal.
  await database.insert(schema.customers).values({ id: 1, name: 'Synthetic customer', phone: '000', address: 'Synthetic' });
  await database.insert(schema.orders).values({ customerId: 1, siteId: 201, createdAt: new Date('2026-11-17T21:00:00Z') });
  const changed = await detail(); assert.equal(changed.messageStale, true); assert.match(changed.suggestion.en, /started recording orders/);
  await assert.rejects(write(await command({ action: 'save_message', language: 'fr', channel: 'whatsapp', text: 'Old proposed message', contextFingerprint: saved.contextFingerprint })), /CONTACT_CONTEXT_CHANGED/);
  await saveMessage(); await write(await command({ action: 'approve_message' }));
  // A confirmed payment and acquired access also invalidate the draft context.
  const paid = { ...businessLaunchTrial(new Date('2026-11-12'), now, [201], []), phase: 'active', plan: 'pro', cycleStart: now.toISOString(), cycleEnd: '2026-12-18T10:00:00Z', paidBaseXaf: 10999 };
  await query('INSERT INTO saas_accounts(organisation_id,state) VALUES(201,$1::jsonb)', [JSON.stringify(paid)]);
  assert.equal((await detail()).messageStale, true); assert.match((await detail()).suggestion.fr, /Votre accès est en cours/);
  await saveMessage();
  for (const status of ['paused', 'closed', 'do_not_contact']) {
    await write(await command({ action: 'plan', status, nextAction: '', nextActionDate: null, note: 'Synthetic suspension reason' }));
    assert.equal((await detail()).approvalBlocked, true);
    await assert.rejects(write(await command({ action: 'approve_message' })), /CONTACT_APPROVAL_BLOCKED/);
  }
  assert.equal((await platformContactDirectory({ query }, { filter: 'do_not_contact' }, now)).total, 1);
  await write(await command({ action: 'cancel_message' }));
  assert.equal((await detail()).tracking.message, null);
  assert.ok((await detail()).history.items.some(e => e.data.action === 'save_message'), 'Cancelling preserves text history');
  for (let i = 0; i < 12; i++) await write(await command({ action: 'plan', status: 'closed', nextAction: '', nextActionDate: null, note: `Synthetic historical note ${i}` }));
  const page2 = await platformContactDetail({ query }, 201, 20, now);
  assert.ok(page2.history.total > 20); assert.ok(page2.history.items.length > 0, 'History remains accessible after page one');
  for (const session of [{}, { userId: 'owner-201' }, { userId: 'admin' }, { userId: 'admin', platformAdminVerifiedAt: Date.now() - 31 * 60000 }]) {
    for (const path of ['GET /api/platform-admin/contacts', 'GET /api/platform-admin/contacts/:organisationId', 'POST /api/platform-admin/contacts/:organisationId'])
      assert.ok([401, 403].includes((await route(path, { session })).code));
  }
  assert.equal((await route('POST /api/platform-admin/contacts/:organisationId', { get: (key: string) => key === 'host' ? 'superadmin.example.invalid' : 'https://evil.example.invalid' })).code, 403);
  assert.equal((await route('POST /api/platform-admin/contacts/:organisationId', { get: () => undefined })).code, 403);
  const get = await route('GET /api/platform-admin/contacts'); assert.equal(get.code, 200); assert.equal(get.headers['Cache-Control'], 'no-store');
  const routeWrite = await route('POST /api/platform-admin/contacts/:organisationId', { body: { requestId: randomUUID(), expectedVersion: (await detail()).tracking.version, action: 'plan', status: 'open', nextAction: '', nextActionDate: null, note: 'Route transaction tested' } });
  assert.equal(routeWrite.code, 200, JSON.stringify(routeWrite.body));
  assert.equal(process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED, 'true');
  console.log('PASS platform contacts: read-only projections, repeatable additive migration, contact history, Douala dates, continuing follow-up, proposals, approval without delivery, fresh context, consent suppression, idempotency, stale edits, audit rollback, MFA/origin gates and unchanged business data. No network or production access.');
} finally { await pg.close(); await pool.end(); }
