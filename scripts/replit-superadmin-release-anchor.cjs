// An additional production NODE_OPTIONS preload keeps old receipt-only releases
// from bypassing the superadmin guard. Never access Git, network or dev packages here.
const path = require('node:path');
const fs = require('node:fs');
const relativeOption = '--require=./scripts/replit-superadmin-release-anchor.cjs';
if ((process.env.NODE_OPTIONS || '').includes(relativeOption)) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS.replace(relativeOption, `--require=${JSON.stringify(__filename)}`);
}
// Preserve the receipt protection even if only this new preload is configured.
require('./replit-release-anchor.cjs');

const root = path.resolve(__dirname, '..');
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'dist/index.cjs')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/public/build-manifest.json'), 'utf8'));
  const guard = manifest.superadminReleaseGuard;
  if (guard?.version !== 1 || guard.baseline !== '2783e45118028dce5dc895332920ce1a1ea4df8d' || guard.commit !== manifest.commit) {
    throw new Error('Publication bloquée : reconstruire cette version avec le contrôle du récapitulatif et des activations manuelles superadmin.');
  }
  console.log(`Superadmin release anchor active: ${manifest.commit}`);
}
