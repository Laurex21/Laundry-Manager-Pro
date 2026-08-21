import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("shared/schema.ts", "utf8");
const ddl = readFileSync("server/replit_integrations/auth/replitAuth.ts", "utf8");

for (const name of ["daily_site_reports", "daily_site_report_comments"]) {
  assert.match(schema, new RegExp(name));
  assert.match(ddl, new RegExp(`CREATE TABLE IF NOT EXISTS ${name}`));
}
for (const field of ["organisation_id", "site_id", "report_date", "version", "status", "metrics_snapshot", "author_user_id", "submitted_at", "acknowledged_at"]) {
  assert.match(ddl, new RegExp(field));
}
assert.match(ddl, /UNIQUE \(site_id, report_date, version\)/);
assert.match(schema, /summary: text/);
assert.match(schema, /difficulties: text/);
assert.match(schema, /needs: text/);
assert.match(schema, /handover: text/);

console.log("daily site report schema regressions passed");
