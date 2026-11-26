import assert from 'node:assert/strict';
import { Router } from 'wouter';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../lib/i18n';
import Subscriptions from './subscriptions';
import { UpgradePrompt } from '../components/upgrade-prompt';
import { subscriptionUiTranslations } from '../lib/subscription-ui-translations';
import { businessLaunchTrial } from '@shared/saas-business-launch';
import type { SaasState } from '@shared/saas-plans';
Object.assign(globalThis, { React });

function render(config: unknown, unavailable = false, saas?: SaasState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, retryOnMount: false } } });
  // This visitor response is still cached when signup navigates without a page reload.
  client.setQueryData(['/api/saas/config'], { enabled: false, signupOffer: { plan: 'business', days: 30 } });
  client.setQueryData(['/api/auth/user'], { id: 'new-owner', saas });
  const accountKey = ['/api/saas/config', 'new-owner'];
  client.setQueryData(accountKey, config);
  if (saas) {
    client.setQueryData(['/api/saas/current'], { state: saas, mode: 'sandbox', sites: [{ id: 1, name: 'Test' }], staff: [], quotas: { sites: 2, staff: 5 }, monthlyXaf: 18999 });
    client.setQueryData(['/api/saas/invoices'], []);
  }
  client.setQueryData(['/api/subscriptions/current', 'new-owner'], { plan: { name: 'Existing Enterprise' }, endDate: '2026-11-22T00:00:00Z' });
  if (unavailable) client.getQueryCache().find({ queryKey: accountKey, exact: true })!.setState({ status: 'error', error: new Error('offline'), data: undefined, fetchStatus: 'idle' });
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><Subscriptions /></QueryClientProvider>);
  client.clear();
  return html;
}
for (const language of ['fr', 'en', 'pt'] as const) {
  await i18n.changeLanguage(language);
  const start = new Date('2026-11-26T12:43:07.035Z');
  const trial = businessLaunchTrial(start, start, [1], []);
  assert.doesNotMatch(render(undefined, false, trial), /subscription-disabled|role="alert"/);
  const active = render({ enabled: true }, false, trial);
  assert.match(active, /Business · (Essai gratuit|Free trial)/);
  assert.doesNotMatch(active, /subscription-disabled|role="alert"/);
  const disabledTrial = render({ enabled: false }, false, trial);
  assert.ok(disabledTrial.includes('Business · ' + subscriptionUiTranslations[language].billing_free_trial));
  assert.ok(disabledTrial.includes(new Date(trial.trialEndsAt!).toLocaleString(i18n.language)));
  assert.doesNotMatch(disabledTrial, /Existing Enterprise|<button/);
  const html = render({ enabled: false, collectionPilot: true });
  assert.match(html, /subscription-disabled/);
  for (const slug of ['starter', 'pro', 'business']) assert.ok(html.includes(`card-plan-${slug}`));
  assert.match(html, /saas-custom-plan/);
  assert.match(html, /Existing Enterprise/);
  assert.ok(html.includes(subscriptionUiTranslations[language].billing_disabled_notice));
  assert.doesNotMatch(html, /checkout\.sandbox|button-confirm-plan-activation|Choisir Pro|Tester le paiement|Create my account|Créer mon compte/);
  assert.equal((html.match(/<button/g) || []).length, 0, 'Disabled catalogue has no activation, checkout or selection buttons');
  const upgrade = renderToStaticMarkup(<Router ssrPath="/analytics"><UpgradePrompt title="Analytics" description={i18n.t('analytics_upgrade_description')} requiredPlan="Pro" /></Router>);
  assert.ok(upgrade.includes(subscriptionUiTranslations[language].view_subscription_plans));
  assert.ok(upgrade.includes(i18n.t('feature_requires_plan', { plan: 'Pro' })));
  const failed = render({ enabled: false }, true);
  assert.ok(failed.includes(subscriptionUiTranslations[language].billing_config_unavailable), language+failed);
  for (const key of ['no_payments', 'service_quantity', 'pieces', 'order_created_history', 'feature_requires_plan', 'analytics_upgrade_description']) assert.ok(i18n.exists(key));
}
console.log('PASS disabled subscription FR/EN/PT: current plan retained, new catalogue, custom preview, no payment/activation controls, stale pilot blocked, configuration failure closed, labels translated');
