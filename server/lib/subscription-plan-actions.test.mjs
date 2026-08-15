import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync("client/src/pages/membership-plans.tsx", "utf8");
const routes = readFileSync("server/lib/membership-routes.ts", "utf8");

assert.match(ui, /DropdownMenuTrigger/, "three-dot control must open an action menu");
assert.match(ui, /Restore to active/, "archived plans need a restore action");
assert.match(ui, /statusMutation\.mutate\(\{ id: plan\.id, status: "active" \}\)/, "restore must call the status API");
assert.match(ui, /Archive plan/, "active plans need an archive action");
assert.match(ui, /Delete plan/, "plans with no active subscribers need a delete action");
assert.match(ui, /deleteMutation\.mutate/, "delete action must call the delete API");
assert.match(ui, /AlertDialog/, "archive and delete must require confirmation");
assert.match(ui, /plan\.subscriberCount > 0/, "destructive actions must be blocked while subscribers are active");
assert.match(ui, /aria-label=\{`Actions for \$\{plan\.name\}`\}/, "menu trigger needs an accessible name");
assert.match(routes, /status === "archived"[\s\S]*active\.value > 0/, "server must block archiving plans with active subscribers");
assert.match(routes, /app\.delete\("\/api\/subscription-plans\/:id"[\s\S]*active\.value > 0/, "server must block deleting plans with active subscribers");

console.log("subscription plan actions regression passed");
