import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const analytics = readFileSync(join(root, "client/src/pages/analytics.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");

assert.match(analytics, /function CustomerCreditAnalyticsSection/);
assert.match(analytics, /queryKey: \["\/api\/analytics\/credit-summary"\]/);
assert.match(analytics, /data-testid="section-customer-credit-analytics"/);
assert.match(analytics, /href="\/customers\?filter=credit"/);
assert.match(analytics, /Button asChild/);
assert.match(analytics, /role="progressbar"/);
assert.match(analytics, /organisation_all_time/);
assert.match(analytics, /credit_outstanding_liability/);
assert.match(analytics, /customer_credit_liability_note/);
assert.match(i18n, /customer_credit_analytics: "Customer credit"/);
assert.match(i18n, /customer_credit_analytics: "Avoirs clients"/);
assert.match(i18n, /customer_credit_analytics: "Créditos de clientes"/);

console.log("Customer credit analytics regression checks passed");
