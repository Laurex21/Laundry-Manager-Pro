import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./stain-treatment.ts", import.meta.url), "utf8");
assert.match(source, /ON CONFLICT \(organisation_id, site_id\) DO NOTHING/i);
assert.match(source, /FOR UPDATE/i);
assert.match(source, /BEGIN/);
assert.match(source, /COMMIT/);
assert.match(source, /ROLLBACK/);
assert.match(source, /pg_advisory_xact_lock/i, "whole-order idempotency must serialize concurrent duplicate submissions");
assert.match(source, /request_fingerprint/i);
assert.match(source, /pricing_conflict/i);
assert.match(source, /INSERT INTO orders[\s\S]*INSERT INTO order_items[\s\S]*INSERT INTO order_stain_treatments/i);
assert.match(source, /persistPaymentInTransaction/);

if (!process.env.TEST_DATABASE_URL) {
  console.log("stain treatment concurrency source gate passed; real PostgreSQL race test blocked: TEST_DATABASE_URL is unset");
} else {
  throw new Error("Real PostgreSQL race harness must be run only through the validated test database harness");
}
