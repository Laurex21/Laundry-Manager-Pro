import crypto from 'node:crypto';
import { SAAS_PLANS, saasEffective, saasMonthly, saasQuotas, saasSelection, type SaasState } from '../../shared/saas-plans';
import { businessLaunchTrial } from '../../shared/saas-business-launch';
import { legacyLaunchProtection } from './saas-legacy-protection';
import { saasOrganisationDeferred, saasIdentityDeferred } from './saas-deferred';
import type { SaasExecutor } from './saas-store';
/** Projection only: never call SaasStore.current/ensure (they can write on GET). */
export async function adminSubscribers(db: SaasExecutor, now = new Date()) {
    const { rows } = await db.query(`SELECT o.id,o.name,o.created_at AT TIME ZONE 'UTC' AS created_at,o.owner_id,
    owner.email,owner.first_name,owner.last_name,owner.phone,
    account.state,
    COALESCE((SELECT jsonb_agg(s.id ORDER BY s.id) FROM sites s WHERE s.organisation_id=o.id AND s.is_active=true),'[]') AS site_ids,
    COALESCE((SELECT jsonb_agg(DISTINCT u.id) FROM users u JOIN site_members sm ON sm.user_id=u.id JOIN sites s ON s.id=sm.site_id
      WHERE s.organisation_id=o.id AND s.is_active=true AND u.organisation_id=o.id AND u.id<>o.owner_id),'[]') AS staff_ids,
    (SELECT count(*)::int FROM users u WHERE u.organisation_id=o.id AND u.user_type='staff') AS staff_count,
    (SELECT jsonb_agg(jsonb_build_object('end_milliseconds',extract(epoch FROM sub.end_date)*1000)) FROM subscriptions sub WHERE sub.user_id=o.owner_id AND sub.status='active') AS periods,
    legacy.id AS legacy_id,legacy.status AS legacy_status,legacy.start_date AS legacy_start,legacy.end_date AS legacy_end,
    legacy.end_ms,legacy.plan_slug,legacy.plan_name,legacy.plan_price,legacy.orders_used
    FROM organisations o JOIN users owner ON owner.id=o.owner_id
    LEFT JOIN saas_accounts account ON account.organisation_id=o.id
    LEFT JOIN LATERAL (SELECT sub.*,extract(epoch FROM sub.end_date)*1000 AS end_ms,p.slug AS plan_slug,p.name AS plan_name,p.price AS plan_price
      FROM subscriptions sub JOIN plans p ON p.id=sub.plan_id WHERE sub.user_id=o.owner_id ORDER BY sub.created_at DESC,sub.id DESC LIMIT 1) legacy ON true
    ORDER BY o.created_at DESC,o.id DESC`);
    return rows.map((row: any) => {
        const deferred = saasOrganisationDeferred(row.id);
        let state: SaasState | null = null;
        let source = 'legacy';
        if (!deferred && row.state) {
            state = saasEffective(structuredClone(row.state), now);
            source = 'saas';
        }
        else if (!deferred && process.env.SAAS_BUSINESS_LAUNCH_ENABLED === 'true' && !legacyLaunchProtection(row.periods ?? [], now).defer) {
            state = businessLaunchTrial(new Date(row.created_at), now, row.site_ids, row.staff_ids);
            source = 'launch-preview';
        }
        const end = row.end_ms == null ? null : new Date(Number(row.end_ms)).toISOString();
        const legacyStatus = row.legacy_status === 'active' && end && Date.parse(end) <= now.getTime() ? 'expired' : row.legacy_status;
        const subscription = state ? {
            id: null, status: state.phase === 'trialing' ? 'trial' : 'active', startDate: state.phase === 'trialing' ? state.trialStartedAt : state.cycleStart,
            endDate: state.phase === 'trialing' ? state.trialEndsAt : state.phase === 'active' ? state.cycleEnd : null,
            planSlug: state.plan, planName: SAAS_PLANS[state.plan].name, planPrice: saasMonthly(state), ordersUsed: null,
        } : row.legacy_id ? { id: Number(row.legacy_id), status: legacyStatus, startDate: row.legacy_start, endDate: end,
            planSlug: row.plan_slug, planName: row.plan_name, planPrice: Number(row.plan_price), ordersUsed: Number(row.orders_used ?? 0) } : null;
        return { id: Number(row.id), name: row.name, createdAt: row.created_at,
            owner: { id: row.owner_id, email: row.email, firstName: row.first_name, lastName: row.last_name, phone: row.phone },
            siteCount: row.site_ids.length, staffCount: Number(row.staff_count), subscription, source: deferred ? 'deferred' : source,
            deferred, manualAssignmentAllowed: source === 'saas' && !deferred, stateVersion: row.state?.version ?? null,
            // Fingerprint protects against expiry reconciliation, payment or access changes during confirmation.
            stateFingerprint: row.state ? stateFingerprint(row.state) : null };
    });
}
export function stateFingerprint(state: SaasState) { return crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex'); }
export function adminSegment(item: any, segment: string, now = new Date()) {
    const sub = item.subscription;
    const end = sub?.endDate ? Date.parse(sub.endDate) : null;
    const expiring = ['active', 'trial'].includes(sub?.status) && end !== null && end >= now.getTime() && end < now.getTime() + 14 * 86400000;
    if (segment === 'attention')
        return !sub || expiring || ['expired', 'cancelled'].includes(sub.status) || item.deferred;
    return segment === 'all' || (segment === 'no-plan' ? !sub : segment === 'expiring' ? expiring : sub?.status === segment);
}
export async function adminBilling(db: SaasExecutor, org?: number, now = new Date()) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 3600000);
    // Cameroon month starts at 00:00 UTC+1, not the database machine's timezone.
    const month = new Date(now.getTime() + 3600000);
    start.setTime(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1) - 3600000);
    const payments = (await db.query(`SELECT id,total_xaf AS amount,status,provider_status,payment_source,paid_at,created_at,quote
    FROM saas_invoices WHERE provider_environment='live' AND ($1::int IS NULL OR organisation_id=$1) ORDER BY created_at DESC,id DESC`, [org ?? null])).rows;
    const completed = payments.filter((p: any) => p.status === 'paid' && p.provider_status === 'COMPLETED');
    const monthly = completed.filter((p: any) => p.paid_at && new Date(p.paid_at) >= start && new Date(p.paid_at) <= now);
    const pilot = (p: any) => ['collection_pilot', 'subscription_pilot'].includes(p.quote?.purpose);
    return { subscriptionRevenueMonth: monthly.reduce((n: number, p: any) => n + Number(p.amount), 0),
        pilotRevenueMonth: monthly.filter(pilot).reduce((n: number, p: any) => n + Number(p.amount), 0),
        completedRevenue: completed.reduce((n: number, p: any) => n + Number(p.amount), 0), successfulPaymentCount: completed.length,
        payments: payments.slice(0, 20).map((p: any) => ({ id: p.id, amount: Number(p.amount), method: pilot(p) ? 'pawaPay · pilot' : 'pawaPay',
            status: p.status === 'paid' && p.provider_status === 'COMPLETED' ? 'completed' : p.status === 'paid' ? 'review' : p.status,
            createdAt: p.paid_at ?? p.created_at, planName: SAAS_PLANS[p.quote?.selection?.plan as keyof typeof SAAS_PLANS]?.name ?? 'pawaPay', source: 'saas-live' })) };
}
export async function adminAudit(db: SaasExecutor, limit: number, org?: number) {
    return (await db.query(`WITH events AS (
    SELECT 'admin:'||a.id::text AS id,CASE WHEN a.metadata->>'organisationId' ~ '^[0-9]+$' THEN (a.metadata->>'organisationId')::int END AS organisation_id,
      a.user_id AS actor_user_id,a.action,'platform_admin' AS target_type,NULL::text AS target_id,a.created_at,a.request_id,a.outcome
      FROM platform_admin_audit_events a
    UNION ALL SELECT 'business:'||s.id::text,s.organisation_id,s.actor_user_id,s.action,s.target_type,s.target_id,s.created_at,s.request_id,'success' FROM security_audit_events s
    UNION ALL SELECT 'saas:'||e.id::text,e.organisation_id,NULL,e.action,'saas',e.details->>'invoiceId',e.created_at,NULL,CASE WHEN e.action LIKE '%failed%' THEN 'failure' WHEN e.action LIKE '%review%' THEN 'review' ELSE 'success' END FROM saas_events e)
    SELECT e.*,o.name AS organisation_name,u.email AS actor_email FROM events e
    LEFT JOIN organisations o ON o.id=e.organisation_id LEFT JOIN users u ON u.id=e.actor_user_id
    WHERE ($1::int IS NULL OR e.organisation_id=$1) ORDER BY e.created_at DESC,e.id DESC LIMIT $2`, [org ?? null, limit])).rows;
}
/** Manual gifts preserve acquired time, seats and payments; downgrades require a separate scheduled flow. */
export function previewAdminGrant(old: SaasState, input: any, now = new Date()) {
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason.length < 10 || reason.length > 500)
        throw Error('ADMIN_REASON_REQUIRED');
    if (input.expectedFingerprint !== stateFingerprint(old))
        throw Error('ADMIN_STATE_CHANGED');
    if (old.renewal || old.pending)
        throw Error('ADMIN_SCHEDULED_CHANGE_REQUIRES_REVIEW');
    const selection = saasSelection(input.planId, input.extraSites ?? old.extraSites, input.extraStaff ?? old.extraStaff);
    const current = saasEffective(structuredClone(old), now);
    const rank = { starter: 0, pro: 1, business: 2 };
    const quota = saasQuotas(selection), oldQuota = saasQuotas(current);
    if (rank[selection.plan] < rank[current.plan] || quota.sites < oldQuota.sites || quota.staff < oldQuota.staff || quota.sites < current.activeSiteIds.length || quota.staff < current.activeStaffIds.length)
        throw Error('ADMIN_ACQUIRED_RIGHTS_PROTECTED');
    const day = String(input.endDate ?? '');
    const end = new Date(day + 'T23:59:59.999+01:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(end.getTime()) || new Date(end.getTime() + 3600000).toISOString().slice(0, 10) !== day || end <= now)
        throw Error('ADMIN_FUTURE_DATE_REQUIRED');
    const acquired = [old.trialEndsAt, old.cycleEnd, old.protectedUntil].filter(Boolean).map(v => Date.parse(v!));
    if (acquired.some(v => !Number.isFinite(v)) || end.getTime() < Math.max(0, ...acquired))
        throw Error('ADMIN_ACQUIRED_DAYS_PROTECTED');
    const next: SaasState = { ...current, ...selection, phase: 'active', cycleStart: current.phase === 'active' ? current.cycleStart : now.toISOString(), cycleEnd: end.toISOString(), version: old.version + 1 };
    // Grants do not manufacture payment/credit amounts. Existing paid credit and selections survive.
    return { next, reason, before: current, after: { plan: next.plan, endDate: next.cycleEnd, sites: quota.sites, staff: quota.staff }, paymentRecorded: false };
}
export async function adminGrant(db: SaasExecutor, org: number, input: any, actor: string, requestId: string | null, now = new Date(), write = false, audit?: {
    ipHash: string;
    userAgent: string;
}) {
    if (saasOrganisationDeferred(org))
        throw Error('ADMIN_ORGANISATION_EXCLUDED');
    const owner = (await db.query('SELECT owner_id FROM organisations WHERE id=$1' + (write ? ' FOR UPDATE' : ''), [org])).rows[0];
    if (!owner)
        throw Error('ADMIN_ORGANISATION_NOT_FOUND');
    if (await saasIdentityDeferred(db, owner.owner_id))
        throw Error('ADMIN_ORGANISATION_EXCLUDED');
    const row = (await db.query('SELECT state FROM saas_accounts WHERE organisation_id=$1' + (write ? ' FOR UPDATE' : ''), [org])).rows[0];
    if (!row)
        throw Error('ADMIN_LEGACY_REVIEW_REQUIRED');
    const preview = previewAdminGrant(row.state, input, now);
    if (write) {
        if (!audit)
            throw Error('ADMIN_AUDIT_CONTEXT_REQUIRED');
        await db.query('UPDATE saas_accounts SET state=$2::jsonb,updated_at=now() WHERE organisation_id=$1', [org, JSON.stringify(preview.next)]);
        await db.query(`INSERT INTO platform_admin_audit_events(user_id,action,outcome,request_id,metadata,ip_hash,user_agent) VALUES($1,'platform_admin.saas_grant','success',$2,$3::jsonb,$4,$5)`, [actor, requestId, JSON.stringify({ organisationId: org, reason: preview.reason, before: preview.before, after: preview.after, paymentRecorded: false }), audit.ipHash, audit.userAgent]);
        await db.query(`INSERT INTO saas_events(organisation_id,action,details) VALUES($1,'admin_grant',$2::jsonb)`, [org, JSON.stringify({ actor, reason: preview.reason, before: preview.before, after: preview.after, paymentRecorded: false })]);
    }
    return preview;
}
