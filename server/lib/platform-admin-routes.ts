import type { Express, RequestHandler } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { authStorage } from "../replit_integrations/auth/storage";
import { rateLimit } from "./rate-limit";
import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotp,
} from "./totp";

const ADMIN_PENDING_TTL_MS = 10 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000;

type PlatformAdminRecord = {
  user_id: string;
  mfa_secret_ciphertext: string | null;
  mfa_secret_iv: string | null;
  mfa_secret_tag: string | null;
  mfa_enabled_at: Date | null;
  last_totp_step: string | number | null;
};

const platformAdminLoginLimiter = rateLimit({
  name: "platform-admin-login",
  windowMs: 15 * 60 * 1000,
  max: 5,
  key: (req) => String(req.body?.email || "").trim().toLowerCase(),
});

const platformAdminMfaLimiter = rateLimit({
  name: "platform-admin-mfa",
  windowMs: 15 * 60 * 1000,
  max: 8,
  key: (req) => String(req.session?.userId || "anonymous"),
  keyOnly: true,
});

async function getPlatformAdmin(userId: string | null | undefined): Promise<PlatformAdminRecord | null> {
  if (!userId) return null;
  const result = await pool.query<PlatformAdminRecord>(
    `SELECT user_id, mfa_secret_ciphertext, mfa_secret_iv, mfa_secret_tag, mfa_enabled_at, last_totp_step
     FROM platform_admins
     WHERE user_id = $1 AND is_active = true AND revoked_at IS NULL
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

function requestIp(req: any): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

async function recordPlatformAdminEvent(
  req: any,
  action: string,
  outcome: "success" | "denied" | "failure",
  userId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const ipHash = crypto.createHash("sha256").update(requestIp(req)).digest("hex");
  await pool.query(
    `INSERT INTO platform_admin_audit_events
       (user_id, action, outcome, request_id, ip_hash, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      userId,
      action,
      outcome,
      req.requestId || null,
      ipHash,
      String(req.get?.("user-agent") || "").slice(0, 500) || null,
      JSON.stringify(metadata),
    ],
  );
}

async function recordPlatformAdminEventBestEffort(
  req: any,
  action: string,
  outcome: "success" | "denied" | "failure",
  userId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await recordPlatformAdminEvent(req, action, outcome, userId, metadata).catch((error) => {
    console.error("Platform administrator audit recording failed:", error);
  });
}

function regenerateSession(req: any): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((error: unknown) => error ? reject(error) : resolve()));
}

function saveSession(req: any): Promise<void> {
  return new Promise((resolve, reject) => req.session.save((error: unknown) => error ? reject(error) : resolve()));
}

function pendingAdminSession(req: any, userId: string): void {
  req.session.userId = userId;
  req.session.platformAdminPendingAt = Date.now();
  req.session.platformAdminVerifiedAt = undefined;
  req.session.platformAdminSetupSecret = undefined;
  req.session.cookie.maxAge = ADMIN_PENDING_TTL_MS;
}

function verifiedAdminSession(req: any, userId: string): void {
  req.session.userId = userId;
  req.session.platformAdminPendingAt = undefined;
  req.session.platformAdminVerifiedAt = Date.now();
  req.session.platformAdminSetupSecret = undefined;
  req.session.cookie.maxAge = ADMIN_SESSION_TTL_MS;
}

function isFreshTimestamp(value: unknown, ttlMs: number): boolean {
  return typeof value === "number" && value <= Date.now() && Date.now() - value <= ttlMs;
}

const requirePendingPlatformAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const admin = await getPlatformAdmin(req.session?.userId);
    if (!admin || !isFreshTimestamp(req.session?.platformAdminPendingAt, ADMIN_PENDING_TTL_MS)) {
      return res.status(401).json({ message: "Administrator reauthentication required" });
    }
    req.platformAdmin = admin;
    next();
  } catch (error) {
    console.error("Pending platform administrator authorization failed:", error);
    res.status(500).json({ message: "Unable to verify administrator access" });
  }
};

export async function isActivePlatformAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const result = await pool.query(
    `SELECT 1 FROM platform_admins WHERE user_id = $1 AND is_active = true AND revoked_at IS NULL LIMIT 1`,
    [userId],
  );
  return result.rowCount === 1;
}

export const requirePlatformAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const admin = await getPlatformAdmin(req.session?.userId);
    if (!admin) {
      return res.status(403).json({ message: "Platform administrator access required" });
    }
    if (!admin.mfa_enabled_at || !isFreshTimestamp(req.session?.platformAdminVerifiedAt, ADMIN_SESSION_TTL_MS)) {
      return res.status(401).json({ message: "Multi-factor authentication required", code: "PLATFORM_ADMIN_MFA_REQUIRED" });
    }
    req.isPlatformAdmin = true;
    next();
  } catch (error) {
    console.error("Platform admin authorization failed:", error);
    res.status(500).json({ message: "Unable to verify platform administrator access" });
  }
};

function safeLimit(value: unknown, fallback = 100, maximum = 200): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function registerPlatformAdminRoutes(app: Express): void {
  app.post("/api/platform-admin/login", platformAdminLoginLimiter, async (req: any, res) => {
    const identifier = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!identifier || !password) return res.status(400).json({ message: "Email and password are required" });
    let userId: string | null = null;
    try {
      const user = await authStorage.getUserByEmail(identifier);
      userId = user?.id ?? null;
      const validPassword = !!(user?.passwordHash && await bcrypt.compare(password, user.passwordHash));
      const admin = validPassword ? await getPlatformAdmin(user?.id) : null;
      if (!user || !validPassword || !admin) {
        await recordPlatformAdminEventBestEffort(req, "platform_admin.login", "denied", userId);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      await regenerateSession(req);
      pendingAdminSession(req, user.id);
      await saveSession(req);
      await recordPlatformAdminEventBestEffort(req, "platform_admin.login", "success", user.id, { mfaEnrolled: !!admin.mfa_enabled_at });
      res.json({ mfaRequired: true, enrollmentRequired: !admin.mfa_enabled_at });
    } catch (error) {
      console.error("Platform administrator login failed:", error);
      await recordPlatformAdminEventBestEffort(req, "platform_admin.login", "failure", userId);
      res.status(500).json({ message: "Administrator sign in failed" });
    }
  });

  app.post("/api/platform-admin/mfa/setup", platformAdminMfaLimiter, requirePendingPlatformAdmin, async (req: any, res) => {
    try {
      const admin = req.platformAdmin as PlatformAdminRecord;
      if (admin.mfa_enabled_at) return res.status(409).json({ message: "Multi-factor authentication is already enabled" });
      const user = await authStorage.getUser(admin.user_id);
      if (!user?.email) return res.status(400).json({ message: "Administrator email is required" });
      const secret = String(req.session.platformAdminSetupSecret || generateTotpSecret());
      req.session.platformAdminSetupSecret = secret;
      await saveSession(req);
      res.json({ secret, otpauthUri: buildTotpUri(secret, user.email) });
    } catch (error) {
      console.error("Platform administrator MFA setup failed:", error);
      res.status(500).json({ message: "Unable to prepare multi-factor authentication" });
    }
  });

  app.post("/api/platform-admin/mfa/confirm", platformAdminMfaLimiter, requirePendingPlatformAdmin, async (req: any, res) => {
    const code = String(req.body?.code || "");
    const secret = String(req.session?.platformAdminSetupSecret || "");
    const userId = req.session?.userId as string;
    const step = secret ? verifyTotp(secret, code) : null;
    if (step === null) {
      await recordPlatformAdminEventBestEffort(req, "platform_admin.mfa_enrollment", "denied", userId);
      return res.status(401).json({ message: "Invalid verification code" });
    }
    try {
      const encrypted = encryptTotpSecret(secret);
      const updated = await pool.query(
        `UPDATE platform_admins
         SET mfa_secret_ciphertext = $2, mfa_secret_iv = $3, mfa_secret_tag = $4,
             mfa_enabled_at = now(), last_totp_step = $5
         WHERE user_id = $1 AND is_active = true AND revoked_at IS NULL AND mfa_enabled_at IS NULL`,
        [userId, encrypted.ciphertext, encrypted.iv, encrypted.tag, step],
      );
      if (updated.rowCount !== 1) {
        return res.status(409).json({ message: "Multi-factor authentication enrollment is no longer available" });
      }
      verifiedAdminSession(req, userId);
      await saveSession(req);
      await recordPlatformAdminEventBestEffort(req, "platform_admin.mfa_enrollment", "success", userId);
      res.json({ verified: true, expiresInSeconds: ADMIN_SESSION_TTL_MS / 1000 });
    } catch (error) {
      console.error("Platform administrator MFA enrollment failed:", error);
      await recordPlatformAdminEventBestEffort(req, "platform_admin.mfa_enrollment", "failure", userId);
      res.status(500).json({ message: "Unable to enable multi-factor authentication" });
    }
  });

  app.post("/api/platform-admin/mfa/verify", platformAdminMfaLimiter, requirePendingPlatformAdmin, async (req: any, res) => {
    const admin = req.platformAdmin as PlatformAdminRecord;
    const code = String(req.body?.code || "");
    try {
      if (!admin.mfa_enabled_at || !admin.mfa_secret_ciphertext || !admin.mfa_secret_iv || !admin.mfa_secret_tag) {
        return res.status(409).json({ message: "Multi-factor authentication enrollment required" });
      }
      const secret = decryptTotpSecret({
        ciphertext: admin.mfa_secret_ciphertext,
        iv: admin.mfa_secret_iv,
        tag: admin.mfa_secret_tag,
      });
      const step = verifyTotp(secret, code);
      const lastStep = admin.last_totp_step === null ? null : Number(admin.last_totp_step);
      if (step === null || (lastStep !== null && step <= lastStep)) {
        await recordPlatformAdminEventBestEffort(req, "platform_admin.mfa_verification", "denied", admin.user_id);
        return res.status(401).json({ message: "Invalid or already used verification code" });
      }
      const updated = await pool.query(
        `UPDATE platform_admins SET last_totp_step = $2
         WHERE user_id = $1 AND is_active = true AND revoked_at IS NULL
           AND (last_totp_step IS NULL OR last_totp_step < $2)`,
        [admin.user_id, step],
      );
      if (updated.rowCount !== 1) return res.status(401).json({ message: "Verification code already used" });
      verifiedAdminSession(req, admin.user_id);
      await saveSession(req);
      await recordPlatformAdminEventBestEffort(req, "platform_admin.mfa_verification", "success", admin.user_id);
      res.json({ verified: true, expiresInSeconds: ADMIN_SESSION_TTL_MS / 1000 });
    } catch (error) {
      console.error("Platform administrator MFA verification failed:", error);
      await recordPlatformAdminEventBestEffort(req, "platform_admin.mfa_verification", "failure", admin.user_id);
      res.status(500).json({ message: "Unable to verify multi-factor authentication" });
    }
  });

  app.get("/api/platform-admin/status", async (req: any, res) => {
    try {
      const admin = await getPlatformAdmin(req.session?.userId);
      res.json({
        isPlatformAdmin: !!admin,
        mfaEnrolled: !!admin?.mfa_enabled_at,
        mfaVerified: !!admin?.mfa_enabled_at && isFreshTimestamp(req.session?.platformAdminVerifiedAt, ADMIN_SESSION_TTL_MS),
        pendingAuthentication: !!admin && isFreshTimestamp(req.session?.platformAdminPendingAt, ADMIN_PENDING_TTL_MS),
      });
    } catch (error) {
      console.error("Platform administrator status failed:", error);
      res.status(500).json({ message: "Unable to verify administrator status" });
    }
  });

  app.get("/api/platform-admin/overview", isAuthenticated, requirePlatformAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          (SELECT count(*)::int FROM organisations) AS organisation_count,
          (SELECT count(*)::int FROM sites WHERE is_active = true) AS active_site_count,
          (SELECT count(*)::int FROM users) AS user_count,
          (SELECT count(*)::int FROM users WHERE user_type = 'staff') AS staff_count,
          (SELECT count(*)::int FROM subscriptions WHERE status = 'active') AS active_subscription_count,
          (
            SELECT COALESCE(sum(amount), 0)::numeric
            FROM subscription_payments
            WHERE status = 'completed'
              AND created_at >= date_trunc('month', now())
          ) AS subscription_revenue_month,
          (
            SELECT count(*)::int
            FROM subscriptions
            WHERE status = 'active'
              AND end_date IS NOT NULL
              AND end_date >= now()
              AND end_date < now() + interval '14 days'
          ) AS expiring_soon_count
      `);
      const row = result.rows[0] || {};
      res.json({
        organisationCount: Number(row.organisation_count || 0),
        activeSiteCount: Number(row.active_site_count || 0),
        userCount: Number(row.user_count || 0),
        staffCount: Number(row.staff_count || 0),
        activeSubscriptionCount: Number(row.active_subscription_count || 0),
        subscriptionRevenueMonth: Number(row.subscription_revenue_month || 0),
        expiringSoonCount: Number(row.expiring_soon_count || 0),
      });
    } catch (error) {
      console.error("Platform admin overview failed:", error);
      res.status(500).json({ message: "Failed to load platform overview" });
    }
  });

  app.get("/api/platform-admin/subscribers", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      const search = String(req.query.search || "").trim().slice(0, 120);
      const limit = safeLimit(req.query.limit);
      const result = await pool.query(
        `
          SELECT
            o.id,
            o.name,
            o.created_at,
            o.owner_id,
            owner.email AS owner_email,
            owner.first_name AS owner_first_name,
            owner.last_name AS owner_last_name,
            owner.phone AS owner_phone,
            (SELECT count(*)::int FROM sites s WHERE s.organisation_id = o.id AND s.is_active = true) AS site_count,
            (SELECT count(*)::int FROM users member WHERE member.organisation_id = o.id AND member.user_type = 'staff') AS staff_count,
            latest_subscription.status AS subscription_status,
            latest_subscription.start_date AS subscription_start_date,
            latest_subscription.end_date AS subscription_end_date,
            latest_subscription.plan_slug,
            latest_subscription.plan_name
          FROM organisations o
          INNER JOIN users owner ON owner.id = o.owner_id
          LEFT JOIN LATERAL (
            SELECT
              sub.status,
              sub.start_date,
              sub.end_date,
              p.slug AS plan_slug,
              p.name AS plan_name
            FROM subscriptions sub
            INNER JOIN plans p ON p.id = sub.plan_id
            WHERE sub.user_id = o.owner_id
            ORDER BY sub.created_at DESC, sub.id DESC
            LIMIT 1
          ) latest_subscription ON true
          WHERE (
            $1 = ''
            OR o.name ILIKE '%' || $1 || '%'
            OR COALESCE(owner.email, '') ILIKE '%' || $1 || '%'
            OR COALESCE(owner.first_name, '') ILIKE '%' || $1 || '%'
            OR COALESCE(owner.last_name, '') ILIKE '%' || $1 || '%'
          )
          ORDER BY o.created_at DESC, o.id DESC
          LIMIT $2
        `,
        [search, limit],
      );

      res.json(result.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        createdAt: row.created_at,
        owner: {
          id: row.owner_id,
          email: row.owner_email,
          firstName: row.owner_first_name,
          lastName: row.owner_last_name,
          phone: row.owner_phone,
        },
        siteCount: Number(row.site_count || 0),
        staffCount: Number(row.staff_count || 0),
        subscription: row.plan_slug ? {
          status: row.subscription_status,
          startDate: row.subscription_start_date,
          endDate: row.subscription_end_date,
          planSlug: row.plan_slug,
          planName: row.plan_name,
        } : null,
      })));
    } catch (error) {
      console.error("Platform admin subscriber list failed:", error);
      res.status(500).json({ message: "Failed to load subscribers" });
    }
  });

  app.get("/api/platform-admin/audit-events", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      const limit = safeLimit(req.query.limit, 30, 100);
      const result = await pool.query(
        `
          SELECT
            event.id,
            event.organisation_id,
            org.name AS organisation_name,
            event.actor_user_id,
            actor.email AS actor_email,
            event.action,
            event.target_type,
            event.target_id,
            event.created_at,
            event.request_id
          FROM security_audit_events event
          LEFT JOIN organisations org ON org.id = event.organisation_id
          LEFT JOIN users actor ON actor.id = event.actor_user_id
          ORDER BY event.created_at DESC, event.id DESC
          LIMIT $1
        `,
        [limit],
      );
      res.json(result.rows.map((row) => ({
        id: Number(row.id),
        organisationId: Number(row.organisation_id),
        organisationName: row.organisation_name,
        actorUserId: row.actor_user_id,
        actorEmail: row.actor_email,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        createdAt: row.created_at,
        requestId: row.request_id,
      })));
    } catch (error) {
      console.error("Platform admin audit event list failed:", error);
      res.status(500).json({ message: "Failed to load audit events" });
    }
  });
}
