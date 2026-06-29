import type { RequestHandler } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function requestIp(req: any): string {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}

export function rateLimit(options: {
  name: string;
  windowMs: number;
  max: number;
  key?: (req: any) => string;
}): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const keyPart = options.key?.(req) || "";
    const key = `${options.name}:${requestIp(req)}:${keyPart}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ message: "Too many attempts. Please try again later." });
    }

    return next();
  };
}
