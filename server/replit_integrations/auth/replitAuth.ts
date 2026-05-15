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
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.userId = (req.session as any).userId;

  if ((req.session as any).currentSiteId === undefined) {
    try {
      const { db } = await import("../../db");
      const { users } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");
      const [row] = await db.select({ currentSiteId: users.currentSiteId }).from(users).where(eq(users.id, req.userId)).limit(1);
      const siteId = row?.currentSiteId ?? null;
      (req.session as any).currentSiteId = siteId;
      req.session.save(() => {});
    } catch (_) {}
  }

  req.siteId = (req.session as any).currentSiteId ?? null;
  return next();
};
