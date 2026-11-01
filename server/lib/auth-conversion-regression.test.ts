import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planIntentUrl } from "../../client/src/lib/saas-plan-intent";
import { SALES_CODE } from "../../shared/sales-referrals";

const auth = readFileSync("client/src/pages/auth-page.tsx", "utf8");
const landing = readFileSync("client/src/pages/landing.tsx", "utf8");

assert.match(auth, /requestedTab === "register"/, "registration deep links must open the registration tab");
// Execute the actual navigation handler so referral preservation cannot hide a lost plan.
const handler = auth.match(/const changeTab = \(nextTab: "login" \| "register"\) => \{([\s\S]*?)\n  \};/);
assert.ok(handler, "authentication must expose tab navigation");
for (const sales of ["CM-0123456789ABCDEF0123", "invalid", ""]) {
  for (const nextTab of ["login", "register"] as const) {
    let destination = "";
    let activeTab = "";
    const selectedPlan = { plan: "business" as const, extraSites: 2, extraStaff: 3 };
    new Function("nextTab", "selectedPlan", "search", "setTab", "setLocation", "planIntentUrl", "SALES_CODE", handler[1])(
      nextTab, selectedPlan, `?sales=${sales}`, (tab: string) => { activeTab = tab; },
      (url: string) => { destination = url; }, planIntentUrl, SALES_CODE,
    );
    const url = new URL(destination, "https://example.test");
    assert.equal(activeTab, nextTab);
    assert.equal(url.pathname, "/auth");
    assert.equal(url.searchParams.get("plan"), "business");
    assert.equal(url.searchParams.get("extraSites"), "2");
    assert.equal(url.searchParams.get("extraStaff"), "3");
    assert.equal(url.searchParams.get("tab"), nextTab === "register" ? "register" : null);
    assert.equal(url.searchParams.get("sales"), SALES_CODE.test(sales) ? sales : null);
  }
}
assert.match(auth, /minLength=\{tab === "register" \? 10 : undefined\}/, "registration must match the server's ten-character policy without blocking legacy login");
assert.match(auth, /password !== confirmPassword/, "registration must validate password confirmation");
assert.match(auth, /data-testid="input-confirm-password"/, "registration must expose a confirmation field");
assert.match(auth, /registration_password_rule/, "registration must explain password rules before submission");
assert.match(auth, /xpresspro-mark\.svg/, "authentication must use the approved XpressPro mark");
assert.match(auth, /back_to_public_site/, "authentication must provide a localized route back to the public site");

assert.doesNotMatch(landing, /href="#"/, "the public landing must not contain empty footer links");
assert.doesNotMatch(landing, /testimonials_placeholder/, "the public landing must not expose internal testimonial placeholders");
assert.match(landing, /© 2026 XpressGroup/, "the public footer must use the approved parent brand");

console.log("auth conversion regression passed");
