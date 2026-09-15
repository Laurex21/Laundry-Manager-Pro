import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const shell = fs.readFileSync(path.join(root, "client/src/components/layout-shell.tsx"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "client/src/pages/dashboard.tsx"), "utf8");
const i18n = fs.readFileSync(path.join(root, "client/src/lib/i18n.ts"), "utf8");

for (const group of ["operations", "production", "management", "administration"]) {
  assert.match(shell, new RegExp(`key: "${group}"`), `Missing navigation group: ${group}`);
  assert.match(i18n, new RegExp(`"${group}"`), `Missing translations for: ${group}`);
}

assert.match(shell, /data-testid="grouped-navigation"/, "Grouped desktop/mobile navigation is required");
assert.match(shell, /data-testid="button-help-menu"/, "Support must live in the Help menu");
assert.doesNotMatch(shell, /data-testid="button-whatsapp-support"/, "Floating support must not obscure page content");
assert.match(shell, /max-w-\[1440px\]/, "Desktop content must use the approved maximum width");

for (const marker of [
  "dashboard-global-redesign",
  "dashboard-core-kpis",
  "dashboard-supporting-kpis",
  "dashboard-action-center",
]) {
  assert.match(dashboard, new RegExp(marker), `Missing Dashboard redesign marker: ${marker}`);
}

assert.match(dashboard, /card-orders-status-chart/, "Production pipeline must remain available");
assert.match(dashboard, /card-recent-orders/, "Recent orders must remain available");
assert.match(dashboard, /card-ready-for-pickup/, "Pickup priorities must remain available");

console.log("Global shell and Dashboard redesign checks passed.");
