import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { receiptBaseline, verifyReceiptRelease } from './verify-receipt-release.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = () => mkdtempSync(path.join(tmpdir(), 'receipt release '));

test('rejects the actual pre-fix releases and a reverted header despite correct ancestry', () => {
  const fixture = temporary();
  const git = (...args) => execFileSync('git', args, { cwd: fixture, stdio: 'pipe' });
  try {
    git('clone', '--shared', '--no-checkout', root, '.');
    for (const revision of ['c8f4212', '0bddd9e93a2c466270955dbbf06c3188e018fc0f']) {
      git('checkout', '--detach', revision);
      assert.throws(() => verifyReceiptRelease(fixture), /Publication bloquée/);
    }
    git('checkout', '--detach', receiptBaseline);
    copyFileSync(path.join(root, 'scripts/receipt-release-lock.json'), path.join(fixture, 'scripts/receipt-release-lock.json'));
    assert.equal(verifyReceiptRelease(fixture).commit, receiptBaseline);
    const exportFile = path.join(fixture, 'client/src/lib/receipt-export.ts');
    const reviewed = readFileSync(exportFile, 'utf8');
    writeFileSync(exportFile, reviewed.replace('doc.body.replaceChildren(receipt);', ''));
    assert.throws(() => verifyReceiptRelease(fixture), /receipt-export.ts diffère/);
    writeFileSync(exportFile, reviewed);
    const requestFile = path.join(fixture, 'client/src/lib/receipt-request.ts');
    writeFileSync(requestFile, readFileSync(requestFile, 'utf8').replace('20_000', 'Infinity'));
    assert.throws(() => verifyReceiptRelease(fixture), /receipt-request.ts diffère/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('persistent NODE_OPTIONS rejects source without anchor and supports npm children in other directories', () => {
  const fixture = temporary();
  const env = { ...process.env, NODE_OPTIONS: '--require=./scripts/replit-release-anchor.cjs --no-warnings' };
  const run = (args) => spawnSync(process.execPath, args, { cwd: fixture, env, encoding: 'utf8' });
  try {
    assert.notEqual(run(['-e', 'console.log("old release")']).status, 0);
    mkdirSync(path.join(fixture, 'scripts'));
    mkdirSync(path.join(fixture, 'node_modules/child'), { recursive: true });
    copyFileSync(path.join(root, 'scripts/replit-release-anchor.cjs'), path.join(fixture, 'scripts/replit-release-anchor.cjs'));
    const result = run(['-e', `
      const {execFileSync} = require('node:child_process');
      console.log(execFileSync(process.execPath, ['-e', 'console.log("child OK")'], { cwd: './node_modules/child', encoding: 'utf8' }));
      if (!process.env.NODE_OPTIONS.includes('--no-warnings')) process.exit(9);
    `]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /child OK/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('cold start needs a verified build but no Git history, network or dev dependencies', () => {
  const fixture = temporary();
  try {
    mkdirSync(path.join(fixture, 'scripts'));
    mkdirSync(path.join(fixture, 'dist/public'), { recursive: true });
    copyFileSync(path.join(root, 'scripts/replit-release-anchor.cjs'), path.join(fixture, 'scripts/replit-release-anchor.cjs'));
    writeFileSync(path.join(fixture, 'dist/index.cjs'), 'console.log("server started")');
    const run = () => spawnSync(process.execPath, ['dist/index.cjs'], { cwd: fixture, env: { ...process.env, NODE_OPTIONS: '--require=./scripts/replit-release-anchor.cjs' }, encoding: 'utf8' });
    const manifestFile = path.join(fixture, 'dist/public/build-manifest.json');
    writeFileSync(manifestFile, JSON.stringify({ commit: receiptBaseline }));
    assert.notEqual(run().status, 0);
    writeFileSync(manifestFile, JSON.stringify({ commit: receiptBaseline, receiptReleaseGuard: { version: 1, baseline: receiptBaseline, commit: receiptBaseline } }));
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /server started/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
