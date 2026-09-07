import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const dashboard = readFileSync(resolve(root, "client/src/pages/dashboard.tsx"), "utf8");
const analytics = readFileSync(resolve(root, "client/src/pages/analytics.tsx"), "utf8");

assert.match(
  dashboard,
  /<Link href="\/analytics#churn-risk">/,
  "the dashboard churn alert must deep-link to the churn-risk section",
);
assert.match(
  analytics,
  /id="churn-risk"/,
  "the analytics churn card must expose the matching anchor",
);
assert.match(
  analytics,
  /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/,
  "the async analytics section must scroll into view after its data loads",
);
assert.match(
  analytics,
  /focus\(\{ preventScroll: true \}\)/,
  "the target must receive focus so keyboard and screen-reader users land on the result",
);

console.log("dashboard churn deep-link regression test passed");
