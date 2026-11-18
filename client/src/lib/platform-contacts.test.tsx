import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from './i18n';
import { ContactEditor } from '../components/platform-contacts';
import type { ContactDetail } from '../../../shared/platform-contact';
Object.assign(globalThis, { React });
globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN'); };
const sample: ContactDetail = {
  account: { id: 201, name: 'Fictitious pressing', createdAt: '2026-11-12T12:00:00Z', ageDays: 5,
    owner: { name: 'Owner <script>bad()</script>', email: 'owner@example.invalid', phone: null },
    activity: { orders: 0, orders7: 0, activeDays7: 0, firstOrderAt: null, lastOrderAt: null, daysSinceLastOrder: null },
    subscription: { planName: 'Business', status: 'trial', endDate: '2026-12-12T12:00:00Z', source: 'saas', paidAccess: false, hasCommercialPayment: false, lastPaymentAt: null },
    followUp: { status: 'support', reason: 'no_orders' } },
  tracking: { version: 1, reviewRevision: 0, status: 'open', nextAction: 'Synthetic call', nextActionDate: '2026-11-19', lastContactAt: null, lastContactOutcome: null,
    message: { text: 'Hello <script>bad()</script>, may we help you?', channel: 'email', language: 'en', reason: 'no_orders', status: 'draft', contextFingerprint: 'a'.repeat(64), approvedAt: null, approvedBy: null } },
  contextFingerprint: 'a'.repeat(64), messageStale: false, approvalBlocked: false, due: false,
  suggestion: { fr: 'Bonjour, comment pouvons-nous vous aider ?', en: 'Hello, how can we help?' },
  deliveries: [],
  history: { items: [], total: 0, offset: 0, limit: 20 },
};
const markup = (detail: ContactDetail, tab = 'message') => renderToStaticMarkup(<ContactEditor detail={detail} tab={tab} save={() => {}} pending={false} historyPage={() => {}} />);
for (const language of ['fr', 'en']) {
  await i18n.changeLanguage(language);
  const html = markup(sample);
  assert.doesNotMatch(html, /<script>bad/); assert.match(html, /&lt;script&gt;/);
  assert.ok(html.includes(language === 'fr' ? 'Valider le message' : 'Approve message'));
  assert.doesNotMatch(html, /href="(?:https:\/\/wa.me|mailto:)/, 'No implicit transmission');
  const approved = structuredClone(sample); approved.tracking.message!.status = 'approved'; approved.tracking.message!.approvedBy = 'Synthetic Admin';
  const approvedHtml = markup(approved); assert.ok(approvedHtml.includes(language === 'fr' ? 'Copier le message validé' : 'Copy approved message'));
  const stale = { ...approved, messageStale: true, contextFingerprint: 'b'.repeat(64) };
  const staleHtml = markup(stale);
  assert.match(staleHtml, /<button[^>]*disabled=""[^>]*>(?:Copier le message validé|Copy approved message)<\/button>/);
  const suppressed = markup({ ...sample, approvalBlocked: true, tracking: { ...sample.tracking, status: 'do_not_contact' } });
  assert.match(suppressed, /<button[^>]*disabled=""[^>]*>(?:Valider le message|Approve message)<\/button>/);
  const contact = markup(sample, 'contact'); assert.match(contact, /datetime-local/); assert.match(contact, /Douala/);
  assert.ok(contact.includes(language === 'fr' ? 'Ne plus contacter' : 'Do not contact'));
  const whatsapp = structuredClone(approved);
  whatsapp.tracking.message!.channel = 'whatsapp';
  whatsapp.tracking.message!.approvalId = '9fe4bdf3-ec5f-411d-8b15-658a007ad8f7';
  const unavailable = renderToStaticMarkup(<ContactEditor detail={whatsapp} tab="message" catalog={{ configured: false, enabled: false, senders: [], templates: [] }} save={() => {}} pending={false} historyPage={() => {}} />);
  assert.ok(unavailable.includes(language === 'fr' ? 'à connecter' : 'connect your account'));
  assert.match(unavailable, /<button[^>]*disabled=""[^>]*>(?:Envoyer le WhatsApp validé|Send approved WhatsApp)<\/button>/);
  const senders = [{ id: '111', accountId: '222', phoneNumber: '+237600000001', name: 'Synthetic first sender' }, { id: '444', accountId: '222', phoneNumber: '+237600000002', name: 'Synthetic <script>second</script>' }];
  whatsapp.tracking.message!.whatsappTemplate = { id: '333', name: 'synthetic_support', language: 'fr', body: 'Bonjour {{1}}', footer: '', parameters: ['Amina'] };
  const catalog = { configured: true, enabled: true, senders, templates: [whatsapp.tracking.message!.whatsappTemplate] };
  const missingSender = renderToStaticMarkup(<ContactEditor detail={whatsapp} tab="message" catalog={catalog} save={() => {}} pending={false} historyPage={() => {}} send={() => {}} />);
  assert.ok(missingSender.includes(language === 'fr' ? 'Choisis un numéro expéditeur' : 'Choose a sender number'));
  assert.match(missingSender, /<button[^>]*disabled=""[^>]*>(?:Envoyer le WhatsApp validé|Send approved WhatsApp)<\/button>/);
  whatsapp.tracking.message!.whatsappSender = senders[1];
  const multipleSenders = renderToStaticMarkup(<ContactEditor detail={whatsapp} tab="message" catalog={catalog} save={() => {}} pending={false} historyPage={() => {}} send={() => {}} />);
  assert.match(multipleSenders, /<option value="444" selected="">/);
  assert.ok(multipleSenders.includes('+237600000001') && multipleSenders.includes('+237600000002'));
  assert.doesNotMatch(multipleSenders, /<script>/);
  assert.ok(multipleSenders.includes(language === 'fr' ? 'Expéditeur validé' : 'Approved sender'));
  whatsapp.deliveries = [{ id: 'synthetic', approvalId: 'synthetic', recipient: '+237600000000', text: 'Synthetic <script>bad()</script>', actorName: 'Synthetic Admin', status: 'unknown', providerId: null, errorCode: 'PROVIDER_RESULT_UNKNOWN', createdAt: '2026-11-18T12:00:00Z', updatedAt: '2026-11-18T12:00:00Z' }];
  const uncertain = markup(whatsapp, 'history');
  assert.ok(uncertain.includes(language === 'fr' ? 'Résultat incertain' : 'Unknown result'));
  assert.doesNotMatch(uncertain, /<script>bad/);
}
console.log('PASS platform contact UI: FR/EN, manual approval distinction, escaped identities and messages, suppressed/stale actions disabled, contact outcomes and Douala scheduling.');
