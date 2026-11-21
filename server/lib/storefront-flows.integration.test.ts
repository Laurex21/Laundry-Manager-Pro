import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { constants, createCipheriv, createDecipheriv, createHmac, generateKeyPairSync, publicEncrypt, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { storefrontFixture } from "../../scripts/storefront-fixture";
import { StorefrontFlowAdapter, type FlowBinding } from "./storefront-flows";
import { processEncryptedStorefrontFlow } from "./storefront-flow-transport";
const f = await storefrontFixture();
let now = Date.now();
let connection: FlowBinding | null = { id: "test-connection", actor: f.actor, phoneNumberId: "synthetic-phone-id", flowId: "synthetic-flow-id", enabled: true };
const adapter = new StorefrontFlowAdapter(f.service, randomBytes(32), async () => connection, () => now);
const json = JSON.parse(await readFile(new URL("../../integrations/whatsapp-flows/storefront-order.draft.json", import.meta.url), "utf8"));
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const appSecret = "synthetic-test-app-secret";
function encrypted(value: unknown) {
  const aes = randomBytes(16), iv = randomBytes(16), cipher = createCipheriv("aes-128-gcm", aes, iv);
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]);
  const raw = Buffer.from(JSON.stringify({ encrypted_aes_key: publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, aes).toString("base64"), initial_vector: iv.toString("base64"), encrypted_flow_data: bytes.toString("base64") }));
  return { raw, signature: `sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`, decrypt(body: string) {
    const b = Buffer.from(body, "base64"), decipher = createDecipheriv("aes-128-gcm", aes, Buffer.from(iv.map(v => v ^ 255)));
    decipher.setAuthTag(b.subarray(-16)); return JSON.parse(Buffer.concat([decipher.update(b.subarray(0, -16)), decipher.final()]).toString());
  } };
}
const handle = (value: unknown) => adapter.handle(value);
const transport = (e: ReturnType<typeof encrypted>, signature = e.signature) => processEncryptedStorefrontFlow(e.raw, signature, { appSecret, privateKey }, handle);
try {
  assert.equal(json.data_api_version, "4.0"); assert.equal(json.version, "7.3");
  assert.deepEqual(json.routing_model, { ITEMS: ["CART"], CART: ["CONTACT"], CONTACT: [] });
  const start = await adapter.launch("test-connection", "+237600000001");
  assert.equal(start.message.interactive.action.parameters.mode, "draft");
  assert.equal(JSON.stringify(start).includes("trackingSecret"), false);
  const run = (action: string, screen?: string, data: Record<string, unknown> = {}, token = start.flow_token) => handle({ version: "4.0", action, screen, data, flow_token: token });
  let state = await run("INIT"); assert.equal(state.screen, "ITEMS");
  // Contract check: every returned screen field is declared in its draft JSON.
  function contract(result: any) { const screen = json.screens.find((s: any) => s.id === result.screen); for (const key of Object.keys(result.data)) assert.ok(key in screen.data, `${result.screen}.${key} declared`); }
  contract(state);
  for (const [garment, size, count] of [["tshirt", "child", "3"], ["shirt", "adult", "2"], ["jeans", "teen", "1"]]) {
    state = await run("data_exchange", "ITEMS", { operation: "add", cart_token: state.data.cart_token, service_id: "1", garment, size, count }); contract(state);
    if (garment !== "jeans") state = await run("data_exchange", "CART", { operation: "more", cart_token: state.data.cart_token });
  }
  assert.match(String(state.data.estimate), /1300 XAF/);
  state = await run("data_exchange", "CART", { operation: "checkout", cart_token: state.data.cart_token }); contract(state);
  const confirm = { operation: "confirm", cart_token: state.data.cart_token, customer_name: "Client fictif Flow", note: "Test isolé", accepted: true, phone: "+237699999999", price: "0" };
  await assert.rejects(() => run("data_exchange", "CONTACT", { ...confirm, accepted: false }));
  const first = await run("data_exchange", "CONTACT", confirm);
  const second = await run("data_exchange", "CONTACT", confirm);
  assert.deepEqual(first, second, "confirmation replay is idempotent");
  const rows = await f.database.select().from(f.schema.storefrontRequests);
  assert.equal(rows.length, 1); assert.equal(rows[0].phone, "+237600000001"); assert.equal(rows[0].estimate.total, "1300");
  assert.equal((await f.database.select().from(f.schema.payments)).length, 0);
  assert.equal((await f.service.inbox(f.actor)).length, 1);
  const other = await adapter.launch("test-connection", "+237600000002");
  await assert.rejects(() => run("data_exchange", "CONTACT", confirm, other.flow_token), (e: any) => e.status === 427);
  await assert.rejects(() => run("INIT", undefined, {}, start.flow_token.slice(0, -6) + "aaaaaa"), (e: any) => e.status === 427);
  let fresh = await run("INIT", undefined, {}, other.flow_token);
  const invalid = { operation: "add", cart_token: fresh.data.cart_token, service_id: "4", garment: "tshirt", size: "adult", count: "1" };
  await assert.rejects(() => run("data_exchange", "ITEMS", invalid, other.flow_token), (e: any) => e.status === 409);
  fresh = await run("data_exchange", "ITEMS", { ...invalid, service_id: "1" }, other.flow_token);
  fresh = await run("data_exchange", "CART", { operation: "checkout", cart_token: fresh.data.cart_token }, other.flow_token);
  await f.database.update(f.schema.services).set({ price: "2000" }).where(eq(f.schema.services.id, 1));
  const revised = await run("data_exchange", "CONTACT", { ...confirm, cart_token: fresh.data.cart_token }, other.flow_token);
  assert.equal(revised.screen, "CART"); assert.match(String(revised.data.explanation), /tarif a changé/);
  assert.equal((await f.database.select().from(f.schema.storefrontRequests)).length, 1);
  let unknown = await run("INIT", undefined, {}, other.flow_token);
  unknown = await run("data_exchange", "ITEMS", { ...invalid, service_id: "1", garment: "evening_dress", cart_token: unknown.data.cart_token }, other.flow_token);
  assert.match(String(unknown.data.estimate), /restent à chiffrer/);
  const ping = encrypted({ version: "4.0", action: "ping" });
  assert.deepEqual(ping.decrypt((await transport(ping)).body), { data: { status: "active" } });
  assert.equal((await transport(ping, "")).status, 432);
  assert.equal((await transport(ping, "sha256=" + "f".repeat(64))).status, 432);
  assert.equal((await processEncryptedStorefrontFlow(Buffer.alloc(128001), ping.signature, { appSecret, privateKey }, handle)).status, 413);
  const broken = Buffer.from('{"encrypted_aes_key":"AAAA","encrypted_flow_data":"AAAA","initial_vector":"AAAA"}');
  assert.equal((await processEncryptedStorefrontFlow(broken, `sha256=${createHmac("sha256", appSecret).update(broken).digest("hex")}`, { appSecret, privateKey }, handle)).status, 421);
  now += 31 * 60_000;
  const expired = encrypted({ version: "4.0", action: "INIT", flow_token: start.flow_token });
  const expiredResponse = await transport(expired);
  assert.equal(expiredResponse.status, 427); assert.match(expired.decrypt(expiredResponse.body).error_msg, /expirée/);
  now -= 31 * 60_000;
  connection = { ...connection!, actor: { siteId: 2, organisationId: 2, userId: "other-demo" } };
  await assert.rejects(() => run("INIT"), (e: any) => e.status === 427);
  connection = { ...connection, actor: f.actor, enabled: false };
  await assert.rejects(() => run("INIT"), (e: any) => e.status === 427);
  connection.enabled = true;
  const config = (await f.service.admin(f.actor)).shop!;
  await f.service.save(f.actor, { ...config, expectedVersion: config.version, published: false });
  await assert.rejects(() => run("INIT"), (e: any) => e.status === 427);
  console.log("PASS Flow preparation: mixed basket, exact shared pricing, same inbox, encrypted state, tenant/recipient binding, duplicates, consent, repricing, unknown weights, expiry, connection revocation, closed shop, RSA/AES round trip and signature rejection. No Meta calls or messages.");
} finally { await f.pg.close(); }
