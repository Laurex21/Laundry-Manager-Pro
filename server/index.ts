import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { runDailyJobsWithLock } from "./lib/daily-jobs";
import { serveStatic } from "./static";
import { createServer } from "http";
import crypto from "crypto";
import { securityHeaders } from "./lib/http-security";
import { repairKnownAccountOrganisationLinks } from "./replit_integrations/auth/replitAuth";

const app = express();
const httpServer = createServer(app);

app.disable("x-powered-by");
app.use(securityHeaders);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const standardJsonParser = express.json({
  limit: "250kb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
});
const evidenceJsonParser = express.json({
  limit: "3mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
});
const settingsJsonParser = express.json({
  limit: "2mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
});

app.use((req, res, next) => {
  const isReturnEvidenceUpload = req.method === "POST" && /^\/api\/orders\/\d+\/garment-returns$/.test(req.path);
  const isBusinessLogoUpdate = req.method === "PUT" && req.path === "/api/settings";
  const parser = isReturnEvidenceUpload
    ? evidenceJsonParser
    : isBusinessLogoUpdate
      ? settingsJsonParser
      : standardJsonParser;
  return parser(req, res, next);
});

app.use(express.urlencoded({ extended: false, limit: "100kb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const requestId = req.get("x-request-id") || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms requestId=${requestId}`);
    }
  });

  next();
});

(async () => {
  await repairKnownAccountOrganisationLinks();
  await registerRoutes(httpServer, app);
  runDailyJobsWithLock().catch((error) => console.error("[Daily Job] Execution failed", error));
  const subscriptionNotificationTimer = setInterval(() => {
    runDailyJobsWithLock().catch((error) => console.error("[Daily Job] Execution failed", error));
  }, 24 * 60 * 60 * 1000);
  subscriptionNotificationTimer.unref();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 ? "Internal Server Error" : (err.message || "Request failed");

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
