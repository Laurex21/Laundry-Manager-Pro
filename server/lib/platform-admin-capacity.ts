import { createHash } from 'node:crypto';
import { z } from 'zod';
import { capacityCost, type CapacitySummary, type CapacityPreview } from '../../shared/admin-capacity';
import { saasEffective, saasQuotas, saasSelection, type SaasState } from '../../shared/saas-plans';
import { businessLaunchTrial } from '../../shared/saas-business-launch';
import { legacyLaunchProtection } from './saas-legacy-protection';
import { saasIdentityDeferred, saasOrganisationDeferred } from './saas-deferred';
import type { SaasExecutor } from './saas-store';

const changeSchema = z.object({
  expectedFingerprint: z.string().length(64),
  extraSites: z.number().int().min(0).max(1000),
  extraStaff: z.number().int().min(0).max(1000),
  addSiteIds: z.array(z.number().int().positive()).max(1002),
  addStaffIds: z.array(z.string().min(1).max(255)).max(3005),
  reason: z.string().trim().min(10).max(500),
}).strict();

function invoiceCost(selection: any) {
  try { return selection ? capacityCost(saasSelection(selection.plan, selection.extraSites ?? 0, selection.extraStaff ?? 0)) : null; }
  catch { return null; }
}

/** Projection only. Never initialise, reconcile, activate or charge on a read. */
async function readCapacity(db: SaasExecutor, org: number, now: Date, lock = false) {
  const organisation = (await db.query('SELECT id,owner_id,created_at FROM organisations WHERE id=$1' + (lock ? ' FOR UPDATE' : ''), [org])).rows[0];
  if (!organisation) throw Error('ADMIN_ORGANISATION_NOT_FOUND');
  const account = (await db.query('SELECT state FROM saas_accounts WHERE organisation_id=$1' + (lock ? ' FOR UPDATE' : ''), [org])).rows[0];
  const raw: SaasState | null = account?.state ?? null;
  const siteRows = (await db.query('SELECT id,name,is_active FROM sites WHERE organisation_id=$1 ORDER BY id', [org])).rows;
  // Include unassigned personnel in the directory, but only valid memberships can be activated.
  const people = (await db.query(`SELECT u.id,concat_ws(' ',u.first_name,u.last_name) AS name,
    COALESCE((SELECT jsonb_agg(DISTINCT s.id ORDER BY s.id) FROM site_members sm JOIN sites s ON s.id=sm.site_id
      WHERE sm.user_id=u.id AND s.organisation_id=$1 AND s.is_active=true),'[]'::jsonb) AS site_ids
    FROM users u WHERE u.organisation_id=$1 AND u.id<>$2 ORDER BY u.id`, [org, organisation.owner_id])).rows;
  const activeSites = siteRows.filter(s => s.is_active).map(s => Number(s.id));
  const eligibleStaff = people.filter(p => p.site_ids.length > 0).map(p => String(p.id));
  const excluded = saasOrganisationDeferred(org) || await saasIdentityDeferred(db, organisation.owner_id);
  let state: SaasState | null = raw ? saasEffective(structuredClone(raw), now) : null;
  if (!raw && !excluded && process.env.SAAS_BUSINESS_LAUNCH_ENABLED === 'true') {
    const periods = (await db.query("SELECT extract(epoch FROM end_date)*1000 AS end_milliseconds FROM subscriptions WHERE user_id=$1 AND status='active'", [organisation.owner_id])).rows;
    if (!legacyLaunchProtection(periods, now).defer) state = businessLaunchTrial(new Date(organisation.created_at), now, activeSites, eligibleStaff);
  }
  // Deferred/historical rights cannot be inferred from the commercial catalogue.
  if (excluded) state = null;
  if (state) {
    if (state.launchBusiness && state.phase === 'trialing') {
      state.activeSiteIds = activeSites;
      state.activeStaffIds = eligibleStaff;
      state.extraSites = Math.max(0, activeSites.length - 2);
      state.extraStaff = Math.max(0, eligibleStaff.length - 5 - state.extraSites * 2);
    }
    const quotas = saasQuotas(state);
    state.activeSiteIds = state.activeSiteIds.filter(id => activeSites.includes(id)).slice(0, quotas.sites);
    state.activeStaffIds = state.activeStaffIds.filter(id => people.some(p => p.id === id && p.site_ids.some((site: number) => state!.activeSiteIds.includes(site))));
    if (state.activeStaffIds.length > quotas.staff) state.activeStaffIds = [];
  }
  const unresolved = (await db.query("SELECT id,status FROM saas_invoices WHERE organisation_id=$1 AND status IN ('pending','review') ORDER BY id", [org])).rows;
  const invoice = (await db.query(`SELECT id,status,created_at,paid_at,quote,total_xaf FROM saas_invoices
    WHERE organisation_id=$1 AND provider_environment='live'
      AND COALESCE(quote->>'purpose','') NOT IN ('collection_pilot','subscription_pilot')
    ORDER BY created_at DESC,id DESC LIMIT 1`, [org])).rows[0];
  const blocked = excluded ? 'ADMIN_ORGANISATION_EXCLUDED' : !raw ? 'ADMIN_LEGACY_REVIEW_REQUIRED'
    : state?.phase !== 'active' || !state.cycleEnd || !Number.isFinite(Date.parse(state.cycleEnd)) ? 'ADMIN_ACTIVE_PLAN_REQUIRED'
    : state.renewal || state.pending ? 'ADMIN_SCHEDULED_CHANGE_REQUIRES_REVIEW'
    : unresolved.length ? 'ADMIN_PAYMENT_PENDING' : null;
  // Detect membership/availability changes as well as subscription changes between review and confirmation.
  const fingerprint = raw && !excluded ? createHash('sha256').update(JSON.stringify({ raw, sites: siteRows, people, unresolved })).digest('hex') : null;
  const next = state?.renewal ? { kind: 'renewal' as const, cost: capacityCost(state.renewal.selection), startsAt: state.renewal.start, endsAt: state.renewal.end }
    : state?.pending ? { kind: 'scheduled' as const, cost: capacityCost(state.pending), startsAt: state.cycleEnd ?? state.trialEndsAt, endsAt: null } : null;
  const summary: CapacitySummary = {
    organisationId: org, fingerprint, phase: state?.phase ?? null,
    endsAt: state?.phase === 'trialing' ? state.trialEndsAt : state?.phase === 'active' ? state.cycleEnd : null,
    current: state ? capacityCost(state) : null,
    usedSites: state?.activeSiteIds.length ?? 0, usedStaff: state?.activeStaffIds.length ?? 0,
    sites: siteRows.map(s => ({ id: Number(s.id), name: s.name, available: !!s.is_active, enabled: !!state?.activeSiteIds.includes(Number(s.id)) })),
    staff: people.map(p => ({ id: p.id, name: p.name?.trim() || '—', siteIds: p.site_ids, enabled: !!state?.activeStaffIds.includes(p.id) })),
    next, activationBlockedReason: blocked,
    latestInvoice: invoice ? {
      id: invoice.id, status: invoice.status, createdAt: invoice.created_at, paidAt: invoice.paid_at,
      cost: invoiceCost(invoice.quote?.selection),
      lines: Array.isArray(invoice.quote?.lines) ? invoice.quote.lines : [],
      originalXaf: invoice.quote?.promo?.originalXaf ?? Number(invoice.total_xaf),
      discountXaf: invoice.quote?.promo?.discountXaf ?? 0, totalXaf: Number(invoice.total_xaf),
      promoCode: invoice.quote?.promo?.code ?? null, durationMonths: invoice.quote?.durationMonths ?? 1,
    } : null,
  };
  return { summary, raw, state };
}

export async function adminCapacity(db: SaasExecutor, org: number, now = new Date()): Promise<CapacitySummary> {
  return (await readCapacity(db, org, now)).summary;
}

/** Called in a transaction. Adds capacity/access for the existing cycle, preserving payment credits. */
export async function activateAdminCapacity(db: SaasExecutor, org: number, input: unknown, actor: string,
  requestId: string | null, now = new Date(), write = false, audit?: { ipHash: string; userAgent: string }): Promise<CapacityPreview> {
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) throw Error('ADMIN_CAPACITY_INPUT_INVALID');
  const change = parsed.data;
  const { summary, state, raw } = await readCapacity(db, org, now, write);
  if (summary.activationBlockedReason) throw Error(summary.activationBlockedReason);
  if (!state || !raw || summary.fingerprint !== change.expectedFingerprint) throw Error('ADMIN_STATE_CHANGED');
  if (change.extraSites < state.extraSites || change.extraStaff < state.extraStaff) throw Error('ADMIN_ACQUIRED_RIGHTS_PROTECTED');
  const selection = saasSelection(state.plan, change.extraSites, change.extraStaff);
  if (new Set(change.addSiteIds).size !== change.addSiteIds.length || new Set(change.addStaffIds).size !== change.addStaffIds.length) throw Error('ADMIN_ACCESS_SELECTION_INVALID');
  const sites = summary.sites.filter(s => change.addSiteIds.includes(s.id));
  if (sites.length !== change.addSiteIds.length || sites.some(s => !s.available || s.enabled)) throw Error('ADMIN_ACCESS_SELECTION_INVALID');
  const siteIds = [...state.activeSiteIds, ...change.addSiteIds];
  const staff = summary.staff.filter(p => change.addStaffIds.includes(p.id));
  if (staff.length !== change.addStaffIds.length || staff.some(p => p.enabled || !p.siteIds.some(id => siteIds.includes(id)))) throw Error('ADMIN_ACCESS_SELECTION_INVALID');
  const staffIds = [...state.activeStaffIds, ...change.addStaffIds];
  const quotas = saasQuotas(selection);
  if (siteIds.length > quotas.sites || staffIds.length > quotas.staff) throw Error('ADMIN_CAPACITY_EXCEEDED');
  if (selection.extraSites === state.extraSites && selection.extraStaff === state.extraStaff && !sites.length && !staff.length) throw Error('ADMIN_CAPACITY_UNCHANGED');
  const next: SaasState = { ...state, ...selection, activeSiteIds: siteIds, activeStaffIds: staffIds, version: raw.version + 1 };
  const preview: CapacityPreview = {
    before: capacityCost(state), after: capacityCost(next),
    usedSitesBefore: state.activeSiteIds.length, usedStaffBefore: state.activeStaffIds.length,
    usedSitesAfter: siteIds.length, usedStaffAfter: staffIds.length,
    addedSites: sites.map(({ id, name }) => ({ id, name })), addedStaff: staff.map(({ id, name }) => ({ id, name })),
    endsAt: state.cycleEnd, paymentRecorded: false,
  };
  if (write) {
    if (!audit) throw Error('ADMIN_AUDIT_CONTEXT_REQUIRED');
    await db.query('UPDATE saas_accounts SET state=$2::jsonb,updated_at=now() WHERE organisation_id=$1', [org, JSON.stringify(next)]);
    // A pre-existing quote must be recalculated for the newly granted rights.
    await db.query("UPDATE saas_invoices SET status='expired' WHERE organisation_id=$1 AND status='quoted'", [org]);
    const details = { organisationId: org, reason: change.reason, ...preview, actor, previousVersion: raw.version, version: next.version };
    await db.query(`INSERT INTO platform_admin_audit_events(user_id,action,outcome,request_id,metadata,ip_hash,user_agent)
      VALUES($1,'platform_admin.capacity_grant','success',$2,$3::jsonb,$4,$5)`, [actor, requestId, JSON.stringify(details), audit.ipHash, audit.userAgent]);
    await db.query("INSERT INTO saas_events(organisation_id,action,details) VALUES($1,'admin_capacity_grant',$2::jsonb)", [org, JSON.stringify(details)]);
  }
  return preview;
}
