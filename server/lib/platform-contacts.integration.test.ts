/** Isolated PostgreSQL. No production database, delivery provider or background job. */
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
import { businessLaunchTrial } from '../../shared/saas-business-launch';
import { platformContactDetail, platformContactDirectory, writePlatformContact } from './platform-contacts';
import { reserveContactDelivery, finishContactDelivery, applyWhatsAppStatuses, sendContactDelivery } from './platform-contact-delivery';
import { supportedTemplate, sendWhatsAppTemplate, validWhatsAppSignature, whatsappRecipient, whatsappCatalog, whatsappConfiguration } from './platform-whatsapp';
import { renderWhatsAppTemplate } from '../../shared/whatsapp-template';
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
  const deliveryMigration = await readFile(new URL('../../migrations/20261119_platform_contact_deliveries.sql', import.meta.url), 'utf8');
  await pg.exec(deliveryMigration); await pg.exec(deliveryMigration);
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
  // Synthetic provider only: a real API call is impossible in this test process.
  Object.assign(process.env, { WHATSAPP_ACCESS_TOKEN: 'synthetic-token', WHATSAPP_PHONE_NUMBER_ID: '111', WHATSAPP_ADDITIONAL_PHONE_NUMBER_IDS: '444', WHATSAPP_BUSINESS_ACCOUNT_ID: '222', META_APP_SECRET: 'synthetic-secret', WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'test-only-verification-token-32-characters', PLATFORM_CONTACT_WHATSAPP_ENABLED: 'true' });
  const rawTemplate = { id: '333', name: 'synthetic_support', language: 'fr', status: 'APPROVED', category: 'UTILITY', components: [{ type: 'BODY', text: 'Bonjour {{1}}, accompagnement de {{2}}.' }, { type: 'FOOTER', text: 'XpressPro' }] };
  const template = { ...supportedTemplate(rawTemplate)!, parameters: ['Fictitious', 'Pressing test'] };
  assert.ok(supportedTemplate(rawTemplate));
  assert.equal(supportedTemplate({ ...rawTemplate, status: 'PENDING' }), null);
  assert.equal(supportedTemplate({ ...rawTemplate, components: [...rawTemplate.components, { type: 'BUTTONS', buttons: [] }] }), null);
  assert.equal(supportedTemplate({ ...rawTemplate, components: [{ type: 'BODY', text: 'Missing {{2}}' }] }), null);
  assert.equal(whatsappRecipient('00237 600-000-000'), '+237600000000');
  assert.throws(() => whatsappRecipient('600000000'), /CONTACT_RECIPIENT_INVALID/);
  const sender = { id: '111', accountId: '222', phoneNumber: '+237600000001', name: 'Synthetic sender' };
  const secondSender = { id: '444', accountId: '222', phoneNumber: '+237600000002', name: 'Synthetic second sender' };
  let providerCalls = 0, templateChanged = false, senderConnected = true, senderNumber = sender.phoneNumber;
  const sentFrom: string[] = [];
  const fakeFetch: typeof fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/graph\.facebook\.com\/v27\.0\/((111|444)\/messages|222\/(message_templates|phone_numbers)\?)/);
    if (options?.method === 'POST') {
      providerCalls++; sentFrom.push(new URL(String(url)).pathname.split('/')[2]);
      const payload = JSON.parse(String(options.body));
      assert.equal(payload.type, 'template'); assert.equal(payload.to, '237600000000');
      assert.equal(payload.template.components[0].parameters[0].text, 'Fictitious');
      assert.equal((await query('SELECT count(*)::int AS n FROM platform_contact_deliveries WHERE id=$1', [payload.biz_opaque_callback_data])).rows[0].n, 1, 'Durable reservation precedes network side effect');
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.synthetic' }] }), { status: 200 });
    }
    if (String(url).includes('/phone_numbers?')) return new Response(JSON.stringify({ data: [
      { id: '111', display_phone_number: senderNumber, verified_name: sender.name, status: senderConnected ? 'CONNECTED' : 'DISCONNECTED' },
      { id: '444', display_phone_number: secondSender.phoneNumber, verified_name: secondSender.name, status: 'CONNECTED' },
      { id: '555', display_phone_number: '+237600000003', verified_name: 'Not authorised', status: 'CONNECTED' },
    ] }), { status: 200 });
    return new Response(JSON.stringify({ data: [templateChanged ? { ...rawTemplate, status: 'PAUSED' } : rawTemplate] }), { status: 200 });
  };
  globalThis.fetch = fakeFetch;
  const tx = async <T>(fn: () => Promise<T>) => { await query('BEGIN'); try { const value = await fn(); await query('COMMIT'); return value; } catch (error) { await query('ROLLBACK'); throw error; } };
  assert.deepEqual((await whatsappCatalog()).senders, [sender, secondSender], 'Other account numbers are never automatically enabled');
  process.env.WHATSAPP_ADDITIONAL_PHONE_NUMBER_IDS = '444,invalid';
  assert.equal(whatsappConfiguration().configured, false, 'Invalid allowlist fails closed');
  process.env.WHATSAPP_ADDITIONAL_PHONE_NUMBER_IDS = '444';
  const prepare = async (senderId = '111') => {
    await write(await command({ action: 'save_message', channel: 'whatsapp', language: 'fr', text: renderWhatsAppTemplate(template), whatsappTemplate: template, whatsappSenderId: senderId, contextFingerprint: (await detail(202)).contextFingerprint }, 202), 202);
    await write(await command({ action: 'approve_message' }, 202), 202);
    const d = await detail(202);
    return { requestId: randomUUID(), expectedVersion: d.tracking.version, approvalId: d.tracking.message!.approvalId!, consentConfirmed: true as const };
  };
  await assert.rejects(prepare('555'), /CONTACT_SENDER_UNAVAILABLE/);
  const send = await prepare();
  senderConnected = false;
  await assert.rejects(tx(() => reserveContactDelivery({ query }, 202, actor, send, now)), /CONTACT_SENDER_UNAVAILABLE/);
  senderConnected = true;
  senderNumber = '+237600000099';
  await assert.rejects(tx(() => reserveContactDelivery({ query }, 202, actor, send, now)), /CONTACT_SENDER_CHANGED/);
  senderNumber = sender.phoneNumber;
  const reserve = (input: unknown = send, org = 202, executor = { query }) => tx(() => reserveContactDelivery(executor, org, actor, input, now));
  await assert.rejects(reserve({ ...send, consentConfirmed: false }), /CONTACT_INVALID_INPUT/);
  await assert.rejects(reserve({ ...send, expectedVersion: 0 }), /CONTACT_INVALID_INPUT/);
  await assert.rejects(reserve({ ...send, approvalId: randomUUID() }), /CONTACT_APPROVAL_REQUIRED/);
  templateChanged = true; await assert.rejects(reserve(), /CONTACT_TEMPLATE_CHANGED/); templateChanged = false;
  await assert.rejects(reserve(send, 202, failing), /AUDIT_FAILURE/);
  assert.equal((await query('SELECT count(*)::int AS n FROM platform_contact_deliveries')).rows[0].n, 0);
  const reserved = await reserve(); assert.equal(reserved.duplicate, false);
  assert.equal((await reserve()).duplicate, true);
  assert.equal((await reserve({ ...send, requestId: randomUUID() })).duplicate, true, 'Fresh retry UUID cannot resend the same approval');
  await assert.rejects(reserve(send, 201), /CONTACT_REQUEST_CONFLICT/);
  assert.equal(providerCalls, 0, 'Reservation never sends before commit');
  const result = await sendWhatsAppTemplate(reserved.delivery.recipient, template, reserved.delivery.id, reserved.delivery.message.whatsappSender!);
  assert.equal(result.status, 'accepted'); assert.equal(providerCalls, 1);
  await tx(() => finishContactDelivery({ query }, reserved.delivery.id, result, now));
  assert.equal((await detail(202)).deliveries[0].status, 'accepted');
  assert.equal((await detail(202)).tracking.lastContactAt, null, 'Provider acceptance is not an actual conversation');
  await sendContactDelivery(async () => ({ query, release() {} }), 202, actor, send);
  assert.equal(providerCalls, 1, 'Route retry returns the reservation without network access');
  const notification = (status: string, recipient = '237600000000', id = reserved.delivery.id) => ({ object: 'whatsapp_business_account', entry: [{ id: '222', changes: [{ field: 'messages', value: { metadata: { phone_number_id: '111' }, statuses: [{ id: 'wamid.synthetic', recipient_id: recipient, status, biz_opaque_callback_data: id }] } }] }] });
  const raw = Buffer.from(JSON.stringify(notification('delivered')));
  const signature = 'sha256=' + createHmac('sha256', process.env.META_APP_SECRET!).update(raw).digest('hex');
  assert.equal(validWhatsAppSignature(raw, signature), true);
  assert.equal(validWhatsAppSignature(Buffer.concat([raw, Buffer.from(' ')]), signature), false);
  assert.equal(validWhatsAppSignature(raw, 'sha256=' + '0'.repeat(64)), false);
  await tx(() => applyWhatsAppStatuses({ query }, notification('delivered', '237699999999'), now));
  assert.equal((await detail(202)).deliveries[0].status, 'accepted', 'Wrong recipient cannot alter a delivery');
  const wrongSender = notification('read'); wrongSender.entry[0].changes[0].value.metadata.phone_number_id = '444';
  await tx(() => applyWhatsAppStatuses({ query }, wrongSender, now));
  assert.equal((await detail(202)).deliveries[0].status, 'accepted', 'A second authorised sender cannot update another sender’s delivery');
  await tx(() => applyWhatsAppStatuses({ query }, notification('read'), now));
  const historyAfterRead = (await detail(202)).history.total;
  await tx(() => applyWhatsAppStatuses({ query }, notification('read'), now));
  await tx(() => applyWhatsAppStatuses({ query }, notification('sent'), now));
  await tx(() => applyWhatsAppStatuses({ query }, notification('failed'), now));
  assert.equal((await detail(202)).deliveries[0].status, 'read', 'Out-of-order callbacks cannot regress delivered/read');
  assert.equal((await detail(202)).history.total, historyAfterRead, 'Duplicate callbacks do not duplicate history');
  const ambiguous = await prepare(); await reserve(ambiguous);
  const unknown = await sendWhatsAppTemplate('+237600000000', template, ambiguous.requestId, sender, async () => { throw Error('timeout'); });
  assert.equal(unknown.status, 'unknown');
  await tx(() => finishContactDelivery({ query }, ambiguous.requestId, unknown, now));
  const afterAmbiguous = await prepare();
  await assert.rejects(reserve(afterAmbiguous), /CONTACT_DELIVERY_UNRESOLVED/);
  const recovered = notification('delivered', '237600000000', ambiguous.requestId);
  recovered.entry[0].changes[0].value.statuses[0].id = 'wamid.recovered';
  await tx(() => applyWhatsAppStatuses({ query }, recovered, now));
  assert.equal((await detail(202)).deliveries.find(d => d.id === ambiguous.requestId)?.status, 'delivered', 'Callback recovers uncertain transport by opaque reservation ID');
  await write(await command({ action: 'plan', status: 'do_not_contact', nextAction: '', nextActionDate: null, note: 'Synthetic explicit refusal' }, 202), 202);
  await assert.rejects(reserve({ ...afterAmbiguous, expectedVersion: (await detail(202)).tracking.version }), /CONTACT_APPROVAL_BLOCKED/);
  await write(await command({ action: 'plan', status: 'open', nextAction: '', nextActionDate: null, note: 'Synthetic test reset' }, 202), 202);
  const beforePhoneChange = await prepare();
  await query("UPDATE users SET phone='+237699999999' WHERE id='owner-202'");
  await assert.rejects(reserve(beforePhoneChange), /CONTACT_CONTEXT_CHANGED/);
  await query("UPDATE users SET phone='+237600000000' WHERE id='owner-202'");
  const failureOnly = await reserve(beforePhoneChange);
  const failureNotification = notification('failed', '237600000000', failureOnly.delivery.id);
  const failureStatus: any = failureNotification.entry[0].changes[0].value.statuses[0];
  failureStatus.id = 'wamid.failed'; delete failureStatus.recipient_id;
  await tx(() => applyWhatsAppStatuses({ query }, failureNotification, now));
  assert.equal((await detail(202)).deliveries.find(d => d.id === failureOnly.delivery.id)?.status, 'failed', 'Signed failure correlates even without recipient_id');
  const rejected = await sendWhatsAppTemplate('+237600000000', template, randomUUID(), sender, async () => new Response(JSON.stringify({ error: { code: 131030, message: 'private provider details' } }), { status: 400 }));
  assert.deepEqual(rejected, { status: 'failed', providerId: null, errorCode: 'META_131030' });
  assert.equal((await sendWhatsAppTemplate('+237600000000', template, randomUUID(), sender, async () => new Response('{}', { status: 502 }))).status, 'unknown');
  const second = await prepare('444');
  assert.equal((await detail(202)).tracking.message!.whatsappSender!.phoneNumber, secondSender.phoneNumber);
  await assert.rejects(reserve({ ...second, whatsappSenderId: '111' }), /CONTACT_INVALID_INPUT/, 'Send request cannot override the approved sender');
  const secondReserved = await reserve(second);
  await sendWhatsAppTemplate(secondReserved.delivery.recipient, template, secondReserved.delivery.id, secondReserved.delivery.message.whatsappSender!);
  assert.deepEqual(sentFrom, ['111', '444'], 'Each approved message uses its exact sender endpoint');
  const secondNotification = notification('delivered', '237600000000', second.requestId);
  secondNotification.entry[0].changes[0].value.statuses[0].id = 'wamid.second';
  await tx(() => applyWhatsAppStatuses({ query }, secondNotification, now));
  assert.equal((await detail(202)).deliveries.find(d => d.id === second.requestId)?.status, 'dispatching');
  secondNotification.entry[0].changes[0].value.metadata.phone_number_id = '444';
  await tx(() => applyWhatsAppStatuses({ query }, secondNotification, now));
  const secondDetail = await detail(202);
  assert.equal(secondDetail.deliveries.find(d => d.id === second.requestId)?.status, 'delivered');
  assert.deepEqual(secondDetail.deliveries.find(d => d.id === second.requestId)?.sender, secondSender);
  assert.ok(secondDetail.history.items.some(e => e.data.action === 'delivery' && e.data.sender?.id === '444'));
  const invalidSenderResult = await sendWhatsAppTemplate('+237600000000', template, randomUUID(), { ...sender, accountId: '999' }, async () => { throw Error('MUST_NOT_SEND'); });
  assert.equal(invalidSenderResult.status, 'failed');
  assert.equal(invalidSenderResult.errorCode, 'CONTACT_SENDER_UNAVAILABLE');
  const unapprovedSwitch = await prepare();
  await write(await command({ action: 'save_message', channel: 'whatsapp', language: 'fr', text: renderWhatsAppTemplate(template), whatsappTemplate: template, whatsappSenderId: '444', contextFingerprint: (await detail(202)).contextFingerprint }, 202), 202);
  assert.equal((await detail(202)).tracking.message!.status, 'draft', 'Changing sender always removes approval');
  await assert.rejects(reserve({ ...unapprovedSwitch, expectedVersion: (await detail(202)).tracking.version }), /CONTACT_APPROVAL_REQUIRED/);
  assert.deepEqual(await businessSnapshot(), before, 'Sending only affects platform relationship records');
  globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN'); };
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
    for (const path of ['GET /api/platform-admin/contacts', 'GET /api/platform-admin/contacts/whatsapp', 'GET /api/platform-admin/contacts/:organisationId', 'POST /api/platform-admin/contacts/:organisationId', 'POST /api/platform-admin/contacts/:organisationId/send'])
      assert.ok([401, 403].includes((await route(path, { session })).code));
  }
  assert.equal((await route('POST /api/platform-admin/contacts/:organisationId', { get: (key: string) => key === 'host' ? 'superadmin.example.invalid' : 'https://evil.example.invalid' })).code, 403);
  assert.equal((await route('POST /api/platform-admin/contacts/:organisationId', { get: () => undefined })).code, 403);
  assert.equal((await route('POST /api/platform-admin/contacts/:organisationId/send', { get: () => undefined })).code, 403);
  assert.equal((await route('POST /api/webhooks/platform-whatsapp', { rawBody: Buffer.from('{}') })).code, 403);
  const get = await route('GET /api/platform-admin/contacts'); assert.equal(get.code, 200); assert.equal(get.headers['Cache-Control'], 'no-store');
  const routeWrite = await route('POST /api/platform-admin/contacts/:organisationId', { body: { requestId: randomUUID(), expectedVersion: (await detail()).tracking.version, action: 'plan', status: 'open', nextAction: '', nextActionDate: null, note: 'Route transaction tested' } });
  assert.equal(routeWrite.code, 200, JSON.stringify(routeWrite.body));
  assert.equal(process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED, 'true');
  console.log('PASS platform contacts: read-only projections, repeatable additive migration, contact history, Douala dates, continuing follow-up, proposals, approval without delivery, fresh context, consent suppression, durable WhatsApp attempts, immutable approved templates, duplicate/ambiguous sends, signed and out-of-order status callbacks, idempotency, stale edits, audit rollback, MFA/origin gates and unchanged business data. No network or production access.');
} finally { await pg.close(); await pool.end(); }
