import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getRouteMeta, injectMetaIntoHtml } from "./lib/seo-metadata";

const viteLogger = createLogger();

// Known SPA routes: exact matches and prefixes for dynamic segments
const KNOWN_EXACT_ROUTES = new Set([
  "/",
  "/auth",
  "/calculateur",
  "/calculator",
  "/diagnostic",
  "/rentabilite",
  "/dashboard",
  "/customers",
  "/orders",
  "/services",
  "/expenses",
  "/payments",
  "/reports",
  "/machines",
  "/employees",
  "/analytics",
  "/subscriptions",
  "/settings",
]);

const KNOWN_PREFIXES = [
  "/rapport/",
  "/join/",
  "/customers/",
  "/orders/",
];

function isKnownSpaRoute(pathname: string): boolean {
  const p = pathname.split("?")[0].replace(/\/$/, "") || "/";
  if (KNOWN_EXACT_ROUTES.has(p)) return true;
  return KNOWN_PREFIXES.some((prefix) => p.startsWith(prefix));
}

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Server-side 301 redirect: /calculator → /calculateur
  app.get("/calculator", (_req, res) => {
    res.redirect(301, "/calculateur");
  });

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      let page = await vite.transformIndexHtml(url, template);

      // Inject route-specific SEO metadata for public acquisition routes
      const pathname = req.originalUrl.split("?")[0].replace(/\/$/, "") || "/";
      const meta = getRouteMeta(pathname);
      if (meta) {
        page = injectMetaIntoHtml(page, meta);
      }

      const status = isKnownSpaRoute(req.originalUrl) ? 200 : 404;
      res.status(status).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
