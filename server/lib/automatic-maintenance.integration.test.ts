import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../shared/schema";

process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/isolated_maintenance";
process.env.SAAS_BILLING_MODE = "disabled";
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED = "true";
process.env.PLATFORM_ADMIN_EMAILS = "synthetic@example.invalid";
const memory = new PGlite();
const testDb = drizzle(memory, { schema });
const { db, pool } = await import("../db");
for (const method of ["select", "insert", "update", "delete", "execute", "transaction"] as const) {
  (db as any)[method] = testDb[method].bind(testDb);
}
const statements: string[] = [];
let connects = 0;
(pool as any).query = async (sql: string, params?: any[]) => {
  statements.push(sql);
  const result = await memory.query(sql, params);
  return { rows: result.rows, rowCount: result.affectedRows };
};
(pool as any).connect = async () => {
  connects++;
  return { query: async () => ({ rows: [{ locked: false }] }), release() {} };
};
const { automaticMaintenanceSuspended } = await import("./automatic-maintenance");
const { runDailyJobsWithLock } = await import("./daily-jobs");
const { recalculateCachedCustomerIntelligence, startTemporalIntelligenceJob, refreshCustomerAnalyticsFromHistory } = await import("./temporal-intelligence");
const { repairKnownAccountOrganisationLinks } = await import("../replit_integrations/auth/replitAuth");
const { syncConfiguredPlatformAdmins } = await import("./platform-admin-bootstrap");
const { ensureGarmentVerificationSchema } = await import("./garment-verification-schema");
const { ensureOrderItemQuantitySupportsDecimals } = await import("./order-item-quantity-schema");
const { requireExistingColumns } = await import("./existing-schema-check");
let scheduled = 0;
const nativeInterval = globalThis.setInterval;
try {
  for (const sql of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))) await memory.exec(sql);
  await testDb.insert(schema.users).values({ id: "synthetic-owner" });
  await testDb.insert(schema.organisations).values({ id: 1, name: "Synthetic", ownerId: "synthetic-owner" });
  await testDb.insert(schema.sites).values({ id: 1, organisationId: 1, name: "Synthetic" });
  await testDb.insert(schema.customers).values({ id: 1, name: "Synthetic", phone: "", address: "", siteId: 1, visitCount: 5, lastVisitAt: new Date("2025-01-01"), avgDaysBetweenVisits: "7", churnRiskScore: 5 });
  const before = (await memory.query("SELECT to_jsonb(c) AS row FROM customers c")).rows;
  globalThis.setInterval = ((..._args: any[]) => { scheduled++; return { unref() {} }; }) as any;
  await runDailyJobsWithLock();
  await recalculateCachedCustomerIntelligence();
  startTemporalIntelligenceJob();
  await repairKnownAccountOrganisationLinks();
  await syncConfiguredPlatformAdmins();
  assert.equal(connects, 0, "Suspended tasks do not acquire a database connection");
  assert.equal(statements.length, 0, "Suspended repairs do not issue SQL");
  assert.equal(scheduled, 0, "Suspended recalculation does not schedule timers");
  process.env.SAAS_BILLING_MODE = "sandbox";
  process.env.PAWAPAY_SANDBOX_API_TOKEN = "synthetic-key-never-sent";
  const { startSaasJobs } = await import("./saas-runtime");
  const { registerSaasRoutes } = await import("./saas-routes");
  startSaasJobs();
  registerSaasRoutes({ get() {}, post() {} } as any);
  assert.equal(scheduled, 0, "Even enabled Sandbox SaaS jobs and provider reconciliation remain suspended");
  assert.equal(statements.length, 0);
  process.env.SAAS_BILLING_MODE = "disabled";
  await ensureGarmentVerificationSchema();
  await ensureOrderItemQuantitySupportsDecimals();
  assert.ok(statements.length > 0);
  assert.ok(statements.every(sql => /^\s*SELECT\b/i.test(sql)), "Suspended schema guards only read metadata");
  await testDb.insert(schema.businessSettings).values({ userId: "synthetic-owner" });
  const { storage } = await import("../storage");
  const settingsBefore = (await memory.query("SELECT to_jsonb(s) AS row FROM business_settings s")).rows;
  await storage.getSettings("synthetic-owner");
  assert.deepEqual((await memory.query("SELECT to_jsonb(s) AS row FROM business_settings s")).rows, settingsBefore);
  assert.ok(statements.every(sql => /^\s*SELECT\b/i.test(sql)), "Reading existing settings does not run schema DDL");
  assert.deepEqual((await memory.query("SELECT to_jsonb(c) AS row FROM customers c")).rows, before);
  await assert.rejects(requireExistingColumns("customers", ["missing_required_column"]), /Reviewed schema migration required/);
  assert.ok(statements.every(sql => /^\s*SELECT\b/i.test(sql)), "Missing schema is never repaired implicitly");

  // Explicit business operations remain available during the maintenance pause.
  await refreshCustomerAnalyticsFromHistory(1, testDb as any);
  assert.equal((await memory.query<{ visit_count: number }>("SELECT visit_count FROM customers WHERE id=1")).rows[0].visit_count, 0);
  await memory.exec("UPDATE customers SET visit_count=5, churn_risk_score=5 WHERE id=1");
  for (const value of [undefined, "false"]) {
    if (value === undefined) delete process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED;
    else process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED = value;
    assert.equal(automaticMaintenanceSuspended(), false);
    await runDailyJobsWithLock();
    await recalculateCachedCustomerIntelligence();
  }
  assert.equal(connects, 2, "Normal daily jobs still acquire their advisory lock");
  assert.notEqual((await memory.query<{ churn_risk_score: number }>("SELECT churn_risk_score FROM customers WHERE id=1")).rows[0].churn_risk_score, 5, "Normal customer recalculation resumes");
  statements.length = 0;
  await ensureGarmentVerificationSchema();
  assert.ok(statements.some(sql => /^\s*ALTER\b/i.test(sql)), "Default schema behaviour is preserved");
  startTemporalIntelligenceJob();
  assert.equal(scheduled, 1, "Normal scheduler resumes");
  // Drain the startup calculation before shutting down the in-memory DB.
  await recalculateCachedCustomerIntelligence();
  console.log("PASS isolated maintenance pause: zero background connections/writes/timers, read-only schema validation, missing schema refusal, explicit operations preserved, normal maintenance resumed");
} finally {
  globalThis.setInterval = nativeInterval;
  await memory.close();
  await pool.end();
}
