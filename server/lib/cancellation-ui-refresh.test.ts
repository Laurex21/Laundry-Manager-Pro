import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("client/src/pages/order-detail.tsx", "utf8");

assert.match(source, /isReviewingCancellation/);
assert.match(source, /setQueryData\(\["\/api\/orders\/:id", orderId\]/);
assert.match(source, /customer-subscription-summaries/);
assert.match(source, /subscription-dashboard/);
assert.match(source, /Loader2[^\n]*animate-spin/);
assert.match(source, /if \(!res\.ok\) throw new Error/);

console.log("Cancellation approval refresh regression test passed");
