import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("PWA manifest exposes branded install metadata and safe shortcuts", () => {
  const manifest = JSON.parse(read("client/public/manifest.webmanifest"));
  assert.equal(manifest.short_name, "XpressPro");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#082D5B");
  assert.ok(manifest.icons.some((icon: { sizes: string }) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon: { sizes: string }) => icon.sizes === "512x512"));
  assert.ok(manifest.shortcuts.every((shortcut: { url: string }) => !shortcut.url.includes("new=1")));
});

test("service worker never caches authenticated APIs or navigations", () => {
  const worker = read("client/public/sw.js");
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.doesNotMatch(worker, /caches\.match\(request\).*\/api\//s);
});

test("authenticated shell exposes the install entry and branded dialog", () => {
  const shell = read("client/src/components/layout-shell.tsx");
  const dialog = read("client/src/components/pwa-install-dialog.tsx");
  const html = read("client/index.html");
  assert.match(shell, /menu-item-install-xpresspro/);
  assert.match(shell, /PWA_DISMISS_DURATION_MS/);
  assert.match(dialog, /Installer XpressPro/);
  assert.match(dialog, /Sur l’écran d’accueil/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /apple-touch-icon\.png/);
});
