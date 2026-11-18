import { createHash, randomUUID } from 'node:crypto';
import type { SaasExecutor } from './saas-store';
import { sendContactCommand, type ContactMessage, type DeliveryHistory, type DeliveryStatus } from '../../shared/platform-contact';
import { platformContactDetail, PlatformContactError } from './platform-contacts';
import { sendWhatsAppTemplate, verifyWhatsAppTemplate, whatsappConfiguration, whatsappRecipient, type WhatsAppResult } from './platform-whatsapp';

type Actor = { id: string; ip: string; requestId?: string; userAgent?: string };
type DeliveryRow = { id: string; organisation_id: number; approval_id: string; actor_name: string; recipient: string; message: ContactMessage; status: DeliveryStatus; provider_id: string | null; error_code: string | null };
async function deliveryEvent(db: SaasExecutor, row: DeliveryRow, actorId: string, actorName: string, now: Date, text?: string) {
  const data: DeliveryHistory = { action: 'delivery', deliveryId: row.id, status: row.status, recipient: row.recipient, errorCode: row.error_code, ...(text ? { text } : {}) };
  await db.query(`INSERT INTO platform_contact_events(id,organisation_id,actor_user_id,actor_name,action,data,resulting_version,created_at)
    SELECT $1,$2,$3,$4,'delivery',$5::jsonb,version,$6 FROM platform_contact_cases WHERE organisation_id=$2`,
  [randomUUID(), row.organisation_id, actorId, actorName, JSON.stringify(data), now]);
}

/** One durable reservation per approval. Caller MUST commit before the provider request. */
export async function reserveContactDelivery(db: SaasExecutor, organisationId: number, actor: Actor, input: unknown, now = new Date(), request = fetch) {
  const parsed = sendContactCommand.safeParse(input);
  if (!parsed.success || !Number.isSafeInteger(organisationId) || organisationId < 1) throw new PlatformContactError('CONTACT_INVALID_INPUT', 400);
  const command = parsed.data;
  await db.query("SELECT pg_advisory_xact_lock(hashtext('platform_contact:' || $1::text))", [organisationId]);
  const duplicate = (await db.query('SELECT * FROM platform_contact_deliveries WHERE id=$1 OR approval_id=$2', [command.requestId, command.approvalId])).rows;
  if (duplicate.length) {
    if (duplicate.length !== 1 || Number(duplicate[0].organisation_id) !== organisationId || duplicate[0].approval_id !== command.approvalId)
      throw new PlatformContactError('CONTACT_REQUEST_CONFLICT');
    return { delivery: duplicate[0] as DeliveryRow, duplicate: true };
  }
  const current = await platformContactDetail(db, organisationId, 0, now);
  if (current.tracking.version !== command.expectedVersion) throw new PlatformContactError('CONTACT_STATE_CHANGED');
  if (current.approvalBlocked) throw new PlatformContactError('CONTACT_APPROVAL_BLOCKED');
  if (current.messageStale) throw new PlatformContactError('CONTACT_CONTEXT_CHANGED');
  const message = current.tracking.message;
  if (!message || message.status !== 'approved' || message.approvalId !== command.approvalId || message.deliveryId)
    throw new PlatformContactError('CONTACT_APPROVAL_REQUIRED', 400);
  if (message.channel !== 'whatsapp' || !message.whatsappTemplate) throw new PlatformContactError('CONTACT_TEMPLATE_REQUIRED', 400);
  if (!whatsappConfiguration().enabled) throw new PlatformContactError('CONTACT_WHATSAPP_NOT_CONFIGURED', 400);
  // A transport interruption cannot be treated as a failure and resent under a fresh approval.
  if ((await db.query("SELECT id FROM platform_contact_deliveries WHERE organisation_id=$1 AND status IN ('dispatching','unknown') LIMIT 1", [organisationId])).rows.length)
    throw new PlatformContactError('CONTACT_DELIVERY_UNRESOLVED');
  let recipient: string;
  try {
    recipient = whatsappRecipient(current.account.owner.phone);
    await verifyWhatsAppTemplate(message.whatsappTemplate, message.text, request);
  } catch (error) { throw new PlatformContactError((error as Error).message.startsWith('CONTACT_') ? (error as Error).message : 'CONTACT_PROVIDER_UNAVAILABLE', 400); }
  const who = (await db.query("SELECT COALESCE(NULLIF(trim(concat_ws(' ',first_name,last_name)),''),email,'Administrator') AS name FROM users WHERE id=$1", [actor.id])).rows[0];
  if (!who) throw new PlatformContactError('CONTACT_ACTOR_REQUIRED', 403);
  const delivery: DeliveryRow = { id: command.requestId, organisation_id: organisationId, approval_id: command.approvalId,
    actor_name: who.name, recipient, message, status: 'dispatching', provider_id: null, error_code: null };
  await db.query(`INSERT INTO platform_contact_deliveries(id,organisation_id,approval_id,actor_user_id,actor_name,recipient,message,status,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'dispatching',$8,$8)`,
  [delivery.id, organisationId, command.approvalId, actor.id, who.name, recipient, JSON.stringify({ ...message, consentConfirmedAt: now.toISOString() }), now]);
  await db.query('UPDATE platform_contact_cases SET version=version+1,message=$2::jsonb,updated_at=$3 WHERE organisation_id=$1',
    [organisationId, JSON.stringify({ ...message, deliveryId: delivery.id }), now]);
  await deliveryEvent(db, delivery, actor.id, who.name, now, message.text);
  await db.query(`INSERT INTO platform_admin_audit_events(user_id,action,outcome,request_id,ip_hash,user_agent,metadata)
    VALUES($1,'platform_admin.contact_send','success',$2,$3,$4,$5::jsonb)`, [actor.id, actor.requestId ?? null,
    createHash('sha256').update(actor.ip).digest('hex'), (actor.userAgent ?? '').slice(0, 500), JSON.stringify({ organisationId, deliveryId: delivery.id, approvalId: command.approvalId, consentConfirmed: true })]);
  return { delivery, duplicate: false };
}

const rank: Record<DeliveryStatus, number> = { dispatching: 0, unknown: 0, accepted: 1, sent: 2, failed: 3, delivered: 4, read: 5 };
/** Caller owns a transaction. Provider notifications may arrive before the send response. */
export async function finishContactDelivery(db: SaasExecutor, id: string, update: WhatsAppResult, now = new Date()) {
  const row = (await db.query('SELECT * FROM platform_contact_deliveries WHERE id=$1 FOR UPDATE', [id])).rows[0] as DeliveryRow | undefined;
  if (!row) return null;
  if (row.provider_id && update.providerId && row.provider_id !== update.providerId) throw new PlatformContactError('CONTACT_PROVIDER_ID_CONFLICT');
  const status = rank[update.status] > rank[row.status] || row.status === 'dispatching' && update.status === 'unknown' ? update.status : row.status;
  const providerId = row.provider_id ?? update.providerId;
  if (status === row.status && providerId === row.provider_id) return row;
  const next = { ...row, status, provider_id: providerId, error_code: status === update.status ? update.errorCode : row.error_code };
  await db.query('UPDATE platform_contact_deliveries SET status=$2,provider_id=$3,error_code=$4,updated_at=$5 WHERE id=$1', [id, status, providerId, next.error_code, now]);
  if (status !== row.status) await deliveryEvent(db, next, 'whatsapp-provider', 'WhatsApp', now);
  return next;
}

type Connection = SaasExecutor & { release(): void };
export async function sendContactDelivery(connect: () => Promise<Connection>, organisationId: number, actor: Actor, input: unknown, request = fetch) {
  const db = await connect();
  try {
    await db.query('BEGIN');
    const reserved = await reserveContactDelivery(db, organisationId, actor, input, new Date(), request);
    await db.query('COMMIT');
    if (reserved.duplicate) return { id: reserved.delivery.id, duplicate: true, status: reserved.delivery.status };
    const row = reserved.delivery;
    const result = await sendWhatsAppTemplate(row.recipient, row.message.whatsappTemplate!, row.id, request);
    await db.query('BEGIN');
    const saved = await finishContactDelivery(db, row.id, result);
    await db.query('COMMIT');
    return { id: row.id, duplicate: false, status: saved!.status };
  } catch (error) { await db.query('ROLLBACK').catch(() => {}); throw error; }
  finally { db.release(); }
}

/** Authenticated by signature at the route. Unrelated inbound messages are not retained. */
export async function applyWhatsAppStatuses(db: SaasExecutor, body: any, now = new Date()) {
  const config = whatsappConfiguration();
  if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return;
  for (const entry of body.entry) {
    if (entry.id !== config.accountId || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      const value = change?.value;
      if (change?.field !== 'messages' || value?.metadata?.phone_number_id !== config.phoneId || !Array.isArray(value.statuses)) continue;
      for (const update of value.statuses) {
        if (!['sent','delivered','read','failed'].includes(update?.status) || typeof update.id !== 'string' || !update.id.startsWith('wamid.') || update.id.length > 500) continue;
        const parsedId = sendContactCommand.shape.requestId.safeParse(update.biz_opaque_callback_data);
        const correlation = parsedId.success ? parsedId.data : null;
        const rows = (await db.query('SELECT id,recipient FROM platform_contact_deliveries WHERE provider_id=$1 OR id=$2::uuid', [update.id, correlation])).rows;
        if (rows.length !== 1) continue;
        // Failed notifications can omit recipient_id; authenticated message/correlation IDs still identify the reservation.
        if (update.recipient_id != null ? String(update.recipient_id) !== rows[0].recipient.replace(/^\+/, '') : update.status !== 'failed') continue;
        const code = update.errors?.[0]?.code;
        await finishContactDelivery(db, rows[0].id, { status: update.status, providerId: update.id,
          errorCode: update.status === 'failed' ? Number.isSafeInteger(code) ? `META_${code}` : 'META_DELIVERY_FAILED' : null }, now);
      }
    }
  }
}
