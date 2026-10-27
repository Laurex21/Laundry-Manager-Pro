import { adminSubscribers, adminSegment, adminBilling, adminAudit, adminGrant } from "./platform-admin-saas";
import { SAAS_PLANS } from "../../shared/saas-plans";
import type { Express, RequestHandler } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "../db";
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

const platformAdminPlanLimiter = rateLimit({
  name: "platform-admin-plan-assign",
  windowMs: 60 * 60 * 1000,
  max: 20,
  key: (req) => String(req.session?.userId || ""),
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

  app.get("/api/platform-admin/overview", requirePlatformAdmin, async (_req, res) => {
    try {
      const now=new Date();
      const [items,billing,users]=await Promise.all([adminSubscribers(pool,now),adminBilling(pool,undefined,now),pool.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE user_type='staff')::int AS staff FROM users")]);
      const active=items.filter(i=>i.subscription?.status==='active');
      res.json({organisationCount:items.length,activeSiteCount:items.reduce((n,i)=>n+i.siteCount,0),userCount:Number(users.rows[0].total),staffCount:Number(users.rows[0].staff),
        activeSubscriptionCount:active.length,activeFreePlanCount:active.filter(i=>i.subscription!.planPrice===0).length,activePaidPlanCount:active.filter(i=>i.subscription!.planPrice>0).length,
        withoutPlanCount:items.filter(i=>!i.subscription).length,subscriptionRevenueMonth:billing.subscriptionRevenueMonth,pilotRevenueMonth:billing.pilotRevenueMonth,
        trialCount:items.filter(i=>i.subscription?.status==='trial').length,excludedCount:items.filter(i=>i.deferred).length,
        expiringSoonCount:items.filter(i=>adminSegment(i,'expiring',now)).length,attentionCount:items.filter(i=>adminSegment(i,'attention',now)).length});
    } catch (error) {
      console.error("Platform admin overview failed:", error);
      res.status(500).json({ message: "Failed to load platform overview" });
    }
  });

  app.get("/api/platform-admin/subscribers", requirePlatformAdmin, async (req, res) => {
    try {
      const search = String(req.query.search || "").trim().slice(0, 120);
      const segment = String(req.query.segment || "all");
      if (!["all","attention","active","trial","expiring","no-plan","expired","cancelled"].includes(segment)) return res.status(400).json({message:"Invalid subscription status filter"});
      const limit=safeLimit(req.query.limit,25,100),offset=Math.max(0,Math.min(1_000_000,Number(req.query.offset)||0));
      if(!Number.isSafeInteger(offset))return res.status(400).json({message:"Invalid offset"});
      const now=new Date();
      const items=(await adminSubscribers(pool,now)).filter(item=>adminSegment(item,segment,now)&&[item.name,item.owner.email,item.owner.firstName,item.owner.lastName].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())));
      if(segment==='expiring')items.sort((a,b)=>Date.parse(a.subscription!.endDate!)-Date.parse(b.subscription!.endDate!));
      res.json({total:items.length,limit,offset,items:items.slice(offset,offset+limit)});
    } catch (error) {
      console.error("Platform admin subscriber list failed:", error);
      res.status(500).json({ message: "Failed to load subscribers" });
    }
  });

  app.get("/api/platform-admin/organisations/:organisationId", requirePlatformAdmin, async (req: any, res) => {
    const organisationId = Number(req.params.organisationId);
    if (!Number.isInteger(organisationId) || organisationId < 1) {
      return res.status(400).json({ message: "Invalid organisation identifier" });
    }

    try {
      const [organisationResult, sitesResult, rolesResult, paymentsResult, auditResult] = await Promise.all([
        pool.query(
          `
            SELECT
              o.id,
              o.name,
              o.created_at,
              owner.id AS owner_id,
              owner.email AS owner_email,
              owner.first_name AS owner_first_name,
              owner.last_name AS owner_last_name,
              owner.phone AS owner_phone,
              latest_subscription.id AS subscription_id,
              latest_subscription.status AS subscription_status,
              latest_subscription.start_date AS subscription_start_date,
              latest_subscription.end_date AS subscription_end_date,
              latest_subscription.orders_used,
              latest_subscription.plan_slug,
              latest_subscription.plan_name,
              latest_subscription.plan_price,
              COALESCE(activity.order_count, 0)::int AS order_count,
              COALESCE(activity.orders_last_30_days, 0)::int AS orders_last_30_days,
              COALESCE(activity.revenue_last_30_days, 0)::numeric AS revenue_last_30_days,
              COALESCE(activity.last_order_at, NULL) AS last_order_at,
              COALESCE(customer_activity.customer_count, 0)::int AS customer_count,
              COALESCE(customer_activity.customers_last_30_days, 0)::int AS customers_last_30_days
            FROM organisations o
            INNER JOIN users owner ON owner.id = o.owner_id
            LEFT JOIN LATERAL (
              SELECT
                sub.id,
                sub.status,
                sub.start_date,
                sub.end_date,
                sub.orders_used,
                p.slug AS plan_slug,
                p.name AS plan_name,
                p.price AS plan_price
              FROM subscriptions sub
              INNER JOIN plans p ON p.id = sub.plan_id
              WHERE sub.user_id = o.owner_id
              ORDER BY sub.created_at DESC, sub.id DESC
              LIMIT 1
            ) latest_subscription ON true
            LEFT JOIN LATERAL (
              SELECT
                count(ord.id)::int AS order_count,
                count(ord.id) FILTER (WHERE ord.created_at >= now() - interval '30 days')::int AS orders_last_30_days,
                COALESCE(sum(ord.paid_amount_30_days), 0)::numeric AS revenue_last_30_days,
                max(ord.created_at) AS last_order_at
              FROM sites site_scope
              LEFT JOIN LATERAL (
                SELECT
                  organisation_order.id,
                  organisation_order.created_at,
                  COALESCE(sum(payment.amount) FILTER (WHERE payment.date >= now() - interval '30 days'), 0)::numeric AS paid_amount_30_days
                FROM orders organisation_order
                LEFT JOIN payments payment ON payment.order_id = organisation_order.id
                WHERE organisation_order.site_id = site_scope.id
                GROUP BY organisation_order.id, organisation_order.created_at
              ) ord ON true
              WHERE site_scope.organisation_id = o.id
            ) activity ON true
            LEFT JOIN LATERAL (
              SELECT
                count(DISTINCT customer.id)::int AS customer_count,
                count(DISTINCT customer.id) FILTER (WHERE customer.created_at >= now() - interval '30 days')::int AS customers_last_30_days
              FROM sites customer_sites
              LEFT JOIN customers customer ON customer.site_id = customer_sites.id
              WHERE customer_sites.organisation_id = o.id
            ) customer_activity ON true
            WHERE o.id = $1
            LIMIT 1
          `,
          [organisationId],
        ),
        pool.query(
          `SELECT id, name, city, is_active, created_at
           FROM sites
           WHERE organisation_id = $1
           ORDER BY is_active DESC, created_at ASC, id ASC`,
          [organisationId],
        ),
        pool.query(
          `SELECT COALESCE(role, user_type, 'unknown') AS role, count(*)::int AS count
           FROM users
           WHERE organisation_id = $1
           GROUP BY COALESCE(role, user_type, 'unknown')
           ORDER BY count(*) DESC, role ASC`,
          [organisationId],
        ),
        pool.query(
          `SELECT
             payment.id,
             payment.amount,
             payment.method,
             payment.status,
             payment.created_at,
             plan.name AS plan_name
           FROM subscription_payments payment
           INNER JOIN users owner ON owner.id = payment.user_id
           INNER JOIN organisations organisation ON organisation.owner_id = owner.id
           INNER JOIN plans plan ON plan.id = payment.plan_id
           WHERE organisation.id = $1
           ORDER BY payment.created_at DESC, payment.id DESC
           LIMIT 20`,
          [organisationId],
        ),
        adminAudit(pool,30,organisationId).then(rows=>({rows})),
      ]);

      const row = organisationResult.rows[0];
      if (!row) return res.status(404).json({ message: "Organisation not found" });

      const effective=(await adminSubscribers(pool)).find(item=>item.id===organisationId)!;
      const billing=await adminBilling(pool,organisationId);
      const historical=paymentsResult.rows.map(p=>({id:Number(p.id),amount:Number(p.amount),method:p.method,createdAt:p.created_at,planName:p.plan_name,
        status:['simulate','simulation','sandbox','test'].includes(String(p.method).toLowerCase())?'simulation':'historical',source:'legacy'}));

      await recordPlatformAdminEventBestEffort(
        req,
        "platform_admin.organisation_view",
        "success",
        req.session?.userId || null,
        { organisationId },
      );

      res.json({
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
        subscription: effective.subscription,
        source:effective.source,deferred:effective.deferred,manualAssignmentAllowed:effective.manualAssignmentAllowed,
        stateFingerprint:effective.stateFingerprint,stateVersion:effective.stateVersion,
        footprint: {
          sites: sitesResult.rows.map((site) => ({
            id: Number(site.id),
            name: site.name,
            city: site.city,
            active: site.is_active,
            createdAt: site.created_at,
          })),
          roles: rolesResult.rows.map((role) => ({ role: role.role, count: Number(role.count || 0) })),
        },
        usage: {
          orderCount: Number(row.order_count || 0),
          ordersLast30Days: Number(row.orders_last_30_days || 0),
          revenueLast30Days: Number(row.revenue_last_30_days || 0),
          lastOrderAt: row.last_order_at,
          customerCount: Number(row.customer_count || 0),
          customersLast30Days: Number(row.customers_last_30_days || 0),
        },
        billing: {...billing,payments:[...billing.payments,...historical],historicalPaymentsExcluded:true},
        audit: auditResult.rows.map((event) => ({
          id: Number(event.id),
          action: event.action,
          outcome:event.outcome,
          targetType: event.target_type,
          targetId: event.target_id,
          actorEmail: event.actor_email,
          createdAt: event.created_at,
        })),
      });
    } catch (error) {
      console.error("Platform admin organisation detail failed:", error);
      await recordPlatformAdminEventBestEffort(
        req,
        "platform_admin.organisation_view",
        "failure",
        req.session?.userId || null,
        { organisationId },
      );
      res.status(500).json({ message: "Failed to load organisation detail" });
    }
  });

  app.get("/api/platform-admin/plans", requirePlatformAdmin, async (_req, res) => {
    try {
      res.json(Object.values(SAAS_PLANS).map(p=>({id:p.slug,slug:p.slug,name:p.name,price:p.priceXaf})));
    } catch (error) {
      console.error("Platform admin plans failed:", error);
      res.status(500).json({ message: "Failed to load plans" });
    }
  });

  const grant= (write:boolean):RequestHandler => async(req:any,res)=>{
    const org=Number(req.params.organisationId);
    if(!Number.isSafeInteger(org)||org<1)return res.status(400).json({message:"Invalid organisation identifier"});
    const client=await pool.connect();
    try {
      await client.query(write?"BEGIN":"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const preview=await adminGrant(client,org,req.body,req.session.userId,req.requestId??null,new Date(),write,
        {ipHash:crypto.createHash('sha256').update(requestIp(req)).digest('hex'),userAgent:String(req.get?.('user-agent')??'').slice(0,500)});
      await client.query("COMMIT");
      res.json({before:preview.before,after:preview.after,paymentRecorded:false,preview:!write});
    }catch(error:any){await client.query("ROLLBACK").catch(()=>{});const known=String(error.message).startsWith('ADMIN_')||['INVALID_PLAN','INVALID_OPTIONS','BUSINESS_REQUIRED','PAID_PLAN_REQUIRED'].includes(error.message);
      if(!known)console.error('Platform administrator grant failed',error);
      res.status(known?409:500).json({message:known?error.message:'ADMIN_GRANT_FAILED'});
    }finally{client.release();}
  };
  app.post("/api/platform-admin/organisations/:organisationId/plan-preview",requirePlatformAdmin,platformAdminPlanLimiter,grant(false));
  app.post("/api/platform-admin/organisations/:organisationId/plan",requirePlatformAdmin,platformAdminPlanLimiter,grant(true));

  app.get("/api/platform-admin/audit-events", requirePlatformAdmin, async (req, res) => {
    try {
      const limit = safeLimit(req.query.limit, 30, 100);
      const rows=await adminAudit(pool,limit);
      res.json(rows.map(row=>({id:row.id,organisationId:row.organisation_id,organisationName:row.organisation_name,actorUserId:row.actor_user_id,
        actorEmail:row.actor_email,action:row.action,targetType:row.target_type,targetId:row.target_id,createdAt:row.created_at,requestId:row.request_id,outcome:row.outcome})));
    } catch (error) {
      console.error("Platform admin audit event list failed:", error);
      res.status(500).json({ message: "Failed to load audit events" });
    }
  });
}
