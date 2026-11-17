import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const advisory = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
export const reviewDeadline = '2026-12-17T00:00:00Z';
const originalHashes = {
  '2.3.2': '3a91656f440069aa8f8e15c9d695b9f6b2209df1eab2be8127c72cbcca45ff5f',
  '4.0.4': 'ce57c04e04994b83e2ca566170fa192e6fe19d710bea6da00ce2f76d01c0dea4',
};
const anchor = 'const analyzeRepeatedExtglob = (body, options) => {\n';
export const guard = `  // XpressPro GHSA-fc5q-39xc-vjpf: only repeat one non-empty literal branch.
  // All other repeated extglobs use the upstream literalisation path.
  // Deliberately runs before maxExtglobRecursion, including its false opt-out.
  if (body.length === 0 || body.includes('|') || !isPlainBranch(body)) {
    return { risky: true };
  }

`;
const sha = text => createHash('sha256').update(text).digest('hex');
async function installed(root) {
  const found = [];
  async function packageDir(dir, relative) {
    if (relative.endsWith('/picomatch')) found.push(relative);
    await modules(join(dir, 'node_modules'), `${relative}/node_modules`);
  }
  async function modules(dir, relative) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name.startsWith('@')) {
        for (const scoped of await readdir(join(dir, entry.name)))
          await packageDir(join(dir, entry.name, scoped), `${relative}/${entry.name}/${scoped}`);
      } else await packageDir(join(dir, entry.name), `${relative}/${entry.name}`);
    }
  }
  await modules(join(root, 'node_modules'), 'node_modules');
  return found.sort();
}
export async function securePicomatch(root = process.cwd(), apply = false) {
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  const paths = Object.keys(lock.packages).filter(p => p.endsWith('/picomatch')).sort();
  if (!paths.length || JSON.stringify(paths) !== JSON.stringify(await installed(root)))
    throw Error('Picomatch installed inventory differs from lockfile; review required');
  const files = [];
  for (const path of paths) {
    const version = JSON.parse(await readFile(join(root, path, 'package.json'), 'utf8')).version;
    const expected = originalHashes[version];
    if (!expected || version !== lock.packages[path].version) throw Error(`Unreviewed picomatch version: ${path}`);
    const file = join(root, path, 'lib/parse.js'), source = await readFile(file, 'utf8');
    const patched = source.includes(anchor + guard);
    const original = patched ? source.replace(anchor + guard, anchor) : source;
    if (sha(original) !== expected || original.split(anchor).length !== 2)
      throw Error(`Picomatch source checksum mismatch: ${path}`);
    if (!patched && !apply) throw Error(`Picomatch security patch missing: ${path}`);
    files.push({ file, source: original.replace(anchor, anchor + guard), patched });
  }
  // Verify every copy before changing any of them.
  if (apply) for (const file of files) if (!file.patched) await writeFile(file.file, file.source);
  return paths;
}

export function assessAudit(report, patchedPaths, now = new Date()) {
  if (report.auditReportVersion !== 2 || report.error || !report.vulnerabilities || !report.metadata?.vulnerabilities)
    throw Error('Incomplete npm audit report');
  const vulnerabilities = report.vulnerabilities;
  if (Object.keys(vulnerabilities).length && now >= new Date(reviewDeadline)) throw Error('Picomatch mitigation review deadline reached');
  const memo = new Map();
  function covered(name, visiting = new Set()) {
    if (memo.has(name)) return memo.get(name);
    if (visiting.has(name)) return false;
    const row = vulnerabilities[name];
    if (!row || !Array.isArray(row.via) || !row.via.length) return false;
    const chain = new Set(visiting).add(name);
    const ok = row.via.every(v => typeof v === 'string' ? covered(v, chain)
      : name === 'picomatch' && v.name === 'picomatch' && v.dependency === 'picomatch' && v.url === advisory);
    memo.set(name, ok); return ok;
  }
  for (const name of Object.keys(vulnerabilities)) if (!covered(name)) throw Error(`Unmitigated security advisory: ${name}`);
  if (vulnerabilities.picomatch) {
    const nodes = vulnerabilities.picomatch.nodes;
    if (!Array.isArray(nodes) || !nodes.length || nodes.some(n => !patchedPaths.includes(n))) throw Error('Audit includes an unpatched picomatch copy');
  }
  if (report.metadata.vulnerabilities.total > 0 && !Object.keys(vulnerabilities).length) throw Error('Audit totals disagree with details');
  return Object.keys(vulnerabilities).length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = await securePicomatch(process.cwd(), process.argv.includes('--apply'));
  console.log(`Verified picomatch mitigation in ${paths.length} locked copies.`);
}
