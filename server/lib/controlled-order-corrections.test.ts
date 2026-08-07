import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
const { editOrderControlled } = await import("./order-corrections");

const root = process.cwd();
const service = readFileSync(join(root, "server/lib/order-corrections.ts"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const migration = readFileSync(join(root, "migrations/20260730_controlled_order_corrections.sql"), "utf8");
const component = readFileSync(join(root, "client/src/components/order-correction-actions.tsx"), "utf8");
const translations = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");
const orderDetail = readFileSync(join(root, "client/src/pages/order-detail.tsx"), "utf8");
const auth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");

assert.match(schema, /correctedFromOrderId: integer\("corrected_from_order_id"\)/);
assert.match(schema, /export const orderCorrections = pgTable\("order_corrections"/);
assert.match(migration, /before_snapshot jsonb NOT NULL/);
assert.match(migration, /after_snapshot jsonb NOT NULL/);
assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE/i);

assert.match(service, /FOR UPDATE OF o/);
assert.match(service, /order\.status !== "received"/);
assert.match(service, /deps\.has_payments/);
assert.match(service, /deps\.has_credit/);
assert.match(service, /deps\.has_subscription/);
assert.match(service, /deps\.has_cycles/);
assert.match(service, /customer_organisation_id|organisation_id/);
assert.match(service, /INSERT INTO order_corrections/);
assert.match(service, /to_regclass\('public\.production_cycle_orders'\)/);
assert.match(service, /available\.production_cycle_orders && available\.production_cycles/);
assert.match(service, /enabled \? `EXISTS\(\$\{sql\}\)` : "false"/);
assert.match(service, /before_snapshot, after_snapshot/);
assert.match(service, /existingPrices\.get\(Number\(service\.id\)\) \?\? String\(service\.price\)/);
assert.match(service, /calculateOrderTotals/);
assert.match(service, /Replaced by corrected order/);
assert.match(
  service,
  /order\.customer_id, actorEmployeeId, "received", order\.total_amount/,
  "A corrected replacement must restart at the received stage",
);
assert.doesNotMatch(service, /DELETE FROM orders/);

assert.match(routes, /\/api\/orders\/:id\/correction-eligibility/);
assert.match(routes, /Order correction eligibility failed/);
assert.match(routes, /Reference: \$\{reference\}/);
assert.match(routes, /\/api\/orders\/:id\/correct"/);
assert.match(routes, /\/api\/orders\/:id\/corrected-copy/);
assert.match(routes, /\/api\/orders\/:id\/paid-correction/);
assert.doesNotMatch(routes, /kind: z\.enum\(\["balance"/);
assert.match(routes, /controlledOrderEditSchema\.extend\(\{ idempotencyKey/);
assert.match(routes, /requireSiteRole\(req, res, order\.siteId, \["owner", "manager"\]\)/);

assert.match(component, /<fieldset/);
assert.match(component, /correction_audit_notice/);
assert.match(component, /paid_order_correction_locked/);
assert.match(component, /data-testid="button-correct-order"/);
assert.match(component, /data-testid="order-correction-loading"/);
assert.match(component, /data-testid="order-correction-error"/);
assert.match(component, /data-testid="order-correction-role-restricted"/);
assert.match(component, /refetchEligibility/);
assert.match(component, /eligibility\?\.canEdit/);
assert.match(translations, /order_correction_check_failed:/);
assert.match(translations, /retry:/);
assert.match(translations, /unknown_error:/);
assert.match(orderDetail, /OrderCorrectionActions/);
assert.match(orderDetail, /data-testid="order-correction-history"/);
assert.match(orderDetail, /correctionSummary/);
assert.match(auth, /CREATE TABLE IF NOT EXISTS production_cycles/);
assert.match(auth, /CREATE TABLE IF NOT EXISTS production_cycle_orders/);

type Scenario = { cash: string; credit: string; total: string; failAudit?: boolean };
function correctionDatabase(scenario: Scenario) {
  const sql: string[] = [];
  let nextItemId = 91;
  let completed: any = null;
  const client = {
    async query(text: string, values?: any[]) {
      sql.push(text);
      if (scenario.failAudit && text.includes("INSERT INTO order_corrections")) throw new Error("audit write failed");
      if (text.includes("SELECT o.*, s.organisation_id")) return { rows: [{ id:7,site_id:2,organisation_id:1,status:"received",payment_status:"paid",customer_id:3,discount_pct:"0",discount_amount:"0",discount:"0",pickup_cost:"0",corrected_from_order_id:null,has_corrections:false }], rowCount:1 };
      if (text.includes("SELECT after_snapshot FROM order_corrections")) return completed ? { rows:[{ after_snapshot:completed }],rowCount:1 } : { rows:[],rowCount:0 };
      if (text.includes("to_regclass('public.payments')")) return { rows:[{ payments:true,credit_transactions:true,subscription_transactions:false,production_cycle_orders:false,production_cycles:false,machine_usage:false,loyalty_points:false,order_status_history:true,order_corrections:true }], rowCount:1 };
      if (text.includes("AS has_payments")) return { rows:[{ has_payments:true,has_credit:scenario.credit !== "0",has_subscription:false,has_cycles:false,has_active_cycles:false,has_machine_usage:false,has_loyalty:false,has_status_progress:false,has_corrections:false }], rowCount:1 };
      if (text.includes("SELECT c.id FROM customers")) return { rows:[{ id:3 }], rowCount:1 };
      if (text.includes("FROM services sv")) return { rows:[{ id:1,price:scenario.total }], rowCount:1 };
      if (text.includes("SELECT service_id, price_at_order")) return { rows:[{ service_id:1,price_at_order:scenario.total }], rowCount:1 };
      if (text.includes("SELECT to_jsonb(o)")) return { rows:[{ order:{ id:7 },items:[],garments:[] }], rowCount:1 };
      if (text.includes("AS cash_paid")) return { rows:[{ cash_paid:scenario.cash,refunded:"0",credit_applied:scenario.credit }], rowCount:1 };
      if (text.includes("SELECT id, service_id FROM order_items")) return { rows:[{ id:44,service_id:1 }], rowCount:1 };
      if (text.includes("SELECT credit_balance FROM customers")) return { rows:[{ credit_balance:"1.00" }], rowCount:1 };
      if (text.includes("SELECT id FROM orders") && text.includes("FOR UPDATE")) return { rows:[{ id:7 }], rowCount:1 };
      if (text.includes("FROM order_refunds") && text.includes("idempotency_key")) return { rows:[], rowCount:0 };
      if (text.includes("INSERT INTO order_refunds")) return { rows:[{ id:51 }], rowCount:1 };
      if (text.includes(" AS balance")) return { rows:[{ balance:"0" }], rowCount:1 };
      if (text.includes("INSERT INTO order_corrections")) { completed = values?.[4]; return { rows:[],rowCount:1 }; }
      if (text.includes("RETURNING id")) return { rows:[{ id:nextItemId++ }], rowCount:1 };
      return { rows:[], rowCount:text.startsWith("SELECT") ? 0 : 1 };
    },
    release() { sql.push("RELEASE"); },
  };
  return { sql, source:{ async connect() { return client; } } };
}

const correctionInput = { customerId:3,entryDate:new Date("2026-08-07"),pickupDate:null,reason:"Manager corrected paid order",idempotencyKey:"paid-correction-behavior-001",items:[{ serviceId:1,quantity:1 }],garments:[] };
for (const [scenario,expected] of [
  [{ cash:"10",credit:"0",total:"12" },{ kind:"balance",amount:"2.00" }],
  [{ cash:"10",credit:"5",total:"12" },{ kind:"customer_credit",amount:"3.00" }],
  [{ cash:"15",credit:"0",total:"12" },{ kind:"approved_internal_refund",amount:"3.00",externalTransfer:false }],
] as const) {
  const db = correctionDatabase(scenario);
  const result = await editOrderControlled(7,2,"manager-user",correctionInput,db.source as any);
  assert.deepEqual(result.financialOutcome,expected);
  assert.ok(db.sql.includes("BEGIN") && db.sql.includes("COMMIT"));
  assert.ok(db.sql.some(statement => statement.includes("UPDATE order_items SET quantity")), "surviving service lines retain stable IDs");
  assert.equal(db.sql.filter(statement => statement.includes("INSERT INTO order_corrections")).length,1);
}

const rollbackDb = correctionDatabase({ cash:"15",credit:"0",total:"12",failAudit:true });
await assert.rejects(editOrderControlled(7,2,"manager-user",correctionInput,rollbackDb.source as any),/audit write failed/);
assert.ok(rollbackDb.sql.includes("ROLLBACK") && !rollbackDb.sql.includes("COMMIT"));
const replayDb = correctionDatabase({ cash:"10",credit:"0",total:"12" });
const first = await editOrderControlled(7,2,"manager-user",correctionInput,replayDb.source as any);
const mutationCount = replayDb.sql.filter(statement => /UPDATE orders SET|UPDATE order_items SET|INSERT INTO order_corrections/.test(statement)).length;
assert.deepEqual(await editOrderControlled(7,2,"manager-user",correctionInput,replayDb.source as any),first);
assert.equal(replayDb.sql.filter(statement => /UPDATE orders SET|UPDATE order_items SET|INSERT INTO order_corrections/.test(statement)).length,mutationCount,"completed correction replay must not mutate again");
await assert.rejects(editOrderControlled(7,2,"manager-user",{ ...correctionInput,reason:"Different correction payload" },replayDb.source as any),/different correction request/);
assert.match(routes, /requireSiteRole\(req, res, order\.siteId, \["owner", "manager"\]\)/, "paid corrections are role-authorized before mutation");

console.log("Controlled order correction regression checks passed");
