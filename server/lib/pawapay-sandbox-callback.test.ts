import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyPawapaySandboxCallback } from "./pawapay-sandbox-callback";

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const body = Buffer.from(JSON.stringify({ depositId: "8917c345-4791-4285-a416-62f24b6982db", status: "COMPLETED" }));
const now = Date.now();
const created = Math.floor(now / 1000);
const components = ["@method", "@authority", "@path", "signature-date", "content-digest", "content-type"];
const params = `(${components.map((component) => `"${component}"`).join(" ")});alg="ecdsa-p256-sha256";keyid="test-key";created=${created};expires=${created + 60}`;
const headers = {
  "signature-date": new Date(now).toISOString(),
  "content-digest": `sha-512=:${crypto.createHash("sha512").update(body).digest("base64")}:`,
  "content-type": "application/json; charset=UTF-8",
  "signature-input": `sig-pp=${params}`,
  signature: "",
};
const values: Record<string, string> = {
  "@method": "POST", "@authority": "app.xpressclean.cm", "@path": "/api/payments/pawapay/sandbox/callback",
  "signature-date": headers["signature-date"], "content-digest": headers["content-digest"], "content-type": headers["content-type"],
};
const base = `${components.map((component) => `"${component}": ${values[component]}`).join("\n")}\n"@signature-params": ${params}`;
headers.signature = `sig-pp=:${crypto.sign("sha256", Buffer.from(base), privateKey).toString("base64")}:`;
const input = {
  method: "POST", authority: values["@authority"], path: values["@path"], headers,
  rawBody: body, keys: [{ id: "test-key", key: publicKey.export({ type: "spki", format: "pem" }).toString() }], now,
};

assert.equal(verifyPawapaySandboxCallback(input), true, "valid PawaPay-style signature accepted");
const p1363 = crypto.sign("sha256", Buffer.from(base), { key: privateKey, dsaEncoding: "ieee-p1363" });
assert.equal(verifyPawapaySandboxCallback({ ...input, headers: { ...headers, signature: `sig-pp=:${p1363.toString("base64")}:` } }), false, "non-DER signature rejected");
assert.equal(verifyPawapaySandboxCallback({ ...input, rawBody: Buffer.from("{}") }), false, "tampered body rejected");
assert.equal(verifyPawapaySandboxCallback({ ...input, authority: "evil.example" }), false, "wrong host rejected");
assert.equal(verifyPawapaySandboxCallback({ ...input, keys: [] }), false, "unknown signer rejected");
assert.equal(verifyPawapaySandboxCallback({ ...input, now: now + 10 * 60 * 1000 }), false, "expired signature rejected");
console.log("PawaPay sandbox callback signature tests passed");
