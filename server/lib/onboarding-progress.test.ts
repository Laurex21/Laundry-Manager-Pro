import assert from "node:assert/strict";
import { completionKey, parseCompleted, progressKey, ONBOARDING_ACTIONS } from "../../client/src/lib/onboarding-progress";
import { readFileSync } from "node:fs";

assert.deepEqual(parseCompleted(null), []);
for (const invalid of ['broken', '{}', 'null', '1', '"identity"']) assert.deepEqual(parseCompleted(invalid), []);
assert.deepEqual(parseCompleted('["receipt","identity","identity","bogus",7]'), ['identity','receipt']);
assert.notEqual(completionKey('owner-a'), completionKey('owner-b'));
assert.notEqual(progressKey('owner-a'), completionKey('owner-a'));
assert(ONBOARDING_ACTIONS.indexOf('service') < ONBOARDING_ACTIONS.indexOf('order'));
const guide = readFileSync('client/src/components/getting-started-guide.tsx', 'utf8');
assert(guide.includes('disabled={!currentCompleted}'));
assert(guide.includes('if (!currentCompleted) return;'));
assert(!guide.includes('Passer le guide'));
assert(guide.includes('Plus → Paramètres'));
assert(guide.includes('onboarding-register-payment'));
assert(guide.includes('if (dialogOpen) return null'));
console.log('Onboarding progress validation, account separation, and navigation checks passed');
