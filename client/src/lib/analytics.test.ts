import assert from "node:assert/strict";
import { trackAppVisit, trackEvent } from "./analytics.ts";

const storage = new Map<string, string>();
const events: string[] = [];

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    umami: { track: (name: string) => events.push(name) },
  },
});

trackAppVisit();
trackAppVisit();
assert.deepEqual(events, ["app_visit"], "a browser visit is counted once within the 30-minute window");

trackEvent("signup_completed");
assert.deepEqual(events, ["app_visit", "signup_completed"], "registration tracking sends only the event name");

storage.set("xpresspro.analytics.last-visit", String(Date.now() - 30 * 60 * 1000 - 1));
trackAppVisit();
assert.deepEqual(events, ["app_visit", "signup_completed", "app_visit"], "a later visit starts after 30 minutes");

console.log("analytics tracking tests passed");
