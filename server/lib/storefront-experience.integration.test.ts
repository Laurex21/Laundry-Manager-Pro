import assert from "node:assert/strict";
import sharp from "sharp";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { storefrontFixture } from "../../scripts/storefront-fixture";
import { DEFAULT_BRANDING, accentForeground, brandingSchema } from "../../shared/storefront-branding";
import { sanitizeBranding } from "./storefront-branding";
import { shopInputSchema } from "../../shared/storefront";
const legacy = new PGlite();
try {
  await legacy.exec("CREATE TABLE storefronts (id integer PRIMARY KEY, name text NOT NULL); INSERT INTO storefronts VALUES (7, 'Existing fictional shop');");
  await legacy.exec(await readFile(new URL("../../migrations/20261120_storefront_branding.sql", import.meta.url), "utf8"));
  const existing = (await legacy.query<{ id: number; name: string; branding: unknown }>("SELECT * FROM storefronts")).rows[0];
  assert.equal(existing.id, 7); assert.equal(existing.name, "Existing fictional shop"); assert.deepEqual(existing.branding, DEFAULT_BRANDING);
} finally { await legacy.close(); }
const f = await storefrontFixture();
try {
  const current = (await f.service.admin(f.actor)).shop!;
  assert.deepEqual(current.branding, DEFAULT_BRANDING);
  const png = await sharp({ create: { width: 600, height: 400, channels: 4, background: { r: 40, g: 70, b: 90, alpha: .5 } } }).png().toBuffer();
  const image = `data:image/png;base64,${png.toString("base64")}`;
  const branding = { ...DEFAULT_BRANDING, template: "editorial" as const, accent: "#ffffff", logo: image, cover: image, serviceImages: { 1: image }, welcome: "Bienvenue à la boutique test" };
  const saved = await f.service.save(f.actor, { ...current, expectedVersion: current.version, branding });
  assert.match(saved.branding.logo, /^data:image\/webp;base64,/);
  const clean = await sharp(Buffer.from(saved.branding.logo.split(",")[1], "base64")).metadata();
  assert.ok(clean.width! <= 320); assert.equal(clean.exif, undefined);
  assert.deepEqual(await sanitizeBranding(saved.branding, [1], saved.branding), saved.branding, "unchanged images are preserved without recompression");
  const publicShop = await f.service.publicShop(current.slug);
  assert.equal(publicShop.branding.welcome, branding.welcome);
  assert.equal(publicShop.branding.accent, "#ffffff");
  assert.equal(accentForeground("#ffffff"), "#101820");
  assert.equal(accentForeground("#000000"), "#ffffff");
  assert.equal(brandingSchema.safeParse({ ...branding, accent: "red;url(javascript:alert(1))" }).success, false);
  await assert.rejects(() => sanitizeBranding({ ...branding, logo: `data:image/png;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64")}` }, [1]));
  await assert.rejects(() => sanitizeBranding({ ...branding, cover: "https://example.invalid/image.png" }, [1]));
  await assert.rejects(() => sanitizeBranding({ ...branding, serviceImages: { 4: image } }, [1]), (e: any) => e.status === 400);
  await assert.rejects(() => f.service.save({ siteId: 2, organisationId: 2, userId: "other-demo" }, { ...saved, expectedVersion: saved.version }), (e: any) => e.status === 409);
  const { branding: _omit, ...oldClient } = saved;
  const preserved = await f.service.save(f.actor, { ...oldClient, expectedVersion: saved.version });
  assert.deepEqual(preserved.branding, saved.branding, "older configuration clients cannot erase branding");
  await f.database.update(f.schema.services).set({ active: false }).where(eq(f.schema.services.id, 1));
  assert.deepEqual((await f.service.publicShop(current.slug)).branding.serviceImages, {}, "inactive service photos are not public");
  assert.equal(shopInputSchema.safeParse({ ...preserved, expectedVersion: preserved.version, weightsAcknowledged: false, services: [{ serviceId: 2, mode: "piece" }] }).success, true);
  assert.equal(shopInputSchema.safeParse({ ...preserved, expectedVersion: preserved.version, weightsAcknowledged: false, services: [{ serviceId: 1, mode: "kg" }] }).success, false);
  assert.equal(shopInputSchema.safeParse({ ...preserved, expectedVersion: preserved.version, services: [] }).success, false);
  console.log("PASS storefront experience: additive defaults, image persistence/resize/metadata, invalid images, tenant boundaries, old-client preservation, conditional weight acknowledgement.");
} finally { await f.pg.close(); }
