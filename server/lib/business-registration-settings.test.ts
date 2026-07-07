import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
const settingsPage = readFileSync(join(root, "client/src/pages/settings.tsx"), "utf8");
const receiptSettings = readFileSync(join(root, "client/src/lib/receipt-settings.ts"), "utf8");
const receipt = readFileSync(join(root, "client/src/lib/receipt.ts"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");

assert.match(schema, /companyRegistrationNumber: varchar\("company_registration_number"/);
assert.match(storage, /ADD COLUMN IF NOT EXISTS company_registration_number/);
assert.match(storage, /ensureBusinessSettingsSchema\(\)/);

assert.match(settingsPage, /companyRegistrationNumber: settings\.companyRegistrationNumber/);
assert.match(settingsPage, /input-company-registration-number/);
assert.match(settingsPage, /t\("company_registration_number"\)/);
assert.match(settingsPage, /t\("company_registration_number_placeholder"\)/);

assert.match(receiptSettings, /companyRegistrationNumber\?: string \| null/);
assert.match(receiptSettings, /companyRegistrationNumber: ""/);
assert.match(receiptSettings, /"Registration No\.": "Nº de Registo"/);

assert.match(receipt, /settings\.companyRegistrationNumber/);
assert.match(receipt, /label\("Registration No\.", "N° d'immatriculation"/);
assert.match(receipt, /registrationLine, settings\.phone/);

assert.match(i18n, /company_registration_number: "Company Registration Number"/);
assert.match(i18n, /company_registration_number: "Numéro d'immatriculation"/);
assert.match(i18n, /company_registration_number: "Número de registo da empresa"/);

console.log("business registration settings regression tests passed");
