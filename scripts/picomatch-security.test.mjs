import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { securePicomatch, assessAudit, advisory, guard } from './picomatch-security.mjs';

test('every locked copy rejects attack patterns quickly and retains ordinary matching', async () => {
  const paths = await securePicomatch();
  for (const path of paths) {
    const result = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict'), pm = require(process.argv[1]);
      const patterns = ['+(*a)', '+(*)', '*(*)', '*(*a)', '+(?*a)', '+(*?a)', '+([ab]*)', '+(a|aa)', '**/+(*a)', '+(+(*a))'];
      for (const pattern of patterns) for (const options of [{}, {fastpaths:false}, {maxExtglobRecursion:false}, {capture:true}]) {
        const re = pm.makeRe(pattern, options);
        assert.equal(re.test('a'.repeat(4096) + '!'), false, pattern);
        assert.equal(pm(pattern, options)('a'.repeat(4096) + '!'), false, pattern);
        pm.parse(pattern, options);
      }
      assert(pm.isMatch('client/src/pages/admin.tsx', '**/*.{ts,tsx}'));
      assert(!pm.isMatch('client/src/pages/admin.js', '**/*.{ts,tsx}'));
      assert(pm.isMatch('photo.png', '*.@(png|jpg)'));
      assert(pm.isMatch('abab', '+(ab)'));
      assert(pm.isMatch('src/app.ts', '**/!(*.test).ts'));
      assert(!pm.isMatch('src/app.test.ts', '**/!(*.test).ts'));
    `, resolve(path)], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, `${path}: ${result.error ?? result.stderr}`);
  }
});

test('missing patch and tampered source fail closed; application is idempotent', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'picomatch-security-'));
  try {
    const path = 'node_modules/picomatch';
    await cp(path, join(temp, path), { recursive: true });
    const version = JSON.parse(await readFile(join(temp, path, 'package.json'), 'utf8')).version;
    await writeFile(join(temp, 'package-lock.json'), JSON.stringify({ packages: { [path]: {version} } }));
    const file = join(temp, path, 'lib/parse.js'), patched = await readFile(file, 'utf8');
    await writeFile(file, patched.replace(guard, ''));
    await assert.rejects(securePicomatch(temp), /patch missing/);
    // The same regression input hangs the unmodified upstream parser in a bounded subprocess.
    const original = spawnSync(process.execPath, ['-e', "require(process.argv[1]).isMatch('a'.repeat(40)+'!', '+(*a)')", join(temp, path)], { timeout: 500, stdio: 'ignore' });
    assert.equal(original.error?.code, 'ETIMEDOUT');
    await securePicomatch(temp, true); await securePicomatch(temp, true);
    assert.equal(await readFile(file, 'utf8'), patched);
    await writeFile(file, patched + '\n// tampered\n');
    await assert.rejects(securePicomatch(temp), /checksum mismatch/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('audit permits only the exact mitigated advisory and rejects unrelated, missing or expired evidence', () => {
  const report = { auditReportVersion: 2, metadata: { vulnerabilities: { total: 2 } }, vulnerabilities: {
    picomatch: { nodes: ['node_modules/picomatch'], via: [{ name: 'picomatch', dependency: 'picomatch', url: advisory }] },
    vite: { via: ['picomatch'] },
  } };
  const paths = ['node_modules/picomatch'], now = new Date('2026-11-18');
  assert.equal(assessAudit(report, paths, now), 2);
  assert.throws(() => assessAudit(report, [], now), /unpatched/);
  assert.throws(() => assessAudit(report, paths, new Date('2026-12-17')), /deadline/);
  assert.throws(() => assessAudit({ ...report, error: 'offline' }, paths, now), /Incomplete/);
  const unrelated = structuredClone(report); unrelated.vulnerabilities.picomatch.via.push({name:'picomatch',dependency:'picomatch',url:'https://github.com/advisories/another'});
  assert.throws(() => assessAudit(unrelated, paths, now), /Unmitigated/);
  const missing = structuredClone(report); missing.vulnerabilities.vite.via = ['missing'];
  assert.throws(() => assessAudit(missing, paths, now), /Unmitigated/);
});
