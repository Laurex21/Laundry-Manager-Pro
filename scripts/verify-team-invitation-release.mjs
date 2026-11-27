import { fileURLToPath } from 'node:url';
import anchor from './replit-team-invitation-anchor.cjs';
import { verifyTestedRelease } from './verify-tested-release.mjs';

export function verifyTeamInvitationRelease(root = fileURLToPath(new URL('../', import.meta.url))) {
  return verifyTestedRelease(root, anchor.baseline,
    'Publication bloquée : les correctifs des invitations des PR #107 et #108 sont absents ou l’historique Git est incomplet.', [
    'scripts/team-invitation-form.test.mjs',
    'server/lib/staff-invitation-account-boundary.test.ts',
    'server/lib/team-invitation.integration.test.ts',
    'client/src/lib/demo-invitations.test.ts',
  ]);
}
