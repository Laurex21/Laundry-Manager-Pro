import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const receiptBaseline = 'b55a0a03481156af5cc29a0ce19647477e8e9645';

/** Fail before dist is replaced, including when build.ts is invoked directly. */
export function verifyReceiptRelease(root = projectRoot) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('merge-base', '--is-ancestor', receiptBaseline, 'HEAD');
  } catch {
    throw new Error('Publication bloquée : cette révision ne contient pas les correctifs reçus PR #89 et #90, ou son historique Git est incomplet. Intégrer origin/main (avec son historique complet), puis reconstruire.');
  }
  const lock = JSON.parse(readFileSync(path.join(root, 'scripts/receipt-release-lock.json'), 'utf8'));
  for (const [file, expected] of Object.entries(lock.files)) {
    const actual = createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
    if (actual !== expected) {
      throw new Error(`Publication bloquée : ${file} diffère de la version des reçus validée. Tester les PDF sur mobile et PC, puis faire revoir la mise à jour de scripts/receipt-release-lock.json. Voir docs/releases/replit.md.`);
    }
  }
  console.log('Receipt release guard: validated Android download and complete receipt header.');
  return { version: 1, baseline: receiptBaseline, commit: git('rev-parse', 'HEAD') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { verifyReceiptRelease(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
