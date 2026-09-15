import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const shell = fs.readFileSync(path.join(root, "client/src/components/layout-shell.tsx"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "client/src/pages/dashboard.tsx"), "utf8");
const i18n = fs.readFileSync(path.join(root, "client/src/lib/i18n.ts"), "utf8");
const storage = fs.readFileSync(path.join(root, "server/storage.ts"), "utf8");

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
assert.match(dashboard, /hasDistinctOwnerActions && <Card[\s\S]*data-testid="card-owner-actions"/, "Empty owner action card must be hidden");
assert.match(dashboard, /const priorityCount = openReturnCount \+ unacknowledgedReportCount;/, "Owner action count must exclude pickup delays shown in the separate pickup card");
assert.match(dashboard, /overduePickupCount > 0 \? t\('overdue_pickups'\) : t\('ready_for_pickup'\)/, "Detailed pickup card must distinguish overdue collections");
assert.match(shell, /min-h-0 flex-1 overflow-y-auto overscroll-contain/, "Only the navigation area should scroll on short desktop screens");
assert.match(shell, /shrink-0 border-t border-white\/10/, "Plan and user controls must remain visible at the bottom of the sidebar");
assert.equal(i18n.match(/"overdue_pickups"/g)?.length, 3, "Missing EN/FR/PT overdue pickup labels");
assert.match(dashboard, /toLocaleString\(i18n\.language/, "Dashboard money must follow the selected locale");
assert.match(dashboard, /MessageCircle/, "Pickup WhatsApp actions must use a compact accessible icon");
assert.doesNotMatch(dashboard, /ActionRow href="\/orders\?status=ready"/, "Pickup delays must not be duplicated in the action centre");
assert.match(storage, /messageKey: "dashboard_alert_pending_orders"/, "Dashboard alerts must be localized by the client");
assert.doesNotMatch(storage, /You have \$\{pendingCount\} pending orders/, "Server must not hard-code English Dashboard alerts");
for (const key of [
  "dashboard_alert_pending_orders",
  "dashboard_alert_expenses_exceed_revenue",
  "dashboard_alert_returned_garments",
]) {
  assert.equal(i18n.match(new RegExp(`"${key}"`, "g"))?.length, 3, `Missing EN/FR/PT translations for ${key}`);
}

console.log("Global shell and Dashboard redesign checks passed.");
