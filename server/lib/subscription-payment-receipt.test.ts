import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateSubscriptionPaymentReceiptHTML } from "./subscription-receipt";

const html = generateSubscriptionPaymentReceiptHTML({
  customer: { name: "Laure", phone: "+237600000000" },
  subscription: { membershipNumber: "XP-14-TEST" },
  plan: { name: "Best" },
  payment: { id: 7, amount: 1000, paymentMethod: "cash", paymentDate: "2026-08-20T14:22:00Z", reference: null },
  paymentPosition: { cost: 20000, paid: 1000, due: 19000 },
  settings: { businessName: "Xpress Clean" },
});

assert.match(html, /1[\s\u202f]000,00 FCFA/);
assert.match(html, /19[\s\u202f]000,00 FCFA/);
assert.match(html, /Avance · Abonnement actif/);
assert.match(html, /lang="fr"/);
assert.match(html, /<title>Reçu de paiement abonnement #7<\/title>/);

const renewalAdvanceHtml = generateSubscriptionPaymentReceiptHTML({
  customer: { name: "Laure", phone: "+237600000000" }, subscription: { membershipNumber: "XP-14-TEST" }, plan: { name: "Best" },
  payment: { id: 8, amount: 3000, paymentMethod: "cash", paymentDate: "2026-08-20T14:23:00Z" },
  paymentPosition: { cost: 20000, paid: 3000, due: 17000 }, settings: {},
  receiptStatus: "Avance disponible pour le prochain renouvellement",
});
assert.match(renewalAdvanceHtml, /Avance disponible pour le prochain renouvellement/);

const routes = readFileSync("server/lib/membership-routes.ts", "utf8");
const membershipUi = readFileSync("client/src/components/customer-membership-tab.tsx", "utf8");
assert.match(routes, /\/api\/subscriptions\/:id\/payments\/:paymentId\/receipt/);
assert.match(routes, /eq\(membershipSubscriptionPayments\.organisationId, organisationId\)/, "receipt payment must be tenant scoped");
assert.match(routes, /inArray\(customers\.siteId, siteScope\(req\)\)/, "receipt customer must be site scoped");
assert.match(routes, /Content-Disposition.*subscription-payment-\$\{paymentId\}\.html/, "receipt must download with a stable filename");
assert.match(membershipUi, /aria-label=\{`\$\{t\("download_receipt"\)\}/, "icon-only receipt control needs an accessible name");
assert.match(membershipUi, /const receiptWindow = window\.open\("", "_blank"/, "receipt print window must open synchronously from the user click");
assert.match(membershipUi, /await fetch\(\s*`\/api\/subscriptions\/\$\{subscriptionId\}\/payments\/\$\{paymentId\}\/receipt`[\s\S]*credentials: "include"/, "receipt HTML must be fetched with the authenticated session");
assert.match(membershipUi, /receiptWindow\.document\.write\(html\)/, "receipt HTML must be written into the dedicated print window");
assert.match(html, /Promise\.all\(waitForImages\)/, "printing must wait for receipt images to finish loading");
assert.match(html, /window\.print\(\)/, "payment receipt must trigger the browser print dialog");
console.log("subscription payment receipt regression passed");
