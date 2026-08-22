import assert from "node:assert/strict";
import fs from "node:fs";

process.env.SESSION_SECRET = "security-test-secret-that-is-longer-than-32-characters";

const indexSource = fs.readFileSync("server/index.ts", "utf8");
const authSource = fs.readFileSync("server/replit_integrations/auth/replitAuth.ts", "utf8");
const limiterSource = fs.readFileSync("server/lib/rate-limit.ts", "utf8");
const tokenSource = fs.readFileSync("server/lib/public-access-token.ts", "utf8");

assert.doesNotMatch(indexSource, /capturedJsonResponse|JSON\.stringify\(capturedJsonResponse\)/);
assert.match(indexSource, /X-Request-Id/);
assert.doesNotMatch(authSource, /kapnangsilva@gmail\.com/);
assert.doesNotMatch(authSource, /setupAuth[\s\S]{0,180}await ensureAuthSchema\(\)/);
assert.match(authSource, /SESSION_SECRET must be configured with at least 32 characters/);
assert.match(limiterSource, /INSERT INTO security_rate_limits/);
assert.match(limiterSource, /createHash\("sha256"\)/);
assert.doesNotMatch(limiterSource, /new Map/);
assert.doesNotMatch(tokenSource, /development-only-public-access-token-secret/);
assert.match(tokenSource, /TOKEN_TTL_SECONDS/);

const { createPublicAccessToken, verifyPublicAccessToken } = await import("./public-access-token");
const token = createPublicAccessToken("calculator", 42);
assert.equal(verifyPublicAccessToken("calculator", 42, token), true);
assert.equal(verifyPublicAccessToken("calculator", 43, token), false);
assert.equal(verifyPublicAccessToken("diagnostic", 42, token), false);
assert.equal(verifyPublicAccessToken("calculator", 42, `${token}x`), false);

console.log("security hardening regression tests passed");
