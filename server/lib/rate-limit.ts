import crypto from "crypto";
import type { RequestHandler } from "express";
import { pool } from "../db";

function requestIp(req: any): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function bucketKey(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function rateLimit(options: {
  name: string;
  windowMs: number;
  max: number;
  key?: (req: any) => string;
  keyOnly?: boolean;
}): RequestHandler {
  return async (req, res, next) => {
    try {
      const keyPart = options.key?.(req) || "";
      const rawKey = options.keyOnly
        ? `${options.name}:${keyPart || requestIp(req)}`
        : `${options.name}:${requestIp(req)}:${keyPart}`;
      const key = bucketKey(rawKey);
      const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
      const result = await pool.query<{ count: number; reset_at: Date }>(
        `INSERT INTO security_rate_limits (bucket_key, count, reset_at)
         VALUES ($1, 1, now() + ($2 * interval '1 second'))
         ON CONFLICT (bucket_key) DO UPDATE SET
           count = CASE WHEN security_rate_limits.reset_at <= now() THEN 1 ELSE security_rate_limits.count + 1 END,
           reset_at = CASE WHEN security_rate_limits.reset_at <= now() THEN now() + ($2 * interval '1 second') ELSE security_rate_limits.reset_at END
         RETURNING count, reset_at`,
        [key, windowSeconds],
      );
      const bucket = result.rows[0];
      if (bucket.count > options.max) {
        const retryAfter = Math.max(1, Math.ceil((bucket.reset_at.getTime() - Date.now()) / 1000));
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({ message: "Too many attempts. Please try again later." });
      }
      if (Math.random() < 0.01) {
        pool.query("DELETE FROM security_rate_limits WHERE reset_at < now() - interval '1 day'").catch(() => {});
      }
      return next();
    } catch (error) {
      console.error("Security rate limiter unavailable:", error);
      return res.status(503).json({ message: "Security service temporarily unavailable" });
    }
  };
}
