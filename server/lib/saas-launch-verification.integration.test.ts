import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../shared/schema";
import { saasSelection } from "../../shared/saas-plans";

// No configured database or provider credentials are used by this rehearsal.
process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/isolated_launch";
const mode = process.argv.includes("--live") ? "live" : "sandbox";
const callbackPath = `/api/saas/${mode}/callback`;
process.env.NODE_ENV = mode === "live" ? "production" : "test";
process.env.SAAS_BILLING_MODE = mode;
if (mode === "live") {
  process.env.SAAS_LIVE_ENABLED = "true";
  process.env.SAAS_DATABASE_ENVIRONMENT = "production";
  process.env.PAWAPAY_PRODUCTION_API_TOKEN = "synthetic-key-never-sent";
  process.env.SAAS_PRODUCTION_ORIGIN = "https://isolated-launch.example";
}
delete process.env.PAWAPAY_SANDBOX_API_TOKEN;
delete process.env.SAAS_SANDBOX_CALLBACK_ORIGIN;
const pg = new PGlite();
const testDb = drizzle(pg, { schema });
const { db, pool } = await import("../db");
for (const method of ["select", "insert", "update", "delete", "execute", "transaction"] as const) {
  (db as any)[method] = testDb[method].bind(testDb);
}
const query = async (text: string, params?: any[]) => {
  const result = await pg.query(text, params);
  return { rows: result.rows, rowCount: result.affectedRows };
};
(pool as any).query = query;
(pool as any).connect = async () => ({ query, release() {} });
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
let keyRequests = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: any) => {
  assert.equal(String(input), `https://api.${mode === "live" ? "" : "sandbox."}pawapay.io/v2/public-key/http`, "No payment/status API call is allowed during callback-only tests");
  keyRequests++;
  return new Response(JSON.stringify([{ id: "isolated-launch-key", key: publicKey.export({ type: "spki", format: "pem" }).toString() }]));
};
try {
  for (const statement of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))) await pg.exec(statement);
  await testDb.insert(schema.users).values([{ id: "launch-owner", organisationId: 1 }, { id: "foreign-owner", organisationId: 2 }]);
  await testDb.insert(schema.organisations).values([{ id: 1, name: "Synthetic launch", ownerId: "launch-owner" }, { id: 2, name: "Synthetic foreign", ownerId: "foreign-owner" }]);
  await testDb.insert(schema.sites).values([{ id: 10, name: "Synthetic site", organisationId: 1 }, { id: 20, name: "Foreign", organisationId: 2 }]);
  const baseline = await query("SELECT * FROM organisations ORDER BY id");
  const migration = await readFile(new URL("../../migrations/20261021_saas_billing_v5.sql", import.meta.url), "utf8");
  // Rehearse the exact deployment SQL, including its repeatability.
  await pg.exec(migration);
  await pg.exec(migration);
  const environmentMigration = await readFile(new URL("../../migrations/20261021_saas_provider_environment.sql", import.meta.url), "utf8");
  await pg.exec(environmentMigration);
  await pg.exec(environmentMigration);
  assert.deepEqual((await query("SELECT * FROM organisations ORDER BY id")).rows, baseline.rows);
  assert.equal((await query("SELECT count(*)::int AS n FROM saas_accounts")).rows[0].n, 0, "Migration never enrols existing organisations");
  const { saasStore } = await import("./saas-runtime");
  const { registerSaasRoutes } = await import("./saas-routes");
  const handlers = new Map<string, Function>();
  const app: any = { get: (path: string, ...fn: Function[]) => handlers.set("GET " + path, fn.at(-1)!), post: (path: string, ...fn: Function[]) => handlers.set("POST " + path, fn.at(-1)!) };
  registerSaasRoutes(app, { backgroundJobs: false });
  async function pending() {
    const quote = await saasStore.createQuote(1, saasSelection("pro"));
    const invoice = await saasStore.reserveCheckout(1, quote.id);
    await saasStore.recordCheckout(1, quote.id, "launch-code", `https://checkout.${mode === "live" ? "" : "sandbox."}pawapay.io/launch-code`);
    return invoice;
  }
  function event(invoice: any, status = "COMPLETED") {
    return { checkoutId: invoice.checkout_id, checkoutCode: "launch-code", clientReferenceId: invoice.id, status, ...(status === "COMPLETED" ? { deposit: { depositId: crypto.randomUUID(), status, amount: String(invoice.total_xaf), currency: "XAF", country: "CMR" } } : {}) };
  }
  async function callback(body: any, validSignature = true) {
    const rawBody = Buffer.from(JSON.stringify(body));
    const created = Math.floor(Date.now() / 1000);
    const params = `("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="isolated-launch-key";created=${created};expires=${created + 60}`;
    const headers: any = { "content-type": "application/json", "signature-date": new Date().toISOString(), "content-digest": `sha-512=:${crypto.createHash("sha512").update(rawBody).digest("base64")}:`, "signature-input": `sig-pp=${params}` };
    const base = `"@method": POST\n"@authority": isolated-launch.example\n"@path": ${callbackPath}\n"signature-date": ${headers["signature-date"]}\n"content-digest": ${headers["content-digest"]}\n"content-type": application/json\n"@signature-params": ${params}`;
    headers.signature = validSignature ? `sig-pp=:${crypto.sign("sha256", Buffer.from(base), privateKey).toString("base64")}:` : "invalid";
    let status = 200;
    const res: any = { status: (code: number) => { status = code; return res; }, sendStatus: (code: number) => { status = code; return res; }, json: () => res };
    await handlers.get("POST " + callbackPath)!({ method: "POST", path: callbackPath, headers, rawBody, body, is: () => true, get: () => "isolated-launch.example" }, res);
    return status;
  }
  const first = await pending();
  const before = await saasStore.current(1);
  for (const status of ["FAILED", "EXPIRED", "CANCELLED"]) {
    const invoice = status === "FAILED" ? first : await pending();
    assert.equal(await callback(event(invoice, status)), 200);
    assert.equal((await saasStore.invoice(saasStore.db, 1, invoice.id)).status, "failed");
    assert.deepEqual(await saasStore.current(1), before, `${status} must never activate access`);
  }
  const invoice = await pending();
  const completed = event(invoice);
  assert.equal(await callback(completed, false), 401);
  assert.equal(await callback({ ...completed, clientReferenceId: crypto.randomUUID() }), 409);
  assert.equal(await callback({ ...completed, amount: "1" }), 409);
  assert.equal(await callback({ ...completed, deposit: { ...completed.deposit, amount: "1" } }), 409);
  assert.equal(await callback({ ...completed, deposit: undefined }), 409);
  assert.deepEqual(await saasStore.current(1), before);
  assert.equal(await callback(completed), 200, "First signed checkout callback must activate without polling");
  const active = await saasStore.current(1);
  assert.equal(active.phase, "active");
  assert.equal(active.plan, "pro");
  assert.equal((await saasStore.invoice(saasStore.db, 1, invoice.id)).status, "paid");
  assert.equal(await callback(completed), 200);
  assert.deepEqual(await saasStore.current(1), active, "Duplicate notification cannot add another cycle");
  assert.equal(await callback(event(invoice, "FAILED")), 409);
  assert.equal((await query("SELECT count(*)::int AS n FROM saas_accounts WHERE organisation_id=2")).rows[0].n, 0);
  assert.equal((await query("SELECT count(*)::int AS n FROM saas_events WHERE action='payment_applied'")).rows[0].n, 1);
  await pg.exec(migration);
  assert.deepEqual(await saasStore.current(1), active, "Reapplying additive migration preserves paid state");
  // A live adapter cannot read or apply a Sandbox invoice, even with its UUID.
  const { SaasStore } = await import("./saas-store");
  const otherMode = mode === "live" ? "sandbox" : "live";
  const oppositeSource = mode === "live" ? "pawapay_sandbox" : "pawapay_live";
  const liveStore = new SaasStore(saasStore.db, undefined, otherMode);
  await assert.rejects(liveStore.invoice(liveStore.db, 1, invoice.id), /INVOICE_NOT_FOUND/);
  await assert.rejects(liveStore.applyProviderResult(invoice.checkout_id!, completed, oppositeSource), /CHECKOUT_NOT_FOUND/);
  await assert.rejects(saasStore.applyProviderResult(invoice.checkout_id!, completed, oppositeSource), /PROVIDER_ENVIRONMENT_MISMATCH/);
  assert.ok(keyRequests > 0);
  console.log(`PASS isolated ${mode} launch: migration rehearsal, first signed callback without reconciliation, duplicate, failure, expiry, cancellation, tampering and tenant isolation`);
} finally {
  globalThis.fetch = originalFetch;
  await pg.close();
  await pool.end();
}
