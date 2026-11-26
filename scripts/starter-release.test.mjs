import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import starter from './replit-starter-release-anchor.cjs';
import { verifyStarterRelease } from './verify-starter-release.mjs';
import { receiptBaseline } from './verify-receipt-release.mjs';
import { superadminBaseline } from './verify-superadmin-release.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preloads = ['replit-release-anchor.cjs', 'replit-superadmin-release-anchor.cjs', 'replit-starter-release-anchor.cjs'];
const options = preloads.map(file => '--require=./scripts/' + file).join(' ') + ' --no-warnings';

test('rejects old branches, a receipt screen missing its plan and the previous editable Starter settings', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'starter branding test '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  git('clone', '--shared', '--no-checkout', root, '.');
  const baseline = starter.starterBaseline;
  git('checkout', '--detach', baseline + '^1');
  assert.throws(() => verifyStarterRelease(dir), /PR #102/);
  git('checkout', '--detach', baseline);
  const page = path.join(dir, 'client/src/pages/orders.tsx');
  const original = readFileSync(page, 'utf8');
  const changed = original.replace('currentSite, allSites, planSlug)', 'currentSite, allSites)');
  assert.notEqual(changed, original);
  writeFileSync(page, changed);
  assert.throws(() => verifyStarterRelease(dir), /sans sa formule effective/);
  const settings = 'client/src/pages/settings.tsx';
  writeFileSync(path.join(dir, settings), git('show', baseline + '^1:' + settings));
  const testFile = 'client/src/lib/starter-settings-page.test.tsx';
  copyFileSync(path.join(root, testFile), path.join(dir, testFile));
  symlinkSync(realpathSync(path.join(root, 'node_modules')), path.join(dir, 'node_modules'), 'dir');
  const result = spawnSync(process.execPath, ['--import', 'tsx', testFile], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AssertionError/);
});

test('Replit refuses old source and unverified builds, and preserves all three checks in nested Node processes', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'starter runtime '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, 'scripts'));
  mkdirSync(path.join(dir, 'dist/public'), { recursive: true });
  const copy = file => copyFileSync(path.join(root, 'scripts', file), path.join(dir, 'scripts', file));
  const run = args => spawnSync(process.execPath, args, { cwd: dir, env: { NODE_OPTIONS: options }, encoding: 'utf8' });
  preloads.slice(0, 2).forEach(copy);
  const old = run(['-e', 'console.log("started")']);
  assert.notEqual(old.status, 0);
  assert.match(old.stderr, /Cannot find module.*starter-release-anchor/);
  copy(preloads[2]);
  const nested = run(['-e', "require('node:child_process').execFileSync(process.execPath,['-e',\"if (!process.env.NODE_OPTIONS.includes('--no-warnings')) process.exit(1)\"],{cwd:'./dist'})"]);
  assert.equal(nested.status, 0, nested.stderr);
  writeFileSync(path.join(dir, 'dist/index.cjs'), 'console.log("server started")');
  const commit = starter.starterBaseline;
  const guard = baseline => ({ version: 1, baseline, commit });
  const manifest = { commit, receiptReleaseGuard: guard(receiptBaseline), superadminReleaseGuard: guard(superadminBaseline), starterBrandingReleaseGuard: guard(commit) };
  function start(overrides) {
    writeFileSync(path.join(dir, 'dist/public/build-manifest.json'), JSON.stringify({ ...manifest, ...overrides }));
    return run(['dist/index.cjs']);
  }
  for (const overrides of [
    { starterBrandingReleaseGuard: undefined }, { starterBrandingReleaseGuard: { ...guard(commit), version: 0 } },
    { starterBrandingReleaseGuard: guard(superadminBaseline) }, { starterBrandingReleaseGuard: { ...guard(commit), commit: receiptBaseline } },
    { receiptReleaseGuard: undefined }, { superadminReleaseGuard: undefined },
  ]) {
    const rejected = start(overrides);
    assert.notEqual(rejected.status, 0);
    assert.doesNotMatch(rejected.stdout, /server started/);
  }
  const verified = start({});
  assert.equal(verified.status, 0, verified.stderr);
  for (const signal of ['Receipt release anchor active', 'Superadmin release anchor active', 'Starter branding release anchor active', 'server started']) {
    assert.ok(verified.stdout.includes(signal), signal);
  }
});
