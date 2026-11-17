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
  history: { items: [], total: 0, offset: 0, limit: 20 },
};
const markup = (detail: ContactDetail, tab = 'message') => renderToStaticMarkup(<ContactEditor detail={detail} tab={tab} save={() => {}} pending={false} historyPage={() => {}} />);
for (const language of ['fr', 'en']) {
  await i18n.changeLanguage(language);
  const html = markup(sample);
  assert.doesNotMatch(html, /<script>bad/); assert.match(html, /&lt;script&gt;/);
  assert.ok(html.includes(language === 'fr' ? 'Valider pour envoi manuel' : 'Approve for manual sending'));
  assert.doesNotMatch(html, /href="(?:https:\/\/wa.me|mailto:)/, 'No implicit transmission');
  const approved = structuredClone(sample); approved.tracking.message!.status = 'approved'; approved.tracking.message!.approvedBy = 'Synthetic Admin';
  const approvedHtml = markup(approved); assert.ok(approvedHtml.includes(language === 'fr' ? 'Copier le message validé' : 'Copy approved message'));
  const stale = { ...approved, messageStale: true, contextFingerprint: 'b'.repeat(64) };
  const staleHtml = markup(stale);
  assert.match(staleHtml, /<button[^>]*disabled=""[^>]*>(?:Copier le message validé|Copy approved message)<\/button>/);
  const suppressed = markup({ ...sample, approvalBlocked: true, tracking: { ...sample.tracking, status: 'do_not_contact' } });
  assert.match(suppressed, /<button[^>]*disabled=""[^>]*>(?:Valider pour envoi manuel|Approve for manual sending)<\/button>/);
  const contact = markup(sample, 'contact'); assert.match(contact, /datetime-local/); assert.match(contact, /Douala/);
  assert.ok(contact.includes(language === 'fr' ? 'Ne plus contacter' : 'Do not contact'));
}
console.log('PASS platform contact UI: FR/EN, manual approval distinction, escaped identities and messages, suppressed/stale actions disabled, contact outcomes and Douala scheduling.');
