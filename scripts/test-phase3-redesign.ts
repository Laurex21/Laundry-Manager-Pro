import fs from "node:fs";
import assert from "node:assert/strict";

const files = {
  reports: fs.readFileSync("client/src/pages/reports.tsx", "utf8"),
  pilotage: fs.readFileSync("client/src/pages/pilotage.tsx", "utf8"),
  analytics: fs.readFileSync("client/src/pages/analytics.tsx", "utf8"),
  settings: fs.readFileSync("client/src/pages/settings.tsx", "utf8"),
};

assert.match(files.reports, /reports-page-redesign/);
assert.match(files.reports, /totalRevenue/);
assert.match(files.pilotage, /pilotage-page-redesign/);
assert.match(files.pilotage, /canAccess\("reports"\)/);
assert.match(files.analytics, /analytics-page-redesign/);
assert.match(files.analytics, /hasFeature\("analytics"\)/);
assert.match(files.settings, /settings-page-redesign/);
assert.match(files.settings, /if \(!isOwner\)/);
assert.match(files.settings, /data-testid="settings-tabs"/);

console.log("Phase 3 visual redesign regression checks passed.");
