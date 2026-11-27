import assert from "node:assert/strict";
import { acceptDemoInvitation, clearDemoInvitations, demoInvitationResponse, isDemoInvitation, readDemoInvitation } from "./demo-invitations";

// Browser-local fixture storage. External fetch is forbidden throughout this test.
const data = Object.create(null) as Record<string, string>;
Object.defineProperty(globalThis, "localStorage", { value: Object.defineProperties(data, {
  getItem: { value: (key: string) => data[key] ?? null },
  setItem: { value: (key: string, value: string) => { data[key] = value; } },
  removeItem: { value: (key: string) => { delete data[key]; } },
}) });
globalThis.fetch = async () => { throw Error("Unexpected network request"); };
const create = (email: string, phone?: string) => demoInvitationResponse("/api/invitations", "POST",
  JSON.stringify({ identifier: email, notificationPhone: phone, role: "operator", siteId: 1 }))!;
const pending = async () => (await demoInvitationResponse("/api/invitations/pending", "GET")!.json()) as { token: string }[];
const first = await create("AGENT@example.invalid").json();
const second = await create("agent2@example.invalid", "+1 202 555 0142").json();
assert.ok(isDemoInvitation(first.token));
assert.notEqual(first.token, second.token);
assert.equal(first.identifier, "agent@example.invalid");
assert.equal(first.notificationPhone, null);
assert.equal(second.notificationPhone, "12025550142");
assert.equal(readDemoInvitation(second.token)?.siteName, "Douala Akwa");
assert.equal(create("invalid").status, 400);
assert.equal(create("agent@example.invalid", "invalid").status, 400);
assert.equal((await pending()).length, 2);
assert.ok(acceptDemoInvitation(first.token));
assert.equal(acceptDemoInvitation(first.token), false);
assert.equal(readDemoInvitation(first.token)?.status, "accepted");
assert.deepEqual((await pending()).map(i => i.token), [second.token]);
assert.equal(demoInvitationResponse("/api/invitations/" + second.id, "DELETE")!.status, 200);
assert.equal(readDemoInvitation(second.token), null);
assert.equal(readDemoInvitation("a".repeat(64)), null);
data.other = "preserved";
clearDemoInvitations();
assert.equal(readDemoInvitation(first.token), null);
assert.deepEqual(Object.keys(data), ["other"]);
console.log("Demo invitations passed for email only, optional WhatsApp, simulated acceptance, revocation and cleanup.");
