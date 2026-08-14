import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ordersPage = readFileSync(join(root, "client/src/pages/orders.tsx"), "utf8");
const i18n = readFileSync(join(root, "client/src/lib/i18n.ts"), "utf8");
const popover = readFileSync(join(root, "client/src/components/ui/popover.tsx"), "utf8");
const command = readFileSync(join(root, "client/src/components/ui/command.tsx"), "utf8");

assert.match(ordersPage, /function ServiceCombobox/);
assert.match(ordersPage, /normalize\("NFD"\)/, "service search must ignore accents");
assert.match(ordersPage, /t\("search_services"\)/);
assert.match(ordersPage, /t\("no_service_found"\)/);
assert.match(ordersPage, /<CommandGroup key=\{category\} heading=\{category\}>/);
assert.match(ordersPage, /value=\{`\$\{service\.id\} \$\{service\.name\} \$\{category\}`\}/);
assert.match(ordersPage, /onChange\(service\.id\)/);
assert.match(ordersPage, /aria-expanded=\{open\}/);
assert.match(ordersPage, /aria-label=\{t\("search_services"\)\}/);
assert.match(ordersPage, /services=\{activeServices\}/);
assert.match(ordersPage, /<PopoverContent portalled=\{false\}/, "service list must stay inside the modal scroll-lock boundary");
assert.match(command, /overflow-y-auto overflow-x-hidden/);
assert.match(popover, /portalled\?: boolean/);
assert.match(popover, /portalled \? <PopoverPrimitive\.Portal>/);

for (const text of [
  "Search services...",
  "No service found.",
  "Rechercher un service...",
  "Aucun service trouvé.",
  "Pesquisar serviços...",
  "Nenhum serviço encontrado.",
]) {
  assert.ok(i18n.includes(text), `missing service-search translation: ${text}`);
}

console.log("new order service search regression tests passed");
