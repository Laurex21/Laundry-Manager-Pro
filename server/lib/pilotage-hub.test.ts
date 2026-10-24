import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("client/src/App.tsx", "utf8");
const auth = readFileSync("client/src/hooks/use-auth.ts", "utf8");
const layout = readFileSync("client/src/components/layout-shell.tsx", "utf8");
const hub = readFileSync("client/src/pages/pilotage.tsx", "utf8") + readFileSync("client/src/components/pilotage/overview-360.tsx", "utf8");
const dashboard = readFileSync("client/src/pages/dashboard.tsx", "utf8");
const i18n = readFileSync("client/src/lib/i18n.ts", "utf8");

assert.match(app, /path="\/pilotage"/);
assert.match(app, /LegacyPilotageRoute/);
assert.match(layout, /href: "\/pilotage"/);
assert.doesNotMatch(layout, /href: "\/reports"/);
assert.doesNotMatch(layout, /href: "\/quality-operations"/);
assert.doesNotMatch(layout, /href: "\/daily-reports"/);
assert.match(auth, /managerPages[^\n]*reports/);
assert.match(auth, /operatorPages[^\n]*pilotage/);
assert.match(hub, /role="tablist"/);
assert.match(hub, /aria-selected/);
assert.match(hub, /pilotage_overview/);
assert.match(hub, /canAccess\("reports"\)/);
assert.match(hub, /enabled: managerView/);
assert.match(hub, /reportsToReview > 0 &&[\s\S]*onSelect\(['"]daily['"]\)[\s\S]*t\(['"]pilotage_reports_to_review['"]\)/);
assert.match(hub, /value: "daily" as const, label: t\("daily_reports"\)/);
assert.match(hub, /currentSite\?\.id/);
assert.match(dashboard, /\/pilotage\?view=quality/);
assert.match(dashboard, /\/pilotage\?view=daily/);

for (const key of ["pilotage", "pilotage_subtitle", "pilotage_overview", "pilotage_attention", "pilotage_open_returns", "pilotage_reports_to_review", "pilotage_no_attention"]) {
  assert.equal((i18n.match(new RegExp(`"${key}"`, "g")) || []).length >= 3, true, `${key} needs EN/FR/PT translations`);
}

console.log("pilotage hub regressions passed");
