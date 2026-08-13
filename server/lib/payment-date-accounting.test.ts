import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const schema = readFileSync(join(root, "shared/schema.ts"), "utf8");
const paymentsPage = readFileSync(join(root, "client/src/pages/payments.tsx"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");
const storage = readFileSync(join(root, "server/storage.ts"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");
const paymentDate = readFileSync(join(root, "client/src/lib/payment-date.ts"), "utf8");

assert.match(schema, /insertPaymentSchema = createInsertSchema\(payments\)[\s\S]*\.extend\(\{ date: z\.coerce\.date\(\)\.optional\(\) \}\)/);

assert.match(paymentsPage, /function todayInputDate\(\)/);
assert.match(paymentsPage, /const \[paymentDate, setPaymentDate\] = useState\(todayInputDate\)/);
assert.match(paymentsPage, /data-testid="input-payment-date"/);
assert.match(paymentsPage, /t\("payment_date"\)/);
assert.match(paymentsPage, /t\("payment_date_hint"\)/);
assert.match(paymentsPage, /date: paymentDateWithRegistrationTime\(paymentDate\)/);
assert.match(paymentsPage, /\|\| !paymentDate/);
assert.match(paymentDate, /now\.getHours\(\)/);
assert.match(paymentDate, /now\.getMinutes\(\)/);
assert.doesNotMatch(paymentDate, /T00:00:00/);

assert.match(routes, /date: order\.entryDate \|\| new Date\(\)/);

assert.match(storage, /sql`\$\{payments\.date\} >= \$\{start\}`/);
assert.match(storage, /sql`\$\{payments\.date\} <= \$\{end\}`/);
assert.match(storage, /innerJoin\(orders, eq\(payments\.orderId, orders\.id\)\)/);
assert.ok(storage.includes("COALESCE(SUM(${payments.amount}), 0)`"), "payment revenue sums must use payments.amount");
assert.ok(storage.includes("COALESCE(SUM(${expenditures.amount}), 0)`"), "expense sums must use expenditures.amount");
assert.doesNotMatch(storage, /from\(payments\)[\s\S]{0,200}SUM\(\$\{expenditures\.amount\}\)/);
assert.doesNotMatch(storage, /from\(expenditures\)[\s\S]{0,200}SUM\(\$\{payments\.amount\}\)/);
assert.match(storage, /const paymentWhere = orderSiteWhere/);
assert.match(storage, /formatReportingDay\(payment\.date\)/);
assert.doesNotMatch(storage, /activity\.actionType === "payment_collected"\) stat\.totalPaymentsCollected \+=/);
assert.match(storage, /if \(activity\.actionType !== "payment_collected"\) stat\.totalRevenueHandled \+=/);
assert.match(storage, /stat\.totalPaymentsCollected \+= amount;/);
assert.match(storage, /stat\.totalRevenueHandled \+= amount;/);
assert.doesNotMatch(storage, /paymentsByOrder/);
assert.doesNotMatch(storage, /dailyRevenueMap\.set\(day,[\s\S]*order\.entryDate/);

assert.match(i18n, /"payment_date": "Payment date"/);
assert.match(i18n, /"payment_date": "Date du paiement"/);
assert.match(i18n, /"payment_date": "Data do pagamento"/);

console.log("payment date accounting regression tests passed");
