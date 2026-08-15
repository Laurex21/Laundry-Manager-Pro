import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const plans = readFileSync(join(root, "client/src/pages/membership-plans.tsx"), "utf8");
const dashboard = readFileSync(join(root, "client/src/pages/subscription-dashboard.tsx"), "utf8");
const layout = readFileSync(join(root, "client/src/components/layout-shell.tsx"), "utf8");
const app = readFileSync(join(root, "client/src/App.tsx"), "utf8");

assert.match(plans, /onValueChange=.*membership-plans\?view=/s, "all subscription views must stay inside the plan workspace");
assert.match(plans, /<SubscriptionDashboardPage embedded viewOverride=\{view\}/, "subscriber and revenue content must render inside the workspace");
assert.match(dashboard, /new URLSearchParams\(useSearch\(\)\).*get\("view"\)/s, "dashboard view must be URL-backed");
assert.match(dashboard, /view === "subscribers"/, "subscriber tab must render the subscriber overview");
assert.match(dashboard, /embedded = false, viewOverride/, "dashboard must support embedded revenue and subscriber views");
assert.match(dashboard, /aria-label="Subscription management views"/, "tab list must expose an accessible name");
assert.doesNotMatch(layout, /href: "\/subscription-dashboard"/, "duplicate subscription dashboard sidebar item must be removed");
assert.match(app, /setLocation\("\/membership-plans\?view=revenue"\)/, "legacy dashboard links must redirect to the revenue tab");

console.log("subscription tab navigation regression passed");
