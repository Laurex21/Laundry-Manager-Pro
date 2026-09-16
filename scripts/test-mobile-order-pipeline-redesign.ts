import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/order-detail.tsx", "utf8");

assert.match(source, /data-testid="pipeline-mobile-focus"/, "mobile focused pipeline is missing");
assert.match(source, /data-testid="pipeline-desktop-timeline"/, "desktop timeline must remain available");
assert.match(source, /Étape.*PIPELINE_STAGES\.length/, "mobile step count is missing");
assert.match(source, /button-mobile-all-stages/, "all stages bottom sheet trigger is missing");
assert.match(source, /button-mobile-request-cancellation/, "mobile cancellation must remain available as a secondary action");
assert.match(source, /className="w-full md:w-auto"/, "mobile primary CTA must be full width");
assert.match(source, /hidden text-red-600.*md:inline-flex/, "desktop cancellation button should be hidden from the primary mobile action row");
assert.match(source, /hidden w-\[170px\].*md:flex/, "desktop jump selector should not crowd mobile");
assert.match(source, /if \(isPast\) handleSetStatus\(stage\.key\)/, "mobile sheet must not allow skipping directly to future stages");

console.log("mobile order pipeline redesign regression passed");
