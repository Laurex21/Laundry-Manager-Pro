import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { storage } from "../../storage";
import { db } from "../../db";
import { organisations, siteMembers } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function getOrganisationOwnerId(organisationId: number | null): Promise<string | null> {
  if (!organisationId) return null;
  const [org] = await db.select({ ownerId: organisations.ownerId }).from(organisations).where(eq(organisations.id, organisationId));
  return org?.ownerId ?? null;
}

async function isOrganisationOwnerUser(user: { id: string; organisationId: number | null; userType?: string | null }): Promise<boolean> {
  const ownerId = await getOrganisationOwnerId(user.organisationId);
  return user.userType !== "staff" && (!ownerId || ownerId === user.id);
}

async function buildUserResponse(userId: string) {
  const user = await authStorage.getUser(userId);
  if (!user) return null;
  const orgOwnerId = await getOrganisationOwnerId(user.organisationId);
  const isOrgOwner = user.userType !== "staff" && (!orgOwnerId || orgOwnerId === userId);
  const subscriptionOwnerId = isOrgOwner ? userId : orgOwnerId;
  const sub = subscriptionOwnerId ? await storage.getUserSubscription(subscriptionOwnerId) : null;
  const planSlug = sub?.plan?.slug ?? "starter";

  // Determine effective role: check if user is the org owner or a site member
  let effectiveRole = user.role ?? "owner";
  if (user.organisationId) {
    if (!isOrgOwner) {
      // User is not the org owner — find their highest-priority site member role
      const memberships = await db.select().from(siteMembers).where(eq(siteMembers.userId, userId));
      if (memberships.length > 0) {
        // Priority: manager > operator (owners are handled above)
        if (memberships.some(m => m.role === "manager")) effectiveRole = "manager";
        else effectiveRole = "operator";
        // Use role from current site if available
        if (user.currentSiteId) {
          const currentMembership = memberships.find(m => m.siteId === user.currentSiteId);
          if (currentMembership) effectiveRole = currentMembership.role;
        }
      }
    }
  }

  let currentSite = null;
  let allSites: any[] = [];
  if (user.currentSiteId) {
    currentSite = await storage.getSite(user.currentSiteId);
  }
  if (isOrgOwner && user.organisationId) {
    allSites = await storage.getSites(user.organisationId);
  }
  return { ...user, userType: isOrgOwner ? "owner" : "staff", role: effectiveRole, planSlug, passwordHash: undefined, currentSite, allSites };
}

async function ensureUserOrganisation(userId: string) {
  const user = await authStorage.getUser(userId);
  if (!user || user.organisationId) return;
  if (user.userType === "staff") return;
  await storage.migrateToMultiSite();
}

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildBaseUrl(req: any) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

async function sendPasswordResetLink(user: { phone: string | null; email: string | null }, resetLink: string): Promise<boolean> {
  const hasTwilio = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM &&
    user.phone
  );

  if (hasTwilio) {
    try {
      const twilioModule: any = await import("twilio");
      const twilio = twilioModule.default ?? twilioModule;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM!,
        to: `whatsapp:${user.phone}`,
        body:
          `Réinitialisation XPRESSPRO\n\n` +
          `Utilisez ce lien pour créer un nouveau mot de passe. Il expire dans 30 minutes:\n${resetLink}\n\n` +
          `Si vous n'avez pas demandé cela, ignorez ce message.`,
      });
      return true;
    } catch (error) {
      console.error("Password reset WhatsApp delivery failed:", error);
    }
  }

  console.info("Password reset link generated:", {
    email: user.email,
    phone: user.phone,
    resetLink,
    deliveryConfigured: false,
  });
  return false;
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
        userType: "owner",
        role: "owner",
      });

      (req.session as any).userId = user.id;

      await ensureUserOrganisation(user.id);

      const response = await buildUserResponse(user.id);

      (req.session as any).currentSiteId = (response as any)?.currentSiteId ?? null;

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

      // Try email first, then phone number if it looks like a phone
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
      if (!(await isOrganisationOwnerUser(user))) {
        return res.status(403).json({ message: "Staff accounts must use the staff login page" });
      }

      (req.session as any).userId = user.id;

      await ensureUserOrganisation(user.id);

      const response = await buildUserResponse(user.id);

      (req.session as any).currentSiteId = (response as any)?.currentSiteId ?? null;

      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );

      res.json(response);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/staff/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email or phone number and password are required" });
      }

      let user = await authStorage.getUserByEmail(email);
      if (!user) user = await authStorage.getUserByPhone(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (await isOrganisationOwnerUser(user)) {
        return res.status(403).json({ message: "Owner accounts must use the owner login page" });
      }

      (req.session as any).userId = user.id;
      const response = await buildUserResponse(user.id);
      (req.session as any).currentSiteId = (response as any)?.currentSiteId ?? null;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );
      res.json(response);
    } catch (error) {
      console.error("Staff login error:", error);
      res.status(500).json({ message: "Staff login failed" });
    }
  });

  app.post("/api/staff/onboard/:token", async (req, res) => {
    try {
      const { email, phone, password, firstName, lastName } = req.body;
      const identifier = String(email || phone || "").trim();
      if (!identifier || !password) {
        return res.status(400).json({ message: "Email or phone number and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existingByEmail = email ? await authStorage.getUserByEmail(email) : undefined;
      const existingByPhone = phone ? await authStorage.getUserByPhone(phone) : undefined;
      if (existingByEmail || existingByPhone) {
        return res.status(409).json({ message: "An account already exists. Use staff login instead." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createStaffFromInvitation(req.params.token, {
        email: email || null,
        phone: phone || null,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
      });
      if (!user) {
        return res.status(400).json({ message: "Invalid, expired, or already accepted invitation" });
      }

      (req.session as any).userId = user.id;
      (req.session as any).currentSiteId = user.currentSiteId ?? null;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );

      const response = await buildUserResponse(user.id);
      res.status(201).json(response);
    } catch (error) {
      console.error("Staff onboarding error:", error);
      res.status(500).json({ message: "Staff onboarding failed" });
    }
  });

  app.post("/api/auth/password-reset/request", async (req, res) => {
    try {
      const identifier = String(req.body.identifier || req.body.email || "").trim();
      const requestedAccountType = req.body.accountType === "staff" ? "staff" : "owner";
      const genericResponse = {
        message: "If an account exists, a password reset link has been sent.",
      };

      if (!identifier) {
        return res.status(200).json(genericResponse);
      }

      let user = await authStorage.getUserByEmail(identifier);
      if (!user) user = await authStorage.getUserByPhone(identifier);

      if (user) {
        const isOwner = await isOrganisationOwnerUser(user);
        const accountType = isOwner ? "owner" : "staff";
        if (accountType === requestedAccountType) {
          const token = crypto.randomBytes(32).toString("hex");
          const tokenHash = hashResetToken(token);
          const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
          await authStorage.createPasswordResetToken({ userId: user.id, tokenHash, accountType, expiresAt });
          const resetLink = `${buildBaseUrl(req)}/reset-password/${token}`;
          const delivered = await sendPasswordResetLink(user, resetLink);
          return res.json({
            ...genericResponse,
            ...(process.env.NODE_ENV !== "production" ? { resetLink, delivery: delivered ? "whatsapp" : "manual" } : {}),
          });
        }
      }

      res.json(genericResponse);
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(200).json({ message: "If an account exists, a password reset link has been sent." });
    }
  });

  app.post("/api/auth/password-reset/confirm", async (req, res) => {
    try {
      const token = String(req.body.token || "").trim();
      const password = String(req.body.password || "");
      if (!token || !password) {
        return res.status(400).json({ message: "Reset token and new password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const resetToken = await authStorage.getValidPasswordResetToken(hashResetToken(token));
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      const user = await authStorage.getUser(resetToken.userId);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      const isOwner = await isOrganisationOwnerUser(user);
      const accountType = isOwner ? "owner" : "staff";
      if (accountType !== resetToken.accountType) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await authStorage.updatePassword(user.id, passwordHash);
      await authStorage.markPasswordResetTokenUsed(resetToken.id);

      res.json({ message: "Password updated successfully", accountType });
    } catch (error) {
      console.error("Password reset confirm error:", error);
      res.status(500).json({ message: "Password reset failed" });
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
