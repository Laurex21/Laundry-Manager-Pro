import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildOrderPostingFingerprint,
  prepareTreatmentPosting,
  pricingSetToken,
  postOrderWithTreatments,
  getActiveTreatmentPrices,
  replaceTreatmentPrices,
  resolveTreatmentPrice,
  getStainTreatmentReport,
  validateTreatmentReportInput,
  type PricingDatabase,
} from "./stain-treatment";

const postingServices = [
  { serviceId: 11, unit: "piece", quantity: "2", price: "20.00" },
  { serviceId: 12, unit: "kg", quantity: "3.50", price: "12.00" },
] as const;
const postingRates = [
  { id: 1, level: "standard", unit: "piece", price: "5.00", currency: "XAF", setVersion: 3 },
  { id: 2, level: "intensive", unit: "piece", price: "10.00", currency: "XAF", setVersion: 3 },
  { id: 3, level: "very_intensive", unit: "piece", price: "15.00", currency: "XAF", setVersion: 3 },
  { id: 4, level: "standard", unit: "kg", price: "3.00", currency: "XAF", setVersion: 3 },
  { id: 5, level: "intensive", unit: "kg", price: "8.25", currency: "XAF", setVersion: 3 },
  { id: 6, level: "very_intensive", unit: "kg", price: "9.00", currency: "XAF", setVersion: 3 },
] as const;

const piecePosting = prepareTreatmentPosting(postingServices, postingRates, [
  { orderItemIndex: 0, level: "very_intensive", quantity: "2", idempotencyKey: "piece-line", acknowledgement: { affirmed: true, textVersion: "v1" } },
]);
assert.equal(piecePosting.treatmentSubtotal, "30.00");
const kgPosting = prepareTreatmentPosting(postingServices, postingRates, [
  { orderItemIndex: 1, level: "intensive", quantity: "3.50", idempotencyKey: "kg-line" },
]);
assert.equal(kgPosting.treatmentSubtotal, "28.88");
assert.equal(prepareTreatmentPosting(postingServices, postingRates, [
  { orderItemIndex: 0, level: "standard", quantity: "1", idempotencyKey: "split-a" },
  { orderItemIndex: 0, level: "intensive", quantity: "1", idempotencyKey: "split-b" },
]).treatmentSubtotal, "15.00");
assert.throws(() => prepareTreatmentPosting(postingServices, postingRates, [
  { orderItemIndex: 0, level: "standard", quantity: "2", idempotencyKey: "overflow-a" },
  { orderItemIndex: 0, level: "intensive", quantity: "1", idempotencyKey: "overflow-b" },
]), /service quantity/i);
assert.throws(() => prepareTreatmentPosting([{ serviceId: 9, unit: "load", quantity: "1", price: "1.00" }], postingRates, [{ orderItemIndex: 0, level: "standard", quantity: "1", idempotencyKey: "bad-unit" }]), /unsupported/i);
assert.throws(() => prepareTreatmentPosting(postingServices, postingRates.slice(1), [{ orderItemIndex: 0, level: "standard", quantity: "1", idempotencyKey: "missing-rate" }]), /price/i);
assert.throws(() => prepareTreatmentPosting(postingServices, postingRates, [{ orderItemIndex: 0, level: "very_intensive", quantity: "1", idempotencyKey: "missing-ack" }]), /acknowledgement/i);

const fingerprintPayload = {
  organisationId: 7, siteId: 44, customerId: 5, items: [{ serviceId: 11, quantity: "2.00" }, { serviceId: 12, quantity: "3.50" }],
  treatments: [{ orderItemIndex: 0, level: "standard", quantity: "1.00", idempotencyKey: "line-1" }, { orderItemIndex: 1, level: "intensive", quantity: "1.00", idempotencyKey: "line-2" }],
  expectedPricingSetVersion: pricingSetToken(8, 3), advancePayment: "0", pickupCost: "0", discount: "0",
};
assert.equal(buildOrderPostingFingerprint(fingerprintPayload), buildOrderPostingFingerprint({ expectedPricingSetVersion: pricingSetToken(8, 3), treatments: fingerprintPayload.treatments, items: fingerprintPayload.items, customerId: 5, siteId: 44, organisationId: 7, discount: "0.00", pickupCost: "0.00", advancePayment: "0.00" }));
assert.notEqual(buildOrderPostingFingerprint(fingerprintPayload), buildOrderPostingFingerprint({ ...fingerprintPayload, items: [...fingerprintPayload.items].reverse(), treatments: [...fingerprintPayload.treatments].reverse() }));

const rates = [
  { level: "standard", unit: "piece", price: "5.00" },
  { level: "intensive", unit: "piece", price: "10.00" },
  { level: "very_intensive", unit: "piece", price: "15.00" },
  { level: "standard", unit: "kg", price: "3.00" },
  { level: "intensive", unit: "kg", price: "6.00" },
  { level: "very_intensive", unit: "kg", price: "9.00" },
] as const;

class ScriptedDatabase implements PricingDatabase {
  statements: Array<{ text: string; values?: readonly unknown[] }> = [];
  constructor(private readonly replies: Array<{ rows: any[]; rowCount?: number }>) {}
  async query(text: string, values?: readonly unknown[]) {
    this.statements.push({ text, values });
    const reply = this.replies.shift();
    if (!reply) throw new Error(`Unexpected query: ${text}`);
    return { ...reply, rowCount: reply.rowCount ?? reply.rows.length };
  }
  async connect() { return this; }
  release() {}
}

const replayInput = { organisationId: 7, siteId: 44, customerId: 5, actorId: "actor-1", idempotencyKey: "whole-order-replay-1", items: [{ serviceId: 11, quantity: "2" }], treatments: [] };
const replayFingerprint = buildOrderPostingFingerprint({
  organisationId: 7, siteId: 44, customerId: 5, status: "received", entryDate: null, pickupDate: null,
  discount: "0", discountPct: "0", pickupCost: "0", advancePayment: "0", advancePaymentMethod: "Cash",
  items: replayInput.items, treatments: [], garments: [], expectedPricingSetVersion: undefined,
});
const replayDb = new ScriptedDatabase([
  { rows: [] }, { rows: [] }, { rows: [{ id: 91, request_fingerprint: replayFingerprint }] },
  { rows: [{ id: 91, customer_id: 5, status: "received", payment_status: "unpaid", cleaning_subtotal: "40.00", discount: "0.00", treatment_subtotal: "0.00", other_charges: "0.00", final_total: "40.00" }] },
  { rows: [] }, { rows: [] },
]);
const replayedOrder = await postOrderWithTreatments(replayDb as any, replayInput);
assert.equal(replayedOrder.replayed, true);
assert.equal(replayedOrder.finalTotal, "40.00");
assert.equal(replayDb.statements.some(({ text }) => /INSERT INTO orders/i.test(text)), false, "successful replay must remain immutable");

const mismatchDb = new ScriptedDatabase([{ rows: [] }, { rows: [] }, { rows: [{ id: 91, request_fingerprint: replayFingerprint }] }, { rows: [] }]);
await assert.rejects(() => postOrderWithTreatments(mismatchDb as any, { ...replayInput, customerId: 6 }), /different order request/i);
assert.equal(mismatchDb.statements.at(-1)?.text, "ROLLBACK");

const replacementDb = new ScriptedDatabase([
  { rows: [] }, // BEGIN
  { rows: [{ currency: "XAF" }] },
  { rows: [{ id: 44 }] }, // tenant-safe site assertion
  { rows: [] }, // insert parent
  { rows: [{ id: 8, current_version: 0 }] }, // locked parent
  { rows: [] }, // deactivate
  { rows: [{ current_version: 1 }] }, // advance parent
  ...rates.map((rate, index) => ({ rows: [{ id: index + 1, ...rate, currency: "XAF", set_version: 1 }] })),
  { rows: [] }, // COMMIT
]);
const replaced = await replaceTreatmentPrices(replacementDb, { organisationId: 7, siteId: 44, actorId: "owner-1", rates: [...rates] });
assert.equal(replaced.version, 1);
assert.equal(replaced.currency, "XAF");
assert.equal(replaced.rates.length, 6);
assert.match(replacementDb.statements[4].text, /FOR UPDATE/i);
assert.deepEqual(replacementDb.statements[2].values, [44, 7]);

const badRates = rates.map((rate) => ({ ...rate }));
badRates[4].price = "2.00";
await assert.rejects(() => replaceTreatmentPrices(new ScriptedDatabase([]), { organisationId: 7, siteId: 44, actorId: "owner-1", rates: badRates }), /ascending/i);

const activeDb = new ScriptedDatabase([{ rows: rates.map((rate, index) => ({ id: index + 1, ...rate, currency: "XAF", set_version: 3 })) }]);
const active = await getActiveTreatmentPrices(activeDb, { organisationId: 7, siteId: 44 });
assert.equal(active?.version, 3);
assert.equal(typeof active?.expectedPricingSetVersion, "string");
assert.equal(active?.rates.length, 6);
assert.deepEqual(activeDb.statements[0].values, [7, 44]);
await assert.rejects(
  () => getActiveTreatmentPrices(new ScriptedDatabase([{ rows: rates.slice(0, 5).map((rate, index) => ({ id: index + 1, pricing_set_id: 8, ...rate, currency: "FCFA", set_version: 3 })) }]), { organisationId: 7, siteId: 44 }),
  /incomplete/i,
);

const rollbackDb = new ScriptedDatabase([
  { rows: [] }, { rows: [{ currency: "FCFA" }] }, { rows: [{ id: 44 }] }, { rows: [] },
  { rows: [{ id: 8, current_version: 1 }] }, { rows: [] }, { rows: [{ current_version: 2 }] },
]);
await assert.rejects(
  () => replaceTreatmentPrices(rollbackDb, { organisationId: 7, siteId: 44, actorId: "owner-1", rates: [...rates] }),
  /Unexpected query/,
);
assert.equal(rollbackDb.statements.at(-1)?.text, "ROLLBACK", "failed replacement must roll back the whole version change");

const resolveDb = new ScriptedDatabase([{ rows: [{ id: 2, price: "6.00", currency: "XAF", set_version: 3 }] }]);
const resolved = await resolveTreatmentPrice(resolveDb, { organisationId: 7, siteId: 44, level: "intensive", unit: "kg" });
assert.equal(resolved.price, "6.00");
assert.deepEqual(resolveDb.statements[0].values, [7, 44, "intensive", "kg"]);

process.env.DATABASE_URL ||= "postgresql://invalid:invalid@127.0.0.1:1/never_connected";
const { canManageStainTreatmentPricing } = await import("./stain-treatment-routes");
const { canViewStainTreatmentReports } = await import("./stain-treatment-routes");
assert.equal(canManageStainTreatmentPricing({ role: "owner", capabilities: [] }), true);
assert.equal(canManageStainTreatmentPricing({ role: "manager", capabilities: ["manage_stain_treatment_pricing"] }), true);
assert.equal(canManageStainTreatmentPricing({ role: "manager", capabilities: [] }), false);
assert.equal(canManageStainTreatmentPricing({ role: "operator", capabilities: ["manage_stain_treatment_pricing"] }), false);
assert.equal(canViewStainTreatmentReports({ role: "owner", capabilities: [] }), true);
assert.equal(canViewStainTreatmentReports({ role: "manager", capabilities: ["view_stain_treatment_reports"] }), true);
assert.equal(canViewStainTreatmentReports({ role: "manager", capabilities: [] }), false);
assert.equal(canViewStainTreatmentReports({ role: "operator", capabilities: ["view_stain_treatment_reports"] }), false);
assert.throws(() => validateTreatmentReportInput({ organisationId: 7, siteIds: [44], mode: "booked", from: "2024-01-01", to: "2026-01-01", page: 1, pageSize: 25 }), /366/);
assert.throws(() => validateTreatmentReportInput({ organisationId: 7, siteIds: [], mode: "booked", from: "2026-01-01", to: "2026-01-02", page: 1, pageSize: 25 }), /authorized/i);
const reportDb = new ScriptedDatabase([{ rows: [{ site_id: 44, site_name: "Central", level: "standard", unit: "piece", currency: "XAF", quantity: "2", booked_revenue: "10", collected_revenue: "5", treated_orders: 1, acknowledgement_exceptions: 0, average_booked_revenue: "10", total_groups: 1 }] }]);
const report = await getStainTreatmentReport(reportDb, { organisationId: 7, siteIds: [44], mode: "booked", from: "2026-08-01", to: "2026-08-07", asOf: "2026-08-07", page: 1, pageSize: 25 });
assert.equal(report.groups[0].bookedRevenue, "10.00");
assert.equal(report.groups[0].quantity, "2.00");
assert.deepEqual(reportDb.statements[0].values?.slice(0, 2), [7, [44]]);
assert.match(reportDb.statements[0].text, /payment_date/);
assert.match(reportDb.statements[0].text, /order_refund_allocations/);
assert.match(reportDb.statements[0].text, /count\(DISTINCT e\.order_id\)/i);

const routesSource = readFileSync(new URL("./stain-treatment-routes.ts", import.meta.url), "utf8");
const correctionSource = readFileSync(new URL("./order-corrections.ts", import.meta.url), "utf8");
assert.match(routesSource, /GET \/api\/stain-treatment\/prices|app\.get\("\/api\/stain-treatment\/prices"/);
assert.match(routesSource, /PUT \/api\/stain-treatment\/prices|app\.put\("\/api\/stain-treatment\/prices"/);
assert.match(routesSource, /app\.get\("\/api\/stain-treatment\/report"/);
assert.match(routesSource, /isAuthenticated/);
assert.doesNotMatch(routesSource, /req\.body\.(organisationId|siteId|currency)/);
assert.match(correctionSource, /SELECT id FROM order_stain_treatments[\s\S]*FOR UPDATE/);
assert.match(correctionSource, /order_stain_treatment_adjustments/);
assert.match(correctionSource, /Treatment correction required/);

console.log("stain treatment pricing API tests passed");
const { pool } = await import("../db");
await pool.end();
