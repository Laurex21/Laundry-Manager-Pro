import fs from "node:fs";
import assert from "node:assert/strict";

const css = fs.readFileSync("client/src/index.css", "utf8");
const shell = fs.readFileSync("client/src/components/layout-shell.tsx", "utf8");
const dashboard = fs.readFileSync("client/src/pages/dashboard.tsx", "utf8");
const button = fs.readFileSync("client/src/components/ui/button.tsx", "utf8");

assert.match(css, /--primary:\s*245 100% 68%/);
assert.match(css, /--sidebar:\s*212 84% 19%/);
assert.match(css, /prefers-reduced-motion/);
assert.match(shell, /bg-sidebar text-sidebar-foreground/);
assert.match(shell, /bg-sidebar-primary text-white/);
assert.match(shell, /xpresspro-mark-white\.svg/);
assert.doesNotMatch(shell, /laundry_manager/);
assert.match(dashboard, /text-xl font-bold text-foreground/);
assert.match(dashboard, /hover:border-primary\/30/);
assert.match(button, /focus-visible:ring-2/);

console.log("XpressPro visual foundation regression passed");
