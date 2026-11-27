import { execFileSync } from 'node:child_process';

export function verifyTestedRelease(root, baseline, ancestryError, tests) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  try { git('merge-base', '--is-ancestor', baseline, 'HEAD'); }
  catch { throw new Error(ancestryError); }
  for (const file of tests) {
    // These tests use fixture accounts. Do not inherit deployment credentials.
    execFileSync(process.execPath, ['--import', 'tsx', file], {
      cwd: root, stdio: 'inherit', env: { PATH: process.env.PATH, TZ: 'UTC', NODE_ENV: 'test' },
    });
  }
  return { version: 1, baseline, commit: git('rev-parse', 'HEAD') };
}
