import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../shared/schema";
import { createOrderWithItemsSchema } from "../../shared/routes";

// Always use an in-memory PostgreSQL engine. Never connect to a configured DB.
process.env.DATABASE_URL = "postgresql://test-only:unused@127.0.0.1:1/test_only";
const pg = new PGlite();
const testDb = drizzle(pg, { schema });
const { db, pool } = await import("../db");
for (const method of ["select", "insert", "update", "delete", "execute", "transaction"] as const) {
  (db as any)[method] = testDb[method].bind(testDb);
}
(pool as any).query = (text: string, params?: unknown[]) => pg.query(text, params);
(pool as any).connect = () => { throw new Error("Network database connections are forbidden in this test"); };
const { storage } = await import("../storage");
const { isAuthenticated } = await import("../replit_integrations/auth/replitAuth");

async function tenant(userId: string, currentSiteId: number | null = null) {
  const req: any = {
    path: "/api/auth/user", // Only skip the unrelated legal-acceptance gate.
    session: { userId, currentSiteId, save: (cb: () => void) => cb() },
  };
  let passed = false;
  const res: any = { status: (code: number) => { throw new Error(`Authentication failed: ${code}`); } };
  await isAuthenticated(req, res, () => { passed = true; });
  assert.equal(passed, true);
  return req;
}

try {
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
  for (const statement of statements) await pg.exec(statement);
  await testDb.insert(schema.users).values([
    { id: "owner-a", organisationId: 1 }, { id: "owner-b", organisationId: 2 },
    { id: "staff-a", organisationId: 1, userType: "staff" },
    { id: "unassigned", organisationId: 1, userType: "staff" },
  ]);
  await testDb.insert(schema.organisations).values([
    { id: 1, name: "A", ownerId: "owner-a" }, { id: 2, name: "B", ownerId: "owner-b" },
  ]);
  await testDb.insert(schema.sites).values([
    { id: 1, organisationId: 1, name: "A1" }, { id: 2, organisationId: 1, name: "A2" },
    { id: 3, organisationId: 2, name: "B1" }, { id: 4, organisationId: 1, name: "Closed", isActive: false },
  ]);
  await testDb.insert(schema.siteMembers).values([
    { userId: "staff-a", siteId: 1, role: "operator" },
    { userId: "staff-a", siteId: 3, role: "owner" }, // Corrupt legacy cross-organisation membership.
    { userId: "staff-a", siteId: 4, role: "operator" },
  ]);
  await testDb.insert(schema.customers).values([1, 2, 3].map(id => ({
    id, siteId: id, name: `Customer ${id}`, phone: "000", address: "Test",
  })));
  await testDb.insert(schema.services).values({ id: 1, siteId: 1, name: "Wash", unit: "kg", price: "10", category: "washing" });
  await testDb.insert(schema.employees).values({ id: 1, userId: "owner-a", siteId: 1, name: "Test", role: "owner" });
  await testDb.insert(schema.machines).values([
    { id: 1, userId: "owner-a", siteId: 1, name: "A", capacityKg: "10" },
    { id: 2, userId: "owner-b", siteId: 3, name: "B", capacityKg: "10" },
  ]);
  const entryDate = new Date("2026-10-20T12:34:56Z");
  const input = { customerId: 1, siteId: 1, status: "received", totalAmount: "26.60", entryDate };
  const items = [{ serviceId: 1, quantity: "2.66" }];
  const records = {
    employeeId: 1, actorUserId: "owner-a",
    activities: [{ actionType: "order_created", amount: "26.60", weightKg: "2.66" }],
    machineUsages: [{ machineId: 1, weightProcessed: "2.66" }, { machineId: 2, weightProcessed: "2.66" }],
    initialPayment: { amount: "10.00", method: "Cash", collectedByEmployeeId: 1, date: entryDate },
  };
  const created = await storage.createOrder(input, items, [{ itemName: "Shirt", quantity: 1, color: "burgundy", textileReserve: "Delicate" }], records);
  assert.match(created.orderReference!, /^A1-\d{2}-[2-9A-HJ-NP-Z]{7}$/);
  assert.equal(created.orderNumber, created.orderReference);
  assert.equal((await storage.getOrder(created.id))?.orderReference, created.orderReference);
  await assert.rejects(testDb.insert(schema.orders).values({ ...input, orderReference: created.orderReference }));
  assert.equal(created.paymentStatus, "partial");
  assert.equal(created.requiresGarmentVerification, true);
  const [garment] = await testDb.select().from(schema.garmentItems);
  assert.equal(garment.color, "burgundy");
  assert.equal(garment.textileReserve, "Delicate");
  const [payment] = await testDb.select().from(schema.payments);
  assert.equal(Number(payment.amount), 10);
  assert.equal(payment.date!.toISOString(), entryDate.toISOString());
  assert.equal(payment.isAdvance, true);
  assert.equal((await testDb.select().from(schema.machineUsage)).length, 1);
  assert.equal((await testDb.select().from(schema.machines).where(eq(schema.machines.id, 1)))[0].cycleCount, 1);
  assert.equal((await testDb.select().from(schema.employees))[0].ordersHandled, 1);
  assert.equal((await testDb.select().from(schema.customers).where(eq(schema.customers.id, 1)))[0].visitCount, 1);
  console.log("PASS: order, advance, garments, machine and employee counters saved together");

  const tables = [schema.orders, schema.orderItems, schema.orderStatusHistory, schema.garmentItems,
    schema.payments, schema.employeeActivities, schema.machineUsage, schema.customers, schema.machines, schema.employees];
  const snapshot = async () => Promise.all(tables.map(table => testDb.select().from(table)));
  const before = await snapshot();
  // PostgreSQL rejects the payment after the other inserts and counter updates.
  await assert.rejects(storage.createOrder(input, items, [{ itemName: "Fail", quantity: 1 }], {
    ...records, initialPayment: { ...records.initialPayment, method: "x".repeat(51) },
  }));
  assert.deepEqual(await snapshot(), before);
  // A failure updating derived analytics must also roll back the order and payment.
  await pg.exec(`CREATE FUNCTION fail_analytics() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$;
    CREATE TRIGGER fail_analytics BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION fail_analytics();`);
  await assert.rejects(storage.createOrder(input, items, [], records));
  assert.deepEqual(await snapshot(), before);
  await pg.exec("DROP TRIGGER fail_analytics ON customers; DROP FUNCTION fail_analytics();");
  console.log("PASS: payment and analytics failures leave no partial order, payment or counter changes");

  for (const [amount, expected] of [["0", "unpaid"], ["26.60", "paid"], ["30", "paid"]]) {
    const order = await storage.createOrder(input, items, [], {
      initialPayment: { ...records.initialPayment, amount },
    });
    assert.equal(order.paymentStatus, expected);
    assert.equal((await storage.getPaymentsByOrder(order.id)).length, amount === "0" ? 0 : 1);
  }
  assert.equal((await storage.createOrder({ ...input, totalAmount: "0" }, [], [])).paymentStatus, "paid");
  assert.equal(createOrderWithItemsSchema.safeParse({ customerId: 1, items, advancePayment: "-1" }).success, false);
  console.log("PASS: no advance, full advance, overpayment and free orders retain correct payment status");

  await testDb.insert(schema.orders).values([
    { customerId: 2, siteId: 2, totalAmount: "20" }, { customerId: 3, siteId: 3, totalAmount: "30" },
  ]);
  const ownerA = await tenant("owner-a");
  assert.deepEqual(ownerA.siteScope, [1, 2]);
  const ownerB = await tenant("owner-b");
  assert.deepEqual(ownerB.siteScope, [3]);
  const staff = await tenant("staff-a", 3);
  assert.deepEqual(staff.siteScope, [1]);
  assert.equal(staff.siteId, null);
  assert.deepEqual((await tenant("owner-a", 2)).siteScope, [2]);
  assert.deepEqual((await tenant("unassigned")).siteScope, []);
  for (const req of [ownerA, ownerB, staff]) {
    const rows = await storage.getOrdersBySite(req.siteScope);
    assert.ok(rows.length > 0);
    assert.ok(rows.every(row => req.siteScope.includes(row.siteId)));
    const customers = await storage.getCustomersBySite(req.organisationSiteScope);
    assert.ok(customers.every(row => req.organisationSiteScope.includes(row.siteId)));
  }
  for (const scope of [null, [], undefined]) {
    assert.deepEqual(await storage.getOrdersBySite(scope as any), []);
    assert.deepEqual(await storage.getCustomersBySite(scope as any), []);
  }
  console.log("PASS: real auth and storage isolate two organisations, staff, forged site selections and empty scopes");
  const unpaid = await storage.createOrder(input, items, [], {});
  (pool as any).connect = async () => ({ query: (text: string, params?: unknown[]) => pg.query(text, params), release() {} });
  const { createCorrectedOrderCopy } = await import("./order-corrections");
  const copy = await createCorrectedOrderCopy(unpaid.id, 1, "owner-a", null, "QA reference replacement");
  const copiedOrder = await storage.getOrder(copy.orderId);
  assert.ok(copiedOrder?.orderReference);
  assert.notEqual(copiedOrder?.orderReference, unpaid.orderReference);
  assert.equal((await storage.getOrder(unpaid.id))?.orderReference, unpaid.orderReference);
  console.log("PASS: corrected copy gets its own permanent reference; original reference unchanged");
  await testDb.update(schema.sites).set({ name: "Renamed shop" }).where(eq(schema.sites.id, 1));
  assert.equal((await storage.getOrder(created.id))?.orderNumber, created.orderReference);
  await testDb.update(schema.sites).set({ name: "A1" }).where(eq(schema.sites.id, 1));
} finally {
  await pool.end();
  await pg.close();
}
