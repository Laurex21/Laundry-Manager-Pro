import assert from "node:assert/strict";
import crypto from "node:crypto";
import { registerPawapayNotificationReceivers } from "./pawapay-notification-receivers";

// No database, real key, provider request, or running application is used.
delete process.env.DATABASE_URL;
process.env.SAAS_BILLING_MODE = "disabled";
process.env.SAAS_LIVE_ENABLED = "false";
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED = "true";
const before = { ...process.env };
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("External requests forbidden in this test"); };
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const handlers = new Map<string, Function>();
let keyRequests = 0, failKeys = false;
let origin: string | undefined = "https://isolated-notifications.example";
registerPawapayNotificationReceivers({ post: (path: string, fn: Function) => handlers.set(path, fn) } as any, {
  origin: () => origin,
  keys: async mode => {
    assert.equal(mode, "live");
    keyRequests++;
    if (failKeys) throw new Error("keys unavailable");
    return [{ id: "synthetic-key", key: publicKey.export({ type: "spki", format: "pem" }).toString() }];
  },
});
function request(kind: "payout" | "refund", body: unknown, ageSeconds = 0) {
  const path = `/api/saas/live/${kind}-callback`, authority = "isolated-notifications.example";
  const rawBody = Buffer.from(JSON.stringify(body));
  const signedAt = Date.now() - ageSeconds * 1000, created = Math.floor(signedAt / 1000);
  const components = ["@method", "@authority", "@path", "signature-date", "content-digest", "content-type"];
  const params = `(${components.map(c => `"${c}"`).join(" ")});alg="ecdsa-p256-sha256";keyid="synthetic-key";created=${created};expires=${created + 60}`;
  const headers: Record<string, string> = { "content-type": "application/json", "signature-date": new Date(signedAt).toISOString(),
    "content-digest": `sha-512=:${crypto.createHash("sha512").update(rawBody).digest("base64")}:`, "signature-input": `sig-pp=${params}` };
  const values = { "@method": "POST", "@authority": authority, "@path": path, ...headers } as Record<string, string>;
  const base = `${components.map(c => `"${c}": ${values[c]}`).join("\n")}\n"@signature-params": ${params}`;
  headers.signature = `sig-pp=:${crypto.sign("sha256", Buffer.from(base), privateKey).toString("base64")}:`;
  return { method: "POST", path, headers, rawBody, body: { deliberately: "not trusted" }, is: () => true, get: () => authority };
}
async function send(kind: "payout" | "refund", req: any) {
  const res: any = { code: 200, body: undefined, status(code: number) { this.code = code; return this; },
    sendStatus(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; return this; } };
  await handlers.get(`/api/saas/live/${kind}-callback`)!(req, res);
  return res;
}
let cases = 0;
async function expect(kind: "payout" | "refund", req: any, status: number) { assert.equal((await send(kind, req)).code, status); cases++; }
try {
  assert.equal(handlers.size, 2);
  for (const kind of ["payout", "refund"] as const) {
    const event = { [kind + "Id"]: crypto.randomUUID(), status: "COMPLETED", amount: "1500", currency: "XAF", country: "CMR" };
    for (const status of ["COMPLETED", "FAILED", "PROCESSING"]) {
      const req = request(kind, { ...event, status });
      const first = await send(kind, req), duplicate = await send(kind, req);
      assert.equal(first.code, 200); assert.deepEqual(first.body, { received: true, handled: false });
      assert.equal(duplicate.code, 200); assert.deepEqual(duplicate.body, first.body); cases += 2;
    }
    let req = request(kind, event); delete req.headers.signature;
    const count = keyRequests; await expect(kind, req, 401); assert.equal(keyRequests, count);
    req = request(kind, event); req.rawBody = Buffer.from("{}"); await expect(kind, req, 401);
    await expect(kind, request(kind, event, 600), 401);
    req = request(kind, event); req.get = () => "foreign.example"; await expect(kind, req, 400);
    req = request(kind, event); req.path += "/extra"; await expect(kind, req, 400);
    req = request(kind, event); req.method = "GET"; await expect(kind, req, 401);
    req = request(kind, event); req.is = () => false; await expect(kind, req, 400);
    req = request(kind, event); req.rawBody = Buffer.alloc(65537); await expect(kind, req, 413);
    await expect(kind, request(kind, { ...event, [kind + "Id"]: "bad-id" }), 400);
    await expect(kind, request(kind, { ...event, status: "ACCEPTED" }), 400);
    await expect(kind, request(kind, { ...event, amount: "-100" }), 400);
    await expect(kind, request(kind, { ...event, depositId: crypto.randomUUID() }), 400);
    await expect(kind, request(kind, { ...event, [kind === "payout" ? "refundId" : "payoutId"]: crypto.randomUUID() }), 400);
    origin = undefined; await expect(kind, request(kind, event), 503);
    origin = "http://localhost"; await expect(kind, request(kind, event), 503);
    origin = "https://isolated-notifications.example";
    failKeys = true; await expect(kind, request(kind, event), 503); failKeys = false;
  }
  assert.deepEqual({ ...process.env }, before, "Receivers never enable billing or change maintenance configuration");
  console.log(`PASS ${cases} notification receiver cases: signed payout/refund acknowledgements, duplicates, invalid bodies/signatures/hosts, expiry, size bounds, unavailable configuration/keys; billing disabled; no DB or external calls`);
} finally { globalThis.fetch = originalFetch; }
