import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { db } from "../../db";
import { sites, organisations, siteMembers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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

  const userId = (req.session as any).userId as string;
  req.userId = userId;

  const siteIdHeader = req.headers["x-site-id"];

  if (siteIdHeader) {
    const siteId = Number(siteIdHeader);
    if (isNaN(siteId) || siteId <= 0) {
      return res.status(400).json({ message: "Invalid X-Site-Id header" });
    }

    const [site] = await db.select().from(sites).where(eq(sites.id, siteId));
    if (!site) {
      return res.status(403).json({ message: "Site not found" });
    }

    const [org] = await db.select().from(organisations).where(eq(organisations.id, site.organisationId));

    if (org && org.ownerId === userId) {
      req.siteId = siteId;
      req.siteRole = "owner";
      req.organisationId = org.id;
    } else {
      const [membership] = await db
        .select()
        .from(siteMembers)
        .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId)));

      if (!membership) {
        return res.status(403).json({ message: "Access denied to this site" });
      }
      req.siteId = siteId;
      req.siteRole = membership.role;
      req.organisationId = site.organisationId;
    }
  } else {
    req.siteId = (req.session as any).currentSiteId ?? null;
    req.siteRole = null;
    req.organisationId = null;
  }

  return next();
};
