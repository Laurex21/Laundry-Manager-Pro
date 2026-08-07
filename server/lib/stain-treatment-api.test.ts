import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getActiveTreatmentPrices,
  replaceTreatmentPrices,
  resolveTreatmentPrice,
  type PricingDatabase,
} from "./stain-treatment";

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
assert.equal(canManageStainTreatmentPricing({ role: "owner", capabilities: [] }), true);
assert.equal(canManageStainTreatmentPricing({ role: "manager", capabilities: ["manage_stain_treatment_pricing"] }), true);
assert.equal(canManageStainTreatmentPricing({ role: "manager", capabilities: [] }), false);
assert.equal(canManageStainTreatmentPricing({ role: "operator", capabilities: ["manage_stain_treatment_pricing"] }), false);

const routesSource = readFileSync(new URL("./stain-treatment-routes.ts", import.meta.url), "utf8");
assert.match(routesSource, /GET \/api\/stain-treatment\/prices|app\.get\("\/api\/stain-treatment\/prices"/);
assert.match(routesSource, /PUT \/api\/stain-treatment\/prices|app\.put\("\/api\/stain-treatment\/prices"/);
assert.match(routesSource, /isAuthenticated/);
assert.doesNotMatch(routesSource, /req\.body\.(organisationId|siteId|currency)/);

console.log("stain treatment pricing API tests passed");
