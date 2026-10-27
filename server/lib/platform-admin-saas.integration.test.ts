/** Disposable PostgreSQL only. No credentials, network, scheduler or production data. */
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
import { adminSubscribers, adminSegment, adminBilling, adminAudit, adminGrant, stateFingerprint, previewAdminGrant } from './platform-admin-saas';
import { businessLaunchTrial } from '../../shared/saas-business-launch';
import { marketingHostAllowed } from '../../shared/marketing';
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/admin_memory_only';
process.env.NODE_ENV = 'test';
process.env.SAAS_BILLING_MODE = 'disabled';
process.env.SAAS_LIVE_ENABLED = 'false';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED = 'true';
process.env.SAAS_DEFERRED_ORGANISATION_IDS = '3,100,112,193';
process.env.SAAS_BUSINESS_LAUNCH_ENABLED = 'true';
globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN_IN_ADMIN_TEST'); };
const pg = new PGlite(), database = drizzle(pg, { schema });
const query = async (sql: string, params?: any[]) => { const r = await pg.query<any>(sql, params); return { rows: r.rows, rowCount: r.affectedRows }; };
const { pool } = await import('../db');
(pool as any).query = query;
(pool as any).connect = async () => ({ query, release() { } });
const { registerPlatformAdminRoutes, requirePlatformAdmin } = await import('./platform-admin-routes');
const routes = new Map<string, Function>();
registerPlatformAdminRoutes({ get: (p: string, ...f: Function[]) => routes.set('GET ' + p, f.at(-1)!), post: (p: string, ...f: Function[]) => routes.set('POST ' + p, f.at(-1)!) } as any);
const now = new Date('2026-10-27T12:00:00Z');
const clock = new Date(now);
async function call(method: string, path: string, body: any = {}, params: any = {}, qs: any = {}) { let status = 200, result: any; const res: any = { status: (s: number) => { status = s; return res; }, json: (r: any) => { result = r; return res; } }; await routes.get(method + ' ' + path)!({ params, body, query: qs, session: { userId: 'admin' }, ip: '127.0.0.1', requestId: 'isolated-request', get: () => 'isolated-test' }, res); return { status, body: result }; }
try {
    for (const sql of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema)))
        await pg.exec(sql);
    await pg.exec('CREATE TABLE security_audit_events(id bigserial PRIMARY KEY,organisation_id integer,actor_user_id varchar,action text,target_type text,target_id text,created_at timestamptz DEFAULT now(),request_id text)');
    await database.insert(schema.users).values({ id: 'admin', email: 'admin@example.invalid', userType: 'owner' });
    for (const org of [1, 2, 3, 4, 5, 100, 112, 193]) {
        await database.insert(schema.users).values({ id: 'owner-' + org, email: `fictitious-${org}@example.invalid`, userType: 'owner', organisationId: org });
        await database.insert(schema.organisations).values({ id: org, name: 'Fictitious pressing ' + org, ownerId: 'owner-' + org, createdAt: new Date('2026-08-01') });
        await database.insert(schema.sites).values({ id: org, organisationId: org, name: 'Fictitious shop' });
    }
    await database.insert(schema.plans).values([{ id: 1, name: 'Legacy Starter', slug: 'starter', price: '6000' }, { id: 2, name: 'Legacy Pro', slug: 'legacy-pro', price: '15000' }]);
    await database.insert(schema.subscriptions).values([{ id: 1, userId: 'owner-1', planId: 1, status: 'active', endDate: new Date('2026-11-22') }, { id: 2, userId: 'owner-2', planId: 2, status: 'active', endDate: new Date('2026-10-20') }, { id: 5, userId: 'owner-5', planId: 2, status: 'active', endDate: new Date('2026-12-12') }]);
    const state = { ...businessLaunchTrial(new Date('2026-08-01'), clock, [1], []), plan: 'pro' as const, phase: 'active' as const, cycleStart: '2026-10-26T00:00:00Z', cycleEnd: '2026-11-26T00:00:00Z', paidBaseXaf: 50, version: 2 };
    await query('INSERT INTO saas_accounts(organisation_id,state) VALUES(1,$1::jsonb)', [JSON.stringify(state)]);
    const invoice = async (org: number, amount: number, environment: string, purpose: string | null, id: string) => query(`INSERT INTO saas_invoices(id,organisation_id,quote,total_xaf,provider_environment,status,provider_status,paid_at) VALUES($1,$2,$3::jsonb,$4,$5,'paid','COMPLETED',$6)`, [id, org, JSON.stringify({ selection: { plan: 'pro' }, purpose }), amount, environment, new Date("2026-10-26T12:00:00Z")]);
    await invoice(1, 50, 'live', 'subscription_pilot', '00000000-0000-4000-8000-000000000001');
    await invoice(1, 10999, 'live', null, '00000000-0000-4000-8000-000000000002');
    await invoice(1, 99999, 'sandbox', null, '00000000-0000-4000-8000-000000000003');
    await database.insert(schema.subscriptionPayments).values({ userId: 'owner-1', planId: 1, amount: '30000', method: 'simulate', status: 'completed' });
    const legacyBefore = (await query('SELECT * FROM subscriptions ORDER BY id')).rows;
    const invoicesBefore = (await query('SELECT * FROM saas_invoices ORDER BY id')).rows;
    const before = await query('SELECT * FROM saas_accounts ORDER BY organisation_id');
    await query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const all = await adminSubscribers({ query }, clock);
    const one = all.find(i => i.id === 1)!;
    assert.equal(one.subscription?.planSlug, 'pro');
    assert.equal(one.subscription?.planPrice, 10999);
    assert.equal(one.subscription?.endDate, '2026-11-26T00:00:00Z');
    assert.equal(all.find(i => i.id === 2)?.subscription?.planSlug, 'business', 'Expired legacy is projected as launch trial without conversion');
    assert.equal(all.find(i => i.id === 5)?.source, 'legacy', 'Unelapsed legacy rights preserved');
    assert.equal(all.filter(i => i.deferred).length, 4);
    assert.ok(all.filter(i => i.deferred).every(i => !i.manualAssignmentAllowed));
    assert.equal(adminSegment({ subscription: { status: 'expired', endDate: '2026-10-20' } }, 'active', clock), false);
    const billing = await adminBilling({ query }, 1, clock);
    assert.equal(billing.subscriptionRevenueMonth, 11049);
    assert.equal(billing.pilotRevenueMonth, 50);
    assert.equal(billing.completedRevenue, 11049);
    assert.equal(billing.successfulPaymentCount, 2);
    assert.equal(billing.payments.length, 2);
    await adminAudit({ query }, 100);
    await query('ROLLBACK');
    assert.deepEqual(await query('SELECT * FROM saas_accounts ORDER BY organisation_id'), before, 'Reads must never reconcile or create accounts');
    const input = { planId: 'business', endDate: '2026-12-26', reason: 'Synthetic complimentary upgrade', expectedFingerprint: stateFingerprint((await query('SELECT state FROM saas_accounts WHERE organisation_id=1')).rows[0].state) };
    const saved = (await query('SELECT state FROM saas_accounts WHERE organisation_id=1')).rows[0].state;
    const preview = previewAdminGrant(saved, input, clock);
    assert.equal(preview.next.plan, 'business');
    assert.equal(preview.next.paidBaseXaf, 50);
    assert.deepEqual(preview.next.activeSiteIds, [1]);
    assert.equal(preview.next.cycleEnd, '2026-12-26T22:59:59.999Z');
    assert.throws(() => previewAdminGrant(saved, { ...input, endDate: '2026-11-01' }, clock), /ADMIN_ACQUIRED_DAYS_PROTECTED/);
    assert.throws(() => previewAdminGrant(saved, { ...input, planId: 'starter' }, clock), /ADMIN_ACQUIRED_RIGHTS_PROTECTED/);
    assert.throws(() => previewAdminGrant(saved, { ...input, expectedFingerprint: 'stale' }, clock), /ADMIN_STATE_CHANGED/);
    assert.throws(() => previewAdminGrant({ ...saved, renewal: { end: '2026-12-26' } }, { ...input, expectedFingerprint: stateFingerprint({ ...saved, renewal: { end: '2026-12-26' } }) }, clock), /ADMIN_SCHEDULED_CHANGE/);
    for (const org of [3, 100, 112, 193])
        await assert.rejects(adminGrant({ query }, org, input, 'admin', null, clock, true), /ADMIN_ORGANISATION_EXCLUDED/);
    await assert.rejects(adminGrant({ query }, 5, input, 'admin', null, clock, true), /ADMIN_LEGACY_REVIEW_REQUIRED/);
    const routePreview = await call('POST', '/api/platform-admin/organisations/:organisationId/plan-preview', input, { organisationId: 1 });
    assert.equal(routePreview.status, 200);
    assert.equal(routePreview.body.preview, true);
    assert.deepEqual((await query('SELECT state FROM saas_accounts WHERE organisation_id=1')).rows[0].state, saved);
    const applied = await call('POST', '/api/platform-admin/organisations/:organisationId/plan', input, { organisationId: 1 });
    assert.equal(applied.status, 200);
    assert.equal(applied.body.paymentRecorded, false);
    assert.equal((await query('SELECT state FROM saas_accounts WHERE organisation_id=1')).rows[0].state.plan, 'business');
    assert.equal((await call('POST', '/api/platform-admin/organisations/:organisationId/plan', input, { organisationId: 1 })).status, 409, 'Stale confirmation/retry must not reapply');
    const audit = await adminAudit({ query }, 100, 1);
    assert.ok(audit.some(e => e.action === 'platform_admin.saas_grant' && e.actor_email === 'admin@example.invalid'));
    assert.ok(audit.some(e => e.action === 'admin_grant'));
    assert.deepEqual((await query('SELECT * FROM subscriptions ORDER BY id')).rows, legacyBefore);
    assert.deepEqual((await query('SELECT * FROM saas_invoices ORDER BY id')).rows, invoicesBefore);
    // Transaction rollback if mandatory audit insertion fails.
    const latest = (await query('SELECT state FROM saas_accounts WHERE organisation_id=1')).rows[0].state;
    const failDb = { query: async (sql: string, args?: any[]) => { if (sql.includes('INSERT INTO platform_admin_audit_events'))
            throw Error('SYNTHETIC_AUDIT_FAILURE'); return query(sql, args); } };
    await query('BEGIN');
    await assert.rejects(adminGrant(failDb, 1, { ...input, expectedFingerprint: stateFingerprint(latest), endDate: '2027-01-26' }, 'admin', null, clock, true, { ipHash: 'synthetic', userAgent: 'test' }), /SYNTHETIC_AUDIT_FAILURE/);
    await query('ROLLBACK');
    assert.deepEqual((await query('SELECT state FROM saas_accounts WHERE organisation_id=1')).rows[0].state, latest);
    const detail = await call('GET', '/api/platform-admin/organisations/:organisationId', {}, { organisationId: 1 });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.billing.completedRevenue, 11049);
    assert.ok(detail.body.billing.payments.some((p: any) => p.status === 'simulation'));
    assert.equal(detail.body.subscription.planSlug, 'business');
    const plans = await call('GET', '/api/platform-admin/plans');
    assert.deepEqual(plans.body.map((p: any) => [p.id, p.price]), [['starter', 0], ['pro', 10999], ['business', 18999]]);
    assert.equal(marketingHostAllowed('superadmin.xpressclean.cm'), false);
    assert.equal(marketingHostAllowed('SUPERADMIN.example'), false);
    assert.equal(marketingHostAllowed('app.xpressclean.cm'), true);
    // Dedicated gate is independent of tenant repair middleware.
    let code = 200, passed = false;
    await requirePlatformAdmin({ session: { userId: 'not-admin' } } as any, { status: (n: number) => { code = n; return { json: () => { } }; } } as any, () => { passed = true; });
    assert.equal(code, 403);
    assert.equal(passed, false);
    await database.insert(schema.platformAdmins).values({ userId: 'admin', mfaEnabledAt: now });
    const gate = async (verifiedAt?: number) => { let status = 200, next = false; await requirePlatformAdmin({ session: { userId: 'admin', platformAdminVerifiedAt: verifiedAt } } as any, { status: (n: number) => { status = n; return { json: () => { } }; } } as any, () => { next = true; }); return { status, next }; };
    assert.deepEqual(await gate(), { status: 401, next: false });
    assert.deepEqual(await gate(Date.now() - 31 * 60 * 1000), { status: 401, next: false });
    assert.deepEqual(await gate(Date.now()), { status: 200, next: true });
    await query("UPDATE platform_admins SET revoked_at=now() WHERE user_id='admin'");
    assert.deepEqual(await gate(Date.now()), { status: 403, next: false });
    assert.equal(process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED, 'true');
    console.log('PASS isolated admin: effective plans, launch/legacy preservation, live-only receipts/pilots, excluded roles, readonly GET, preview/confirm, stale replay, acquired rights/days, rollback, current catalogue, unified audit, host isolation, auth gate');
}
finally {
    await pg.close();
    await pool.end();
}
