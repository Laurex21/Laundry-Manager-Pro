import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const superadminBaseline = '2783e45118028dce5dc895332920ce1a1ea4df8d';
const protectedFiles = [
  'client/src/components/admin-organisation-capacity.tsx',
  'server/lib/platform-admin-capacity.ts',
  'shared/admin-capacity.ts',
];
const blocked = message => new Error(`Publication bloquée : ${message} Voir docs/releases/replit.md.`);

// Check the actual JSX, so an unused import or a commented-out panel cannot pass.
// Other changes to the large superadmin page do not require a new capacity lock.
export function verifyCapacityPanel(source) {
  const file = ts.createSourceFile('platform-admin.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imported = file.statements.find(node => ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === '@/components/admin-organisation-capacity');
  const localName = imported?.importClause?.name?.text;
  let mounted = false;
  function visit(node) {
    if (localName && ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === localName &&
        node.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText(file) === 'organisationId' &&
          prop.initializer && ts.isJsxExpression(prop.initializer) && prop.initializer.expression?.getText(file) === 'subscriber.id')) {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(file) === 'TabsContent' &&
            parent.openingElement.attributes.properties.some(prop => ts.isJsxAttribute(prop) &&
              prop.name.getText(file) === 'value' && prop.initializer && ts.isStringLiteral(prop.initializer) && prop.initializer.text === 'subscription')) mounted = true;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!mounted) throw blocked('le récapitulatif et l’activation manuelle ne sont plus intégrés à la fiche organisation.');
}

export function verifySuperadminRelease(root = projectRoot) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try { git('merge-base', '--is-ancestor', superadminBaseline, 'HEAD'); }
  catch { throw blocked('cette révision ne contient pas les correctifs superadmin de PR #88, ou son historique Git est incomplet. Intégrer origin/main avec son historique complet.'); }
  const lock = JSON.parse(readFileSync(path.join(root, 'scripts/superadmin-release-lock.json'), 'utf8'));
  if (JSON.stringify(Object.keys(lock.files ?? {}).sort()) !== JSON.stringify([...protectedFiles].sort())) {
    throw blocked('la liste des fichiers superadmin protégés est incomplète ou invalide.');
  }
  for (const file of protectedFiles) {
    const actual = createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
    if (actual !== lock.files[file]) throw blocked(`${file} diffère de la version superadmin validée. Tester le récapitulatif et les attributions manuelles, puis faire revoir les empreintes concernées.`);
  }
  verifyCapacityPanel(readFileSync(path.join(root, 'client/src/pages/platform-admin.tsx'), 'utf8'));
  console.log('Superadmin release guard: validated capacity recap, cost and manual site/staff activation.');
  return { version: 1, baseline: superadminBaseline, commit: git('rev-parse', 'HEAD') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { verifySuperadminRelease(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
