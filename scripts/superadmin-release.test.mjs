import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { superadminBaseline, verifyCapacityPanel, verifySuperadminRelease } from './verify-superadmin-release.mjs';
import { receiptBaseline } from './verify-receipt-release.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = () => mkdtempSync(path.join(tmpdir(), 'superadmin release '));
const options = '--require=./scripts/replit-release-anchor.cjs --require=./scripts/replit-superadmin-release-anchor.cjs --no-warnings';

test('rejects the pre-PR88 release and changed capacity UI, calculation or grant despite correct ancestry', () => {
  const fixture = temporary();
  const git = (...args) => execFileSync('git', args, { cwd: fixture, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git('clone', '--shared', '--no-checkout', root, '.');
    git('checkout', '--detach', `${superadminBaseline}^1`);
    assert.throws(() => verifySuperadminRelease(fixture), /PR #88/);
    git('checkout', '--detach', '7317d1bd6fa0df0d1f7b804b6f7684361243d296');
    copyFileSync(path.join(root, 'scripts/superadmin-release-lock.json'), path.join(fixture, 'scripts/superadmin-release-lock.json'));
    assert.equal(verifySuperadminRelease(fixture).baseline, superadminBaseline);
    const mutations = [
      ['client/src/components/admin-organisation-capacity.tsx', '<CapacityActivation', '<RemovedCapacityActivation'],
      ['server/lib/platform-admin-capacity.ts', 'paymentRecorded: false', 'paymentRecorded: true'],
      ['shared/admin-capacity.ts', 'selection.extraSites * 2', 'selection.extraSites * 0'],
    ];
    for (const [file, before, after] of mutations) {
      const target = path.join(fixture, file), original = readFileSync(target, 'utf8');
      assert.ok(original.includes(before));
      writeFileSync(target, original.replace(before, after));
      assert.throws(() => verifySuperadminRelease(fixture), /diffère de la version superadmin validée/);
      writeFileSync(target, original);
    }
    const lockFile = path.join(fixture, 'scripts/superadmin-release-lock.json');
    writeFileSync(lockFile, JSON.stringify({ files: {} }));
    assert.throws(() => verifySuperadminRelease(fixture), /liste des fichiers superadmin protégés/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('an unused or commented-out panel cannot pass; unrelated page edits remain possible', () => {
  const source = readFileSync(path.join(root, 'client/src/pages/platform-admin.tsx'), 'utf8');
  verifyCapacityPanel(source + '\n// Unrelated superadmin change\n');
  const mount = '<AdminOrganisationCapacity organisationId={subscriber.id} />';
  assert.ok(source.includes(mount));
  for (const replacement of ['', `{/* ${mount} */}`, '<AdminOrganisationCapacity organisationId={0} />']) {
    assert.throws(() => verifyCapacityPanel(source.replace(mount, replacement)), /ne sont plus intégrés/);
  }
});

test('production preloads reject old receipt-only source and support children in other directories', () => {
  const fixture = temporary();
  const env = { ...process.env, NODE_OPTIONS: options };
  const run = args => spawnSync(process.execPath, args, { cwd: fixture, env, encoding: 'utf8' });
  try {
    mkdirSync(path.join(fixture, 'scripts'));
    copyFileSync(path.join(root, 'scripts/replit-release-anchor.cjs'), path.join(fixture, 'scripts/replit-release-anchor.cjs'));
    assert.notEqual(run(['-e', 'console.log("old receipt-only release")']).status, 0);
    copyFileSync(path.join(root, 'scripts/replit-superadmin-release-anchor.cjs'), path.join(fixture, 'scripts/replit-superadmin-release-anchor.cjs'));
    mkdirSync(path.join(fixture, 'node_modules/child'), { recursive: true });
    const result = run(['-e', `
      console.log(require('node:child_process').execFileSync(process.execPath, ['-e', 'console.log("child OK")'], {cwd:'./node_modules/child',encoding:'utf8'}));
      if (!process.env.NODE_OPTIONS.includes('--no-warnings')) process.exit(9);
    `]);
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /child OK/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('runtime requires both verified manifests, without Git, network or dev dependencies', () => {
  const fixture = temporary();
  try {
    mkdirSync(path.join(fixture, 'scripts'));
    mkdirSync(path.join(fixture, 'dist/public'), { recursive: true });
    for (const file of ['replit-release-anchor.cjs', 'replit-superadmin-release-anchor.cjs']) copyFileSync(path.join(root, 'scripts', file), path.join(fixture, 'scripts', file));
    writeFileSync(path.join(fixture, 'dist/index.cjs'), 'console.log("server started")');
    const commit = '7317d1bd6fa0df0d1f7b804b6f7684361243d296';
    const receiptReleaseGuard = { version: 1, baseline: receiptBaseline, commit };
    const superadminReleaseGuard = { version: 1, baseline: superadminBaseline, commit };
    const run = manifest => {
      writeFileSync(path.join(fixture, 'dist/public/build-manifest.json'), JSON.stringify(manifest));
      return spawnSync(process.execPath, ['dist/index.cjs'], { cwd: fixture, env: { ...process.env, NODE_OPTIONS: options }, encoding: 'utf8' });
    };
    for (const manifest of [
      { commit, receiptReleaseGuard },
      { commit, superadminReleaseGuard },
      { commit, receiptReleaseGuard, superadminReleaseGuard: { ...superadminReleaseGuard, commit: receiptBaseline } },
    ]) assert.notEqual(run(manifest).status, 0);
    const result = run({ commit, receiptReleaseGuard, superadminReleaseGuard });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Receipt release anchor active/);
    assert.match(result.stdout, /Superadmin release anchor active/);
    assert.match(result.stdout, /server started/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
