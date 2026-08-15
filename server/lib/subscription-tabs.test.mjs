import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const plans = readFileSync(join(root, "client/src/pages/membership-plans.tsx"), "utf8");
const dashboard = readFileSync(join(root, "client/src/pages/subscription-dashboard.tsx"), "utf8");

assert.match(plans, /onValueChange=.*subscription-dashboard\?view=/s, "plan tabs must navigate to working dashboard views");
assert.match(dashboard, /new URLSearchParams\(useSearch\(\)\).*get\("view"\)/s, "dashboard view must be URL-backed");
assert.match(dashboard, /view === "subscribers"/, "subscriber tab must render the subscriber overview");
assert.match(dashboard, /value === "plans" \? "\/membership-plans"/, "dashboard tabs must navigate back to plans");
assert.match(dashboard, /aria-label="Subscription management views"/, "tab list must expose an accessible name");

console.log("subscription tab navigation regression passed");
