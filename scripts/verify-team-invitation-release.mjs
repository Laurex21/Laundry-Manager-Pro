import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import anchor from './replit-team-invitation-anchor.cjs';

export function verifyTeamInvitationRelease(root = fileURLToPath(new URL('../', import.meta.url))) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  try { git('merge-base', '--is-ancestor', anchor.baseline, 'HEAD'); }
  catch { throw new Error('Publication bloquée : les correctifs des invitations des PR #107 et #108 sont absents ou l’historique Git est incomplet.'); }
  for (const file of [
    'scripts/team-invitation-form.test.mjs',
    'server/lib/staff-invitation-account-boundary.test.ts',
    'server/lib/team-invitation.integration.test.ts',
    'client/src/lib/demo-invitations.test.ts',
  ]) {
    execFileSync(process.execPath, ['--import', 'tsx', file], {
      cwd: root, stdio: 'inherit', env: { PATH: process.env.PATH, TZ: 'UTC', NODE_ENV: 'test' },
    });
  }
  return { version: 1, baseline: anchor.baseline, commit: git('rev-parse', 'HEAD') };
}
