import crypto from "crypto";

const TOKEN_VERSION = "v2";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.PUBLIC_ACCESS_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("PUBLIC_ACCESS_TOKEN_SECRET or SESSION_SECRET must contain at least 32 characters");
  }
  return value;
}

function sign(scope: string, id: number, expiresAt: number): string {
  return crypto.createHmac("sha256", secret()).update(`${scope}:${id}:${expiresAt}`).digest("base64url");
}

export function createPublicAccessToken(scope: string, id: number): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  return `${TOKEN_VERSION}.${expiresAt}.${sign(scope, id, expiresAt)}`;
}

export function verifyPublicAccessToken(scope: string, id: number, token: unknown): boolean {
  if (typeof token !== "string") return false;
  const [version, rawExpiresAt, signature, extra] = token.split(".");
  if (version !== TOKEN_VERSION || extra !== undefined || !/^\d+$/.test(rawExpiresAt || "")) return false;
  const expiresAt = Number(rawExpiresAt);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const expected = `${TOKEN_VERSION}.${expiresAt}.${sign(scope, id, expiresAt)}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(token);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function publicAccessTokenFromRequest(req: any): string | undefined {
  const header = req.get?.("x-lead-access-token");
  if (header) return header;
  if (typeof req.query?.token === "string") return req.query.token;
  if (typeof req.body?.leadAccessToken === "string") return req.body.leadAccessToken;
  if (typeof req.body?.accessToken === "string") return req.body.accessToken;
  return undefined;
}
