import fs from "node:fs";
import assert from "node:assert/strict";

const orders = fs.readFileSync("client/src/pages/orders.tsx", "utf8");
const storage = fs.readFileSync("server/storage.ts", "utf8");
assert.match(orders, /no_orders_for_site/);
assert.match(orders, /currentSite\.name/);
assert.match(orders, /switchSite\(null\)/);
assert.match(orders, /view_all_sites/);
const scopedOrderList = storage.slice(
  storage.indexOf("async getOrdersBySite"),
  storage.indexOf("async getCustomersBySite"),
);
assert.match(scopedOrderList, /returnedForTreatment: garmentItems\.returnedForTreatment/);
assert.doesNotMatch(scopedOrderList, /db\.select\(\)\.from\(garmentItems\)/);
console.log("Orders site-aware empty-state checks passed.");
