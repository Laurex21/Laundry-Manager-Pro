// Explicit local sandbox. This entry point is never imported by server/index.ts.
import express from "express";
import { createServer } from "vite";
import { eq } from "drizzle-orm";
import { storefrontFixture } from "./storefront-fixture";
import { registerStorefrontRoutes } from "../server/lib/storefront-routes";
import viteConfig from "../vite.config";

if (process.env.NODE_ENV === "production") throw new Error("The storefront sandbox cannot run in production");
const fixture = await storefrontFixture();
const app = express();
app.use(express.json({ limit: "64kb" }));
registerStorefrontRoutes(app, { service: fixture.service, auth: (_req, _res, next) => next(), limit: (_req, _res, next) => next(), enabled: () => true, actor: async () => fixture.actor });
app.get("/api/storefront-preview/orders/:id", async (req, res) => {
  const [order] = await fixture.database.select().from(fixture.schema.orders).where(eq(fixture.schema.orders.id, Number(req.params.id)));
  if (!order) { res.status(404).json({ message: "Commande de démonstration introuvable" }); return; }
  const items = await fixture.database.select({ quantity: fixture.schema.orderItems.quantity, priceAtOrder: fixture.schema.orderItems.priceAtOrder, name: fixture.schema.services.name, unit: fixture.schema.services.unit }).from(fixture.schema.orderItems).innerJoin(fixture.schema.services, eq(fixture.schema.services.id, fixture.schema.orderItems.serviceId)).where(eq(fixture.schema.orderItems.orderId, order.id));
  res.json({ ...order, items });
});
const vite = await createServer({ ...viteConfig, configFile: false, cacheDir: ".storefront-vite", server: { host: "127.0.0.1", middlewareMode: true, hmr: { host: "127.0.0.1", port: 5124 } }, appType: "custom" });
app.use(vite.middlewares);
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) { res.status(404).json({ message: "Cette fonction appartient à l’application complète, hors de la démonstration locale." }); return; }
  try {
    const html = await vite.transformIndexHtml(req.originalUrl, '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Xpress Pro · Boutique pilote locale</title></head><body><div id="root"></div><script type="module" src="/src/storefront-preview.tsx"></script></body></html>');
    res.type("html").send(html);
  } catch (error) { next(error); }
});
const port = Number(process.env.STOREFRONT_PREVIEW_PORT || 5123);
const server = app.listen(port, "127.0.0.1", () => console.log(`Boutique locale : http://127.0.0.1:${port}/b/pressing-horizon\nGestion locale : http://127.0.0.1:${port}/boutique\nDonnées fictives en mémoire, effacées à l’arrêt. Aucun WhatsApp envoyé.`));
server.on("error", async error => { console.error(error.message); await vite.close(); await fixture.pg.close(); process.exitCode = 1; });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, async () => { server.close(); await vite.close(); await fixture.pg.close(); process.exit(0); });
