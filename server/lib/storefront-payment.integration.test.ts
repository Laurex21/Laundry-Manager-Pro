import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { storefrontFixture } from "../../scripts/storefront-fixture";

// All SQL stays in the isolated PostgreSQL fixture, including the existing cash module.
process.env.DATABASE_URL = "postgresql://test-only:unused@127.0.0.1:1/test_only";
const f = await storefrontFixture();
const { pool } = await import("../db");
const query = async (sql: string, values?: any[]) => {
  const result = await f.pg.query(sql, values);
  return { rows: result.rows, rowCount: result.affectedRows || result.rows.length };
};
(pool as any).query = query;
(pool as any).connect = async () => ({ query, release() {} });
const { recordPaymentWithCredit } = await import("./customer-credit");
const { generateDepositReceipt, generatePaymentReceipt } = await import("../../client/src/lib/receipt");
const { DEFAULT_SETTINGS } = await import("../../client/src/lib/receipt-settings");
let html = "";
(globalThis as any).__captureReceiptHtml = (value: string) => { html = value; };
try {
  const lines = [{ serviceId: 1, garment: "tshirt", size: "adult", count: 6 }];
  const estimate = await f.service.quote("pressing-horizon", { lines });
  const trackingSecret = randomBytes(32).toString("hex");
  const submitted = await f.service.submit("pressing-horizon", { lines, trackingSecret, requestKey: randomUUID(), quoteFingerprint: estimate.fingerprint, customerName: "Test boutique encaissement", phone: "+237600000005" });
  const [request] = await f.database.select().from(f.schema.storefrontRequests).where(eq(f.schema.storefrontRequests.reference, submitted.reference));
  await f.service.disposition(f.actor, request.id, 1, true, "Dépôt de test accepté");
  await f.service.review(f.actor, request.id, { expectedVersion: 2, received: true, basis: "measured", measuredGrams: { 1: 1450 }, note: "Poids net sec du test" });
  await f.service.decision(trackingSecret, 3, true);
  const { orderId } = await f.service.convert(f.actor, request.id, 3);
  const paymentInput = { orderId, amountReceived: "500", method: "cash", creditToApply: "0", surplusDisposition: "return" as const, idempotencyKey: randomUUID(), organisationId: f.actor.organisationId, siteId: f.actor.siteId, actorUserId: f.actor.userId, collectedByEmployeeId: null };
  const advance = await recordPaymentWithCredit(paymentInput);
  assert.equal(advance.paymentStatus, "partial");
  assert.equal((await f.service.tracking(trackingSecret)).order?.paymentStatus, "partial");
  await recordPaymentWithCredit(paymentInput);
  assert.equal((await f.database.select().from(f.schema.payments)).length, 1, "same payment key is not collected twice");
  const settlement = await recordPaymentWithCredit({ ...paymentInput, amountReceived: "950", idempotencyKey: randomUUID() });
  assert.equal(settlement.paymentStatus, "paid");
  assert.equal((await f.service.tracking(trackingSecret)).order?.paymentStatus, "paid");
  const [order] = await f.database.select().from(f.schema.orders).where(eq(f.schema.orders.id, orderId));
  const [customer] = await f.database.select().from(f.schema.customers).where(eq(f.schema.customers.id, order.customerId));
  const items = await f.database.select({ quantity: f.schema.orderItems.quantity, priceAtOrder: f.schema.orderItems.priceAtOrder, service: f.schema.services }).from(f.schema.orderItems).innerJoin(f.schema.services, eq(f.schema.services.id, f.schema.orderItems.serviceId)).where(eq(f.schema.orderItems.orderId, orderId));
  const payments = await f.database.select().from(f.schema.payments).where(eq(f.schema.payments.orderId, orderId));
  const garments = await f.database.select().from(f.schema.garmentItems).where(eq(f.schema.garmentItems.orderId, orderId));
  assert.equal(payments.reduce((sum, p) => sum + Number(p.amount), 0), 1450);
  const settings = { ...DEFAULT_SETTINGS, businessName: "TEST BOUTIQUE", receiptLanguage: "fr" };
  await generateDepositReceipt({ ...order, customer, items, payments, garmentItems: garments }, "FCFA ", settings, "html");
  assert.ok(html.includes(order.orderReference!), "permanent order reference appears on the receipt");
  assert.ok(html.includes("1,45 kg"), "measured mass is preserved on the receipt");
  assert.ok(html.includes("1450.00"), "receipt total equals the accepted quote");
  assert.ok(html.includes("ENTIÈREMENT PAYÉ"), "settled deposit receipt has no amount due");
  await generatePaymentReceipt(order.orderReference!, customer, items, garments, { amount: "950", method: "cash", date: new Date().toISOString(), newStatus: "paid" }, payments, order.entryDate!.toISOString(), "", 0, "FCFA ", settings, 0, "html");
  assert.ok(html.includes("950.00") && html.includes("1450.00") && html.includes("ENTIÈREMENT PAYÉ"));
  console.log("Storefront → order → partial payment → idempotent replay → settlement → deposit/payment HTML receipts: passed; no external database or real payment.");
} finally {
  delete (globalThis as any).__captureReceiptHtml;
  await f.pg.close();
  await pool.end();
}
