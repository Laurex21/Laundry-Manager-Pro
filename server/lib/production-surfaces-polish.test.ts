import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const services = readFileSync("client/src/pages/services.tsx", "utf8");
const employees = readFileSync("client/src/pages/employees.tsx", "utf8");
const machines = readFileSync("client/src/pages/machines.tsx", "utf8");

assert.match(services, /columns-1 gap-5 lg:columns-2/, "service categories must flow independently without paired-row gaps");
assert.match(services, /input-search-services/, "services must provide search");
assert.match(services, /select-service-category-filter/, "services must provide a category filter");
assert.match(services, /button-filter-express/, "services must provide an Express filter");
assert.match(services, /toLocaleString\(i18n\.language/, "service prices must be locale formatted");
assert.doesNotMatch(services, /Number\(service\.price\)\.toFixed\(2\)/, "service prices must not expose raw fixed decimals");

assert.match(employees, /hidden lg:grid/, "employees must use a compact desktop table from the lg breakpoint");
assert.match(employees, /role_owner.*Propriétaire/s, "employee roles must be translated");
assert.match(employees, /active: t\("active", "Actif"\)/, "employee statuses must be translated");
assert.match(employees, /text-\[11px\] text-muted-foreground\/70/, "employee codes must remain visually secondary");

assert.match(machines, /SelectValue placeholder=\{t\("select_machine"\)\}/, "machine selection must expose the translated label");

console.log("production surfaces polish regression checks passed");
