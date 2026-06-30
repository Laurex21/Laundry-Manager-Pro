import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const authRoutes = readFileSync(join(root, "server/replit_integrations/auth/routes.ts"), "utf8");
const replitAuth = readFileSync(join(root, "server/replit_integrations/auth/replitAuth.ts"), "utf8");
const legalRoutes = readFileSync(join(root, "server/lib/legal-routes.ts"), "utf8");
const legal = readFileSync(join(root, "server/lib/legal.ts"), "utf8");
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const authPage = readFileSync(join(root, "client/src/pages/auth-page.tsx"), "utf8");
const legalGate = readFileSync(join(root, "client/src/components/legal-acceptance-gate.tsx"), "utf8");
const layout = readFileSync(join(root, "client/src/components/layout-shell.tsx"), "utf8");

assert.match(schema, /export const legalDocuments = pgTable\("legal_documents"/);
assert.match(schema, /export const legalAcceptances = pgTable\("legal_acceptances"/);
assert.match(replitAuth, /CREATE TABLE IF NOT EXISTS legal_documents/);
assert.match(replitAuth, /CREATE TABLE IF NOT EXISTS legal_acceptances/);
assert.match(replitAuth, /bf7328dc39d69b2d8691d92553c04c92998fe6512eaa461a97c3a86bbc521e39/);
assert.match(replitAuth, /TERMS_REQUIRED/);
assert.match(replitAuth, /getCurrentLegalAcceptance/);
assert.match(replitAuth, /\/api\/legal\/accept/);

assert.match(legal, /termsVersion: "1\.0-enterprise-2026-06-30"/);
assert.match(legal, /privacyVersion: "1\.0-2026-06-30"/);
assert.match(legal, /cookieVersion: "1\.0-2026-06-30"/);
assert.match(legal, /fullDocumentUrl/);
assert.match(legal, /getCurrentLegalAcceptanceStatus/);
assert.match(legal, /recordCurrentLegalAcceptance/);

assert.match(legalRoutes, /\/api\/legal\/current/);
assert.match(legalRoutes, /\/api\/legal\/status/);
assert.match(legalRoutes, /\/api\/legal\/accept/);
assert.match(legalRoutes, /source: "login_gate"/);

assert.match(authRoutes, /acceptedLegal !== true/);
assert.match(authRoutes, /recordCurrentLegalAcceptance/);
assert.match(authRoutes, /source: "registration"/);
assert.match(authRoutes, /legalAcceptance/);

assert.match(authPage, /checkbox-registration-legal/);
assert.match(authPage, /acceptedLegal/);
assert.match(authPage, /\/terms/);
assert.match(authPage, /\/privacy/);
assert.match(authPage, /\/cookies/);

assert.match(legalGate, /legal-acceptance-modal/);
assert.match(legalGate, /\/api\/legal\/accept/);
assert.match(legalGate, /link-legal-full-document/);
assert.match(legalGate, /Decline and sign out/);
assert.match(layout, /<LegalAcceptanceGate \/>/);

console.log("legal acceptance regression tests passed");
