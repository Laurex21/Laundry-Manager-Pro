import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import anchor from './replit-starter-release-anchor.cjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blocked = reason => new Error('Publication bloquée : ' + reason);

// Old callers still compile because the settings helper also accepts server-marked
// receipts. While settings load, these screens must pass the signed-in plan.
function verifyReceiptCallers(root) {
  const screens = { 'orders.tsx': 2, 'order-detail.tsx': 1, 'payments.tsx': 2 };
  for (const [name, minimumCalls] of Object.entries(screens)) {
    const source = readFileSync(path.join(root, 'client/src/pages', name), 'utf8');
    const page = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
    let count = 0;
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'receiptSettingsForOrder') {
        const plan = node.arguments[5];
        if (!plan || !ts.isIdentifier(plan) || plan.text !== 'planSlug') throw blocked(name + ' prépare un reçu sans sa formule effective.');
        count++;
      }
      ts.forEachChild(node, visit);
    }
    visit(page);
    if (count < minimumCalls) throw blocked('un parcours de reçu Starter manque dans ' + name);
  }
}

export function verifyStarterRelease(root = projectRoot) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  try { git('merge-base', '--is-ancestor', anchor.starterBaseline, 'HEAD'); }
  catch { throw blocked('la révision validée de la PR #102 est absente. Vérifier la branche et son historique Git.'); }
  verifyReceiptCallers(root);
  for (const test of [
    'client/src/lib/starter-settings-page.test.tsx',
    'server/lib/starter-receipt-rules.test.ts',
    'server/lib/saas-access.integration.test.ts',
  ]) {
    // Integration tests create their own disposable PostgreSQL. Do not pass them
    // the deployment's database URL, billing configuration or credentials.
    execFileSync(process.execPath, ['--import', 'tsx', test], {
      cwd: root, stdio: 'inherit', env: { PATH: process.env.PATH, TZ: 'UTC', NODE_ENV: 'test' },
    });
  }
  return { version: 1, baseline: anchor.starterBaseline, commit: git('rev-parse', 'HEAD') };
}
