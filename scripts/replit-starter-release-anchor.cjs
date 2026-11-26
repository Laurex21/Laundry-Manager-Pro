// Replit preloads this file through a production setting that persists across releases.
const fs = require('node:fs');
const path = require('node:path');
const starterBaseline = '12a8713da902820370191527c96afe31069e5e55';
const relativeOption = '--require=./scripts/replit-starter-release-anchor.cjs';
if ((process.env.NODE_OPTIONS || '').includes(relativeOption)) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS.replace(relativeOption, () => '--require=' + JSON.stringify(__filename));
}

function verifyStarterManifest(manifest) {
  const guard = manifest.starterBrandingReleaseGuard;
  if (!/^[a-f0-9]{40}$/.test(manifest.commit ?? '') || guard?.version !== 1 ||
      guard.baseline !== starterBaseline || guard.commit !== manifest.commit) {
    throw new Error('Publication bloquée : le verrouillage XpressPro de la formule Starter doit être vérifié avant le démarrage.');
  }
}

const root = path.resolve(__dirname, '..');
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'dist/index.cjs')) {
  require('./replit-superadmin-release-anchor.cjs');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/public/build-manifest.json'), 'utf8'));
  verifyStarterManifest(manifest);
  console.log('Starter branding release anchor active: ' + manifest.commit);
}
module.exports = { starterBaseline, verifyStarterManifest };
