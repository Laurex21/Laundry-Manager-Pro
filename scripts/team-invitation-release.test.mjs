import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import anchor from './replit-team-invitation-anchor.cjs';
import { verifyTeamInvitationRelease } from './verify-team-invitation-release.mjs';
import { receiptBaseline } from './verify-receipt-release.mjs';
import { superadminBaseline } from './verify-superadmin-release.mjs';
import starter from './replit-starter-release-anchor.cjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'xpresspro invitation test '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('rejects the old phone-only branch and UI regressions in a descendant', t => {
  const dir = fixture(t);
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  git('clone', '--shared', '--no-checkout', root, '.');
  git('checkout', '--detach', anchor.baseline + '^1^1');
  assert.throws(() => verifyTeamInvitationRelease(dir), /PR #107/);
  git('checkout', '--detach', anchor.baseline);
  symlinkSync(realpathSync(path.join(root, 'node_modules')), path.join(dir, 'node_modules'), 'dir');
  const formTest = 'scripts/team-invitation-form.test.mjs';
  copyFileSync(path.join(root, formTest), path.join(dir, formTest));
  const page = path.join(dir, 'client/src/pages/settings.tsx');
  const valid = readFileSync(page, 'utf8');
  for (const [before, after, failure] of [
    ['id="invite-identifier"\n                type="email"', 'id="invite-identifier"\n                type="tel"', /requires an email input/],
    ['|| !validInviteEmail || invalidInvitePhone', '|| !inviteForm.notificationPhone || !validInviteEmail || invalidInvitePhone', /Email alone must enable/],
    ['openWhatsApp({ phone, text: invitationMessage(invitation) })', 'openWhatsApp({ phone, text: invitationMessage(invitation) + "/other" })', /same message and link/],
  ]) {
    const changed = valid.replace(before, after);
    assert.notEqual(changed, valid);
    writeFileSync(page, changed);
    const result = spawnSync(process.execPath, ['--import', 'tsx', formTest], {
      cwd: dir, encoding: 'utf8', timeout: 30_000, env: { PATH: process.env.PATH, NODE_ENV: 'test' },
    });
    assert.equal(result.status, 1, result.error?.message ?? result.stderr);
    assert.match(result.stderr, failure);
  }
});

test('Replit preload blocks old source and stale manifests before server startup', t => {
  const dir = fixture(t);
  mkdirSync(path.join(dir, 'scripts'));
  mkdirSync(path.join(dir, 'dist/public'), { recursive: true });
  writeFileSync(path.join(dir, 'dist/index.cjs'), 'console.log("server started")');
  const last = 'replit-team-invitation-anchor.cjs';
  const preloads = ['replit-release-anchor.cjs', 'replit-superadmin-release-anchor.cjs', 'replit-starter-release-anchor.cjs', last];
  const copy = file => copyFileSync(path.join(root, 'scripts', file), path.join(dir, 'scripts', file));
  const run = args => spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8',
    env: { NODE_OPTIONS: preloads.map(f => '--require=./scripts/' + f).join(' ') + ' --no-warnings' } });
  preloads.slice(0, -1).forEach(copy);
  const old = run(['-e', 'console.log("starting build")']);
  assert.notEqual(old.status, 0);
  assert.match(old.stderr, /Cannot find module.*replit-team-invitation-anchor/);
  copy(last);
  const nested = run(['-e', "require('node:child_process').execFileSync(process.execPath, ['-e', \"if (!process.env.NODE_OPTIONS.includes('--no-warnings')) process.exit(1)\"], { cwd: './dist' })"]);
  assert.equal(nested.status, 0, nested.stderr);
  const commit = anchor.baseline;
  const guard = baseline => ({ version: 1, commit, baseline });
  const manifest = { commit, receiptReleaseGuard: guard(receiptBaseline), superadminReleaseGuard: guard(superadminBaseline),
    starterBrandingReleaseGuard: guard(starter.starterBaseline), teamInvitationReleaseGuard: guard(anchor.baseline) };
  function start(overrides) {
    writeFileSync(path.join(dir, 'dist/public/build-manifest.json'), JSON.stringify({ ...manifest, ...overrides }));
    return run(['dist/index.cjs']);
  }
  for (const invalid of [undefined, { ...guard(commit), version: 0 }, guard(receiptBaseline), { ...guard(commit), commit: receiptBaseline }]) {
    const rejected = start({ teamInvitationReleaseGuard: invalid });
    assert.notEqual(rejected.status, 0);
    assert.doesNotMatch(rejected.stdout, /server started/);
  }
  const verified = start({});
  assert.equal(verified.status, 0, verified.stderr);
  assert.match(verified.stdout, /Team invitation release anchor active/);
  assert.match(verified.stdout, /server started/);
});
