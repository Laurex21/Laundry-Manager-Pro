import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routes = fs.readFileSync(path.join(root, "server/routes.ts"), "utf8");
const board = fs.readFileSync(path.join(root, "client/src/components/production-cycle-board.tsx"), "utf8");

assert.match(routes, /DELETE FROM production_cycle_orders WHERE cycle_id = \$1 AND order_id = \$2/);
assert.match(routes, /COALESCE\(\(SELECT SUM\(weight_kg\).*production_cycle_orders.*\), 0\)/s);
assert.match(routes, /app\.delete\("\/api\/production-cycles\/:id"/);
assert.match(routes, /status = 'preparing'/);
assert.match(board, /button-cancel-cycle-/);
assert.match(board, /action: "cancel"/);
assert.match(board, /cancel_cycle_confirm/);

console.log("machine cycle cancellation regression test passed");
