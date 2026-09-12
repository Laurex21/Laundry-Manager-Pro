import assert from "node:assert/strict";
import { decodeBase32, encodeBase32, totpCode, verifyTotp } from "./totp";

const rawSecret = Buffer.from("12345678901234567890", "ascii");
const secret = encodeBase32(rawSecret);

assert.deepEqual(decodeBase32(secret), rawSecret);
assert.equal(totpCode(secret, 1), "287082");
assert.equal(verifyTotp(secret, "287082", 30_000, 0), 1);
assert.equal(verifyTotp(secret, "287083", 30_000, 0), null);
assert.equal(verifyTotp(secret, "12345", 30_000, 0), null);

console.log("TOTP regression tests passed");
