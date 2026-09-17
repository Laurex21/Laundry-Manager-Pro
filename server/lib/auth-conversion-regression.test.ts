import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auth = readFileSync("client/src/pages/auth-page.tsx", "utf8");
const landing = readFileSync("client/src/pages/landing.tsx", "utf8");

assert.match(auth, /requestedTab === "register"/, "registration deep links must open the registration tab");
assert.match(auth, /setLocation\(nextTab === "register" \? "\/auth\?tab=register" : "\/auth"\)/, "tab changes must update the URL");
assert.match(auth, /minLength=\{tab === "register" \? 10 : undefined\}/, "registration must match the server's ten-character policy without blocking legacy login");
assert.match(auth, /password !== confirmPassword/, "registration must validate password confirmation");
assert.match(auth, /data-testid="input-confirm-password"/, "registration must expose a confirmation field");
assert.match(auth, /registration_password_rule/, "registration must explain password rules before submission");
assert.match(auth, /xpresspro-mark\.svg/, "authentication must use the approved XpressPro mark");
assert.match(auth, /back_to_public_site/, "authentication must provide a localized route back to the public site");

assert.doesNotMatch(landing, /href="#"/, "the public landing must not contain empty footer links");
assert.doesNotMatch(landing, /testimonials_placeholder/, "the public landing must not expose internal testimonial placeholders");
assert.match(landing, /Une solution XpressGroup/, "the public footer must use the approved parent brand");

console.log("auth conversion regression passed");
