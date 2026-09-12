import type { Express, RequestHandler } from "express";
import { pool } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";

export async function ensurePlatformAdminSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_admins (
      user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      granted_by varchar REFERENCES users(id) ON DELETE SET NULL,
      is_active boolean NOT NULL DEFAULT true,
      granted_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz
    )
  `);

  const configuredEmails = String(process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (configuredEmails.length > 0) {
    await pool.query(
      `
        INSERT INTO platform_admins (user_id, granted_by, is_active, revoked_at)
        SELECT id, id, true, NULL
        FROM users
        WHERE lower(trim(email)) = ANY($1::text[])
        ON CONFLICT (user_id) DO UPDATE SET
          is_active = true,
          revoked_at = NULL
      `,
      [configuredEmails],
    );
  }
}

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
    const allowed = await isActivePlatformAdmin(req.session?.userId);
    if (!allowed) {
      return res.status(403).json({ message: "Platform administrator access required" });
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
  app.get("/api/platform-admin/status", isAuthenticated, async (req: any, res) => {
    res.json({ isPlatformAdmin: await isActivePlatformAdmin(req.session?.userId) });
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