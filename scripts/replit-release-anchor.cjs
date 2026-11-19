// Kept active by the production NODE_OPTIONS setting outside Git. Older source
// trees without this file cannot start Node, even if they contain old build scripts.
// No Git, network or application dependencies: safe for npm install and cold starts.
const path = require('node:path');
const fs = require('node:fs');
const relativeOption = '--require=./scripts/replit-release-anchor.cjs';
if ((process.env.NODE_OPTIONS || '').includes(relativeOption)) {
  // npm install scripts can change cwd. Their children must still load this file.
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS.replace(relativeOption, `--require=${JSON.stringify(__filename)}`);
}

const root = path.resolve(__dirname, '..');
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'dist/index.cjs')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/public/build-manifest.json'), 'utf8'));
  const guard = manifest.receiptReleaseGuard;
  if (guard?.version !== 1 || guard.baseline !== 'b55a0a03481156af5cc29a0ce19647477e8e9645' || guard.commit !== manifest.commit) {
    throw new Error('Publication bloquée : reconstruire cette version avec le contrôle des correctifs reçus.');
  }
  console.log(`Receipt release anchor active: ${manifest.commit}`);
}
