import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.resolve("client/src/pages/subscription-dashboard.tsx"),
  "utf8",
);

if (!source.includes("searchLabel={copy.search}")) {
  throw new Error("Subscription dashboard must pass the localized search label to SubscriberOverview");
}

if (!source.includes("searchLabel: string;")) {
  throw new Error("SubscriberOverview must declare its localized search label prop");
}

const overviewStart = source.indexOf("function SubscriberOverview");
const overviewEnd = source.indexOf("function MetricCard", overviewStart);
const overview = source.slice(overviewStart, overviewEnd > -1 ? overviewEnd : undefined);

if (overview.includes("copy.search")) {
  throw new Error("SubscriberOverview must not reference parent-local copy state");
}

if (!overview.includes("placeholder={searchLabel}")) {
  throw new Error("SubscriberOverview must render the provided localized search label");
}

console.log("subscription dashboard scope regression test passed");
