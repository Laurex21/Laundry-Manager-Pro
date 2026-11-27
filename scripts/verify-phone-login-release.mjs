import { fileURLToPath } from 'node:url';
import anchor from './replit-phone-login-anchor.cjs';
import { verifyTestedRelease } from './verify-tested-release.mjs';

export function verifyPhoneLoginRelease(root = fileURLToPath(new URL('../', import.meta.url))) {
  return verifyTestedRelease(root, anchor.baseline,
    'Publication bloquée : la révision validée de la connexion par téléphone (PR #101) manque dans l’historique Git.', [
    'scripts/phone-login-form.test.mjs',
    'server/lib/phone-and-email-login.integration.test.ts',
  ]);
}
