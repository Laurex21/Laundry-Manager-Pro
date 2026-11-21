// Encrypted pilot transport. Never accepts unsigned Meta payloads.
import { constants, createCipheriv, createDecipheriv, createHmac, privateDecrypt, timingSafeEqual, type KeyLike } from "node:crypto";
import { z, ZodError } from "zod";
import { StorefrontError } from "./storefront-pricing";
import type { FlowResponse } from "./storefront-flows";
const base64 = z.string().max(100_000).regex(/^[A-Za-z0-9+/]+={0,2}$/);
const envelope = z.object({ encrypted_aes_key: base64, encrypted_flow_data: base64, initial_vector: base64 });
export async function processEncryptedStorefrontFlow(rawBody: Buffer, signature: string | undefined,
  config: { appSecret: string; privateKey: KeyLike }, handle: (value: unknown) => Promise<FlowResponse>) {
  const respond = (status: number, body = "") => ({ status, body, contentType: "text/plain" });
  if (!config.appSecret || !config.privateKey) return respond(503);
  if (rawBody.length > 128_000) return respond(413);
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return respond(432);
  const expected = createHmac("sha256", config.appSecret).update(rawBody).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"))) return respond(432);
  let key: Buffer, iv: Buffer, payload: unknown;
  try {
    const body = envelope.parse(JSON.parse(rawBody.toString("utf8")));
    key = privateDecrypt({ key: config.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(body.encrypted_aes_key, "base64"));
    iv = Buffer.from(body.initial_vector, "base64");
    if (key.length !== 16 || iv.length !== 16) return respond(421);
    const encrypted = Buffer.from(body.encrypted_flow_data, "base64");
    if (encrypted.length <= 16) return respond(421);
    const decipher = createDecipheriv("aes-128-gcm", key, iv); decipher.setAuthTag(encrypted.subarray(-16));
    payload = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString("utf8"));
  } catch { return respond(421); }
  const encrypt = (body: unknown) => {
    const cipher = createCipheriv("aes-128-gcm", key, Buffer.from(iv.map(byte => byte ^ 0xff)));
    return Buffer.concat([cipher.update(JSON.stringify(body)), cipher.final(), cipher.getAuthTag()]).toString("base64");
  };
  try { return respond(200, encrypt(await handle(payload))); }
  catch (error) {
    if (error instanceof StorefrontError && error.status === 427) return respond(427, encrypt({ error_msg: error.message }));
    if (error instanceof ZodError || error instanceof StorefrontError) return respond(400);
    return respond(500);
  }
}
