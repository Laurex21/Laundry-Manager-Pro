import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import React from 'react';
import { newTeamInvitation } from '../shared/team-invitation.ts';

// Mount the real settings screen and WhatsApp launcher. Use an in-memory API
// and capture window.open so this test can run inside a production build.
const dom = new JSDOM('<div id="app"></div>', { url: 'https://pressing.example.invalid/settings', pretendToBeVisual: true });
const { window } = dom;
for (const key of ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'HTMLInputElement',
  'HTMLSelectElement', 'Element', 'Node', 'NodeFilter', 'MutationObserver', 'CustomEvent',
  'Event', 'DocumentFragment', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true });
}
globalThis.React = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { default: Settings } = await import('../client/src/pages/settings.tsx');
const { WhatsAppLauncherProvider } = await import('../client/src/components/whatsapp-launcher.tsx');
const { default: i18n } = await import('../client/src/lib/i18n.ts');
await i18n.changeLanguage('fr');

const pending = [];
const launched = [];
const copiedLinks = [];
Object.defineProperty(window.navigator, 'clipboard', { value: { async writeText(value) { copiedLinks.push(value); } } });
window.open = url => { launched.push(new URL(url)); return null; };
const client = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity }, queries: {
  staleTime: Infinity, gcTime: Infinity, retry: false,
  queryFn: async ({ queryKey: [path] }) => (await fetch(path)).json(),
} } });
client.setQueryData(['/api/auth/user'], { id: 'test-owner', role: 'owner', planSlug: 'pro' });
client.setQueryData(['/api/settings', 'pro'], { whatsappAppPreference: 'whatsapp' });
client.setQueryData(['/api/sites'], [{ id: 1, name: 'Site test' }]);
globalThis.fetch = window.fetch = async (path, init) => {
  if (path === '/api/sites/1/members') return Response.json([]);
  if (path === '/api/invitations/pending') return Response.json(pending);
  assert.equal(path, '/api/invitations', 'Unexpected network request');
  assert.equal(init.method, 'POST');
  const fields = newTeamInvitation.parse(JSON.parse(init.body));
  const id = pending.length + 1;
  const invitation = { ...fields, id, token: 'test-issued-token-' + id, siteName: 'Site test',
    expiresAt: new Date(Date.now() + 86400000).toISOString() };
  pending.push(invitation);
  return Response.json(invitation, { status: 201 });
};

const { act, createElement: h } = React;
const root = createRoot(document.querySelector('#app'));
const byId = id => document.querySelector('[data-testid="' + id + '"]');
function fill(input, value) {
  // Dispatch a native input event as a user edit, including React's onChange.
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}
async function waitForElement(selector) {
  for (let i = 0; i < 40; i++) {
    const element = document.querySelector(selector);
    if (element) return element;
    await act(() => delay(10));
  }
  assert.fail('Missing invitation control: ' + selector);
}
function checkEmail(container, email, url) {
  const link = container.querySelector('a[href^="mailto:"]');
  assert.ok(link, 'Sharing by email must be available');
  const mail = new URL(link.href);
  assert.equal(decodeURIComponent(mail.pathname), email);
  const message = mail.searchParams.get('body');
  assert.deepEqual(message?.match(/https?:\/\/\S+/g), [url], 'Email must contain exactly the issued link');
  return message;
}
function checkWhatsApp(message) {
  const sent = launched.at(-1);
  assert.equal(sent?.origin, 'https://wa.me');
  assert.equal(sent.pathname, '/12025550142');
  assert.equal(sent.searchParams.get('text'), message, 'WhatsApp and email must contain the same message and link');
}

try {
  await act(async () => root.render(h(QueryClientProvider, { client }, h(WhatsAppLauncherProvider, null, h(Settings)))));
  await act(async () => byId('tab-team').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 })));
  for (const [email, phone] of [['agent@example.invalid', ''], ['agent+whatsapp@example.invalid', '+1 202 555 0142']]) {
    const invite = await waitForElement('[data-testid="button-invite-first-1"]');
    await act(async () => invite.click());
    const address = byId('input-invite-identifier');
    const number = byId('input-invite-notification-phone');
    assert.equal(address?.type, 'email', 'The invitation form requires an email input');
    assert.equal(number?.type, 'tel');
    assert.equal(number.required, false);
    assert.equal(byId('button-send-invite').disabled, true);
    await act(async () => fill(address, email));
    assert.equal(byId('button-send-invite').disabled, false, 'Email alone must enable creation');
    if (phone) await act(async () => fill(number, phone));
    await act(async () => byId('button-send-invite').click());
    const copied = await waitForElement('[role="dialog"] input[readonly]');
    const issued = pending.at(-1);
    assert.equal(issued.identifier, email);
    assert.equal(issued.notificationPhone, phone ? '12025550142' : null);
    const url = window.location.origin + '/join/' + issued.token;
    assert.equal(copied.value, url);
    assert.equal(copiedLinks.at(-1), url);
    const dialog = copied.closest('[role="dialog"]');
    const message = checkEmail(dialog, email, url);
    const share = byId('button-whatsapp-created-invite');
    assert.equal(Boolean(share), Boolean(phone));
    if (phone) {
      await act(async () => share.click());
      checkWhatsApp(message);
    } else {
      await act(async () => dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    }
    const row = await waitForElement('[data-testid="row-invite-' + issued.id + '"]');
    assert.equal(checkEmail(row, email, url), message);
    const notify = byId('button-whatsapp-invite-' + issued.id);
    assert.equal(Boolean(notify), Boolean(phone));
    if (phone) {
      await act(async () => notify.click());
      checkWhatsApp(message);
    }
  }
  assert.equal(launched.length, 2);
  console.log('PASS: email-only form, optional WhatsApp, identical issued links on creation and pending invitations.');
} finally {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
}
