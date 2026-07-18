import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/customer-detail.tsx", "utf8");

assert.match(
  source,
  /<TabsList[\s\S]*?className="[^"]*grid-cols-2[^"]*sm:inline-flex[^"]*"/,
  "customer detail tabs must show as a two-column grid on narrow screens",
);

assert.match(
  source,
  /<TabsTrigger className="[^"]*min-h-10[^"]*" value="membership"/,
  "the membership option must remain visible with a usable touch target",
);

console.log("customer detail mobile tabs regression passed");
