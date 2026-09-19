import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const customers = readFileSync(path.join(root, "client/src/pages/customers.tsx"), "utf8");
const i18n = readFileSync(path.join(root, "client/src/lib/i18n.ts"), "utf8");

assert.match(customers, /queryKey: \["\/api\/loyalty-program"\]/, "the directory should load the organisation loyalty threshold once");
assert.match(customers, /customer\.loyaltyPoints/, "the visible balance must use the persisted available customer balance");
assert.match(customers, /filter === "points" && points > 0/, "customers with points should be filterable");
assert.match(customers, /filter === "reward" && points >= rewardThreshold/, "reward-ready customers should be filterable");
assert.doesNotMatch(customers, /\["expired", t\("expired_subscription"\)\]/, "expired subscription should not appear as a directory filter");
assert.doesNotMatch(customers, /\["none", t\("no_subscription"\)\]/, "no subscription should not appear as a directory filter");
assert.match(customers, /loyalty_sort_nearest_reward/, "the directory should support nearest-reward sorting");
assert.match(customers, /lg:hidden/, "mobile should use compact loyalty badges");
assert.match(customers, /hidden min-w-\[190px\] lg:block/, "desktop should use a dedicated loyalty area");
assert.match(customers, /!showMembershipColumns && customer\.email/, "membership detail mode should hide secondary columns instead of overflowing");

for (const label of ["customers_with_points", "loyalty_points_remaining", "loyalty_sort_highest", "loyalty_sort_nearest_reward"]) {
  assert.equal((i18n.match(new RegExp(`"${label}"`, "g")) ?? []).length, 3, `${label} should be translated in EN, FR and PT`);
}

console.log("customer loyalty directory regression checks passed");
