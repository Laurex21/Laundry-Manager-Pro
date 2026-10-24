import assert from 'node:assert/strict';
import { Router } from 'wouter';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../lib/i18n';
import Subscriptions from './subscriptions';
import { UpgradePrompt } from '../components/upgrade-prompt';
import { subscriptionUiTranslations } from '../lib/subscription-ui-translations';
Object.assign(globalThis, { React });

function render(config: unknown, unavailable = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, retryOnMount: false } } });
  client.setQueryData(['/api/saas/config'], config);
  client.setQueryData(['/api/subscriptions/current'], { plan: { name: 'Existing Enterprise' }, endDate: '2026-11-22T00:00:00Z' });
  if (unavailable) client.getQueryCache().find({ queryKey: ['/api/saas/config'] })!.setState({ status: 'error', error: new Error('offline'), data: undefined, fetchStatus: 'idle' });
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><Subscriptions /></QueryClientProvider>);
  client.clear();
  return html;
}
for (const language of ['fr', 'en', 'pt'] as const) {
  await i18n.changeLanguage(language);
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
