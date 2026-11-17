import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from './i18n';
import { NewRegistrations, RevenuePressings } from '../components/platform-admin-follow-up';
import type { DecisionReceipt, DecisionRegistration, RevenueScope } from '../../../shared/platform-admin-decision';

Object.assign(globalThis, { React });
globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN'); };
const receipts: DecisionReceipt[] = [
  { id: 'commercial', organisationId: 1, name: 'Commercial pressing', amount: 10999, paidAt: '2026-11-16T12:00:00Z', planName: 'Pro', kind: 'cycle', pilot: false, period: 'current' },
  { id: 'renewal', organisationId: 2, name: 'Renewing pressing', amount: 18999, paidAt: '2026-11-16T12:00:00Z', planName: 'Business', kind: 'renewal', pilot: false, period: 'current' },
  { id: 'pilot', organisationId: 3, name: 'Pilot pressing', amount: 50, paidAt: '2026-11-16T12:00:00Z', planName: null, kind: 'unknown', pilot: true, period: 'current' },
  { id: 'previous', organisationId: 4, name: 'Previous pressing', amount: 10999, paidAt: '2026-10-10T12:00:00Z', planName: 'Pro', kind: 'cycle', pilot: false, period: 'previous' },
];
const registrations: DecisionRegistration[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1, name: `New pressing ${i + 1}`, createdAt: '2026-11-15T12:00:00Z', ageDays: 2,
  owner: { name: 'Owner <example>', phone: null, email: 'owner@example.invalid' },
  activity: { orders: 0, orders7: 0, activeDays7: 0, firstOrderAt: null, lastOrderAt: null, daysSinceLastOrder: null },
  subscription: { planName: 'Business', status: 'trial', endDate: '2026-11-22T12:00:00Z', source: 'saas', paidAccess: false, hasCommercialPayment: false, lastPaymentAt: null },
  followUp: { status: 'support', reason: 'no_orders' },
}));
for (const language of ['fr', 'en']) {
  await i18n.changeLanguage(language);
  const markup = renderToStaticMarkup(<NewRegistrations registrations={registrations} days={30} open={() => {}} />);
  assert.match(markup, /New pressing 1/);
  assert.match(markup, /New pressing 10/);
  assert.doesNotMatch(markup, /New pressing 11/);
  assert.match(markup, /1–10 \/ 12/);
  assert.match(markup, /owner@example.invalid/);
  assert.match(markup, /Owner &lt;example&gt;/, 'Names are escaped');
  assert.ok(markup.includes(language === 'fr' ? 'À accompagner' : 'Needs support'));
  assert.ok(markup.includes(language === 'fr' ? 'Téléphone non renseigné' : 'Phone unavailable'));
  assert.match(markup, /type="search"/);
  for (const [scope, shown, hidden] of [
    ['commercial', 'Commercial pressing', 'Pilot pressing'],
    ['previous', 'Previous pressing', 'Commercial pressing'],
    ['pilots', 'Pilot pressing', 'Renewing pressing'],
    ['renewals', 'Renewing pressing', 'Commercial pressing'],
  ] as [RevenueScope, string, string][]) {
    const paymentMarkup = renderToStaticMarkup(<RevenuePressings receipts={receipts} scope={scope} setScope={() => {}} open={() => {}} />);
    assert.ok(paymentMarkup.includes(shown));
    assert.ok(!paymentMarkup.includes(hidden));
  }
  const empty = renderToStaticMarkup(<NewRegistrations registrations={[]} days={7} open={() => {}} />);
  assert.ok(empty.includes(language === 'fr' ? 'Aucun pressing' : 'No pressing'));
  const noPayments = renderToStaticMarkup(<RevenuePressings receipts={[]} scope="commercial" setScope={() => {}} open={() => {}} />);
  assert.ok(noPayments.includes(language === 'fr' ? 'Aucun paiement confirmé' : 'No confirmed payment'));
}
console.log('PASS follow-up UI: French/English, named receipts by exact scope, registration pagination, contact fallback, escaping, empty states');
