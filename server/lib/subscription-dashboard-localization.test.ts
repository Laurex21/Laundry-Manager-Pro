import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "../../client/src/pages/subscription-dashboard.tsx"), "utf8");

test("subscription dashboard localizes money and user-facing copy", () => {
  assert.match(source, /toLocaleString\(i18n\.language/);
  assert.match(source, /copy\.collected/);
  assert.match(source, /copy\.outstanding/);
  assert.match(source, /copy\.advance/);
  assert.match(source, /copy\.health/);
  assert.match(source, /placeholder=\{copy\.search\}/);
  assert.doesNotMatch(source, /label="Collected this period"/);
  assert.doesNotMatch(source, /label="Outstanding"/);
  assert.doesNotMatch(source, /label="Advance credit held"/);
});
