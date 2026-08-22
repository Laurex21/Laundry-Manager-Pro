import type { RequestHandler } from "express";

const PRODUCTION_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
].join("; ");

export const securityHeaders: RequestHandler = (_req, res, next) => {
  // Vite injects inline HMR and React-refresh bootstrap modules in development.
  // Keep the deployed application's CSP strict while allowing the development
  // server to run those local-only scripts.
  const contentSecurityPolicy = process.env.NODE_ENV === "production"
    ? PRODUCTION_CONTENT_SECURITY_POLICY
    : PRODUCTION_CONTENT_SECURITY_POLICY
      .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
      .replace("connect-src 'self'", "connect-src 'self' ws: wss:");

  res.setHeader("Content-Security-Policy", contentSecurityPolicy);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const sameOriginMutations: RequestHandler = (req: any, res, next) => {
  if (SAFE_METHODS.has(req.method) || !req.session?.userId) return next();

  const fetchSite = String(req.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") {
    return res.status(403).json({ message: "Cross-site request blocked" });
  }

  const origin = req.get("origin");
  if (!origin) return next();
  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== req.get("host") || originUrl.protocol !== `${req.protocol}:`) {
      return res.status(403).json({ message: "Cross-site request blocked" });
    }
  } catch {
    return res.status(403).json({ message: "Cross-site request blocked" });
  }
  return next();
};
