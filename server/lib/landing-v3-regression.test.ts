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
assert.match(source, /testimonials_placeholder/, "landing must show an honest testimonial placeholder until real proof exists");
assert.doesNotMatch(source, /AfricaMap|map_eyebrow|map-stats/, "Africa presence section and map must not appear on the landing page");
assert.match(source, /prefers-reduced-motion/, "landing motion must respect reduced-motion preferences");
assert.match(source, /id="features"[\s\S]*id="tools"|id="tools"[\s\S]*id="features"/, "features and tools anchors must exist");
assert.match(source, /id="pricing"/, "pricing anchor must exist");

console.log("landing v3 regression passed");
