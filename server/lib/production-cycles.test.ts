import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const board = readFileSync(join(root, "client/src/components/production-cycle-board.tsx"), "utf8");
const machines = readFileSync(join(root, "client/src/pages/machines.tsx"), "utf8");
const migration = readFileSync(join(root, "migrations/20260730_production_cycles.sql"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");

assert.match(schema, /export const productionCycles/);
assert.match(schema, /export const productionCycleOrders/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS production_cycles/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS production_cycle_orders/);
assert.match(migration, /idx_one_active_cycle_per_machine/);
assert.match(routes, /\/api\/production-cycles/);
assert.match(routes, /Machine capacity would be exceeded/);
assert.match(routes, /Order already belongs to another active cycle/);
assert.match(routes, /pg_advisory_xact_lock/);
assert.match(routes, /production_cycle_orders WHERE cycle_id = \$1/);
assert.match(routes, /INSERT INTO machine_usage/);
assert.match(routes, /UPDATE machines[\s\S]*cycle_count = cycle_count \+ 1/);
assert.match(routes, /cycle\.stage === "washing" \? "drying" : "ironing"/);
assert.match(board, /data-testid="section-production-cycles"/);
assert.match(board, /role="progressbar"/);
assert.match(board, /function ProductionCycleCard/);
assert.match(machines, /<ProductionCycleBoard \/>/);
assert.match(i18n, /production_cycles: "Production cycles"/);
assert.match(i18n, /production_cycles: "Cycles de production"/);
assert.match(i18n, /production_cycles: "Ciclos de produção"/);

console.log("Production cycle workflow regression checks passed");
