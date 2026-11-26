import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { invitationPhone, matchingInvitationCredential } from "../../shared/team-invitation";

const root = process.cwd();
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const acceptInvitationPage = readFileSync(join(root, "client/src/pages/accept-invitation.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");

assert.match(storage, /user\.userType !== "staff"/);
assert.match(storage, /OWNER_ACCOUNT_CANNOT_ACCEPT_STAFF_INVITATION/);
assert.match(storage, /INVITATION_IDENTIFIER_MISMATCH/);
assert.match(storage, /matchingInvitationCredential\(inv.identifier, user\)/);
for (const value of ["699 11 22 33", "+237 699112233", "00237 699112233"]) {
  assert.equal(invitationPhone(value), "237699112233");
  assert.deepEqual(matchingInvitationCredential("+237699112233", { phone: value }), { kind: "phone", value: "237699112233" });
}
assert.equal(invitationPhone("+33 6 12 34 56 78"), "33612345678");
for (const value of ["staff@example.com", "", "123", "+237 654", "0000000000"]) assert.equal(invitationPhone(value), null);
assert.equal(matchingInvitationCredential("+237699112233", { email: "+237699112233" }), null);
assert.equal(matchingInvitationCredential("+237699112233", { phone: "+237699112234" }), null);
assert.deepEqual(matchingInvitationCredential("STAFF@example.com", { email: "staff@example.com" }), { kind: "email", value: "staff@example.com" });

assert.match(routes, /Owner accounts cannot be converted to staff/);
assert.match(routes, /This invitation is for a different email or phone number/);

assert.match(acceptInvitationPage, /user\.userType !== "staff"/);
assert.match(acceptInvitationPage, /owner-staff-invite-warning/);
assert.match(acceptInvitationPage, /owner_cannot_accept_staff_invitation/);

assert.match(i18n, /owner_cannot_accept_staff_invitation: "Owner accounts cannot be converted to staff/);
assert.match(i18n, /owner_cannot_accept_staff_invitation: "Les comptes propriétaires/);
assert.match(i18n, /owner_cannot_accept_staff_invitation: "Contas de proprietário/);

console.log("staff invitation account-boundary regression tests passed");
