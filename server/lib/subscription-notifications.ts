import type { Express } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { users } from "@shared/models/auth";
import { businessSettings, customerSubscriptions, customers, organisations, subscriptionNotifications, subscriptionPlans } from "@shared/schema";
import { NOTIFICATION_TEMPLATES, type SubscriptionNotificationTrigger } from "./subscription-notification-templates";
import { subscriptionExpiryState } from "./subscription-formulas";
import { rateLimit } from "./rate-limit";
import { invalidateSubscriptionDashboard } from "./subscription-dashboard";

type Trigger = SubscriptionNotificationTrigger;
const triggerSchema = z.enum(["welcome", "renewal_reminder", "expired", "usage_80", "usage_100", "payment_confirmed", "card_ready"]);

async function organisationIdFor(req: any) {
  const [user] = await db.select({ organisationId: users.organisationId }).from(users).where(eq(users.id, req.userId)).limit(1);
  return user?.organisationId ?? null;
}

async function contextFor(subscriptionId: number, organisationId: number, allowedSiteIds?: number[]) {
  if (allowedSiteIds && allowedSiteIds.length === 0) return null;
  const [row] = await db.select({ subscription: customerSubscriptions, client: customers, plan: subscriptionPlans, businessName: organisations.name, country: businessSettings.country })
    .from(customerSubscriptions)
    .innerJoin(customers, eq(customerSubscriptions.customerId, customers.id))
    .innerJoin(subscriptionPlans, and(eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id), eq(subscriptionPlans.organisationId, organisationId)))
    .innerJoin(organisations, eq(customerSubscriptions.organisationId, organisations.id))
    .leftJoin(businessSettings, eq(businessSettings.userId, organisations.ownerId))
    .where(and(eq(customerSubscriptions.id, subscriptionId), eq(customerSubscriptions.organisationId, organisationId), ...(allowedSiteIds ? [inArray(customers.siteId, allowedSiteIds)] : []))).limit(1);
  return row ?? null;
}

function currencyForCountry(country: string | null) {
  const normalized = country?.trim().toLowerCase() ?? "";
  if (["guinée", "guinee"].includes(normalized)) return "GNF";
  if (["rd congo", "rdc", "république démocratique du congo"].includes(normalized)) return "USD";
  if (normalized === "maroc") return "MAD";
  if (normalized === "tunisie") return "TND";
  if (normalized === "algérie" || normalized === "algerie") return "DZD";
  if (normalized === "france" || normalized === "belgique") return "EUR";
  if (normalized === "suisse") return "CHF";
  return "FCFA";
}

type NotificationOptions = {
  allowedSiteIds?: number[];
  amount?: number;
  currency?: string;
  occurrenceKey?: string;
};

function buildMessage(trigger: Trigger, row: NonNullable<Awaited<ReturnType<typeof contextFor>>>, options: NotificationOptions) {
  const first = row.client.name.trim().split(/\s+/)[0] || row.client.name;
  const remainingKg = Number(row.subscription.remainingKg ?? 0);
  const days = Math.max(0, Math.ceil((new Date(`${row.subscription.expiryDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000));
  if (trigger === "welcome") return NOTIFICATION_TEMPLATES.welcome(first, row.plan.name, row.subscription.membershipNumber, row.businessName);
  if (trigger === "renewal_reminder") return NOTIFICATION_TEMPLATES.renewal_reminder(first, row.plan.name, days, row.businessName);
  if (trigger === "expired") return NOTIFICATION_TEMPLATES.expired(first, row.plan.name, row.businessName);
  if (trigger === "usage_80") return NOTIFICATION_TEMPLATES.usage_80(first, row.plan.name, remainingKg, row.businessName);
  if (trigger === "usage_100") return NOTIFICATION_TEMPLATES.usage_100(first, row.plan.name, row.businessName);
  if (trigger === "payment_confirmed") return NOTIFICATION_TEMPLATES.payment_confirmed(first, row.plan.name, options.amount ?? Number(row.plan.recurringPrice), options.currency ?? currencyForCountry(row.country), row.businessName);
  return NOTIFICATION_TEMPLATES.card_ready(first, row.subscription.membershipNumber, row.businessName);
}

export async function createPendingSubscriptionNotification(subscriptionId: number, organisationId: number, trigger: Trigger, options: NotificationOptions = {}) {
  const row = await contextFor(subscriptionId, organisationId, options.allowedSiteIds);
  if (!row) return null;
  const message = buildMessage(trigger, row, options);
  const whatsappUrl = `https://wa.me/${row.client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  const [created] = await db.insert(subscriptionNotifications).values({ organisationId, customerSubscriptionId: subscriptionId, clientId: row.client.id, trigger, occurrenceKey: options.occurrenceKey, message, whatsappUrl }).onConflictDoNothing().returning();
  if (!created) return null;
  return { ...created, clientName: row.client.name, planName: row.plan.name };
}

export async function checkSubscriptionNotifications() {
  const today = new Date().toISOString().slice(0, 10);
  const active = await db.select({
    id: customerSubscriptions.id,
    organisationId: customerSubscriptions.organisationId,
    expiryDate: customerSubscriptions.expiryDate,
    reminderDays: subscriptionPlans.renewalReminderDays,
  }).from(customerSubscriptions)
    .innerJoin(subscriptionPlans, and(
      eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id),
      eq(customerSubscriptions.organisationId, subscriptionPlans.organisationId),
    ))
    .where(eq(customerSubscriptions.status, "active"));
  const expiring = active.filter((item) => subscriptionExpiryState(item.expiryDate, item.reminderDays ?? 7, today) === "reminder");
  const expired = active.filter((item) => subscriptionExpiryState(item.expiryDate, item.reminderDays ?? 7, today) === "expired");
  for (const item of expiring) {
    await createPendingSubscriptionNotification(item.id, item.organisationId, "renewal_reminder", { occurrenceKey: `renewal_reminder:${today}` });
  }
  for (const item of expired) {
    const [updated] = await db.update(customerSubscriptions).set({ status: "expired", updatedAt: new Date() }).where(and(eq(customerSubscriptions.id, item.id), eq(customerSubscriptions.organisationId, item.organisationId), eq(customerSubscriptions.status, "active"))).returning({ id: customerSubscriptions.id });
    if (updated) {
      await createPendingSubscriptionNotification(item.id, item.organisationId, "expired", { occurrenceKey: `expired:${item.expiryDate}` });
      invalidateSubscriptionDashboard(item.organisationId);
    }
  }
  return { reminders: expiring.length, expired: expired.length };
}

export function registerSubscriptionNotificationRoutes(app: Express) {
  const notificationWriteLimiter = rateLimit({
    name: "subscription-notification-write",
    windowMs: 60_000,
    max: 10,
    key: (req) => String(req.user?.organisationId ?? req.organisationId ?? req.userId ?? "anonymous"),
    keyOnly: true,
  });
  app.get("/api/subscriptions/notifications", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    const siteScope = Array.isArray(req.siteScope) ? req.siteScope : [];
    if (siteScope.length === 0) return res.json([]);
    const status = z.enum(["pending", "sent", "failed"]).optional().safeParse(req.query.status);
    const trigger = triggerSchema.optional().safeParse(req.query.trigger);
    if (!status.success || !trigger.success) return res.status(400).json({ message: "Invalid notification filter" });
    const rows = await db
      .select({ notification: subscriptionNotifications })
      .from(subscriptionNotifications)
      .innerJoin(customers, eq(subscriptionNotifications.clientId, customers.id))
      .where(and(
        eq(subscriptionNotifications.organisationId, organisationId),
        inArray(customers.siteId, siteScope),
        ...(status.data ? [eq(subscriptionNotifications.status, status.data)] : []),
        ...(trigger.data ? [eq(subscriptionNotifications.trigger, trigger.data)] : []),
      ))
      .orderBy(desc(subscriptionNotifications.createdAt))
      .limit(50);
    res.json(rows.map((row) => row.notification));
  });
  app.get("/api/subscriptions/notifications/due", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    const siteScope = Array.isArray(req.siteScope) ? req.siteScope : [];
    if (siteScope.length === 0) return res.json([]);
    const rows = await db.select({ notification: subscriptionNotifications, clientName: customers.name, planName: subscriptionPlans.name }).from(subscriptionNotifications)
      .innerJoin(customers, eq(subscriptionNotifications.clientId, customers.id))
      .innerJoin(customerSubscriptions, and(eq(subscriptionNotifications.customerSubscriptionId, customerSubscriptions.id), eq(customerSubscriptions.organisationId, organisationId)))
      .innerJoin(subscriptionPlans, and(eq(customerSubscriptions.subscriptionPlanId, subscriptionPlans.id), eq(subscriptionPlans.organisationId, organisationId)))
      .where(and(
        eq(subscriptionNotifications.organisationId, organisationId),
        eq(subscriptionNotifications.status, "pending"),
        inArray(customers.siteId, siteScope),
      )).orderBy(desc(subscriptionNotifications.createdAt)).limit(50);
    res.json(rows.map(row => ({ ...row.notification, clientName: row.clientName, planName: row.planName })));
  });
  app.post("/api/subscriptions/notifications/send", isAuthenticated, notificationWriteLimiter, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); if (!organisationId) return res.status(403).json({ message: "Organisation required" });
    const parsed = z.object({ subscriptionId: z.coerce.number().int().positive(), trigger: triggerSchema }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid notification request" });
    const created = await createPendingSubscriptionNotification(parsed.data.subscriptionId, organisationId, parsed.data.trigger, { allowedSiteIds: req.siteScope });
    if (!created) return res.status(404).json({ message: "Subscription not found" });
    res.status(201).json(created);
  });
  app.patch("/api/subscriptions/notifications/:id/sent", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req); const id = Number(req.params.id);
    if (!organisationId || !Number.isInteger(id)) return res.status(400).json({ message: "Invalid notification" });
    const siteScope = Array.isArray(req.siteScope) ? req.siteScope : [];
    if (siteScope.length === 0) return res.status(404).json({ message: "Notification not found" });
    const [accessible] = await db
      .select({ id: subscriptionNotifications.id })
      .from(subscriptionNotifications)
      .innerJoin(customers, eq(subscriptionNotifications.clientId, customers.id))
      .where(and(
        eq(subscriptionNotifications.id, id),
        eq(subscriptionNotifications.organisationId, organisationId),
        inArray(customers.siteId, siteScope),
      ))
      .limit(1);
    if (!accessible) return res.status(404).json({ message: "Notification not found" });
    const [updated] = await db.update(subscriptionNotifications).set({ status: "sent", sentAt: new Date() }).where(and(eq(subscriptionNotifications.id, id), eq(subscriptionNotifications.organisationId, organisationId))).returning();
    if (!updated) return res.status(404).json({ message: "Notification not found" });
    res.json(updated);
  });
}
