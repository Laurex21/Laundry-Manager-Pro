// Replit keeps this preload in production settings, independently of the branch.
const fs = require('node:fs');
const path = require('node:path');
const baseline = '798aa87eec162e69b47ff02cf2232c43115ed86d'; // PR #108 includes #107.
const option = '--require=./scripts/replit-team-invitation-anchor.cjs';
if ((process.env.NODE_OPTIONS || '').includes(option)) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS.replace(option, () => '--require=' + JSON.stringify(__filename));
}

function verifyInvitationManifest(manifest) {
  const guard = manifest.teamInvitationReleaseGuard;
  if (!/^[a-f0-9]{40}$/.test(manifest.commit ?? '') || guard?.version !== 1 ||
      guard.baseline !== baseline || guard.commit !== manifest.commit) {
    throw new Error('Publication bloquée : les invitations par e-mail et WhatsApp doivent être vérifiées avant le démarrage.');
  }
}

const root = path.resolve(__dirname, '..');
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'dist/index.cjs')) {
  require('./replit-starter-release-anchor.cjs');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/public/build-manifest.json'), 'utf8'));
  verifyInvitationManifest(manifest);
  console.log('Team invitation release anchor active: ' + manifest.commit);
}
module.exports = { baseline, verifyInvitationManifest };
