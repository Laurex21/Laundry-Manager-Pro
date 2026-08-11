import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { storage } from "../../storage";
import { db } from "../../db";
import { organisations, siteMembers } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { rateLimit } from "../../lib/rate-limit";
import {
  CURRENT_LEGAL_DOCUMENTS,
  clientIp,
  getCurrentLegalAcceptanceStatus,
  recordCurrentLegalAcceptance,
} from "../../lib/legal";

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
  const legalAcceptance = await getCurrentLegalAcceptanceStatus(userId);

  return { ...user, userType: isOrgOwner ? "owner" : "staff", role: effectiveRole, planSlug, passwordHash: undefined, currentSite, allSites, legalAcceptance };
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function validatePassword(password: string): string | null {
  if (password.length < 10) {
    return "Password must be at least 10 characters";
  }
  const normalized = password.toLowerCase();
  const common = ["password", "123456", "123456789", "qwerty", "xpresspro", "pressing"];
  if (common.some((value) => normalized.includes(value))) {
    return "Password is too common";
  }
  return null;
}

function passwordResetEmailHtml(resetLink: string) {
  const safeResetLink = escapeHtml(resetLink);
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 12px">Réinitialisation de votre mot de passe XPRESSPRO</h2>
      <p>Utilisez le bouton ci-dessous pour créer un nouveau mot de passe.</p>
      <p>
        <a href="${safeResetLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p style="font-size:13px;color:#4b5563">Ce lien expire dans 30 minutes. Si vous n'avez pas demandé cette action, ignorez cet email.</p>
      <p style="font-size:12px;color:#6b7280">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur:<br>${safeResetLink}</p>
    </div>
  `;
}

async function sendPasswordResetEmail(user: { email: string | null }, resetLink: string): Promise<boolean> {
  if (!user.email) return false;
  const from = process.env.PASSWORD_RESET_EMAIL_FROM || process.env.EMAIL_FROM || "XPRESSPRO <noreply@xpresspro.app>";

  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: user.email,
          subject: "Réinitialisation de votre mot de passe XPRESSPRO",
          html: passwordResetEmailHtml(resetLink),
        }),
      });
      if (response.ok) return true;
      console.error("Password reset Resend delivery failed:", await response.text());
    } catch (error) {
      console.error("Password reset Resend delivery error:", error);
    }
  }

  if (process.env.SENDGRID_API_KEY) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: user.email }] }],
          from: { email: process.env.SENDGRID_FROM_EMAIL || "noreply@xpresspro.app", name: process.env.SENDGRID_FROM_NAME || "XPRESSPRO" },
          subject: "Réinitialisation de votre mot de passe XPRESSPRO",
          content: [{ type: "text/html", value: passwordResetEmailHtml(resetLink) }],
        }),
      });
      if (response.ok) return true;
      console.error("Password reset SendGrid delivery failed:", await response.text());
    } catch (error) {
      console.error("Password reset SendGrid delivery error:", error);
    }
  }

  return false;
}

async function sendPasswordResetLink(user: { phone: string | null; email: string | null }, resetLink: string): Promise<boolean> {
  const emailDelivered = await sendPasswordResetEmail(user, resetLink);
  if (emailDelivered) return true;

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
    resetTokenGenerated: true,
    deliveryConfigured: false,
  });
  return false;
}

const authAttemptLimiter = rateLimit({
  name: "auth-attempt",
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => String(req.body?.email || req.body?.identifier || "").trim().toLowerCase(),
});

const passwordResetLimiter = rateLimit({
  name: "password-reset",
  windowMs: 60 * 60 * 1000,
  max: 5,
  key: (req) => String(req.body?.identifier || req.body?.email || "").trim().toLowerCase(),
});

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, businessName, acceptedLegal } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      if (acceptedLegal !== true) {
        return res.status(400).json({ message: "You must accept the current Terms, Privacy Policy, and Cookie Policy to create an account." });
      }
      const passwordError = validatePassword(String(password));
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
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

      const userAfterOrg = await authStorage.getUser(user.id);
      await recordCurrentLegalAcceptance({
        userId: user.id,
        organisationId: userAfterOrg?.organisationId ?? null,
        siteId: userAfterOrg?.currentSiteId ?? null,
        source: "registration",
        ipAddress: clientIp(req),
        userAgent: req.get("user-agent") ?? null,
        metadata: {
          documents: CURRENT_LEGAL_DOCUMENTS.documents,
        },
      });

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

  app.post("/api/auth/login", authAttemptLimiter, async (req, res) => {
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

  app.post("/api/staff/login", authAttemptLimiter, async (req, res) => {
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
      const passwordError = validatePassword(String(password));
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
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

  app.post("/api/auth/password-reset/request", passwordResetLimiter, async (req, res) => {
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
            ...(process.env.NODE_ENV !== "production" ? { resetLink, delivery: delivered ? "configured" : "manual" } : {}),
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
      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
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
