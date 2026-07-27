import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const customers = readFileSync(join(root, "client/src/pages/customers.tsx"), "utf8");
const layout = readFileSync(join(root, "client/src/components/layout-shell.tsx"), "utf8");
const translations = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");
const orders = readFileSync(join(root, "client/src/pages/orders.tsx"), "utf8");

assert.match(customers, /grid grid-cols-1 gap-2 sm:flex/);
assert.match(customers, /h-11 w-full[^"]*sm:hidden/);
assert.match(customers, /aria-pressed=\{showMembershipColumns\}/);
assert.match(customers, /show_subscription_details/);
assert.match(customers, /hide_subscription_details/);
assert.match(customers, /membership_status/);
assert.match(customers, /remaining_balance/);

assert.match(layout, /const BOTTOM_NAV_HREFS = \["\/", "\/orders", "\/customers", "\/payments"\]/);
assert.match(layout, /BOTTOM_NAV_HREFS\.includes\(item\.href\)/);
assert.match(layout, /bottom-\[calc\(5\.75rem\+env\(safe-area-inset-bottom\)\)\]/);

assert.match(translations, /"show_subscription_details": "Show subscriptions"/);
assert.match(translations, /"show_subscription_details": "Afficher les abonnements"/);
assert.match(translations, /"show_subscription_details": "Mostrar assinaturas"/);
assert.match(translations, /"hide_subscription_details": "Hide subscriptions"/);
assert.match(translations, /"hide_subscription_details": "Masquer les abonnements"/);
assert.match(translations, /"hide_subscription_details": "Ocultar assinaturas"/);
assert.match(translations, /"remaining_balance": "Remaining Balance"/);
assert.match(translations, /"remaining_balance": "Solde restant"/);
assert.match(translations, /"remaining_balance": "Saldo restante"/);

assert.match(orders, /md:max-w-\[1080px\]/);
assert.match(orders, /md:grid-cols-\[minmax\(0,1\.2fr\)_minmax\(18rem,0\.8fr\)\]/);

console.log("customers responsive controls tests passed");
