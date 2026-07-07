import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const authPage = readFileSync(join(root, "client/src/pages/auth-page.tsx"), "utf8");
const staffLoginPage = readFileSync(join(root, "client/src/pages/staff-login.tsx"), "utf8");
const acceptInvitationPage = readFileSync(join(root, "client/src/pages/accept-invitation.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");

const requiredKeys = [
  "staff_member_prompt",
  "use_staff_login",
  "staff_login_title",
  "staff_login_description",
  "forgot_password",
  "login_as_staff",
  "login_as_admin",
  "create_staff_login_description",
  "create_staff_login",
  "already_have_staff_credentials",
];

for (const key of requiredKeys) {
  assert.match(i18n, new RegExp(`${key}: |"${key}": `), `${key} must be defined in i18n resources`);
}

assert.match(authPage, /t\("staff_member_prompt"\)/);
assert.match(authPage, /t\("use_staff_login"\)/);
assert.match(authPage, /t\("forgot_password"\)/);
assert.doesNotMatch(authPage, /t\("forgot_password",/);
assert.doesNotMatch(authPage, /Staff member\?/);
assert.doesNotMatch(authPage, /Use staff login/);

assert.match(staffLoginPage, /t\("staff_login_title"\)/);
assert.match(staffLoginPage, /t\("staff_login_description"\)/);
assert.match(staffLoginPage, /t\("login_as_staff"\)/);
assert.match(staffLoginPage, /t\("login_as_admin"\)/);
assert.match(staffLoginPage, /variant="outline"/);
assert.match(staffLoginPage, /border-primary\/40 bg-primary\/5 text-primary/);
assert.doesNotMatch(staffLoginPage, /Staff login</);
assert.doesNotMatch(staffLoginPage, /Log in as staff/);
assert.doesNotMatch(staffLoginPage, /Owner login/);

assert.match(acceptInvitationPage, /t\("create_staff_login_description"\)/);
assert.match(acceptInvitationPage, /t\("create_staff_login"\)/);
assert.match(acceptInvitationPage, /t\("already_have_staff_credentials"\)/);
assert.doesNotMatch(acceptInvitationPage, /Create your staff login/);
assert.doesNotMatch(acceptInvitationPage, /Already have staff credentials/);

assert.match(i18n, /staff_login_title: "Staff login"/);
assert.match(i18n, /staff_login_title: "Connexion du personnel"/);
assert.match(i18n, /staff_login_title: "Acesso da equipa"/);
assert.match(i18n, /login_as_admin: "Log in as admin"/);
assert.match(i18n, /login_as_admin: "Se connecter comme admin"/);
assert.match(i18n, /login_as_admin: "Entrar como admin"/);

console.log("auth login i18n regression tests passed");
