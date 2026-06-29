import crypto from "crypto";

const TOKEN_VERSION = "v1";

function secret(): string {
  return process.env.PUBLIC_ACCESS_TOKEN_SECRET || process.env.SESSION_SECRET || "development-only-public-access-token-secret";
}

function sign(scope: string, id: number): string {
  return crypto.createHmac("sha256", secret()).update(`${scope}:${id}`).digest("base64url");
}

export function createPublicAccessToken(scope: string, id: number): string {
  return `${TOKEN_VERSION}.${sign(scope, id)}`;
}

export function verifyPublicAccessToken(scope: string, id: number, token: unknown): boolean {
  if (typeof token !== "string" || !token.startsWith(`${TOKEN_VERSION}.`)) return false;
  const expected = createPublicAccessToken(scope, id);
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
