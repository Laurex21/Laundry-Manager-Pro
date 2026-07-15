import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const launcher = read("client/src/components/whatsapp-launcher.tsx");
const app = read("client/src/App.tsx");
const settings = read("client/src/pages/settings.tsx");
const schema = read("shared/schema.ts");
const storage = read("server/storage.ts");
const routes = read("server/routes.ts");
const i18n = read("client/src/lib/i18n.ts");

assert.match(app, /<WhatsAppLauncherProvider>/);
assert.match(launcher, /"ask" \| "whatsapp" \| "business"/);
assert.match(launcher, /xpresspro-whatsapp-app-preference/);
assert.match(launcher, /com\.whatsapp\.w4b/);
assert.match(launcher, /whatsapp-smb/);
assert.match(launcher, /browser_fallback_url/);
assert.match(launcher, /data-testid="dialog-whatsapp-app-chooser"/);
assert.match(launcher, /data-testid="checkbox-remember-whatsapp-choice"/);
assert.match(settings, /data-testid="select-whatsapp-app-preference"/);
assert.match(settings, /data-testid="button-reset-whatsapp-device-choice"/);
assert.match(read("client/src/components/layout-shell.tsx"), /data-testid="button-change-whatsapp-app"/);
assert.match(schema, /whatsappAppPreference: varchar\("whatsapp_app_preference"/);
assert.match(schema, /z\.enum\(\["ask", "whatsapp", "business"\]\)/);
assert.match(schema, /\.omit\(\{ id: true, userId: true, updatedAt: true \}\)/);
assert.match(storage, /ADD COLUMN IF NOT EXISTS whatsapp_app_preference/);
assert.match(routes, /insertBusinessSettingsSchema\.partial\(\)\.safeParse\(req\.body\)/);

for (const path of [
  "client/src/components/layout-shell.tsx",
  "client/src/pages/orders.tsx",
  "client/src/pages/order-detail.tsx",
  "client/src/pages/customer-detail.tsx",
  "client/src/pages/dashboard.tsx",
  "client/src/pages/calculator.tsx",
  "client/src/pages/diagnostic.tsx",
  "client/src/pages/rentabilite.tsx",
  "client/src/pages/report-public.tsx",
]) {
  assert.match(read(path), /useWhatsAppLauncher/, `${path} must use the centralized WhatsApp launcher`);
}

for (const key of [
  "choose_whatsapp_app",
  "open_with_whatsapp",
  "open_with_whatsapp_business",
  "remember_whatsapp_choice",
  "whatsapp_preference_ask",
  "whatsapp_preference_business",
]) {
  assert.equal(i18n.split(`"${key}"`).length - 1, 3, `${key} must exist in all three languages`);
}

console.log("WhatsApp app preference regression tests passed");
