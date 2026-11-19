import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CapacityRecap, capacityError } from '../components/admin-organisation-capacity';
import { capacityCost, type CapacitySummary } from '../../../shared/admin-capacity';
Object.assign(globalThis, { React });
globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN'); };
const data: CapacitySummary = {
  organisationId: 1, fingerprint: 'synthetic', phase: 'starter', endsAt: null,
  current: capacityCost({ plan: 'starter', extraSites: 0, extraStaff: 0 }), usedSites: 1, usedStaff: 0,
  sites: [{ id: 1, name: 'Fictitious site', available: true, enabled: true }],
  staff: [{ id: 'unassigned', name: 'Unassigned', siteIds: [], enabled: false }], next: null,
  activationBlockedReason: 'ADMIN_ACTIVE_PLAN_REQUIRED',
  latestInvoice: { id: 'synthetic', status: 'failed', createdAt: '2026-11-19T10:30:00Z', paidAt: null,
    cost: capacityCost({ plan: 'pro', extraSites: 0, extraStaff: 2 }),
    lines: [{ label: 'plan', quantity: 1, amountXaf: 10999 }, { label: 'staff', quantity: 2, amountXaf: 4000 }],
    originalXaf: 14999, discountXaf: 2249, totalXaf: 12750, promoCode: 'SYNTHETIC15', durationMonths: 1 },
};
for (const fr of [true, false]) {
  const html = renderToStaticMarkup(<CapacityRecap data={data} fr={fr}/>).replaceAll('\u202f', '').replaceAll(',', '');
  assert.match(html, /12750 FCFA/); assert.match(html, /2249 FCFA/); assert.match(html, /4000 FCFA/);
  assert.match(html, /SYNTHETIC15/); assert.match(html, /Starter/);
  assert.ok(html.includes(fr ? 'Paiement non abouti' : 'Payment unsuccessful'));
  assert.ok(html.includes(fr ? 'ne prouvent pas' : 'do not prove'));
  assert.ok(html.includes(fr ? 'Le propriétaire ne compte pas' : 'The owner does not use'));
  assert.ok(html.includes(fr ? 'accès utilisés / autorisés' : 'access in use / authorised'));
  const bundled = renderToStaticMarkup(<CapacityRecap data={{ ...data, phase: 'active', current: capacityCost({ plan: 'business', extraSites: 1, extraStaff: 2 }) }} fr={fr}/>);
  assert.ok(bundled.includes(fr ? 'Inclus avec les boutiques supplémentaires' : 'Bundled with additional sites'));
  const trial = renderToStaticMarkup(<CapacityRecap data={{ ...data, phase: 'trialing' }} fr={fr}/>);
  assert.ok(trial.includes(fr ? 'Capacité de l’essai gratuit' : 'Free trial capacity'));
  const unknown = renderToStaticMarkup(<CapacityRecap data={{ ...data, current: null, latestInvoice: null, activationBlockedReason: 'ADMIN_ORGANISATION_EXCLUDED' }} fr={fr}/>);
  assert.ok(unknown.includes(capacityError('ADMIN_ORGANISATION_EXCLUDED', fr)));
  assert.ok(!unknown.includes('0 / 0'));
  assert.doesNotMatch(capacityError('PRIVATE_DATABASE_ERROR', fr), /PRIVATE_DATABASE_ERROR/);
}
console.log('PASS capacity UI: FR/EN, registered vs used vs authorised, owner excluded, separate failed quote/promo, bundled staff, trial and excluded states, safe errors.');
