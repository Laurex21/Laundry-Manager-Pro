/** Isolated PostgreSQL: no network, production credentials, scheduler or real account. */
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
import { adminCapacity, activateAdminCapacity } from './platform-admin-capacity';
import { businessLaunchTrial } from '../../shared/saas-business-launch';
import { capacityCost } from '../../shared/admin-capacity';
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/capacity_test_only';
process.env.NODE_ENV = 'test';
process.env.SAAS_BILLING_MODE = 'disabled';
process.env.SAAS_LIVE_ENABLED = 'false';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED = 'true';
process.env.SAAS_DEFERRED_ORGANISATION_IDS = '3,100,112,193';
process.env.SAAS_BUSINESS_LAUNCH_ENABLED = 'true';
globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN'); };
const pg = new PGlite(), database = drizzle(pg, { schema });
const query = async (sql: string, params?: any[]) => { const r = await pg.query<any>(sql, params); return { rows: r.rows, rowCount: r.affectedRows }; };
const { pool } = await import('../db');
(pool as any).query = query;
(pool as any).connect = async () => ({ query, release() {} });
const { registerPlatformAdminRoutes, requirePlatformAdmin } = await import('./platform-admin-routes');
const routes = new Map<string, Function[]>();
registerPlatformAdminRoutes({ get: (p: string, ...f: Function[]) => routes.set('GET ' + p, f), post: (p: string, ...f: Function[]) => routes.set('POST ' + p, f) } as any);
const now = new Date(), end = new Date(now.getTime() + 30 * 86400000).toISOString();
const audit = { ipHash: 'synthetic', userAgent: 'isolated-test' };
async function route(method: string, suffix: string, body: any = {}) {
  let status = 200, result: any; const response: any = { status(n: number) { status = n; return response; }, json(value: any) { result = value; } };
  const chain = routes.get(`${method} /api/platform-admin/organisations/:organisationId/${suffix}`)!;
  assert.equal(chain[0], requirePlatformAdmin, 'Every capacity endpoint uses the MFA-protected admin gate');
  await chain.at(-1)!({ params: { organisationId: '1' }, body, session: { userId: 'admin' }, requestId: 'test', ip: '127.0.0.1', get: () => 'test' }, response);
  return { status, body: result };
}
const account = async () => (await query('SELECT state FROM saas_accounts WHERE organisation_id=1')).rows[0].state;
const put = async (state: any) => query('UPDATE saas_accounts SET state=$1::jsonb WHERE organisation_id=1', [JSON.stringify(state)]);
try {
  for (const sql of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))) await pg.exec(sql);
  await database.insert(schema.users).values({ id: 'admin', email: 'admin@example.invalid', userType: 'owner' });
  for (const id of [1, 2, 3]) {
    await database.insert(schema.users).values({ id: `owner-${id}`, organisationId: id, userType: 'owner' });
    await database.insert(schema.organisations).values({ id, ownerId: `owner-${id}`, name: `Fictitious ${id}`, createdAt: new Date(now.getTime() - 5 * 86400000) });
  }
  await database.insert(schema.sites).values([
    { id: 10, organisationId: 1, name: 'Site A' }, { id: 11, organisationId: 1, name: 'Site B' },
    { id: 12, organisationId: 1, name: 'Site C' }, { id: 13, organisationId: 1, name: 'Archived', isActive: false },
    { id: 20, organisationId: 2, name: 'Other organisation' },
  ]);
  await database.insert(schema.users).values([
    { id: 'staff-a', organisationId: 1, userType: 'staff', firstName: 'A' },
    { id: 'staff-b', organisationId: 1, userType: 'staff', firstName: 'B' },
    { id: 'unassigned', organisationId: 1, userType: 'staff', firstName: 'Unassigned' },
    { id: 'foreign', organisationId: 2, userType: 'staff', firstName: 'Foreign' },
  ]);
  await database.insert(schema.siteMembers).values([
    { siteId: 10, userId: 'owner-1', role: 'owner' }, { siteId: 10, userId: 'staff-a', role: 'operator' },
    { siteId: 12, userId: 'staff-b', role: 'operator' }, { siteId: 10, userId: 'foreign', role: 'operator' },
  ]);
  const original = { ...businessLaunchTrial(new Date(now.getTime() - 5 * 86400000), now, [10], ['staff-a']), phase: 'active' as const,
    plan: 'business' as const, extraSites: 0, extraStaff: 0, cycleStart: now.toISOString(), cycleEnd: end, version: 3, paidBaseXaf: 18000, paidStaffXaf: 1200, paidSiteXaf: 2500 };
  await query('INSERT INTO saas_accounts(organisation_id,state) VALUES(1,$1::jsonb),(3,$1::jsonb)', [JSON.stringify(original)]);
  const quote = { ...capacityCost({ plan: 'pro', extraSites: 0, extraStaff: 2 }), selection: { plan: 'pro', extraSites: 0, extraStaff: 2 }, lines: [{ label: 'plan', quantity: 1, amountXaf: 10999 }, { label: 'staff', quantity: 2, amountXaf: 4000 }], promo: { originalXaf: 14999, discountXaf: 2249, code: 'SYNTHETIC15' }, durationMonths: 1 };
  const invoiceId = '10000000-0000-4000-8000-000000000001';
  await query("INSERT INTO saas_invoices(id,organisation_id,quote,total_xaf,provider_environment,status) VALUES($1,1,$2::jsonb,12750,'live','failed')", [invoiceId, JSON.stringify(quote)]);
  await query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  let summary = await adminCapacity({ query }, 1, now);
  await query('COMMIT');
  assert.deepEqual(await account(), original, 'Summary never reconciles or mutates the account');
  assert.equal(summary.usedSites, 1); assert.equal(summary.usedStaff, 1);
  assert.equal(summary.staff.length, 3, 'Owner and cross-organisation membership excluded');
  assert.equal(summary.current!.includedStaff, 5);
  assert.equal(summary.latestInvoice!.cost!.selection.extraStaff, 2);
  assert.equal(summary.latestInvoice!.totalXaf, 12750); assert.equal(summary.latestInvoice!.discountXaf, 2249);
  assert.equal(summary.current!.selection.extraStaff, 0, 'Unpaid invoice options never become current rights');
  const input = { expectedFingerprint: summary.fingerprint!, extraSites: 1, extraStaff: 2, addSiteIds: [11, 12], addStaffIds: ['staff-b'], reason: 'Synthetic manual capacity grant' };
  const beforeInvoices = (await query('SELECT * FROM saas_invoices')).rows;
  const preview = await route('POST', 'capacity-preview', input);
  assert.equal(preview.status, 200); assert.equal(preview.body.after.totalSites, 3);
  assert.equal(preview.body.after.totalStaff, 9, '5 base + 2 bundled + 2 additional staff');
  assert.equal(preview.body.after.monthlyXaf, 27999); assert.equal(preview.body.paymentRecorded, false);
  assert.deepEqual(await account(), original);
  for (const [override, code] of [
    [{ expectedFingerprint: '0'.repeat(64) }, /ADMIN_STATE_CHANGED/],
    [{ addSiteIds: [20] }, /ADMIN_ACCESS_SELECTION_INVALID/],
    [{ addSiteIds: [13] }, /ADMIN_ACCESS_SELECTION_INVALID/],
    [{ addSiteIds: [11, 11] }, /ADMIN_ACCESS_SELECTION_INVALID/],
    [{ addStaffIds: ['foreign'] }, /ADMIN_ACCESS_SELECTION_INVALID/],
    [{ addStaffIds: ['owner-1'] }, /ADMIN_ACCESS_SELECTION_INVALID/],
    [{ addStaffIds: ['unassigned'] }, /ADMIN_ACCESS_SELECTION_INVALID/],
    [{ addSiteIds: [11] }, /ADMIN_ACCESS_SELECTION_INVALID/],
    [{ extraSites: 0 }, /ADMIN_CAPACITY_EXCEEDED/],
    [{ extraStaff: -1 }, /ADMIN_CAPACITY_INPUT_INVALID/],
    [{ extraStaff: 1.5 }, /ADMIN_CAPACITY_INPUT_INVALID/],
    [{ extraStaff: 1001 }, /ADMIN_CAPACITY_INPUT_INVALID/],
    [{ reason: 'short' }, /ADMIN_CAPACITY_INPUT_INVALID/],
    [{ paymentRecorded: true }, /ADMIN_CAPACITY_INPUT_INVALID/],
  ] as const) await assert.rejects(activateAdminCapacity({ query }, 1, { ...input, ...override }, 'admin', null, now), code);
  const blocked = async (state: any, code: RegExp) => { await put(state); await assert.rejects(activateAdminCapacity({ query }, 1, input, 'admin', null, now), code); await put(original); };
  await blocked({ ...original, phase: 'starter', plan: 'starter' }, /ADMIN_ACTIVE_PLAN_REQUIRED/);
  await blocked({ ...original, phase: 'trialing' }, /ADMIN_ACTIVE_PLAN_REQUIRED/);
  await blocked({ ...original, cycleEnd: new Date(now.getTime() - 1).toISOString() }, /ADMIN_ACTIVE_PLAN_REQUIRED/);
  await blocked({ ...original, pending: { plan: 'pro', extraSites: 0, extraStaff: 0 } }, /ADMIN_SCHEDULED_CHANGE_REQUIRES_REVIEW/);
  await blocked({ ...original, renewal: { selection: { plan: 'business', extraSites: 0, extraStaff: 0 }, start: end, end } }, /ADMIN_SCHEDULED_CHANGE_REQUIRES_REVIEW/);
  await assert.rejects(activateAdminCapacity({ query }, 3, input, 'admin', null, now), /ADMIN_ORGANISATION_EXCLUDED/);
  await assert.rejects(activateAdminCapacity({ query }, 2, input, 'admin', null, now), /ADMIN_LEGACY_REVIEW_REQUIRED/);
  for (const status of ['pending', 'review']) {
    await query('UPDATE saas_invoices SET status=$1 WHERE id=$2', [status, invoiceId]);
    await assert.rejects(activateAdminCapacity({ query }, 1, input, 'admin', null, now), /ADMIN_PAYMENT_PENDING/);
  }
  await query("UPDATE saas_invoices SET status='failed' WHERE id=$1", [invoiceId]);
  await query("UPDATE site_members SET site_id=11 WHERE user_id='staff-b'");
  await assert.rejects(activateAdminCapacity({ query }, 1, input, 'admin', null, now), /ADMIN_STATE_CHANGED/, 'Membership changes invalidate the review');
  await query("UPDATE site_members SET site_id=12 WHERE user_id='staff-b'");
  const applied = await route('POST', 'capacity', input);
  assert.equal(applied.status, 200);
  const next = await account();
  assert.deepEqual(next.activeSiteIds, [10, 11, 12]); assert.deepEqual(next.activeStaffIds, ['staff-a', 'staff-b']);
  assert.equal(next.version, 4); assert.equal(next.cycleEnd, original.cycleEnd); assert.equal(next.cycleStart, original.cycleStart);
  for (const key of ['paidBaseXaf', 'paidStaffXaf', 'paidSiteXaf']) assert.equal(next[key], original[key as keyof typeof original], 'Manual gifts do not manufacture refundable payment credit');
  assert.deepEqual((await query('SELECT * FROM saas_invoices')).rows, beforeInvoices, 'No real invoice/payment is changed');
  assert.equal((await route('POST', 'capacity', input)).status, 409, 'Double submission does not reapply');
  assert.equal((await query("SELECT count(*)::int AS n FROM platform_admin_audit_events WHERE action='platform_admin.capacity_grant'")).rows[0].n, 1);
  assert.equal((await query("SELECT count(*)::int AS n FROM saas_events WHERE action='admin_capacity_grant'")).rows[0].n, 1);
  summary = await adminCapacity({ query }, 1, now);
  await assert.rejects(activateAdminCapacity({ query }, 1, { ...input, expectedFingerprint: summary.fingerprint, extraSites: 0, addSiteIds: [], addStaffIds: [] }, 'admin', null, now), /ADMIN_ACQUIRED_RIGHTS_PROTECTED/);
  await assert.rejects(activateAdminCapacity({ query }, 1, { ...input, expectedFingerprint: summary.fingerprint, addSiteIds: [], addStaffIds: [] }, 'admin', null, now), /ADMIN_CAPACITY_UNCHANGED/);
  await put({ ...original, plan: 'pro' });
  const pro = await adminCapacity({ query }, 1, now);
  await assert.rejects(activateAdminCapacity({ query }, 1, { ...input, expectedFingerprint: pro.fingerprint }, 'admin', null, now), /BUSINESS_REQUIRED/);
  await put(next);
  const latest = await adminCapacity({ query }, 1, now);
  const failDb = { query: async (sql: string, args?: any[]) => { if (sql.includes('INSERT INTO platform_admin_audit_events')) throw Error('AUDIT_FAILURE'); return query(sql, args); } };
  await query('BEGIN');
  await assert.rejects(activateAdminCapacity(failDb, 1, { ...input, expectedFingerprint: latest.fingerprint, extraStaff: 3, addSiteIds: [], addStaffIds: [] }, 'admin', null, now, true, audit), /AUDIT_FAILURE/);
  await query('ROLLBACK');
  assert.deepEqual(await account(), next, 'An audit failure rolls back the grant');
  assert.equal((await route('GET', 'capacity')).body.current.totalStaff, 9);
  await query("UPDATE saas_invoices SET status='quoted' WHERE id=$1", [invoiceId]);
  const quoted = await adminCapacity({ query }, 1, now);
  assert.equal((await route('POST', 'capacity', { ...input, expectedFingerprint: quoted.fingerprint, extraStaff: 3, addSiteIds: [], addStaffIds: [] })).status, 200);
  assert.equal((await query('SELECT status FROM saas_invoices WHERE id=$1', [invoiceId])).rows[0].status, 'expired');
  console.log('PASS capacity: read-only recap; actual usage vs quote; prices/promo; preview/confirm; tenant and membership checks; quotas; expiry/renewal/payment protections; stale replay; preserved credits/dates; audit rollback; quote invalidation; protected routes.');
} finally { await pg.close(); await pool.end(); }
