import assert from "node:assert/strict";
import fs from "node:fs";

process.env.SESSION_SECRET = "security-test-secret-that-is-longer-than-32-characters";

const indexSource = fs.readFileSync("server/index.ts", "utf8");
const authSource = fs.readFileSync("server/replit_integrations/auth/replitAuth.ts", "utf8");
const limiterSource = fs.readFileSync("server/lib/rate-limit.ts", "utf8");
const tokenSource = fs.readFileSync("server/lib/public-access-token.ts", "utf8");
const httpSecuritySource = fs.readFileSync("server/lib/http-security.ts", "utf8");
const routesSource = fs.readFileSync("server/routes.ts", "utf8");
const storageSource = fs.readFileSync("server/storage.ts", "utf8");
const authRoutesSource = fs.readFileSync("server/replit_integrations/auth/routes.ts", "utf8");
const calculatorSource = fs.readFileSync("server/lib/calculator-routes.ts", "utf8");
const authStorageSource = fs.readFileSync("server/replit_integrations/auth/storage.ts", "utf8");
const diagnosticSource = fs.readFileSync("server/lib/diagnostic-routes.ts", "utf8");
const profitabilitySource = fs.readFileSync("server/lib/rentabilite-routes.ts", "utf8");
const authSchemaSource = fs.readFileSync("server/replit_integrations/auth/replitAuth.ts", "utf8");
const dailyJobsSource = fs.readFileSync("server/lib/daily-jobs.ts", "utf8");

assert.doesNotMatch(indexSource, /capturedJsonResponse|JSON\.stringify\(capturedJsonResponse\)/);
assert.match(indexSource, /X-Request-Id/);
assert.match(indexSource, /limit: "250kb"/);
assert.match(indexSource, /isReturnEvidenceUpload[\s\S]{0,300}evidenceJsonParser/);
assert.match(indexSource, /isBusinessLogoUpdate[\s\S]{0,300}settingsJsonParser/);
assert.doesNotMatch(indexSource, /limit: "10mb"/);
assert.doesNotMatch(authSource, /kapnangsilva@gmail\.com/);
assert.doesNotMatch(authSource, /setupAuth[\s\S]{0,180}await ensureAuthSchema\(\)/);
assert.match(authSource, /SESSION_SECRET must be configured with at least 32 characters/);
assert.match(limiterSource, /INSERT INTO security_rate_limits/);
assert.match(limiterSource, /createHash\("sha256"\)/);
assert.doesNotMatch(limiterSource, /new Map/);
assert.doesNotMatch(tokenSource, /development-only-public-access-token-secret/);
assert.match(tokenSource, /TOKEN_TTL_SECONDS/);
assert.match(httpSecuritySource, /Content-Security-Policy/);
assert.match(httpSecuritySource, /Strict-Transport-Security/);
assert.match(httpSecuritySource, /sec-fetch-site/);
assert.match(httpSecuritySource, /"connect-src 'self'"/);
assert.doesNotMatch(httpSecuritySource, /connect-src 'self' https: wss:/);
assert.match(httpSecuritySource, /originUrl\.host !== req\.get\("host"\)/);
assert.doesNotMatch(routesSource, /fall back to first authorized site/);
assert.match(routesSource, /z\.enum\(\["manager", "operator"\]\)/);
assert.match(routesSource, /owner cannot be removed/);
assert.match(routesSource, /revokeInvitation\(invitationId, org\.id\)/);
assert.match(routesSource, /if \(!revoked\) return res\.status\(404\)/);
assert.match(storageSource, /revokeInvitation\(id: number, organisationId: number\)[\s\S]{0,500}eq\(siteInvitations\.organisationId, organisationId\)/);
assert.match(storageSource, /eq\(siteInvitations\.status, "pending"\)/);
assert.match(authRoutesSource, /app\.post\("\/api\/auth\/register", registrationLimiter, passwordHashLimiter/);
assert.match(authRoutesSource, /app\.post\("\/api\/staff\/onboard\/:token", staffOnboardingLimiter, passwordHashLimiter/);
assert.match(authRoutesSource, /app\.post\("\/api\/auth\/password-reset\/confirm", passwordResetConfirmLimiter, passwordHashLimiter/);
assert.match(authRoutesSource, /const invitation = await storage\.getInvitationByToken\(invitationToken\)[\s\S]{0,2200}const passwordHash = await bcrypt\.hash/);
assert.match(authRoutesSource, /invitation\.status !== "pending"/);
assert.match(authRoutesSource, /revokeUserSessions\(user\.id\)[\s\S]{0,150}markPasswordResetTokenUsed\(resetToken\.id\)/);
assert.match(authStorageSource, /delete\(sessions\)[\s\S]{0,150}sessions\.sess.*userId/);
assert.doesNotMatch(routesSource, /seedDatabase\(|Database seeded!/);
assert.match(diagnosticSource, /diagnosticLeadSchema\.safeParse\(req\.body\)/);
assert.match(diagnosticSource, /diagnosticCompletionSchema\.safeParse\(req\.body\)/);
assert.match(profitabilitySource, /profitabilityLeadSchema\.safeParse\(req\.body\)/);
assert.match(profitabilitySource, /profitabilityCompletionSchema\.safeParse\(req\.body\)/);
assert.match(authSchemaSource, /CREATE TABLE IF NOT EXISTS security_audit_events/);
assert.match(routesSource, /recordSecurityAudit\([\s\S]{0,200}settings\.updated/);
assert.match(routesSource, /recordSecurityAudit\([\s\S]{0,200}staff\.role_updated/);
assert.match(routesSource, /recordSecurityAudit\([\s\S]{0,200}invitation\.revoked/);
assert.match(dailyJobsSource, /pg_try_advisory_lock/);
assert.match(dailyJobsSource, /pg_advisory_unlock/);
assert.match(authRoutesSource, /status\(405\).*Allow/);
assert.doesNotMatch(calculatorSource, /json\(\{ message: err\.message \}\)/);
assert.match(authRoutesSource, /APP_BASE_URL/);
assert.match(authRoutesSource, /REPLIT_DOMAINS/);
assert.doesNotMatch(authRoutesSource, /process\.env\.APP_BASE_URL \|\| `\$\{req\.protocol\}:\/\/\$\{req\.get\("host"\)\}`/);
assert.match(routesSource, /machinePatchSchema[\s\S]{0,180}omit\(\{ userId: true, siteId: true \}\)[\s\S]{0,100}strict\(\)/);
assert.match(routesSource, /employeePatchSchema[\s\S]{0,220}authUserId: true[\s\S]{0,100}strict\(\)/);
assert.match(storageSource, /updateMachine\(id: number, siteId: number[\s\S]{0,300}eq\(machines\.siteId, siteId\)/);
assert.match(storageSource, /updateEmployee\(id: number, siteId: number[\s\S]{0,300}eq\(employees\.siteId, siteId\)/);
assert.match(routesSource, /Order must belong to the machine's site/);
assert.match(calculatorSource, /calculatorLeadSchema\.safeParse\(req\.body\)/);
assert.match(calculatorSource, /calculatorUpdateSchema\.safeParse\(req\.body\)/);
assert.match(calculatorSource, /calculatorReportSchema\.safeParse\(req\.body\)/);
assert.match(calculatorSource, /données utilisateur non fiables/);

const { createPublicAccessToken, verifyPublicAccessToken } = await import("./public-access-token");
const { sameOriginMutations, securityHeaders } = await import("./http-security");
const { boundedJsonObject } = await import("./public-payload-validation");
const token = createPublicAccessToken("calculator", 42);
assert.equal(verifyPublicAccessToken("calculator", 42, token), true);
assert.equal(verifyPublicAccessToken("calculator", 43, token), false);
assert.equal(verifyPublicAccessToken("diagnostic", 42, token), false);
assert.equal(verifyPublicAccessToken("calculator", 42, `${token}x`), false);

const headers = new Map<string, string>();
securityHeaders({} as any, { setHeader: (name: string, value: string) => headers.set(name, value) } as any, () => {});
assert.match(headers.get("Content-Security-Policy") || "", /frame-ancestors 'none'/);
assert.equal(headers.get("X-Frame-Options"), "DENY");
assert.equal(boundedJsonObject.safeParse({ inputs: { orders: 10 }, mode: "existing" }).success, true);
assert.equal(boundedJsonObject.safeParse({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }).success, false);
assert.equal(boundedJsonObject.safeParse({ payload: "x".repeat(65 * 1024) }).success, false);

let blockedStatus = 0;
sameOriginMutations({
  method: "POST", protocol: "https", session: { userId: "user-1" },
  get: (name: string) => ({ origin: "https://evil.example", host: "app.example", "sec-fetch-site": "cross-site" } as Record<string, string>)[name],
} as any, {
  status: (status: number) => { blockedStatus = status; return { json: () => undefined }; },
} as any, () => assert.fail("cross-site mutation must not continue"));
assert.equal(blockedStatus, 403);

let sameOriginContinued = false;
sameOriginMutations({
  method: "POST", protocol: "https", session: { userId: "user-1" },
  get: (name: string) => ({ origin: "https://app.example", host: "app.example", "sec-fetch-site": "same-origin" } as Record<string, string>)[name],
} as any, {} as any, () => { sameOriginContinued = true; });
assert.equal(sameOriginContinued, true);

console.log("security hardening regression tests passed");
