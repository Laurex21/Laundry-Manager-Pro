import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import anchor from './replit-phone-login-anchor.cjs';
import { verifyPhoneLoginRelease } from './verify-phone-login-release.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
test('rejects an old checkout, email-only forms and a missing lookup of legacy phone accounts', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'phone login publication '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  git('clone', '--shared', '--no-checkout', root, '.');
  git('checkout', '--detach', anchor.baseline + '^1');
  assert.throws(() => verifyPhoneLoginRelease(dir), /PR #101/);
  // Use the same reviewed snapshot for mutations even as the active branch evolves.
  git('checkout', '--detach', '733d020a4bface689762433135e8850aebef190d');
  symlinkSync(realpathSync(path.join(root, 'node_modules')), path.join(dir, 'node_modules'), 'dir');
  const ui = 'scripts/phone-login-form.test.mjs';
  const api = 'server/lib/phone-and-email-login.integration.test.ts';
  for (const testFile of [ui, api]) copyFileSync(path.join(root, testFile), path.join(dir, testFile));
  const mutations = [
    ['client/src/pages/auth-page.tsx', 'type={tab === "login" ? "text" : "email"}', 'type="email"', ui, new RegExp('/auth must accept this identifier')],
    ['client/src/pages/staff-login.tsx', 'name="identifier" type="text"', 'name="identifier" type="email"', ui, /\/staff-login must accept this identifier/],
    ['server/replit_integrations/auth/routes.ts', 'await authStorage.getUserByLoginPhone(identifier.value)', 'undefined', api, /AUTH_INVALID_CREDENTIALS/],
  ];
  for (const [file, before, after, testFile, expected] of mutations) {
    const source = readFileSync(path.join(dir, file), 'utf8');
    const changed = source.replace(before, after);
    assert.notEqual(changed, source);
    writeFileSync(path.join(dir, file), changed);
    const run = spawnSync(process.execPath, ['--import', 'tsx', testFile], { cwd: dir, encoding: 'utf8',
      env: { PATH: process.env.PATH, NODE_ENV: 'test' }, timeout: 60000 });
    assert.equal(run.status, 1, run.error?.message ?? run.stderr);
    assert.match(run.stderr, expected);
    writeFileSync(path.join(dir, file), source);
  }
});
