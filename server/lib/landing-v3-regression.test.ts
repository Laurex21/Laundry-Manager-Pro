import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/landing.tsx", "utf8");

assert.doesNotMatch(source, /framer-motion|motion\./, "landing must use CSS/IntersectionObserver motion only");
assert.doesNotMatch(source, /Mamadou Diallo|Amina Kouassi|Chidi Okafor/, "landing must not contain fabricated testimonials");
assert.match(source, /IntersectionObserver/, "landing must reveal sections without an animation library");
assert.match(source, /href="\/auth\?tab=register"/, "free-trial CTAs must open registration");
assert.match(source, /href="\/rentabilite"/, "profitability CTAs must use the profitability route");
assert.match(source, /href="\/calculateur"/, "startup-budget tool must use the budget calculator route");
assert.match(source, /href="\/diagnostic"/, "diagnostic tools must use the diagnostic route");
assert.match(source, /VITE_DEMO_VIDEO_URL_FR/, "landing must read the configured demo video URL");
assert.match(source, /testimonials_placeholder/, "landing must show an honest testimonial placeholder until real proof exists");
assert.match(source, /enabled: false/, "missing map endpoint must not create a public 404");
assert.match(source, /prefers-reduced-motion/, "landing motion must respect reduced-motion preferences");
assert.match(source, /id="features"[\s\S]*id="tools"|id="tools"[\s\S]*id="features"/, "features and tools anchors must exist");
assert.match(source, /id="pricing"/, "pricing anchor must exist");

console.log("landing v3 regression passed");
