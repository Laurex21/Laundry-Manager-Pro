const fs = require('node:fs');
const path = require('node:path');
const baseline = 'ca931841748bb500a21f2b413f8a914c377bc334'; // Restoration of phone login, PR #101.
const option = '--require=./scripts/replit-phone-login-anchor.cjs';
// npm starts child processes in other directories during a Replit build.
if ((process.env.NODE_OPTIONS || '').includes(option)) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS.replace(option, () => '--require=' + JSON.stringify(__filename));
}

function verifyPhoneLoginManifest(manifest) {
  const guard = manifest.phoneLoginReleaseGuard;
  if (!/^[a-f0-9]{40}$/.test(manifest.commit ?? '') || guard?.version !== 1 ||
      guard.baseline !== baseline || guard.commit !== manifest.commit) {
    throw new Error('Publication bloquée : la connexion des comptes existants par téléphone doit être vérifiée.');
  }
}

const root = path.resolve(__dirname, '..');
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'dist/index.cjs')) {
  require('./replit-team-invitation-anchor.cjs');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/public/build-manifest.json'), 'utf8'));
  verifyPhoneLoginManifest(manifest);
  console.log('Phone login release anchor active: ' + manifest.commit);
}
module.exports = { baseline, verifyPhoneLoginManifest };
