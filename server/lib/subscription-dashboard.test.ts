import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { monthlyEquivalent, percentage, subscriptionExpiryState, usageThresholdCrossed } from "./subscription-formulas";
import { NOTIFICATION_TEMPLATES } from "./subscription-notification-templates";
import { getDemoFixture } from "../../client/src/lib/demo-data";

const root = process.cwd();

assert.equal(monthlyEquivalent(100, "weekly"), 433);
assert.equal(monthlyEquivalent(100, "monthly"), 100);
assert.equal(monthlyEquivalent(300, "quarterly"), 100);
assert.equal(monthlyEquivalent(1200, "annual"), 100);
assert.equal(percentage(3, 12), 25);
assert.equal(percentage(1, 0), 0);
assert.equal(usageThresholdCrossed(30, 19, 100), "usage_80");
assert.equal(usageThresholdCrossed(19, 0, 100), "usage_100");
assert.equal(usageThresholdCrossed(10, 5, 100), null);
assert.equal(usageThresholdCrossed(1, 0, 0), null);
assert.equal(subscriptionExpiryState("2026-07-21", 7, "2026-07-22"), "expired");
assert.equal(subscriptionExpiryState("2026-07-22", 7, "2026-07-22"), "reminder");
assert.equal(subscriptionExpiryState("2026-07-29", 7, "2026-07-22"), "reminder");
assert.equal(subscriptionExpiryState("2026-07-30", 7, "2026-07-22"), null);

assert.match(NOTIFICATION_TEMPLATES.welcome("Awa", "Premium", "XP-1", "Pressing Test"), /XP-1/);
assert.match(NOTIFICATION_TEMPLATES.renewal_reminder("Awa", "Premium", 7, "Pressing Test"), /7 jours/);
assert.match(NOTIFICATION_TEMPLATES.usage_80("Awa", "Premium", 4.5, "Pressing Test"), /4\.5 kg/);
assert.match(NOTIFICATION_TEMPLATES.payment_confirmed("Awa", "Premium", 25000, "FCFA", "Pressing Test"), /25[\s\u202f]000 FCFA/);
assert.match(NOTIFICATION_TEMPLATES.card_ready("Awa", "XP-1", "Pressing Test"), /XP-1/);

const demoDashboard = getDemoFixture("/api/subscriptions/dashboard?period=month") as any;
assert.equal(typeof demoDashboard, "object");
assert.ok(!Array.isArray(demoDashboard));
assert.ok(Array.isArray(demoDashboard.expiringSoonList));
assert.ok(Array.isArray(demoDashboard.topSubscribers));

const dashboardSource = readFileSync(join(root, "server/lib/subscription-dashboard.ts"), "utf8");
assert.match(dashboardSource, /toISOString\(\)\.slice\(0, 7\)/);
assert.doesNotMatch(dashboardSource, /toLocaleDateString\("fr-FR"/);
assert.ok(Array.isArray(demoDashboard.revenueByPlan));
assert.ok(Array.isArray(demoDashboard.mrrTrend));
assert.ok(Array.isArray(demoDashboard.subscriptionGrowth));
assert.ok(Array.isArray(demoDashboard.planDistribution));
assert.deepEqual(getDemoFixture("/api/subscriptions/notifications/due"), []);

const i18nSource = readFileSync(new URL("../../client/src/lib/i18n.ts", import.meta.url), "utf8");
assert.equal(i18nSource.match(/"period_quarter":/g)?.length, 3);

console.log("subscription dashboard formula tests passed");
