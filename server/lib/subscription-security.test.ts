import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routes = readFileSync(join(root, "server/lib/membership-routes.ts"), "utf8");
const dashboard = readFileSync(join(root, "server/lib/subscription-dashboard.ts"), "utf8");
const notifications = readFileSync(join(root, "server/lib/subscription-notifications.ts"), "utf8");
const loyalty = readFileSync(join(root, "server/lib/loyalty.ts"), "utf8");
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const card = readFileSync(join(root, "server/lib/membership-card-generator.ts"), "utf8");
const layout = readFileSync(join(root, "client/src/components/layout-shell.tsx"), "utf8");
const auth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");
const settings = readFileSync(join(root, "client/src/pages/settings.tsx"), "utf8");

assert.match(routes, /requirePlanManager/);
assert.match(routes, /eq\(siteMembers\.role, "manager"\)/);
assert.match(routes, /eq\(customerSubscriptions\.organisationId, organisationId\)/);
assert.match(routes, /eq\(subscriptionPlans\.organisationId, organisationId\)/);
assert.match(routes, /subscriptionWriteLimiter/);
assert.match(routes, /keyOnly: true/);
assert.match(routes, /eq\(customerSubscriptions\.expiryDate, row\.subscription\.expiryDate\)/);
assert.match(routes, /status\(409\)/);
assert.match(dashboard, /max: 30/);
assert.match(dashboard, /keyOnly: true/);
assert.match(dashboard, /eq\(customerSubscriptions\.organisationId, organisationId\)/);
assert.match(dashboard, /inArray\(customers\.siteId, allowedSiteIds\)/);
assert.match(dashboard, /scopeKey/);
assert.match(notifications, /eq\(subscriptionNotifications\.organisationId, organisationId\)/);
assert.match(notifications, /notificationWriteLimiter/);
assert.match(notifications, /keyOnly: true/);
assert.match(notifications, /occurrenceKey: `renewal_reminder:\$\{today\}`/);
assert.match(notifications, /onConflictDoNothing/);
assert.match(notifications, /allowedSiteIds: req\.siteScope/);
assert.match(loyalty, /eq\(sites\.organisationId, organisationId\)/);
assert.match(loyalty, /eq\(loyaltyProgram\.organisationId, organisationId\)/);
assert.match(loyalty, /expireLoyaltyPoints/);
assert.match(loyalty, /isNull\(loyaltyPoints\.expiredAt\)/);
assert.match(loyalty, /awardReferralPoints/);
assert.match(loyalty, /referredClientId: context\.referredClientId/);
assert.match(auth, /req\.organisationId = user\?\.organisationId/);
assert.match(settings, /fetch\("\/api\/loyalty-program"/);
assert.match(settings, /body: JSON\.stringify\(\{\s+enabled,/);
assert.match(routes, /const program = await db\.transaction/);
assert.match(card, /XPRESSPRO:\$\{organisationId\}:\$\{membershipNumber\}:\$\{expiry\}/);
assert.match(layout, /item\.href !== "\/membership-plans"/);
assert.match(layout, /pb-\[env\(safe-area-inset-bottom\)\]/);

for (const indexName of [
  "idx_sub_plans_org",
  "idx_customer_subs_org",
  "idx_customer_subs_client",
  "idx_customer_subs_status",
  "idx_customer_subs_expiry",
  "idx_sub_transactions_sub",
  "idx_sub_payments_org",
  "idx_loyalty_points_client",
  "idx_sub_notifications_occurrence_unique",
  "idx_loyalty_points_referral_reason",
]) {
  assert.match(schema, new RegExp(indexName));
}
assert.match(schema, /expiredAt: timestamp\("expired_at"\)/);

console.log("subscription security regression tests passed");
