import { spawnSync } from 'node:child_process';
import { securePicomatch, assessAudit, advisory, reviewDeadline } from './picomatch-security.mjs';

const patched = await securePicomatch();
const tests = spawnSync(process.execPath, ['--test', 'scripts/picomatch-security.test.mjs'], { stdio: 'inherit' });
if (tests.status !== 0) throw Error('Picomatch mitigation regression tests failed');
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json', '--audit-level=low'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (result.error || ![0, 1].includes(result.status)) throw Error('npm audit failed to run');
const count = assessAudit(JSON.parse(result.stdout), patched);
console.log(count ? `Audit: only ${advisory} and its dependency chains remain; installed source patch verified. Review before ${reviewDeadline}.` : 'Audit: no vulnerabilities.');
