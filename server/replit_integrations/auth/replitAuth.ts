import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { pool } from "../../db";
import { ensureOrderItemQuantitySupportsDecimals } from "../../lib/order-item-quantity-schema";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  await ensureAuthSchema();
  app.set("trust proxy", 1);
  app.use(getSession());
}

async function ensureAuthSchema() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS user_type varchar(20) NOT NULL DEFAULT 'owner'
  `);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS created_by_employee_id integer
  `);
  await pool.query(`
    ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS collected_by_employee_id integer
  `);
  await pool.query(`
    ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS auth_user_id varchar,
    ADD COLUMN IF NOT EXISTS employee_code varchar(100),
    ADD COLUMN IF NOT EXISTS photo_url text,
    ADD COLUMN IF NOT EXISTS position varchar(100),
    ADD COLUMN IF NOT EXISTS date_hired timestamp,
    ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active'
  `);
  await pool.query(`
    ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS brand varchar(100),
    ADD COLUMN IF NOT EXISTS model varchar(100),
    ADD COLUMN IF NOT EXISTS purchase_date timestamp,
    ADD COLUMN IF NOT EXISTS last_maintenance_date timestamp,
    ADD COLUMN IF NOT EXISTS maintenance_interval_days integer,
    ADD COLUMN IF NOT EXISTS maintenance_interval_hours numeric(10, 2),
    ADD COLUMN IF NOT EXISTS maintenance_cost numeric(10, 2) DEFAULT 0
  `);
  await pool.query(`
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS last_visit_at timestamp,
    ADD COLUMN IF NOT EXISTS avg_days_between_visits numeric(10, 2),
    ADD COLUMN IF NOT EXISTS visit_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS expected_next_visit_date timestamp,
    ADD COLUMN IF NOT EXISTS segment varchar(50),
    ADD COLUMN IF NOT EXISTS churn_risk_score integer,
    ADD COLUMN IF NOT EXISTS total_revenue numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_deposit_hour numeric(5, 2),
    ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS loyalty_tier varchar(20) NOT NULL DEFAULT 'bronze',
    ADD COLUMN IF NOT EXISTS referred_by_customer_id integer
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_points (
      id serial PRIMARY KEY,
      organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      client_id integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      points integer NOT NULL,
      reason varchar(100) NOT NULL,
      order_id integer REFERENCES orders(id),
      subscription_payment_id integer,
      referred_client_id integer REFERENCES customers(id),
      expires_at timestamp,
      expired_at timestamp,
      created_at timestamp DEFAULT now()
    )
  `);
  await ensureOrderItemQuantitySupportsDecimals();
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS ready_at timestamp,
    ADD COLUMN IF NOT EXISTS delivered_at timestamp,
    ADD COLUMN IF NOT EXISTS cancelled_at timestamp
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_activities (
      id serial PRIMARY KEY,
      employee_id integer NOT NULL REFERENCES employees(id),
      actor_user_id varchar,
      site_id integer NOT NULL,
      action_date timestamp DEFAULT now(),
      action_type varchar(60) NOT NULL,
      order_id integer REFERENCES orders(id),
      amount numeric(10, 2),
      weight_kg numeric(10, 2),
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_attendance (
      id serial PRIMARY KEY,
      employee_id integer NOT NULL REFERENCES employees(id),
      site_id integer NOT NULL,
      work_date timestamp DEFAULT now(),
      check_in_at timestamp,
      check_out_at timestamp,
      status varchar(30) NOT NULL DEFAULT 'present',
      created_at timestamp DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS machine_usage (
      id serial PRIMARY KEY,
      machine_id integer NOT NULL REFERENCES machines(id),
      order_id integer REFERENCES orders(id),
      site_id integer NOT NULL,
      usage_date timestamp DEFAULT now(),
      weight_processed numeric(10, 2) DEFAULT 0,
      cycle_duration_minutes integer DEFAULT 0,
      created_at timestamp DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id),
      token_hash varchar(64) NOT NULL UNIQUE,
      account_type varchar(20) NOT NULL,
      expires_at timestamp NOT NULL,
      used_at timestamp,
      created_at timestamp DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS legal_documents (
      id serial PRIMARY KEY,
      document_type varchar(30) NOT NULL,
      version varchar(80) NOT NULL,
      title varchar(255) NOT NULL,
      effective_at timestamp NOT NULL,
      content_url varchar(500) NOT NULL,
      document_hash varchar(64) NOT NULL,
      is_required boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now()
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_documents_type_version_unique ON legal_documents(document_type, version)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS legal_acceptances (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      organisation_id integer,
      site_id integer,
      terms_version varchar(80) NOT NULL,
      privacy_version varchar(80) NOT NULL,
      cookie_version varchar(80) NOT NULL,
      document_hash varchar(64) NOT NULL,
      source varchar(40) NOT NULL,
      ip_address varchar(100),
      user_agent text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      accepted_at timestamp DEFAULT now()
    )
  `);
  await pool.query(`
    INSERT INTO legal_documents (document_type, version, title, effective_at, content_url, document_hash, is_required)
    VALUES
      ('terms', '1.0-enterprise-2026-06-30', 'XpressPro Terms of Service', '2026-06-30 00:00:00', '/terms', 'bf7328dc39d69b2d8691d92553c04c92998fe6512eaa461a97c3a86bbc521e39', true),
      ('privacy', '1.0-2026-06-30', 'XpressPro Privacy Policy', '2026-06-30 00:00:00', '/privacy', 'bf7328dc39d69b2d8691d92553c04c92998fe6512eaa461a97c3a86bbc521e39', true),
      ('cookies', '1.0-2026-06-30', 'XpressPro Cookie Policy', '2026-06-30 00:00:00', '/cookies', 'bf7328dc39d69b2d8691d92553c04c92998fe6512eaa461a97c3a86bbc521e39', true)
    ON CONFLICT (document_type, version) DO UPDATE SET
      title = EXCLUDED.title,
      effective_at = EXCLUDED.effective_at,
      content_url = EXCLUDED.content_url,
      document_hash = EXCLUDED.document_hash,
      is_required = EXCLUDED.is_required
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_employee_activities_site_date ON employee_activities(site_id, action_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_employee_activities_employee_date ON employee_activities(employee_id, action_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_machine_usage_site_date ON machine_usage(site_id, usage_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_machine_usage_machine_date ON machine_usage(machine_id, usage_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_legal_documents_type_version ON legal_documents(document_type, version)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_versions ON legal_acceptances(user_id, terms_version, privacy_version, cookie_version)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_legal_acceptances_organisation ON legal_acceptances(organisation_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_last_visit ON customers(last_visit_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_site_status_ready ON orders(site_id, status, ready_at) WHERE status = 'ready'`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at)`);

  // One-time data correction: kapnangsilva@gmail.com was accidentally
  // onboarded as a staff member, overwriting their admin credentials.
  // Restore owner access; guarded so it only fires when still in the
  // wrong state and is a safe no-op on every subsequent restart.
  await pool.query(`
    UPDATE users
    SET user_type = 'owner',
        role      = 'owner'
    WHERE email     = 'kapnangsilva@gmail.com'
      AND user_type = 'staff'
  `);
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.userId = (req.session as any).userId;

  try {
    const { db } = await import("../../db");
    const { users } = await import("@shared/models/auth");
    const { organisations, sites, siteMembers } = await import("@shared/schema");
    const { and, eq } = await import("drizzle-orm");

    let [user] = await db
      .select({ currentSiteId: users.currentSiteId, organisationId: users.organisationId, userType: users.userType })
      .from(users)
      .where(eq(users.id, req.userId))
      .limit(1);

    if (!user?.organisationId && user?.userType !== "staff") {
      const { storage } = await import("../../storage");
      await storage.migrateToMultiSite();
      [user] = await db
        .select({ currentSiteId: users.currentSiteId, organisationId: users.organisationId, userType: users.userType })
        .from(users)
        .where(eq(users.id, req.userId))
        .limit(1);
    }

    let authorizedSiteIds: number[] = [];
    let organisationSiteIds: number[] = [];
    if (user?.organisationId) {
      const [org] = await db
        .select({ ownerId: organisations.ownerId })
        .from(organisations)
        .where(eq(organisations.id, user.organisationId))
        .limit(1);

      organisationSiteIds = (await db
        .select({ id: sites.id })
        .from(sites)
        .where(and(eq(sites.organisationId, user.organisationId), eq(sites.isActive, true))))
        .map((site) => site.id);

      if (org?.ownerId === req.userId) {
        authorizedSiteIds = organisationSiteIds;
      } else {
        const memberships = await db
          .select({ siteId: siteMembers.siteId })
          .from(siteMembers)
          .innerJoin(sites, eq(siteMembers.siteId, sites.id))
          .where(and(eq(siteMembers.userId, req.userId), eq(sites.isActive, true)));
        authorizedSiteIds = memberships.map((membership) => membership.siteId);
      }
    }

    if (authorizedSiteIds.length === 0) {
      const memberships = await db
        .select({ siteId: siteMembers.siteId })
        .from(siteMembers)
        .innerJoin(sites, eq(siteMembers.siteId, sites.id))
        .where(and(eq(siteMembers.userId, req.userId), eq(sites.isActive, true)));
      authorizedSiteIds = memberships.map((membership) => membership.siteId);
    }

    let currentSiteId = (req.session as any).currentSiteId;
    if (currentSiteId === undefined) currentSiteId = user?.currentSiteId ?? null;
    if (currentSiteId !== null && !authorizedSiteIds.includes(Number(currentSiteId))) {
      currentSiteId = null;
      await db.update(users).set({ currentSiteId: null }).where(eq(users.id, req.userId));
    }

    (req.session as any).currentSiteId = currentSiteId;
    req.session.save(() => {});
    req.siteId = currentSiteId ?? null;
    req.organisationId = user?.organisationId ?? null;
    req.authorizedSiteIds = authorizedSiteIds;
    req.organisationSiteIds = organisationSiteIds.length > 0 ? organisationSiteIds : authorizedSiteIds;
    req.siteScope = currentSiteId === null ? authorizedSiteIds : [Number(currentSiteId)].filter((siteId) => authorizedSiteIds.includes(siteId));
    req.organisationSiteScope = req.organisationSiteIds;

    const legalBypassPaths = new Set([
      "/api/auth/user",
      "/api/auth/logout",
      "/api/legal/current",
      "/api/legal/status",
      "/api/legal/accept",
    ]);
    if (!legalBypassPaths.has(req.path)) {
      const { CURRENT_LEGAL_DOCUMENTS, getCurrentLegalAcceptance } = await import("../../lib/legal");
      const legalAcceptance = await getCurrentLegalAcceptance(req.userId);
      if (!legalAcceptance) {
        return res.status(428).json({
          code: "TERMS_REQUIRED",
          message: "You must accept the current Terms, Privacy Policy, and Cookie Policy to continue.",
          legalAcceptance: {
            required: true,
            acceptedAt: null,
            current: CURRENT_LEGAL_DOCUMENTS,
          },
        });
      }
    }
  } catch (error) {
    console.error("Tenant scope resolution failed:", error);
    return res.status(500).json({ message: "Failed to resolve tenant scope" });
  }
  return next();
};
