import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const readPage = (name: string) => readFileSync(resolve(here, `../../client/src/pages/${name}.tsx`), "utf8");

test("membership management uses localized responsive presentation", () => {
  const source = readPage("membership-plans");
  assert.match(source, /membership-management-redesign/);
  assert.match(source, /const money =/);
  assert.match(source, /copy\.subscribers/);
  assert.doesNotMatch(source, />Subscribers</);
  assert.doesNotMatch(source, />Revenue</);
  assert.doesNotMatch(source, />Edit</);
});

test("current subscription uses localized money and branded header", () => {
  const source = readPage("subscriptions");
  assert.match(source, /current-subscription-redesign/);
  assert.match(source, /toLocaleString\(i18n\.language/);
  assert.match(source, /text-\[#082D5B\]/);
});

test("settings tabs remain usable on narrow screens", () => {
  const source = readPage("settings");
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /shrink-0/);
  assert.match(source, /settings-tabs/);
});
