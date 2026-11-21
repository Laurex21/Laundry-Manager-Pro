import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, randomBytes, constants, publicEncrypt, createCipheriv, createDecipheriv } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import express from "express";
import { storefrontFixture } from "../../scripts/storefront-fixture";
import { readFlowPilotConfiguration, StorefrontFlowPilot, postgresFlowPilotLedger, registerStorefrontFlowPilotRoutes } from "./storefront-flow-pilot";

const f = await storefrontFixture();
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const config = readFlowPilotConfiguration({
  XPRESSPRO_WHATSAPP_FLOWS_ENABLED: "true",
  XPRESSPRO_WHATSAPP_FLOWS_PILOT: JSON.stringify({ connectionId: "laurepressing-fixture", organisationId: 1, siteId: 1,
    actorUserId: f.actor.userId, wabaId: "100", phoneNumberId: "101", flowId: "102", phone: "+237600000000",
    endpoint: "https://example.test/api/integrations/whatsapp-flows/data", recipients: ["+237600000001"], mode: "draft" }),
  XPRESSPRO_FLOWS_ACCESS_TOKEN: "synthetic-access-token-only", XPRESSPRO_FLOWS_APP_SECRET: "synthetic-app-secret-only",
  XPRESSPRO_FLOWS_VERIFY_TOKEN: "synthetic-verification-token-only-32", XPRESSPRO_FLOWS_SESSION_KEY: randomBytes(32).toString("hex"),
  XPRESSPRO_FLOWS_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), XPRESSPRO_FLOWS_GRAPH_VERSION: "v27.0",
})!;
assert.equal(readFlowPilotConfiguration({}), null);
assert.throws(() => readFlowPilotConfiguration({ XPRESSPRO_WHATSAPP_FLOWS_ENABLED: "true" }), /CONFIGURATION_INVALID/);
await f.pg.exec(await readFile(new URL("../../integrations/whatsapp-flows/pilot-schema.REVIEW.sql", import.meta.url), "utf8"));
let sent: any[] = [], providerUnknown = false, wrongPhone = false, wrongFlow = false, enabled = true;
const meta: typeof fetch = async (url, options) => {
  const u = new URL(String(url));
  assert.equal(u.hostname, "graph.facebook.com");
  assert.equal(options?.redirect, "error");
  if (u.pathname.endsWith("/phone_numbers")) return Response.json({ data: [{ id: "101", status: "CONNECTED", display_phone_number: wrongPhone ? "+237600000099" : config.phone }] });
  if (u.pathname.endsWith("/flows")) return Response.json({ data: [{ id: wrongFlow ? "999" : "102", status: "DRAFT", endpoint_uri: config.endpoint, data_api_version: "4.0", validation_errors: [] }] });
  if (u.pathname.endsWith("/messages")) {
    sent.push(JSON.parse(String(options?.body)));
    if (providerUnknown) throw Error("Simulated timeout after provider may have accepted");
    return Response.json({ messages: [{ id: "wamid.synthetic-outbound" }] });
  }
  throw Error("Unexpected Meta request");
};
const ledger = postgresFlowPilotLedger({ query: (sql, params) => f.pg.query(sql, params) });
const pilot = new StorefrontFlowPilot(config, f.service, ledger, meta);
const app = express();
app.use(express.json({ limit: "250kb", verify: (req, _res, raw) => { req.rawBody = raw; } }));
registerStorefrontFlowPilotRoutes(app, { pilot: () => enabled ? pilot : null, limit: (_req, _res, next) => next() });
const server = createServer(app);
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}/api/integrations/whatsapp-flows`;
const sign = (raw: string) => `sha256=${createHmac("sha256", config.appSecret).update(raw).digest("hex")}`;
const inbound = (id = "wamid.test-1", overrides: any = {}, account = "100", phone = "101") => ({ object: "whatsapp_business_account", entry: [{ id: account, changes: [{ field: "messages", value: {
  metadata: { phone_number_id: phone }, messages: [{ id, from: "237600000001", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "commander" }, ...overrides }],
} }] }] });
const post = (value: any, signed = true) => {
  const raw = JSON.stringify(value);
  return fetch(`${base}/webhook`, { method: "POST", headers: { "Content-Type": "application/json", ...(signed ? { "x-hub-signature-256": sign(raw) } : {}) }, body: raw });
};
async function exchange(payload: any) {
  const aes = randomBytes(16), iv = randomBytes(16), cipher = createCipheriv("aes-128-gcm", aes, iv);
  const raw = JSON.stringify({ initial_vector: iv.toString("base64"), encrypted_aes_key: publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, aes).toString("base64"),
    encrypted_flow_data: Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final(), cipher.getAuthTag()]).toString("base64") });
  const res = await fetch(`${base}/data`, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": sign(raw) }, body: raw });
  assert.equal(res.status, 200);
  const data = Buffer.from(await res.text(), "base64"), decipher = createDecipheriv("aes-128-gcm", aes, Buffer.from(iv.map(v => v ^ 255)));
  decipher.setAuthTag(data.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]).toString());
}
try {
  const shop = (await f.service.admin(f.actor)).shop!;
  await f.service.save(f.actor, { ...shop, expectedVersion: shop.version, name: "Laurepressing — simulation isolée" });
  const query = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": config.verifyToken, "hub.challenge": "12345" });
  assert.equal(await (await fetch(`${base}/webhook?${query}`)).text(), "12345");
  assert.equal((await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`)).status, 403);
  assert.equal((await post(inbound(), false)).status, 403);
  await post(inbound("wamid.other-account", {}, "999"));
  await post(inbound("wamid.other-phone", {}, "100", "999"));
  await post(inbound("wamid.other-customer", { from: "237600000002" }));
  await post(inbound("wamid.stale", { timestamp: "1" }));
  await post(inbound("wamid.no-intent", { text: { body: "bonjour" } }));
  assert.equal(sent.length, 0);
  assert.deepEqual(await exchange({ action: "ping", version: "4.0" }), { data: { status: "active" } });
  const replies = await Promise.all([post(inbound()), post(inbound())]);
  assert.deepEqual(replies.map(r => r.status), [200, 200]);
  assert.equal(sent.length, 1, "concurrent duplicate webhook sends only once");
  assert.equal(sent[0].to, "237600000001");
  assert.equal(sent[0].interactive.action.parameters.flow_id, "102");
  const flow_token = sent[0].interactive.action.parameters.flow_token;
  const run = (action: string, screen?: string, data: any = {}) => exchange({ version: "4.0", action, screen, data, flow_token });
  let screen = await run("INIT");
  assert.match(screen.data.shop_name, /Laurepressing/);
  for (const [garment, size] of [["tshirt", "child"], ["tshirt", "teen"], ["shirt", "adult"]]) {
    screen = await run("data_exchange", "ITEMS", { operation: "add", cart_token: screen.data.cart_token, service_id: "1", garment, size, count: "1" });
    if (size !== "adult") screen = await run("data_exchange", "CART", { operation: "more", cart_token: screen.data.cart_token });
  }
  assert.match(screen.data.estimate, /500 XAF/);
  screen = await run("data_exchange", "CART", { operation: "checkout", cart_token: screen.data.cart_token });
  const confirmation = { operation: "confirm", cart_token: screen.data.cart_token, customer_name: "TEST Flow Laurepressing fictif", note: "Simulation isolée sans Meta", accepted: true };
  const done = await run("data_exchange", "CONTACT", confirmation);
  assert.equal(done.screen, "SUCCESS");
  assert.deepEqual(await run("data_exchange", "CONTACT", confirmation), done);
  assert.equal((await f.service.inbox(f.actor)).length, 1);
  assert.equal((await f.service.inbox({ siteId: 2, organisationId: 2, userId: "other-demo" })).length, 0);
  assert.equal((await f.database.select().from(f.schema.orders)).length, 0, "Flow request requires pressing validation before order creation");
  assert.equal((await f.database.select().from(f.schema.payments)).length, 0);
  wrongPhone = true; assert.equal((await post(inbound("wamid.wrong-binding"))).status, 503); wrongPhone = false;
  wrongFlow = true; assert.equal((await post(inbound("wamid.wrong-flow"))).status, 503); wrongFlow = false;
  providerUnknown = true;
  await post(inbound("wamid.uncertain")); await post(inbound("wamid.uncertain"));
  assert.equal(sent.length, 2, "uncertain provider result must not be automatically resent");
  const claims = await f.pg.query<{ outcome: string }>("SELECT outcome FROM xpresspro_flow_pilot.inbound_claims ORDER BY claimed_at");
  assert.deepEqual(claims.rows.map(r => r.outcome), ["accepted", "unknown"]);
  enabled = false;
  assert.equal((await post(inbound("wamid.disabled"))).status, 404);
  console.log("PASS WhatsApp pilot HTTP: signed webhook, verified WABA/sender/Flow, recipient allowlist, recent inbound command, durable concurrent deduplication, unknown-send handling, encrypted native cart, confirmation replay, Laurepressing fixture inbox and tenant isolation. No real Meta call, message, payment or production database access.");
} finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); await f.pg.close(); }
