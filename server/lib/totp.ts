import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(value: Buffer): string {
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let encoded = "";
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    encoded += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return encoded;
}

export function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=|\s|-/g, "");
  if (!normalized || [...normalized].some((character) => !BASE32_ALPHABET.includes(character))) {
    throw new Error("Invalid Base32 secret");
  }
  let bits = "";
  for (const character of normalized) {
    bits += BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return encodeBase32(crypto.randomBytes(20));
}

export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(binary).padStart(6, "0");
}

export function verifyTotp(
  secret: string,
  code: string,
  nowMs = Date.now(),
  allowedDrift = 1,
): number | null {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const currentStep = Math.floor(nowMs / 30_000);
  for (let drift = -allowedDrift; drift <= allowedDrift; drift += 1) {
    const step = currentStep + drift;
    const expected = Buffer.from(totpCode(secret, step));
    const received = Buffer.from(normalized);
    if (expected.length === received.length && crypto.timingSafeEqual(expected, received)) return step;
  }
  return null;
}

function encryptionKey(): Buffer {
  const configured = process.env.PLATFORM_ADMIN_MFA_KEY?.trim();
  if (!configured) throw new Error("PLATFORM_ADMIN_MFA_KEY must be configured");
  const key = /^[a-f\d]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("PLATFORM_ADMIN_MFA_KEY must encode exactly 32 bytes");
  return key;
}

export function encryptTotpSecret(secret: string): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
  };
}

export function decryptTotpSecret(value: { ciphertext: string; iv: string; tag: string }): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "hex"));
  decipher.setAuthTag(Buffer.from(value.tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function buildTotpUri(secret: string, email: string): string {
  const issuer = "XpressPro Super Admin";
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
