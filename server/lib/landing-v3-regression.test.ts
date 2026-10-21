import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/landing.tsx", "utf8");

assert.doesNotMatch(source, /framer-motion|motion\./, "landing must use CSS/IntersectionObserver motion only");
assert.doesNotMatch(source, /Mamadou Diallo|Amina Kouassi|Chidi Okafor/, "landing must not contain fabricated testimonials");
assert.match(source, /IntersectionObserver/, "landing must reveal sections without an animation library");
assert.match(source, /href="\/auth\?tab=register"/, "free-trial CTAs must open registration");
assert.match(source, /href="\/rentabilite"/, "profitability CTAs must use the profitability route");
assert.match(source, /href="\/calculateur"/, "startup-budget tool must use the budget calculator route");
assert.match(source, /href="\/diagnostic"/, "professional diagnostic must use the diagnostic route");
assert.doesNotMatch(source, /health_score|Score de Santé|Health Score/, "health score must not appear on the landing page");
assert.doesNotMatch(source, /audit_desc|Audit Professionnel|Professional Audit/, "professional audit must not appear on the landing page");
assert.match(source, /VITE_DEMO_VIDEO_URL_FR/, "landing must read the configured demo video URL");
assert.match(source, /demoUrl && <section/, "landing must hide the demo section until a real video is configured");
assert.doesNotMatch(source, /testimonials_placeholder|REMPLACER PAR DE VRAIS|REPLACE WITH REAL/, "landing must not publish testimonial placeholders");
assert.match(source, /© 2026 XpressGroup/, "landing must retain the XpressGroup parent brand");
assert.match(source, /about_company_statement:[^\n]*General Advance Services/, "the company disclosure must remain available");
assert.match(source, /<XpressGroupGateway language=\{i18n.language\} \/>/, "home must render the localized group gateway");
const gateway = readFileSync("client/src/pages/xpressgroup-gateway.tsx", "utf8");
for (const href of ["/xpresspro", "/xpress-consulting", "/xpress-clean"]) {
  assert.equal(gateway.split(`href: "${href}"`).length - 1, 2, `${href} must be available in both languages`);
}
assert.match(gateway, /language\.startsWith\("fr"\) \? french : english/);
assert.doesNotMatch(source, /AfricaMap|map_eyebrow|map-stats/, "Africa presence section and map must not appear on the landing page");
assert.match(source, /prefers-reduced-motion/, "landing motion must respect reduced-motion preferences");
assert.match(source, /id="tools"/, "the free tools anchor must remain available");
assert.match(gateway, /id="branches"/, "the three businesses must have a navigation anchor");
assert.match(source, /data-testid="fipp-home-banner"/, "the event promotion must remain available");
assert.match(source, /href="\/rencontre"/, "the event promotion must open the event page");
assert.match(source, /id="home-mobile-menu"[\s\S]*\["fr", "en"\][\s\S]*aria-pressed/, "mobile must retain the FR/EN selector");

assert.doesNotMatch(source, /landing_stats_countries"\s*,\s*value:\s*12|totalCountries\s*\?\?\s*12/, "country coverage must never use the old hard-coded value");

const storageSource = readFileSync("server/storage.ts", "utf8");
const routesSource = readFileSync("server/routes.ts", "utf8");
assert.match(storageSource, /count\(distinct lower\(trim\([^)]*country/, "public stats must count normalized distinct configured countries");
assert.match(storageSource, /trim\(coalesce\([^)]*country[^)]*''\)\) <> ''/, "public stats must exclude blank countries");
assert.match(routesSource, /totalCountries:\s*0/, "public stats fallback must preserve the country-count API contract");

console.log("landing v3 regression passed");
