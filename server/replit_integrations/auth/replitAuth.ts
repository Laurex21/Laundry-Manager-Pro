import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { pool } from "../../db";
import { ensureOrderItemQuantitySupportsDecimals } from "../../lib/order-item-quantity-schema";
import { sameOriginMutations } from "../../lib/http-security";

export function getSession() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  }
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
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(sameOriginMutations);
}

export async function ensureAuthSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS security_rate_limits (
      bucket_key varchar(64) PRIMARY KEY,
      count integer NOT NULL CHECK (count > 0),
      reset_at timestamptz NOT NULL
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_security_rate_limits_reset_at ON security_rate_limits(reset_at)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS security_audit_events (
      id bigserial PRIMARY KEY,
      organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      site_id integer REFERENCES sites(id) ON DELETE SET NULL,
      actor_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      action varchar(100) NOT NULL,
      target_type varchar(80) NOT NULL,
      target_id varchar(120),
      before_state jsonb,
      after_state jsonb,
      request_id varchar(120),
      ip_hash varchar(64) NOT NULL,
      user_agent varchar(500),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_security_audit_org_created ON security_audit_events(organisation_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_security_audit_actor_created ON security_audit_events(actor_user_id, created_at DESC)`);
  await pool.query(`
    ALTER TABLE garment_items
    ADD COLUMN IF NOT EXISTS color varchar(40)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS garment_return_cases (
      id serial PRIMARY KEY,
      organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      garment_item_id integer NOT NULL REFERENCES garment_items(id) ON DELETE CASCADE,
      status varchar(30) NOT NULL DEFAULT 'pending_review',
      complaint_reason varchar(50) NOT NULL,
      customer_comment text NOT NULL,
      decision varchar(50),
      assigned_stage varchar(50),
      decision_notes text,
      received_by_user_id varchar NOT NULL,
      decided_by_user_id varchar,
      resolved_by_user_id varchar,
      returned_at timestamp NOT NULL DEFAULT now(),
      decided_at timestamp,
      resolved_at timestamp,
      legacy_source_key varchar(100) UNIQUE,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS garment_return_events (
      id serial PRIMARY KEY,
      return_case_id integer NOT NULL REFERENCES garment_return_cases(id) ON DELETE CASCADE,
      organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      event_type varchar(50) NOT NULL,
      from_status varchar(30),
      to_status varchar(30) NOT NULL,
      notes text,
      actor_user_id varchar NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS garment_return_attachments (
      id serial PRIMARY KEY,
      return_case_id integer NOT NULL REFERENCES garment_return_cases(id) ON DELETE CASCADE,
      organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      mime_type varchar(50) NOT NULL,
      size_bytes integer NOT NULL,
      data_url text NOT NULL,
      added_by_user_id varchar NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_garment_return_org_site_status ON garment_return_cases(organisation_id, site_id, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_garment_return_order ON garment_return_cases(order_id)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_garment_return_active_case ON garment_return_cases(organisation_id, garment_item_id) WHERE status NOT IN ('rejected', 'resolved')`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_garment_return_events_case ON garment_return_events(return_case_id, created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_garment_return_events_scope ON garment_return_events(organisation_id, site_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_garment_return_attachments_case ON garment_return_attachments(return_case_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_site_reports (
      id serial PRIMARY KEY,
      organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      report_date date NOT NULL,
      version integer NOT NULL DEFAULT 1,
      status varchar(20) NOT NULL DEFAULT 'draft',
      metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
      summary text NOT NULL DEFAULT '',
      difficulties text NOT NULL DEFAULT '',
      needs text NOT NULL DEFAULT '',
      handover text NOT NULL DEFAULT '',
      author_user_id varchar NOT NULL,
      submitted_at timestamp,
      acknowledged_by_user_id varchar,
      acknowledged_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (site_id, report_date, version)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_site_report_comments (
      id serial PRIMARY KEY,
      report_id integer NOT NULL REFERENCES daily_site_reports(id) ON DELETE CASCADE,
      organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      author_user_id varchar NOT NULL,
      comment text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_daily_site_report_scope_date ON daily_site_reports(organisation_id, site_id, report_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_daily_site_report_status ON daily_site_reports(organisation_id, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_daily_site_report_comments_report ON daily_site_report_comments(report_id, created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_daily_site_report_comments_scope ON daily_site_report_comments(organisation_id, site_id)`);
  await pool.query(`
    INSERT INTO garment_return_cases (
      organisation_id, site_id, order_id, garment_item_id, status,
      complaint_reason, customer_comment, received_by_user_id,
      returned_at, resolved_at, legacy_source_key
    )
    SELECT
      s.organisation_id,
      o.site_id,
      gi.order_id,
      gi.id,
      CASE WHEN gi.resolved_at IS NULL THEN 'in_rework' ELSE 'resolved' END,
      'legacy_return',
      COALESCE(NULLIF(gi.return_notes, ''), 'Legacy production return'),
      'legacy',
      COALESCE(gi.returned_at, now()),
      gi.resolved_at,
      'garment:' || gi.id::text
    FROM garment_items gi
    INNER JOIN orders o ON o.id = gi.order_id
    INNER JOIN sites s ON s.id = o.site_id
    WHERE (gi.returned_for_treatment = true OR gi.resolved_at IS NOT NULL)
    ON CONFLICT DO NOTHING
  `);
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
    ALTER TABLE business_settings
    ADD COLUMN IF NOT EXISTS loyalty_program_enabled boolean NOT NULL DEFAULT false
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_program (
      id serial PRIMARY KEY,
      organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      points_per_order integer NOT NULL DEFAULT 10,
      points_per_fcfa numeric(6, 4),
      spend_amount_per_point numeric(12, 2) NOT NULL DEFAULT 500,
      renewal_bonus_points integer NOT NULL DEFAULT 50,
      referral_bonus_points integer NOT NULL DEFAULT 100,
      reward_points_required integer NOT NULL DEFAULT 100,
      reward_value numeric(12, 2) NOT NULL DEFAULT 500,
      point_expire_days integer,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE loyalty_program
    ADD COLUMN IF NOT EXISTS spend_amount_per_point numeric(12, 2) NOT NULL DEFAULT 500,
    ADD COLUMN IF NOT EXISTS reward_points_required integer NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS reward_value numeric(12, 2) NOT NULL DEFAULT 500
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_program_org ON loyalty_program(organisation_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_points (
      id serial PRIMARY KEY,
      organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      client_id integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      points integer NOT NULL,
      redeemed_points integer NOT NULL DEFAULT 0,
      reason varchar(100) NOT NULL,
      order_id integer REFERENCES orders(id),
      subscription_payment_id integer,
      referred_client_id integer REFERENCES customers(id),
      expires_at timestamp,
      expired_at timestamp,
      created_at timestamp DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE loyalty_points ADD COLUMN IF NOT EXISTS redeemed_points integer NOT NULL DEFAULT 0`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_loyalty_points_client ON loyalty_points(client_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_loyalty_points_org ON loyalty_points(organisation_id)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_points_order_reason ON loyalty_points(organisation_id, order_id, reason) WHERE order_id IS NOT NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_points_renewal_reason ON loyalty_points(organisation_id, subscription_payment_id, reason) WHERE subscription_payment_id IS NOT NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_points_referral_reason ON loyalty_points(organisation_id, referred_client_id, reason) WHERE referred_client_id IS NOT NULL`);
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
  await pool.query(`
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS credit_balance numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_credit_added numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_credit_used numeric(12, 2) NOT NULL DEFAULT 0
  `);
  await pool.query(`
    ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS idempotency_key varchar(100)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id serial PRIMARY KEY,
      organisation_id integer NOT NULL REFERENCES organisations(id),
      site_id integer NOT NULL REFERENCES sites(id),
      customer_id integer NOT NULL REFERENCES customers(id),
      order_id integer REFERENCES orders(id),
      payment_id integer REFERENCES payments(id),
      type varchar(10) NOT NULL CHECK (type IN ('credit', 'debit')),
      amount numeric(12, 2) NOT NULL CHECK (amount > 0),
      reason varchar(50) NOT NULL,
      balance_before numeric(12, 2) NOT NULL CHECK (balance_before >= 0),
      balance_after numeric(12, 2) NOT NULL CHECK (balance_after >= 0),
      notes text,
      created_by varchar,
      idempotency_key varchar(120) NOT NULL,
      reversal_of_id integer REFERENCES credit_transactions(id),
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT credit_transaction_balance_check CHECK (
        (type = 'credit' AND balance_after = balance_before + amount)
        OR
        (type = 'debit' AND balance_after = balance_before - amount)
      )
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_positive_credit ON customers(credit_balance) WHERE credit_balance > 0`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_credit_tx_customer ON credit_transactions(customer_id, created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_credit_tx_org_site ON credit_transactions(organisation_id, site_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_credit_tx_order ON credit_transactions(order_id)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_idempotency ON credit_transactions(idempotency_key)`);
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS corrected_from_order_id integer,
    ADD COLUMN IF NOT EXISTS correction_reason text
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_corrected_from ON orders(corrected_from_order_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_corrections (
      id serial PRIMARY KEY,
      order_id integer NOT NULL REFERENCES orders(id),
      site_id integer NOT NULL,
      reason text NOT NULL,
      before_snapshot jsonb NOT NULL,
      after_snapshot jsonb NOT NULL,
      changed_by varchar,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_corrections_order_created ON order_corrections(order_id, created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_corrections_site ON order_corrections(site_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS production_cycles (
      id serial PRIMARY KEY,
      machine_id integer NOT NULL REFERENCES machines(id),
      site_id integer NOT NULL,
      stage varchar(20) NOT NULL CHECK (stage IN ('washing', 'drying')),
      status varchar(20) NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'running', 'completed', 'cancelled')),
      capacity_kg numeric(10, 2) NOT NULL CHECK (capacity_kg > 0),
      total_weight_kg numeric(10, 2) NOT NULL DEFAULT 0 CHECK (total_weight_kg >= 0),
      planned_duration_minutes integer NOT NULL DEFAULT 0 CHECK (planned_duration_minutes >= 0),
      actual_duration_minutes integer CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes >= 0),
      started_by varchar,
      started_at timestamp,
      completed_at timestamp,
      created_at timestamp DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS production_cycle_orders (
      id serial PRIMARY KEY,
      cycle_id integer NOT NULL REFERENCES production_cycles(id) ON DELETE CASCADE,
      order_id integer NOT NULL REFERENCES orders(id),
      weight_kg numeric(10, 2) NOT NULL CHECK (weight_kg > 0),
      added_at timestamp DEFAULT now(),
      CONSTRAINT idx_production_cycle_order_unique UNIQUE (cycle_id, order_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_production_cycles_site_status ON production_cycles(site_id, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_production_cycles_machine_status ON production_cycles(machine_id, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_production_cycle_orders_order ON production_cycle_orders(order_id)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_cycle_per_machine ON production_cycles(machine_id) WHERE status IN ('preparing', 'running')`);

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
