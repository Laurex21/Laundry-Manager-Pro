import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
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
  const { pool } = await import("../../db");
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
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_employee_activities_site_date ON employee_activities(site_id, action_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_employee_activities_employee_date ON employee_activities(employee_id, action_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_machine_usage_site_date ON machine_usage(site_id, usage_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_machine_usage_machine_date ON machine_usage(machine_id, usage_date)`);
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
    req.authorizedSiteIds = authorizedSiteIds;
    req.organisationSiteIds = organisationSiteIds.length > 0 ? organisationSiteIds : authorizedSiteIds;
    req.siteScope = currentSiteId === null ? authorizedSiteIds : [Number(currentSiteId)].filter((siteId) => authorizedSiteIds.includes(siteId));
    req.organisationSiteScope = req.organisationSiteIds;
  } catch (error) {
    console.error("Tenant scope resolution failed:", error);
    return res.status(500).json({ message: "Failed to resolve tenant scope" });
  }
  return next();
};
