import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routes = fs.readFileSync(path.join(root, "server/routes.ts"), "utf8");
const board = fs.readFileSync(path.join(root, "client/src/components/production-cycle-board.tsx"), "utf8");
const machines = fs.readFileSync(path.join(root, "client/src/pages/machines.tsx"), "utf8");

assert.match(routes, /Cycle has no recorded start time/);
assert.match(routes, /INSERT INTO machine_usage/);
assert.match(routes, /actual_duration_minutes/);
assert.match(board, /cycle-duration-alert-/);
assert.match(board, /elapsedMinutes/);
assert.match(board, /cycle_duration_overrun/);
assert.doesNotMatch(machines, /button-machine-usage-/);
assert.doesNotMatch(machines, /onUsage=/);

console.log("machine cycle reliability regression test passed");
