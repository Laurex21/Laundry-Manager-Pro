import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import { readFile } from "node:fs/promises";
import { storefrontFixture } from "../../scripts/storefront-fixture";
import { flowSignupConfig, postgresSignupStore, StorefrontFlowSignup } from "./storefront-flow-signup";

const f = await storefrontFixture();
try {
  await f.pg.exec(await readFile(new URL("../../integrations/whatsapp-flows/signup-schema.REVIEW.sql", import.meta.url), "utf8"));
  const key = "ab".repeat(32);
  const env = {
    XPRESSPRO_STOREFRONT_ENABLED: "true", XPRESSPRO_FLOW_SIGNUP_ENABLED: "true",
    XPRESSPRO_FLOW_SIGNUP_APP_ID: "100", XPRESSPRO_FLOW_SIGNUP_CONFIG_ID: "101", XPRESSPRO_FLOWS_GRAPH_VERSION: "v27.0",
    XPRESSPRO_FLOWS_APP_SECRET: "fixture-app-secret-only", XPRESSPRO_FLOW_SIGNUP_ENCRYPTION_KEY: key,
  };
  let now = Date.now(), graphCalls = 0;
  let sender = "+237 600 000 000", enabled = false;
  const token = "fixture-business-token-only";
  const meta: typeof fetch = async (url, options) => {
    graphCalls++;
    const u = new URL(String(url));
    assert.equal(u.origin, "https://graph.facebook.com");
    assert.equal(options?.redirect, "error");
    if (u.pathname.endsWith("/oauth/access_token")) {
      assert.equal(u.searchParams.get("code"), "fixture-code");
      assert.equal(u.searchParams.get("client_id"), "100");
      return Response.json({ access_token: token });
    }
    assert.equal(u.pathname, "/v27.0/102/phone_numbers");
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${token}`);
    return Response.json({ data: [{ id: "103", display_phone_number: sender }] });
  };
  const store = postgresSignupStore({ query: (sql, args) => f.pg.query(sql, args) });
  const signup = new StorefrontFlowSignup(f.service, store, () => flowSignupConfig(enabled ? env : {}), meta, () => now);
  assert.deepEqual(await signup.status(f.actor), { state: "unavailable" });
  assert.equal((await f.service.publicShop("pressing-horizon")).name, "Pressing Horizon");
  assert.equal(graphCalls, 0);

  enabled = true;
  const other = { userId: "other-demo", organisationId: 2, siteId: 2 };
  assert.deepEqual(await signup.status(other), { state: "needs_shop" });
  const setup = await signup.start(f.actor, "session-one");
  assert.equal(setup.phone, "+237600000000");
  assert.ok(!("appSecret" in setup) && !("encryptionKey" in setup));
  const payload = { authorization: "fixture-code", wabaId: "102", phoneNumberId: "103", attempt: setup.attempt };
  await assert.rejects(() => signup.finish(f.actor, "session-two", payload), (error: any) => error.status === 409);
  await assert.rejects(() => signup.finish(other, "session-one", payload), (error: any) => error.status === 409);
  now += 16 * 60_000;
  await assert.rejects(() => signup.finish(f.actor, "session-one", payload), (error: any) => error.status === 409);
  now -= 16 * 60_000;
  assert.equal(graphCalls, 0);

  sender = "+237600000099";
  await assert.rejects(() => signup.finish(f.actor, "session-one", payload), /ne correspond pas/);
  assert.equal(await store.get(f.actor), null);
  sender = "+237 600 000 000";
  const attempts = await Promise.allSettled([
    signup.finish(f.actor, "session-one", payload), signup.finish(f.actor, "session-one", payload),
  ]);
  assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
  assert.deepEqual(await signup.status(f.actor), { state: "pending", phone: setup.phone });
  assert.equal(await store.get(other), null);
  await assert.rejects(() => signup.start(f.actor, "session-one"), /déjà en attente/);
  const rows = await f.pg.query<{ encrypted_token: string }>("SELECT encrypted_token FROM xpresspro_flow_signup.connections");
  assert.equal(rows.rows.length, 1);
  const ciphertext = Buffer.from(rows.rows[0].encrypted_token, "base64url");
  assert.ok(!ciphertext.includes(Buffer.from(token)));
  const decrypt = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), ciphertext.subarray(0, 12));
  decrypt.setAAD(Buffer.from(JSON.stringify(["wa-signup-v1", 1, 1, "102", "103"])));
  decrypt.setAuthTag(ciphertext.subarray(-16));
  assert.equal(Buffer.concat([decrypt.update(ciphertext.subarray(12, -16)), decrypt.final()]).toString(), token);

  const shop = (await f.service.admin(f.actor)).shop!;
  await f.service.save(other, { ...shop, siteId: 2, slug: "autre-pressing", expectedVersion: 0,
    services: [{ serviceId: 4, mode: "kg" }] });
  const otherSetup = await signup.start(other, "session-other-shop");
  await assert.rejects(() => signup.finish(other, "session-other-shop", { ...payload, attempt: otherSetup.attempt }), /déjà rattaché/);
  assert.deepEqual(await signup.status(other), { state: "ready", phone: setup.phone });
  console.log("PASS Embedded Signup: disabled option leaves the shop available, access attempt bound to site and session, verified number, encrypted Meta token, no duplicate or cross-agency reassignment.");
} finally { await f.pg.close(); }
