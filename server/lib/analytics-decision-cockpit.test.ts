import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const analytics = readFileSync(join(root, "client/src/pages/analytics.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");

assert.match(routes, /\/api\/analytics\/decision-cockpit/);
assert.match(routes, /o\.site_id = ANY\(\$1::int\[\]\)/);
assert.match(routes, /breakEvenRevenue = fixedCosts > 0 && contributionMarginRatio > 0/);
assert.match(routes, /productivityPerHour = number\(team\.paid_hours\) > 0/);
assert.match(routes, /confidenceLevel = confidenceScore >= 80/);
assert.doesNotMatch(analytics, /kpis\?\.breakEvenKg/);
assert.doesNotMatch(analytics, /score\?\.machineUsage/);
assert.match(analytics, /ExecutiveDecisionCockpit period=\{period\}/);
assert.match(analytics, /data-testid="section-executive-decision-cockpit"/);
assert.match(analytics, /function LaundryOperationsFlow/);
assert.match(analytics, /insufficient_data/);
assert.match(analytics, /Button asChild/);
assert.match(i18n, /decision_cockpit: "Decision cockpit"/);
assert.match(i18n, /decision_cockpit: "Poste de décision"/);
assert.match(i18n, /decision_cockpit: "Painel de decisão"/);

console.log("Analytics decision cockpit regression checks passed");
