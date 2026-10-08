import crypto from "crypto";
import type { Express } from "express";

const CALLBACK_PATH = "/api/payments/pawapay/sandbox/callback";
const PUBLIC_KEYS_URL = "https://api.sandbox.pawapay.io/v2/public-key/http";
const REQUIRED_COMPONENTS = ["@method", "@authority", "@path", "signature-date", "content-digest", "content-type"];

type PublicKey = { id: string; key: string };
type CallbackInput = {
  method: string;
  authority: string;
  path: string;
  headers: Record<string, string | undefined>;
  rawBody: Buffer;
  keys: PublicKey[];
  now?: number;
};

let cachedKeys: PublicKey[] = [];
let keysExpiresAt = 0;

async function sandboxPublicKeys(): Promise<PublicKey[]> {
  if (cachedKeys.length && Date.now() < keysExpiresAt) return cachedKeys;
  const response = await fetch(PUBLIC_KEYS_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`PawaPay public key request failed: ${response.status}`);
  const value: unknown = await response.json();
  if (!Array.isArray(value) || !value.length || !value.every((item) =>
    item && typeof item.id === "string" && typeof item.key === "string" && item.key.includes("BEGIN PUBLIC KEY"))) {
    throw new Error("PawaPay public keys response invalid");
  }
  cachedKeys = value as PublicKey[];
  keysExpiresAt = Date.now() + 60 * 1000;
  return cachedKeys;
}

export function verifyPawapaySandboxCallback(input: CallbackInput): boolean {
  const { method, authority, path, headers, rawBody, keys } = input;
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  const digest = headers["content-digest"] || "";
  const digestMatch = /^sha-(256|512)=:([A-Za-z0-9+/]+={0,2}):$/.exec(digest);
  if (!digestMatch) return false;
  const expectedDigest = crypto.createHash(`sha${digestMatch[1]}`).update(rawBody).digest();
  const receivedDigest = Buffer.from(digestMatch[2], "base64");
  if (expectedDigest.length !== receivedDigest.length || !crypto.timingSafeEqual(expectedDigest, receivedDigest)) return false;

  const signatureInput = headers["signature-input"] || "";
  if (!signatureInput.startsWith("sig-pp=")) return false;
  const params = signatureInput.slice("sig-pp=".length);
  const covered = /^\(([^)]*)\)/.exec(params);
  if (!covered) return false;
  const components = [...covered[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  if (components.length !== REQUIRED_COMPONENTS.length ||
      new Set(components).size !== REQUIRED_COMPONENTS.length ||
      !REQUIRED_COMPONENTS.every((component) => components.includes(component))) return false;
  const alg = /;alg="([^"]+)"/.exec(params)?.[1];
  const keyId = /;keyid="([^"]+)"/.exec(params)?.[1];
  const created = Number(/;created=(\d+)/.exec(params)?.[1]);
  const expires = Number(/;expires=(\d+)/.exec(params)?.[1]);
  if (alg !== "ecdsa-p256-sha256" || !keyId || !Number.isSafeInteger(created) || !Number.isSafeInteger(expires) ||
      created > now + 60 || expires < now - 60 || expires <= created || expires - created > 300) return false;
  const signatureDate = headers["signature-date"] || "";
  const signedDate = Date.parse(signatureDate);
  if (!Number.isFinite(signedDate) || Math.abs(signedDate - now * 1000) > 5 * 60 * 1000) return false;
  const signatureMatch = /^sig-pp=:([A-Za-z0-9+/]+={0,2}):$/.exec(headers.signature || "");
  if (!signatureMatch) return false;
  const signature = Buffer.from(signatureMatch[1], "base64");
  if (signature.length !== 64) return false;
  const publicKey = keys.find((key) => key.id === keyId)?.key;
  if (!publicKey) return false;
  const values: Record<string, string | undefined> = {
    "@method": method.toUpperCase(), "@authority": authority, "@path": path,
    "signature-date": signatureDate, "content-digest": digest, "content-type": headers["content-type"],
  };
  if (components.some((component) => !values[component])) return false;
  const base = `${components.map((component) => `"${component}": ${values[component]}`).join("\n")}\n"@signature-params": ${params}`;
  try {
    return crypto.verify("sha256", Buffer.from(base), { key: publicKey, dsaEncoding: "ieee-p1363" }, signature);
  } catch {
    return false;
  }
}

export function registerPawapaySandboxCallback(app: Express): void {
  app.post(CALLBACK_PATH, async (req: any, res) => {
    const rawBody = req.rawBody;
    if (!Buffer.isBuffer(rawBody) || !req.is("application/json")) {
      return res.status(400).json({ message: "JSON callback required" });
    }
    try {
      const keys = await sandboxPublicKeys();
      const headers = Object.fromEntries(Object.entries(req.headers).map(([key, value]) =>
        [key.toLowerCase(), typeof value === "string" ? value : undefined]));
      const valid = verifyPawapaySandboxCallback({
        method: req.method, authority: req.get("host") || "", path: req.path, headers, rawBody, keys,
      });
      if (!valid) return res.status(401).json({ message: "Invalid callback signature" });
      const event = req.body;
      const id = event?.checkoutId || event?.depositId || event?.payoutId || event?.refundId;
      if (typeof id !== "string" || !/^[a-f\d-]{36}$/i.test(id) || typeof event?.status !== "string") {
        return res.status(400).json({ message: "Invalid callback body" });
      }
      if (event.checkoutId) {
        const { pawapaySandboxSchemaReady } = await import("./pawapay-sandbox-schema");
        await pawapaySandboxSchemaReady();
        const { pool } = await import("../db");
        const finalStatus = String(event.status).toUpperCase();
        if (!["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"].includes(finalStatus)) {
          return res.status(400).json({ message: "Invalid checkout final status" });
        }
        const expected = await pool.query(
          "SELECT amount_xaf, checkout_code, status FROM pawapay_sandbox_checkouts WHERE checkout_id = $1",
          [id],
        );
        if (!expected.rowCount) return res.status(404).json({ message: "Unknown sandbox checkout" });
        const expectedAmount = Number(expected.rows[0].amount_xaf);
        const amountMatches = Array.isArray(event.amounts) && event.amounts.some((amount: any) =>
          amount?.country === "CMR" && amount?.currency === "XAF" && Number(amount?.amount) === expectedAmount);
        if (!amountMatches || (expected.rows[0].checkout_code && event.checkoutCode !== expected.rows[0].checkout_code)) {
          return res.status(400).json({ message: "Sandbox checkout details do not match" });
        }
        const updated = await pool.query(
          `UPDATE pawapay_sandbox_checkouts
           SET status = $2, provider_status = $2, callback_received_at = now(), updated_at = now()
           WHERE checkout_id = $1 AND status NOT IN ('COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED')
           RETURNING checkout_id`,
          [id, finalStatus],
        );
        if (!updated.rowCount) {
          const existing = await pool.query("SELECT status FROM pawapay_sandbox_checkouts WHERE checkout_id = $1", [id]);
          if (!existing.rowCount) return res.status(404).json({ message: "Unknown sandbox checkout" });
          if (existing.rows[0].status !== finalStatus) return res.status(409).json({ message: "Conflicting final status" });
        }
      }
      // Sandbox-only state. No payment or subscription state is changed here.
      console.info("Verified PawaPay sandbox callback", { operationId: id, status: event.status });
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("PawaPay sandbox callback verification unavailable:", error);
      return res.status(503).json({ message: "Callback verification temporarily unavailable" });
    }
  });
}
