import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { contactCommand, type ContactCase, type ContactDetail, type ContactDirectory, type ContactEntry, type ContactMessage } from '../../shared/platform-contact';
import type { DecisionRegistration } from '../../shared/platform-admin-decision';
import type { SaasExecutor } from './saas-store';
import { adminDecisionOverview, decisionDays } from './platform-admin-decision';
import { suggestedContactMessage } from './platform-contact-messages';
import { verifyWhatsAppTemplate } from './platform-whatsapp';

export class PlatformContactError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code); }
}
const iso = (v: any) => v == null ? null : new Date(v).toISOString();
export const doualaDate = (now: Date) => new Date(now.getTime() + 3600000).toISOString().slice(0, 10);
const caseSql = `SELECT c.*, last_contact.data->>'contactAt' AS last_contact_at, last_contact.data->>'outcome' AS last_contact_outcome,
 COALESCE((SELECT max(e.resulting_version) FROM platform_contact_events e WHERE e.organisation_id=c.organisation_id AND e.action IN ('contact','plan')),0) AS review_revision
 FROM platform_contact_cases c LEFT JOIN LATERAL (
 SELECT data FROM platform_contact_events e WHERE e.organisation_id=c.organisation_id AND e.action='contact'
 ORDER BY (data->>'contactAt')::timestamptz DESC,e.created_at DESC,e.id DESC LIMIT 1
 ) last_contact ON true`;
function tracking(row: any): ContactCase {
  return {
    version: Number(row?.version ?? 0), reviewRevision: Number(row?.review_revision ?? 0), status: row?.status ?? 'open', nextAction: row?.next_action ?? '',
    nextActionDate: row?.next_action_date ? (typeof row.next_action_date === 'string' ? row.next_action_date.slice(0, 10) : new Date(row.next_action_date).toISOString().slice(0, 10)) : null,
    lastContactAt: iso(row?.last_contact_at), lastContactOutcome: row?.last_contact_outcome ?? null, message: row?.message ?? null,
  };
}
export function contactContext(account: DecisionRegistration, state: ContactCase) {
  // Stable across draft edits, but invalidated by activity, payment, access, contact or planning changes.
  return createHash('sha256').update(JSON.stringify({
    id: account.id, name: account.name, owner: account.owner,
    activity: { orders: account.activity.orders, orders7: account.activity.orders7, activeDays7: account.activity.activeDays7, lastOrderAt: account.activity.lastOrderAt },
    subscription: account.subscription, reason: account.followUp.reason,
    reviewRevision: state.reviewRevision, status: state.status, nextAction: state.nextAction, nextActionDate: state.nextActionDate,
    lastContactAt: state.lastContactAt, lastContactOutcome: state.lastContactOutcome,
  })).digest('hex');
}
function entry(account: DecisionRegistration, row: any, now: Date): ContactEntry {
  const state = tracking(row), contextFingerprint = contactContext(account, state);
  return {
    account, tracking: state, contextFingerprint,
    messageStale: !!state.message && state.message.contextFingerprint !== contextFingerprint,
    approvalBlocked: ['paused', 'closed', 'do_not_contact'].includes(state.status),
    due: ['open', 'in_progress'].includes(state.status) && !!state.nextActionDate && state.nextActionDate <= doualaDate(now),
  };
}
async function snapshot(db: SaasExecutor, days: number, now: Date) {
  const overview = await adminDecisionOverview(db, days, now, true);
  const states = new Map((await db.query(caseSql)).rows.map(row => [Number(row.organisation_id), row]));
  return { start: overview.start, entries: overview.registrations.map(account => entry(account, states.get(account.id), now)) };
}
export async function platformContactDirectory(db: SaasExecutor, options: { days?: unknown; search?: string; filter?: string; offset?: number }, now = new Date()): Promise<ContactDirectory> {
  let days: number;
  try { days = decisionDays(options.days); } catch { throw new PlatformContactError('CONTACT_INVALID_INPUT', 400); }
  const search = (options.search ?? '').trim().toLocaleLowerCase().slice(0, 120);
  const filter = options.filter ?? 'all', offset = options.offset ?? 0, limit = 20;
  if (!['all', 'due', 'drafts', 'approved', 'support', 'subscription', 'tracked', 'do_not_contact'].includes(filter) || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000)
    throw new PlatformContactError('CONTACT_INVALID_INPUT', 400);
  const data = await snapshot(db, days, now);
  const visible = data.entries.filter(e => Date.parse(e.account.createdAt) >= Date.parse(data.start) || e.tracking.version > 0);
  const draft = (e: ContactEntry) => !!e.tracking.message && (e.tracking.message.status === 'draft' || e.messageStale);
  const approved = (e: ContactEntry) => e.tracking.message?.status === 'approved' && !e.tracking.message.deliveryId && !e.messageStale && !e.approvalBlocked;
  const counts = { all: visible.length, due: visible.filter(e => e.due).length, drafts: visible.filter(draft).length, approved: visible.filter(approved).length };
  const rows = visible.filter(e => {
    const matches = [e.account.name, e.account.owner.name, e.account.owner.email, e.account.owner.phone].some(v => v?.toLocaleLowerCase().includes(search));
    return matches && (filter === 'all' || filter === 'due' && e.due || filter === 'drafts' && draft(e) || filter === 'approved' && approved(e)
      || filter === 'tracked' && e.tracking.version > 0 || filter === 'do_not_contact' && e.tracking.status === 'do_not_contact'
      || filter === 'support' && e.account.followUp.status === 'support' && !e.approvalBlocked
      || filter === 'subscription' && ['subscription', 'renewal'].includes(e.account.followUp.status) && !e.approvalBlocked);
  }).sort((a, b) => Number(b.due) - Number(a.due) || (a.tracking.nextActionDate ?? '9999').localeCompare(b.tracking.nextActionDate ?? '9999')
    || Date.parse(b.account.createdAt) - Date.parse(a.account.createdAt) || b.account.id - a.account.id);
  return { items: rows.slice(offset, offset + limit), total: rows.length, offset, limit, counts };
}
export async function platformContactDetail(db: SaasExecutor, organisationId: number, offset = 0, now = new Date()): Promise<ContactDetail> {
  if (!Number.isSafeInteger(organisationId) || organisationId < 1 || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000)
    throw new PlatformContactError('CONTACT_INVALID_INPUT', 400);
  const current = (await snapshot(db, 30, now)).entries.find(e => e.account.id === organisationId);
  if (!current) throw new PlatformContactError('CONTACT_ORGANISATION_UNAVAILABLE', 404);
  const events = await db.query('SELECT id,actor_name,data,created_at FROM platform_contact_events WHERE organisation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $2', [organisationId, offset]);
  const total = Number((await db.query('SELECT count(*)::int AS total FROM platform_contact_events WHERE organisation_id=$1', [organisationId])).rows[0].total);
  const deliveries = (await db.query('SELECT * FROM platform_contact_deliveries WHERE organisation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20', [organisationId])).rows.map(r => ({
    id: r.id, approvalId: r.approval_id, recipient: r.recipient, text: r.message.text, actorName: r.actor_name,
    status: r.status === 'dispatching' && now.getTime() - new Date(r.created_at).getTime() > 60000 ? 'unknown' : r.status,
    providerId: r.provider_id, errorCode: r.error_code, createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!,
  }));
  return { ...current, suggestion: { fr: suggestedContactMessage(current.account, 'fr'), en: suggestedContactMessage(current.account, 'en') },
    deliveries,
    history: { items: events.rows.map(r => ({ id: r.id, actorName: r.actor_name, createdAt: iso(r.created_at)!, data: r.data })), total, offset, limit: 20 } };
}

/** Caller owns one transaction. Template verification is read-only; no message, billing or maintenance is triggered here. */
export async function writePlatformContact(db: SaasExecutor, organisationId: number, actor: { id: string; requestId?: string; ip: string; userAgent?: string }, input: unknown, now = new Date()) {
  const parsed = contactCommand.safeParse(input);
  if (!parsed.success || !Number.isSafeInteger(organisationId) || organisationId < 1) throw new PlatformContactError('CONTACT_INVALID_INPUT', 400);
  const command = parsed.data;
  await db.query("SELECT pg_advisory_xact_lock(hashtext('platform_contact:' || $1::text))", [organisationId]);
  const duplicate = (await db.query('SELECT * FROM platform_contact_events WHERE id=$1', [command.requestId])).rows[0];
  if (duplicate) {
    if (Number(duplicate.organisation_id) !== organisationId || duplicate.actor_user_id !== actor.id || !isDeepStrictEqual(duplicate.data, command))
      throw new PlatformContactError('CONTACT_REQUEST_CONFLICT');
    return { version: Number(duplicate.resulting_version), duplicate: true };
  }
  const current = await platformContactDetail(db, organisationId, 0, now);
  if (current.tracking.version !== command.expectedVersion) throw new PlatformContactError('CONTACT_STATE_CHANGED');
  const who = (await db.query("SELECT COALESCE(NULLIF(trim(concat_ws(' ',first_name,last_name)),''),email,'Administrator') AS name FROM users WHERE id=$1", [actor.id])).rows[0];
  if (!who) throw new PlatformContactError('CONTACT_ACTOR_REQUIRED', 403);
  const state = { ...current.tracking };
  if (command.action === 'contact' || command.action === 'plan') {
    if (!!command.nextAction !== !!command.nextActionDate || command.nextActionDate && command.nextActionDate < doualaDate(now)
      || ['closed', 'do_not_contact'].includes(command.status) && command.nextActionDate)
      throw new PlatformContactError('CONTACT_INVALID_SCHEDULE', 400);
    if (command.action === 'contact' && (Date.parse(command.contactAt) > now.getTime() || Date.parse(command.contactAt) < Date.parse(current.account.createdAt)))
      throw new PlatformContactError('CONTACT_INVALID_DATE', 400);
    state.status = command.status; state.nextAction = command.nextAction; state.nextActionDate = command.nextActionDate;
  } else if (command.action === 'save_message') {
    if (command.contextFingerprint !== current.contextFingerprint) throw new PlatformContactError('CONTACT_CONTEXT_CHANGED');
    if (command.whatsappTemplate) {
      if (command.channel !== 'whatsapp' || !command.whatsappTemplate.language.startsWith(command.language)) throw new PlatformContactError('CONTACT_TEMPLATE_INVALID', 400);
      try { await verifyWhatsAppTemplate(command.whatsappTemplate, command.text); }
      catch (error) { throw new PlatformContactError((error as Error).message.startsWith('CONTACT_') ? (error as Error).message : 'CONTACT_PROVIDER_UNAVAILABLE', 400); }
    }
    state.message = { text: command.text, channel: command.channel, language: command.language, reason: current.account.followUp.reason,
      contextFingerprint: current.contextFingerprint, status: 'draft', approvedAt: null, approvedBy: null,
      ...(command.whatsappTemplate ? { whatsappTemplate: command.whatsappTemplate } : {}) } satisfies ContactMessage;
  } else if (command.action === 'approve_message') {
    if (current.approvalBlocked) throw new PlatformContactError('CONTACT_APPROVAL_BLOCKED');
    if (!state.message) throw new PlatformContactError('CONTACT_MESSAGE_REQUIRED', 400);
    if (current.messageStale) throw new PlatformContactError('CONTACT_CONTEXT_CHANGED');
    if (state.message.status !== 'draft') throw new PlatformContactError('CONTACT_STATE_CHANGED');
    const recipient = state.message.channel === 'email' ? current.account.owner.email : current.account.owner.phone;
    if (!recipient?.trim()) throw new PlatformContactError('CONTACT_RECIPIENT_MISSING', 400);
    state.message = { ...state.message, status: 'approved', approvedAt: now.toISOString(), approvedBy: who.name, approvalId: command.requestId };
  } else {
    if (!state.message) throw new PlatformContactError('CONTACT_MESSAGE_REQUIRED', 400);
    state.message = null;
  }
  const version = state.version + 1;
  await db.query(`INSERT INTO platform_contact_cases(organisation_id,version,status,next_action,next_action_date,message,updated_at)
    VALUES($1,$2,$3,$4,$5::date,$6::jsonb,$7) ON CONFLICT(organisation_id) DO UPDATE SET
    version=EXCLUDED.version,status=EXCLUDED.status,next_action=EXCLUDED.next_action,next_action_date=EXCLUDED.next_action_date,message=EXCLUDED.message,updated_at=EXCLUDED.updated_at`,
  [organisationId, version, state.status, state.nextAction, state.nextActionDate, JSON.stringify(state.message), now]);
  await db.query('INSERT INTO platform_contact_events(id,organisation_id,actor_user_id,actor_name,action,data,resulting_version,created_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)',
    [command.requestId, organisationId, actor.id, who.name, command.action, JSON.stringify(command), version, now]);
  await db.query(`INSERT INTO platform_admin_audit_events(user_id,action,outcome,request_id,ip_hash,user_agent,metadata)
    VALUES($1,$2,'success',$3,$4,$5,$6::jsonb)`, [actor.id, 'platform_admin.contact_' + command.action, actor.requestId ?? null,
    createHash('sha256').update(actor.ip).digest('hex'), (actor.userAgent ?? '').slice(0, 500), JSON.stringify({ organisationId, contactEventId: command.requestId, version })]);
  return { version, duplicate: false };
}
