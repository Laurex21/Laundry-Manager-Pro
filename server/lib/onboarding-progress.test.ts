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

// Exercise the real success recorder: account separation, deduplication, and
// unavailable local storage must never change business-operation outcomes.
const { queryClient } = await import("../../client/src/lib/queryClient");
const { recordOnboardingAction } = await import("../../client/src/lib/onboarding-events");
const stored = new Map<string, string>();
const events: unknown[] = [];
Object.assign(globalThis, { window: {
  localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) },
  dispatchEvent: (event: CustomEvent) => { events.push(event.detail); return true; },
}});
queryClient.setQueryData(["/api/auth/user"], { id: "owner-a", role: "owner" });
recordOnboardingAction("service");
recordOnboardingAction("service");
assert.deepEqual(parseCompleted(stored.get(completionKey("owner-a"))!), ["service"]);
assert.deepEqual(events[0], { userId: "owner-a" });
queryClient.setQueryData(["/api/auth/user"], { id: "owner-b", role: "owner" });
recordOnboardingAction("customer");
assert.deepEqual(parseCompleted(stored.get(completionKey("owner-b"))!), ["customer"]);
assert.deepEqual(parseCompleted(stored.get(completionKey("owner-a"))!), ["service"]);
queryClient.setQueryData(["/api/auth/user"], { id: "staff", role: "employee" });
recordOnboardingAction("payment");
assert.equal(stored.has(completionKey("staff")), false);
queryClient.setQueryData(["/api/auth/user"], null);
const previousCount = events.length;
recordOnboardingAction("payment");
assert.equal(events.length, previousCount);
queryClient.setQueryData(["/api/auth/user"], { id: "owner-a", role: "owner" });
window.localStorage.setItem = () => { throw new Error("Storage disabled"); };
assert.doesNotThrow(() => recordOnboardingAction("payment"));
queryClient.clear();
console.log("Onboarding success recorder and failure isolation checks passed");
