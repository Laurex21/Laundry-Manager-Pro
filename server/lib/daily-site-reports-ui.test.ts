import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("client/src/App.tsx", "utf8");
const auth = readFileSync("client/src/hooks/use-auth.ts", "utf8");
const layout = readFileSync("client/src/components/layout-shell.tsx", "utf8");
const page = readFileSync("client/src/pages/daily-site-reports.tsx", "utf8");
const form = readFileSync("client/src/components/daily-site-report-form.tsx", "utf8");
const card = readFileSync("client/src/components/daily-site-report-card.tsx", "utf8");
const i18n = readFileSync("client/src/lib/i18n.ts", "utf8");

assert.match(app, /path="\/daily-reports"/);
assert.match(auth, /operatorPages[^\n]*dailyReports/);
assert.match(layout, /href: "\/pilotage"/);
assert.match(page, /allSites/);
assert.match(form, /<form/);
assert.match(form, /htmlFor=\{`report-\$\{field\}`\}/);
assert.match(form, /id=\{`report-\$\{field\}`\}/);
assert.match(form, /daily_report_optional/);
assert.match(form, /window\.confirm/);
assert.match(card, /daily_report_status_/);
assert.match(card, /<dl/);
assert.match(card, /daily_report_comment/);
assert.match(card, /daily_report_acknowledge/);

for (const key of ["daily_reports", "daily_reports_subtitle", "daily_report_optional", "daily_report_create", "daily_report_submit", "daily_report_comment", "daily_report_acknowledge", "daily_report_status_draft", "daily_report_status_submitted", "daily_report_status_acknowledged"]) {
  assert.equal((i18n.match(new RegExp(`"${key}"`, "g")) || []).length >= 3, true, `${key} needs EN/FR/PT translations`);
}

console.log("daily site report UI regressions passed");
