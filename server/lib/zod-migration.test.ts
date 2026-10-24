import assert from "node:assert/strict";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOrderWithItemsSchema } from "../../shared/routes";
import { insertCustomerSchema, insertServiceSchema, insertPaymentSchema } from "../../shared/schema";
import { boundedJsonObject } from "./public-payload-validation";

// Real application schemas and the browser's form resolver, without a DB or provider.
const order = { customerId: 1, items: [{ serviceId: 2, quantity: 1.25 }] };
const parsed = createOrderWithItemsSchema.parse(order);
assert.equal(parsed.items[0].quantity, "1.25");
assert.equal(parsed.discountPct, 0);
assert.equal(parsed.advancePayment, "0");
assert.deepEqual(parsed.garmentItems, []);
assert.deepEqual(parsed.machineUsages, []);
assert.equal(createOrderWithItemsSchema.parse({ ...order, discountPct: "12.5" }).discountPct, 12.5);
for (const quantity of [0, -1, "bad", "0.0000001"]) {
  assert.equal(createOrderWithItemsSchema.safeParse({ ...order, items: [{ serviceId: 2, quantity }] }).success, false);
}

const options = { criteriaMode: "firstError" as const, fields: {}, shouldUseNativeValidation: false };
const validForm = await zodResolver(createOrderWithItemsSchema)(order, undefined, options);
assert.deepEqual(validForm.values, parsed);
assert.deepEqual(validForm.errors, {});
const invalidForm = await zodResolver(createOrderWithItemsSchema)({ ...order, items: [{ serviceId: 0, quantity: 0 }] }, undefined, options);
assert.deepEqual(invalidForm.values, {});
assert.ok(invalidForm.errors.items?.[0]?.serviceId?.message);
assert.ok(invalidForm.errors.items?.[0]?.quantity?.message);

assert.equal(insertCustomerSchema.parse({ name: "Synthetic customer", phone: "600000000", address: "Synthetic address" }).name, "Synthetic customer");
assert.equal(insertServiceSchema.parse({ name: "Synthetic service", price: "1000", unit: "piece", category: "Synthetic category" }).price, "1000");
const payment = insertPaymentSchema.parse({ orderId: 1, amount: "500", method: "Cash", date: "2026-10-24T12:00:00Z" });
assert.equal(payment.date?.toISOString(), "2026-10-24T12:00:00.000Z");
assert.equal(insertPaymentSchema.safeParse({ orderId: 1, amount: "500", method: "Cash", date: "invalid-date" }).success, false);
assert.equal(insertPaymentSchema.safeParse({ orderId: 1, amount: 500, method: "Cash" }).success, false);

const invalid = createOrderWithItemsSchema.safeParse({ ...order, customerId: "invalid" });
assert.equal(invalid.success, false);
if (!invalid.success) {
  assert.ok(invalid.error instanceof z.ZodError);
  assert.equal(invalid.error.issues[0].path.join("."), "customerId");
  assert.ok(invalid.error.issues[0].message);
}
assert.deepEqual(boundedJsonObject.parse({ arbitraryKey: { items: ["one", 2] } }), { arbitraryKey: { items: ["one", 2] } });
assert.equal(boundedJsonObject.safeParse({ value: "x".repeat(65 * 1024) }).success, false);
assert.equal(boundedJsonObject.safeParse({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }).success, false);
console.log("PASS Zod 4: real order/customer/service/payment schemas, form errors, defaults, coercion and bounded JSON");
