import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const acceptInvitationPage = readFileSync(join(root, "client/src/pages/accept-invitation.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");

assert.match(storage, /user\.userType !== "staff"/);
assert.match(storage, /OWNER_ACCOUNT_CANNOT_ACCEPT_STAFF_INVITATION/);
assert.match(storage, /INVITATION_IDENTIFIER_MISMATCH/);
assert.match(storage, /userIdentifiers\.includes\(invitedIdentifier\)/);

assert.match(routes, /Owner accounts cannot be converted to staff/);
assert.match(routes, /This invitation is for a different email or phone number/);

assert.match(acceptInvitationPage, /user\.userType !== "staff"/);
assert.match(acceptInvitationPage, /owner-staff-invite-warning/);
assert.match(acceptInvitationPage, /owner_cannot_accept_staff_invitation/);

assert.match(i18n, /owner_cannot_accept_staff_invitation: "Owner accounts cannot be converted to staff/);
assert.match(i18n, /owner_cannot_accept_staff_invitation: "Les comptes propriétaires/);
assert.match(i18n, /owner_cannot_accept_staff_invitation: "Contas de proprietário/);

console.log("staff invitation account-boundary regression tests passed");
