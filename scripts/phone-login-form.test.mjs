import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<main></main>', { url: 'https://xpresspro.example.invalid/auth' });
for (const key of ['window', 'document', 'navigator', 'location', 'HTMLElement', 'Event', 'localStorage']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
globalThis.React = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { Router } = await import('wouter');
const { memoryLocation } = await import('wouter/memory-location');
const { QueryClientProvider } = await import('@tanstack/react-query');
const { queryClient } = await import('../client/src/lib/queryClient.ts');
const { default: i18n } = await import('../client/src/lib/i18n.ts');
const { default: OwnerLogin } = await import('../client/src/pages/auth-page.tsx');
const { default: StaffLogin } = await import('../client/src/pages/staff-login.tsx');

const { act, createElement: h } = React;
const authKey = ['/api/auth/user'];
const localPassword = 'Fixture password with spaces ';
async function checkForm(Page, path, endpoint, destination, identifier) {
  const router = memoryLocation({ path, record: true });
  queryClient.setQueryData(authKey, null);
  const root = createRoot(document.querySelector('main'));
  const requests = [];
  const signedIn = { id: 'existing-fixture', userType: Page === OwnerLogin ? 'owner' : 'staff' };
  window.fetch = globalThis.fetch = async (url, options) => {
    requests.push({ url, method: options?.method, credentials: options?.credentials, body: JSON.parse(options.body) });
    return Response.json(signedIn);
  };
  try {
    await act(async () => root.render(h(Router, { hook: router.hook, searchHook: () => '' },
      h(QueryClientProvider, { client: queryClient }, h(Page)))));
    const input = document.querySelector('input[autocomplete="username"]');
    assert.ok(input?.labels?.[0]?.textContent.includes('téléphone'), path + ' must offer phone login');
    const password = input.form.querySelector('input[type="password"]');
    await act(async () => {
      for (const [field, value] of [[input, identifier], [password, localPassword]]) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(field, value);
        field.dispatchEvent(new window.Event('input', { bubbles: true }));
      }
    });
    assert.ok(input.form.checkValidity(), path + ' must accept this identifier');
    await act(async () => input.form.querySelector('button[type="submit"]').click());
    assert.deepEqual(requests, [{ url: endpoint, method: 'POST', credentials: 'include',
      body: { identifier, password: localPassword } }]);
    assert.equal(queryClient.getQueryData(authKey)?.id, signedIn.id);
    assert.equal(router.history.at(-1), destination);
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
  }
}

try {
  await i18n.changeLanguage('fr');
  for (const identifier of ['+237 600 000 001', 'agent@example.invalid']) {
    await checkForm(OwnerLogin, '/auth', '/api/auth/login', '/', identifier);
    await checkForm(StaffLogin, '/staff-login', '/api/staff/login', '/dashboard', identifier);
  }
  console.log('PASS owner and staff forms submit phone or email, keep the password intact and enter the app.');
} finally {
  dom.window.close();
}
