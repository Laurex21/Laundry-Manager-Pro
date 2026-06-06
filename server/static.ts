import express, { type Express } from "express";
import fs from "fs";
import path from "path";

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

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Server-side 301 redirect: /calculator → /calculateur
  app.get("/calculator", (_req, res) => {
    res.redirect(301, "/calculateur");
  });

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (req, res) => {
    const status = isKnownSpaRoute(req.originalUrl) ? 200 : 404;
    res.status(status).sendFile(path.resolve(distPath, "index.html"));
  });
}
