import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WhatsAppCatalog, WhatsAppTemplate, WhatsAppSender, DeliveryStatus } from '../../shared/platform-contact';
import { whatsappTemplate } from '../../shared/platform-contact';
import { renderWhatsAppTemplate, templateParameterCount } from '../../shared/whatsapp-template';

// Dedicated platform credentials and switch: never enables tenant/sales campaigns.
export function whatsappConfiguration() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim() ?? '';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? '';
  const extraIds = process.env.WHATSAPP_ADDITIONAL_PHONE_NUMBER_IDS?.trim() ?? '';
  const phoneIds = [...new Set([phoneId, ...(extraIds ? extraIds.split(',').map(id => id.trim()) : [])])];
  const accountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() ?? '';
  const secret = process.env.META_APP_SECRET?.trim() ?? '';
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ?? '';
  const version = process.env.WHATSAPP_GRAPH_VERSION?.trim() || 'v27.0';
  const configured = !!token && phoneIds.length <= 10 && phoneIds.every(id => /^\d{1,30}$/.test(id)) && /^\d{1,30}$/.test(accountId)
    && !!secret && verifyToken.length >= 32 && /^v\d+\.0$/.test(version);
  return { token, phoneId, phoneIds, accountId, secret, verifyToken, version, configured,
    enabled: configured && process.env.PLATFORM_CONTACT_WHATSAPP_ENABLED === 'true' };
}
async function graphGet(path: string, request = fetch) {
  const config = whatsappConfiguration();
  if (!config.configured) throw Error('CONTACT_WHATSAPP_NOT_CONFIGURED');
  const response = await request(`https://graph.facebook.com/${config.version}/${path}`, {
    headers: { Authorization: `Bearer ${config.token}` }, signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  if (!response.ok) throw Error('CONTACT_PROVIDER_UNAVAILABLE');
  return response.json();
}
export function supportedTemplate(raw: any): Omit<WhatsAppTemplate, 'parameters'> | null {
  if (raw?.status !== 'APPROVED' || !['UTILITY', 'MARKETING'].includes(raw.category) || !Array.isArray(raw.components)
    || raw.components.some((c: any) => !['BODY', 'FOOTER'].includes(c.type))
    || raw.components.filter((c: any) => c.type === 'BODY').length !== 1
    || raw.components.filter((c: any) => c.type === 'FOOTER').length > 1) return null;
  const body = raw.components.find((c: any) => c.type === 'BODY')?.text;
  const footer = raw.components.find((c: any) => c.type === 'FOOTER')?.text ?? '';
  const parsed = whatsappTemplate.omit({ parameters: true }).safeParse({ id: raw.id, name: raw.name, language: raw.language, body, footer });
  if (!parsed.success || templateParameterCount(parsed.data.body) < 0 || footer.includes('{{')) return null;
  return parsed.data;
}
export async function whatsappCatalog(request = fetch): Promise<WhatsAppCatalog> {
  const config = whatsappConfiguration();
  if (!config.configured) return { configured: false, enabled: false, senders: [], templates: [] };
  const senders: WhatsAppSender[] = [];
  let phoneAfter = '';
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({ fields: 'id,display_phone_number,verified_name,status', limit: '100', ...(phoneAfter ? { after: phoneAfter } : {}) });
    const result = await graphGet(`${config.accountId}/phone_numbers?${params}`, request);
    if (!Array.isArray(result.data)) throw Error('CONTACT_PROVIDER_UNAVAILABLE');
    for (const raw of result.data) {
      if (!config.phoneIds.includes(raw.id) || raw.status !== 'CONNECTED') continue;
      if (typeof raw.display_phone_number !== 'string' || typeof raw.verified_name !== 'string') throw Error('CONTACT_PROVIDER_UNAVAILABLE');
      const number = raw.display_phone_number.trim();
      senders.push({ id: raw.id, accountId: config.accountId, phoneNumber: whatsappRecipient(number.startsWith('+') ? number : `+${number}`), name: raw.verified_name.slice(0, 512) });
    }
    if (!result.paging?.next || !result.paging?.cursors?.after) break;
    phoneAfter = String(result.paging.cursors.after);
    if (page === 9) throw Error('CONTACT_TEMPLATE_CATALOG_TOO_LARGE');
  }
  const templates: WhatsAppCatalog['templates'] = [];
  let after = '';
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({ fields: 'id,name,status,language,category,components', limit: '100', ...(after ? { after } : {}) });
    const result = await graphGet(`${config.accountId}/message_templates?${params}`, request);
    if (!Array.isArray(result.data)) throw Error('CONTACT_PROVIDER_UNAVAILABLE');
    for (const item of result.data) { const template = supportedTemplate(item); if (template) templates.push(template); }
    if (!result.paging?.next || !result.paging?.cursors?.after) break;
    after = String(result.paging.cursors.after);
    if (page === 9) throw Error('CONTACT_TEMPLATE_CATALOG_TOO_LARGE');
  }
  return { configured: true, enabled: config.enabled && senders.length > 0, senders, templates };
}
export async function verifyWhatsAppTemplate(template: WhatsAppTemplate, text: string, senderId: string | undefined, request = fetch) {
  // The catalog establishes ownership by the configured business account, not just knowledge of a template ID.
  if (!senderId) throw Error('CONTACT_SENDER_REQUIRED');
  const catalog = await whatsappCatalog(request);
  const sender = catalog.senders.find(s => s.id === senderId);
  if (!sender) throw Error('CONTACT_SENDER_UNAVAILABLE');
  const actual = catalog.templates.find(t => t.id === template.id);
  if (!actual || (['id','name','language','body','footer'] as const).some(k => actual[k] !== template[k]))
    throw Error('CONTACT_TEMPLATE_CHANGED');
  if (renderWhatsAppTemplate(template) !== text) throw Error('CONTACT_TEMPLATE_INVALID');
  return sender;
}
export function whatsappRecipient(value: string | null | undefined): string {
  const compact = (value ?? '').replace(/[\s().-]/g, '').replace(/^00/, '+');
  // Never guess a country code or accept a list/URL/extension as a destination.
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) throw Error('CONTACT_RECIPIENT_INVALID');
  return compact;
}
export type WhatsAppResult = { status: DeliveryStatus; providerId: string | null; errorCode: string | null };
export async function sendWhatsAppTemplate(recipient: string, template: WhatsAppTemplate, deliveryId: string, sender: WhatsAppSender, request = fetch): Promise<WhatsAppResult> {
  const config = whatsappConfiguration();
  if (!config.enabled) return { status: 'failed', providerId: null, errorCode: 'WHATSAPP_DISABLED' };
  if (sender.accountId !== config.accountId || !config.phoneIds.includes(sender.id))
    return { status: 'failed', providerId: null, errorCode: 'CONTACT_SENDER_UNAVAILABLE' };
  try {
    const response = await request(`https://graph.facebook.com/${config.version}/${sender.id}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000), redirect: 'error', body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient.replace(/^\+/, ''), type: 'template',
        biz_opaque_callback_data: deliveryId,
        template: { name: template.name, language: { code: template.language },
          components: template.parameters.length ? [{ type: 'body', parameters: template.parameters.map(text => ({ type: 'text', text })) }] : [] },
      }),
    });
    const body = await response.json().catch(() => null);
    const id = body?.messages?.[0]?.id;
    if (response.ok && typeof id === 'string' && id.startsWith('wamid.') && id.length <= 500)
      return { status: 'accepted', providerId: id, errorCode: null };
    // A 5xx, timeout or malformed success may have followed acceptance. NEVER automatically retry.
    if (response.status >= 400 && response.status < 500 && Number.isSafeInteger(body?.error?.code))
      return { status: 'failed', providerId: null, errorCode: `META_${body.error.code}` };
    return { status: 'unknown', providerId: null, errorCode: 'PROVIDER_RESULT_UNKNOWN' };
  } catch { return { status: 'unknown', providerId: null, errorCode: 'PROVIDER_RESULT_UNKNOWN' }; }
}
export function validWhatsAppSignature(raw: unknown, signature: string | undefined): boolean {
  const secret = whatsappConfiguration().secret;
  if (!secret || !Buffer.isBuffer(raw) || !/^sha256=[a-f0-9]{64}$/.test(signature ?? '')) return false;
  return timingSafeEqual(createHmac('sha256', secret).update(raw).digest(), Buffer.from(signature!.slice(7), 'hex'));
}
