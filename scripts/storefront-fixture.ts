// Local/test fixture only. No environment variables, real database or network access.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { readFile } from "node:fs/promises";
import * as schema from "../shared/schema";
import type { db } from "../server/db";
import { PILOT_WEIGHTS } from "../shared/storefront";
import { StorefrontService } from "../server/lib/storefront-service";

export async function storefrontFixture(options: { createShop?: boolean } = {}) {
  const pg = new PGlite();
  const database = drizzle(pg, { schema });
  const before = Object.fromEntries(Object.entries(schema).filter(([name]) => !["storefronts", "storefrontServices", "storefrontRequests", "storefrontEvents"].includes(name)));
  for (const sql of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(before))) await pg.exec(sql);
  // Exercise the actual additive migration against the existing application schema.
  await pg.exec(await readFile(new URL("../migrations/20261119_storefront_v1.sql", import.meta.url), "utf8"));
  await pg.exec(await readFile(new URL("../migrations/20261120_storefront_branding.sql", import.meta.url), "utf8"));
  await database.insert(schema.users).values([{ id: "storefront-demo", organisationId: 1 }, { id: "other-demo", organisationId: 2 }]);
  await database.insert(schema.organisations).values([{ id: 1, name: "Pressing Démonstration", ownerId: "storefront-demo" }, { id: 2, name: "Autre organisation", ownerId: "other-demo" }]);
  await database.insert(schema.sites).values([{ id: 1, organisationId: 1, name: "Pressing Horizon", address: "12, avenue de la Démonstration · Douala", phone: "+237600000000" }, { id: 2, organisationId: 2, name: "Autre pressing" }]);
  const rows = await database.insert(schema.services).values([
    { siteId: 1, name: "Lavage & pliage", description: "Le linge du quotidien, lavé et soigneusement plié.", price: "1000", unit: "kg", category: "washing" },
    { siteId: 1, name: "Repassage", description: "Une finition nette, facturée à la pièce.", price: "500", unit: "piece", category: "ironing" },
    { siteId: 1, name: "Tenue délicate", description: "Robes de soirée et vêtements délicats : examen au dépôt.", price: "0", unit: "piece", category: "dry_cleaning" },
    { siteId: 2, name: "Service privé B", price: "2000", unit: "kg", category: "washing" },
  ]).returning();
  const actor = { siteId: 1, organisationId: 1, userId: "storefront-demo" };
  const service = new StorefrontService(database as unknown as typeof db);
  if (options.createShop !== false) await service.save(actor, { siteId: 1, expectedVersion: 0, slug: "pressing-horizon", name: "Pressing Horizon", description: "Du linge frais. Du temps pour vous. Préparez votre dépôt depuis votre téléphone.", address: "12, avenue de la Démonstration · Douala", hours: "Lun – sam · 8 h – 18 h", whatsapp: "+237600000000", currency: "XAF", published: true, weightsAcknowledged: true, weights: PILOT_WEIGHTS, services: rows.slice(0, 3).map((s, i) => ({ serviceId: s.id, mode: i === 0 ? "kg" : i === 1 ? "piece" : "quote" })) });
  return { pg, database, service, actor, services: rows, schema };
}
