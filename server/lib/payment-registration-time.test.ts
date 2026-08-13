import assert from "node:assert/strict";
import { paymentDateWithRegistrationTime } from "../../client/src/lib/payment-date";

const registrationTime = new Date(2026, 7, 13, 20, 26, 8, 321);
const paymentDate = paymentDateWithRegistrationTime("2026-08-10", registrationTime);

assert.equal(paymentDate.getFullYear(), 2026);
assert.equal(paymentDate.getMonth(), 7);
assert.equal(paymentDate.getDate(), 10);
assert.equal(paymentDate.getHours(), 20);
assert.equal(paymentDate.getMinutes(), 26);
assert.equal(paymentDate.getSeconds(), 8);
assert.equal(paymentDate.getMilliseconds(), 321);
assert.ok(Number.isNaN(paymentDateWithRegistrationTime("invalid", registrationTime).getTime()));

console.log("payment registration time regression tests passed");
