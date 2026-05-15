import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { storage } from "../../storage";
import { db } from "../../db";
import { organisations, siteMembers } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function buildUserResponse(userId: string) {
  const user = await authStorage.getUser(userId);
  if (!user) return null;
  const sub = await storage.getUserSubscription(userId);
  const planSlug = sub?.plan?.slug ?? "starter";

  let organisationRole = "owner";
  let siteMemberships: any[] = [];
  let allSites: any[] = [];
  let currentSite = null;
  let effectiveRole = "owner";

  if (user.organisationId) {
    const [org] = await db.select().from(organisations).where(eq(organisations.id, user.organisationId));

    if (org && org.ownerId === userId) {
      // User is the organisation owner
      organisationRole = "owner";
      effectiveRole = "owner";
      allSites = await storage.getSites(user.organisationId);
      if (user.currentSiteId) {
        currentSite = await storage.getSite(user.currentSiteId);
      }
    } else {
      // User is a site member (manager or operator)
      const memberships = await db.select().from(siteMembers).where(eq(siteMembers.userId, userId));

      siteMemberships = await Promise.all(
        memberships.map(async (m) => {
          const site = await storage.getSite(m.siteId);
          return { ...m, site };
        })
      );

      // Determine effectiveRole and currentSite
      if (user.currentSiteId) {
        const currentMembership = memberships.find((m) => m.siteId === user.currentSiteId);
        if (currentMembership) {
          effectiveRole = currentMembership.role;
          organisationRole = currentMembership.role;
          currentSite = await storage.getSite(user.currentSiteId);
        }
      }

      if (!currentSite && memberships.length > 0) {
        const firstMembership = memberships[0];
        effectiveRole = firstMembership.role;
        organisationRole = firstMembership.role;
        currentSite = await storage.getSite(firstMembership.siteId);
      }
    }
  } else {
    effectiveRole = user.role ?? "owner";
  }

  return {
    ...user,
    role: effectiveRole,
    planSlug,
    passwordHash: undefined,
    currentSite,
    allSites,
    siteMemberships,
    organisationRole,
  };
}

async function ensureUserOrganisation(userId: string) {
  const user = await authStorage.getUser(userId);
  if (!user || user.organisationId) return;
  await storage.migrateToMultiSite();
}

async function autoAssignMemberSite(userId: string, sessionRef: any) {
  const user = await authStorage.getUser(userId);
  if (!user || !user.organisationId || user.currentSiteId) return;

  const [org] = await db.select().from(organisations).where(eq(organisations.id, user.organisationId));
  if (!org || org.ownerId === userId) return;

  const memberships = await db.select().from(siteMembers).where(eq(siteMembers.userId, userId));
  if (memberships.length === 0) return;

  const firstSiteId = memberships[0].siteId;
  await db.update(users).set({ currentSiteId: firstSiteId }).where(eq(users.id, userId));
  sessionRef.currentSiteId = firstSiteId;
}

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, businessName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existingUser = await authStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await authStorage.upsertUser({
        email,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        businessName: businessName || null,
        role: "owner",
      });

      (req.session as any).userId = user.id;

      await ensureUserOrganisation(user.id);
      await autoAssignMemberSite(user.id, req.session);

      const response = await buildUserResponse(user.id);

      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );

      res.status(201).json(response);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email or phone number and password are required" });
      }

      let user = await authStorage.getUserByEmail(email);
      if (!user) {
        user = await authStorage.getUserByPhone(email);
      }

      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      (req.session as any).userId = user.id;

      await ensureUserOrganisation(user.id);
      await autoAssignMemberSite(user.id, req.session);

      const response = await buildUserResponse(user.id);

      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );

      res.json(response);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const response = await buildUserResponse(userId);
      if (!response) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(response);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/auth");
    });
  });
}
