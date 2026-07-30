import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas, createOrderWithItemsSchema } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerCalculatorRoutes } from "./lib/calculator-routes";
import { registerDiagnosticRoutes } from "./lib/diagnostic-routes";
import { registerLegalRoutes } from "./lib/legal-routes";
import { registerRentabiliteRoutes } from "./lib/rentabilite-routes";
import { insertBusinessSettingsSchema, insertEmployeeSchema, insertMachineSchema } from "@shared/schema";
import { parseLocalDateParam } from "./lib/reporting-date";
import { startTemporalIntelligenceJob } from "./lib/temporal-intelligence";
import { registerMembershipRoutes } from "./lib/membership-routes";
import { registerSubscriptionDashboardRoutes } from "./lib/subscription-dashboard";
import { registerSubscriptionNotificationRoutes } from "./lib/subscription-notifications";
import { awardOrderPoints, awardReferralPoints } from "./lib/loyalty";
import {
  addManualCredit,
  CREDIT_REASONS,
  CreditOperationError,
  recordPaymentWithCredit,
} from "./lib/customer-credit";
import { pool } from "./db";

function sanitizeNumeric(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const out = { ...obj };
  for (const f of fields) {
    if (f in out) {
      const v = out[f];
      if (v === "" || v === null || v === undefined) {
        out[f] = null;
      } else {
        const n = Number(v);
        out[f] = isNaN(n) ? null : String(n);
      }
    }
  }
  return out;
}

function sanitizeInteger(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const out = { ...obj };
  for (const f of fields) {
    if (f in out) {
      const v = out[f];
      if (v === "" || v === null || v === undefined) {
        out[f] = null;
      } else {
        const n = Number(v);
        out[f] = Number.isInteger(n) ? n : null;
      }
    }
  }
  return out;
}

function sanitizeDates(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const out = { ...obj };
  for (const f of fields) {
    if (f in out) {
      const v = out[f];
      if (v === "" || v === null || v === undefined) {
        out[f] = null;
      } else if (typeof v === "string" || v instanceof Date) {
        const date = new Date(v);
        out[f] = Number.isNaN(date.getTime()) ? null : date;
      }
    }
  }
  return out;
}

function scopedSites(req: any): number[] {
  return Array.isArray(req.siteScope) ? req.siteScope : [];
}

function orgScopedSites(req: any): number[] {
  return Array.isArray(req.organisationSiteScope) ? req.organisationSiteScope : scopedSites(req);
}

function resolveWriteSiteId(req: any): number | null {
  if (typeof req.siteId === "number" && Number.isInteger(req.siteId)) {
    return req.siteId;
  }
  const authorizedSiteIds = Array.isArray(req.authorizedSiteIds) ? req.authorizedSiteIds : [];
  if (authorizedSiteIds.length === 1) return authorizedSiteIds[0];
  // "All Sites" mode with multiple sites — fall back to first authorized site
  if (authorizedSiteIds.length > 1) return authorizedSiteIds[0];
  return null;
}

function requireWriteSite(req: any, res: any): number | null {
  const siteId = resolveWriteSiteId(req);
  if (siteId === null) {
    res.status(400).json({
      message: "Select a specific site before saving. All Sites is read-only for creating records.",
    });
    return null;
  }
  return siteId;
}

function pickSiteUpdate(data: Record<string, any>) {
  const out: Record<string, string> = {};
  for (const key of ["name", "address", "city", "phone"]) {
    if (typeof data[key] === "string") out[key] = data[key];
  }
  return out;
}

async function canAccessSite(req: any, siteId: number): Promise<boolean> {
  return Array.isArray(req.authorizedSiteIds) && req.authorizedSiteIds.includes(siteId);
}

async function canAccessCustomer(req: any, customerId: number): Promise<boolean> {
  const customer = await storage.getCustomer(customerId);
  return !!customer && customer.siteId != null && orgScopedSites(req).includes(customer.siteId);
}

async function canAccessService(req: any, serviceId: number): Promise<boolean> {
  const service = await storage.getService(serviceId);
  return !!service && service.siteId != null && orgScopedSites(req).includes(service.siteId);
}

async function canAccessOrder(req: any, orderId: number): Promise<boolean> {
  const order = await storage.getOrder(orderId);
  return !!order && order.siteId != null && (await canAccessSite(req, order.siteId));
}

async function canAccessMachine(req: any, machineId: number): Promise<boolean> {
  const machine = await storage.getMachine(machineId);
  return !!machine && machine.siteId != null && (await canAccessSite(req, machine.siteId));
}

async function canAccessEmployee(req: any, employeeId: number): Promise<boolean> {
  const employee = await storage.getEmployee(employeeId);
  return !!employee && employee.siteId != null && (await canAccessSite(req, employee.siteId));
}

async function canAccessExpenditure(req: any, expenditureId: number): Promise<boolean> {
  const expenditure = await storage.getExpenditure(expenditureId);
  return !!expenditure && expenditure.siteId != null && (await canAccessSite(req, expenditure.siteId));
}

async function effectiveSiteRole(req: any, siteId: number): Promise<string | null> {
  const userId = (req.session as any)?.userId as string | undefined;
  if (!userId || !(await canAccessSite(req, siteId))) return null;
  if (await canManageSite(req, siteId)) return "owner";
  return storage.getUserSiteRole(userId, siteId);
}

function roleRank(role: string | null): number {
  if (role === "owner") return 3;
  if (role === "manager") return 2;
  if (role === "operator") return 1;
  return 0;
}

async function requireSiteRole(req: any, res: any, siteId: number, allowed: string[]): Promise<boolean> {
  const role = await effectiveSiteRole(req, siteId);
  const minimumRank = Math.min(...allowed.map(roleRank));
  if (roleRank(role) < minimumRank) {
    res.status(403).json({ message: "Insufficient permissions" });
    return false;
  }
  return true;
}

async function requireResourceRole(
  req: any,
  res: any,
  getSiteId: () => Promise<number | null | undefined>,
  allowed: string[],
): Promise<boolean> {
  const siteId = await getSiteId();
  if (siteId == null) {
    res.status(404).json({ message: "Resource not found" });
    return false;
  }
  return requireSiteRole(req, res, siteId, allowed);
}

async function actorEmployee(req: any, siteId: number) {
  const userId = (req.session as any)?.userId as string | undefined;
  if (!userId) return null;
  return storage.getOrCreateActorEmployee(userId, siteId);
}

async function trackEmployeeActivity(req: any, data: {
  siteId: number;
  actionType: string;
  orderId?: number | null;
  amount?: string | number | null;
  weightKg?: string | number | null;
  metadata?: Record<string, any>;
}) {
  const employee = await actorEmployee(req, data.siteId);
  if (!employee) return;
  await storage.createEmployeeActivity({
    employeeId: employee.id,
    actorUserId: (req.session as any).userId,
    siteId: data.siteId,
    actionType: data.actionType,
    orderId: data.orderId ?? null,
    amount: data.amount == null ? null : String(data.amount),
    weightKg: data.weightKg == null ? null : String(data.weightKg),
    metadata: data.metadata ?? {},
  } as any);
}

async function canManageSite(req: any, siteId: number): Promise<boolean> {
  const userId = (req.session as any).userId;
  const org = await storage.getOrganisationByOwner(userId);
  const site = await storage.getSite(siteId);
  return !!org && !!site && site.organisationId === org.id;
}

async function requireOwnerOrganisation(req: any, res: any) {
  const userId = (req.session as any).userId;
  const org = await storage.getOrganisationByOwner(userId);
  if (!org) {
    res.status(403).json({ message: "Only organisation owners can access this resource" });
    return null;
  }
  return org;
}

async function effectiveSettingsOwnerId(req: any): Promise<string> {
  const userId = (req.session as any).userId as string;
  const { db } = await import("./db");
  const { users } = await import("@shared/models/auth");
  const { organisations } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user?.organisationId) {
    const [org] = await db.select().from(organisations).where(eq(organisations.id, user.organisationId)).limit(1);
    return org?.ownerId || userId;
  }
  return userId;
}

async function effectivePlanSlug(req: any): Promise<string> {
  const userId = (req.session as any).userId as string;
  const { db } = await import("./db");
  const { users } = await import("@shared/models/auth");
  const { organisations } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  let subscriptionOwnerId = userId;
  if (user?.organisationId) {
    const [org] = await db.select().from(organisations).where(eq(organisations.id, user.organisationId)).limit(1);
    subscriptionOwnerId = org?.ownerId || userId;
  }
  const sub = await storage.getUserSubscription(subscriptionOwnerId);
  return sub?.plan?.slug || "starter";
}

async function seedDatabase() {
  const servicesList = await storage.getServices();
  if (servicesList.length === 0) {
    console.log("Seeding database...");
    const s1 = await storage.createService({ name: "Wash & Fold", unit: "kg", price: "15.00", category: "washing", description: "Regular wash and fold service", imageUrl: "", active: true });
    const s2 = await storage.createService({ name: "Dry Cleaning (Suit)", unit: "piece", price: "150.00", category: "dry_cleaning", description: "Professional dry cleaning for suits", imageUrl: "", active: true });
    const s3 = await storage.createService({ name: "Ironing (Shirt)", unit: "piece", price: "25.00", category: "ironing", description: "Steam ironing", imageUrl: "", active: true });
    const c1 = await storage.createCustomer({ name: "John Doe", phone: "555-0101", email: "john@example.com", address: "123 Main St", notes: "Allergic to strong detergents" });
    const c2 = await storage.createCustomer({ name: "Jane Smith", phone: "555-0102", email: "jane@example.com", address: "456 Oak Ave", notes: "" });
    await storage.createOrder({ customerId: c1.id, status: "received", paymentStatus: "unpaid" }, [{ serviceId: s1.id, quantity: 5 }]);
    await storage.createOrder({ customerId: c2.id, status: "ready", paymentStatus: "paid" }, [{ serviceId: s2.id, quantity: 2 }, { serviceId: s3.id, quantity: 3 }]);
    console.log("Database seeded!");
  }
  await storage.seedPlans();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerLegalRoutes(app);
  registerCalculatorRoutes(app);
  registerDiagnosticRoutes(app);
  registerRentabiliteRoutes(app);
  registerMembershipRoutes(app);
  registerSubscriptionDashboardRoutes(app);
  registerSubscriptionNotificationRoutes(app);
  seedDatabase().catch(console.error);
  startTemporalIntelligenceJob();

  app.get("/api/public/stats", async (_req, res) => {
    try {
      const stats = await storage.getPublicStats();
      res.json(stats);
    } catch {
      res.json({ totalOrders: 0, totalCustomers: 0, totalTransactions: 0, totalLaundries: 0, totalGarments: 0 });
    }
  });

  const VALID_PIPELINE_STATUSES = ["received", "sorting", "washing", "drying", "ironing", "packaging", "ready", "delivered", "cancelled", "cancellation_requested"];
  const NON_PAYABLE_ORDER_STATUSES = new Set(["cancelled", "cancellation_requested"]);

  app.get(api.customers.list.path, isAuthenticated, async (req: any, res) => {
    const customers = await storage.getCustomersBySite(orgScopedSites(req));
    res.json(customers);
  });

  app.get(api.customers.get.path, isAuthenticated, async (req, res) => {
    const customer = await storage.getCustomer(Number(req.params.id));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    if (!(await canAccessCustomer(req, customer.id))) return res.status(403).json({ message: "Forbidden" });
    res.json(customer);
  });

  app.post(api.customers.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const siteId = requireWriteSite(req, res);
      if (siteId === null) return;
      const input = api.customers.create.input.parse(req.body);
      if (input.referredByCustomerId != null) {
        const referrer = await storage.getCustomer(input.referredByCustomerId);
        if (!referrer || referrer.siteId !== siteId) {
          return res.status(400).json({ message: "Referrer must belong to the selected site", field: "referredByCustomerId" });
        }
      }
      const customer = await storage.createCustomer({ ...input, siteId });
      res.status(201).json(customer);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  app.patch(api.customers.update.path, isAuthenticated, async (req, res) => {
    const input = api.customers.update.input.parse(req.body);
    const existing = await storage.getCustomer(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Customer not found" });
    if (!(await canAccessCustomer(req, existing.id))) return res.status(403).json({ message: "Forbidden" });
    if (input.referredByCustomerId != null) {
      if (input.referredByCustomerId === existing.id) {
        return res.status(400).json({ message: "A customer cannot refer themselves", field: "referredByCustomerId" });
      }
      const referrer = await storage.getCustomer(input.referredByCustomerId);
      if (!referrer || referrer.siteId !== existing.siteId) {
        return res.status(400).json({ message: "Referrer must belong to the same site", field: "referredByCustomerId" });
      }
    }
    const updated = await storage.updateCustomer(Number(req.params.id), input);
    if (!updated) return res.status(404).json({ message: "Customer not found" });
    res.json(updated);
  });

  app.get("/api/customers/:id/orders", isAuthenticated, async (req, res) => {
    const customer = await storage.getCustomer(Number(req.params.id));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    if (!(await canAccessCustomer(req, customer.id))) return res.status(403).json({ message: "Forbidden" });
    const customerOrders = await storage.getCustomerOrders(Number(req.params.id));
    res.json(customerOrders);
  });

  app.get(api.services.list.path, isAuthenticated, async (req: any, res) => {
    let svcList = await storage.getServicesBySite(orgScopedSites(req));
    const writeSiteId = resolveWriteSiteId(req);
    // Auto-seed default services for a brand-new writable site.
    if (svcList.length === 0 && writeSiteId != null) {
      await storage.createService({ name: "Lavage & Repassage", unit: "kg", price: "15.00", category: "washing", description: "Service de lavage et repassage standard", imageUrl: "", active: true, siteId: writeSiteId } as any);
      await storage.createService({ name: "Nettoyage à sec (Costume)", unit: "piece", price: "150.00", category: "dry_cleaning", description: "Nettoyage à sec professionnel pour costumes", imageUrl: "", active: true, siteId: writeSiteId } as any);
      await storage.createService({ name: "Repassage (Chemise)", unit: "piece", price: "25.00", category: "ironing", description: "Repassage à la vapeur", imageUrl: "", active: true, siteId: writeSiteId } as any);
      svcList = await storage.getServicesBySite(orgScopedSites(req));
    }
    res.json(svcList);
  });

  app.post(api.services.create.path, isAuthenticated, async (req: any, res) => {
    const siteId = requireWriteSite(req, res);
    if (siteId === null) return;
    if (!(await requireSiteRole(req, res, siteId, ["owner", "manager"]))) return;
    const input = api.services.create.input.parse(req.body);
    const service = await storage.createService({ ...input, siteId } as any);
    res.status(201).json(service);
  });

  app.patch(api.services.update.path, isAuthenticated, async (req: any, res) => {
    const service = await storage.getService(Number(req.params.id));
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (service.siteId == null || !(await requireSiteRole(req, res, service.siteId, ["owner", "manager"]))) return;
    const input = api.services.update.input.parse(req.body);
    const updated = await storage.updateService(Number(req.params.id), input);
    if (!updated) return res.status(404).json({ message: "Service not found" });
    res.json(updated);
  });

  app.delete(api.services.delete.path, isAuthenticated, async (req, res) => {
    const service = await storage.getService(Number(req.params.id));
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (service.siteId == null || !(await requireSiteRole(req, res, service.siteId, ["owner", "manager"]))) return;
    const deleted = await storage.deleteService(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Service not found" });
    res.json({ success: true });
  });

  app.get("/api/orders/pending-cancellations", isAuthenticated, async (req: any, res) => {
    const pending = await storage.getPendingCancellations(scopedSites(req));
    res.json(pending);
  });

  app.get(api.orders.list.path, isAuthenticated, async (req: any, res) => {
    const orders = await storage.getOrdersBySite(scopedSites(req));
    res.json(orders);
  });

  app.get(api.orders.get.path, isAuthenticated, async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.siteId == null || !(await canAccessSite(req, order.siteId))) return res.status(403).json({ message: "Forbidden" });
    res.json(order);
  });

  app.post(api.orders.create.path, isAuthenticated, async (req, res) => {
    try {
      const siteId = requireWriteSite(req, res);
      if (siteId === null) return;
      const input = api.orders.create.input.parse(req.body);
      const { items, garmentItems: garments, machineUsages, ...orderData } = input;
      const customer = await storage.getCustomer(orderData.customerId);
      if (!customer) return res.status(400).json({ message: "Customer not found" });
      if (!(await canAccessCustomer(req, customer.id))) {
        return res.status(403).json({ message: "Customer does not belong to this organisation" });
      }
      let subtotal = 0;
      for (const item of items) {
        const service = await storage.getService(item.serviceId);
        if (!service) return res.status(400).json({ message: `Service ${item.serviceId} not found` });
        if (!(await canAccessService(req, service.id))) {
          return res.status(403).json({ message: `Service ${item.serviceId} does not belong to this organisation` });
        }
        subtotal += Number(service.price) * item.quantity;
      }
      const discountPct = Number(orderData.discountPct || 0);
      const requestedDiscountAmount = Number(orderData.discount || 0);
      const discountAmount = discountPct > 0
        ? subtotal * (discountPct / 100)
        : requestedDiscountAmount;
      if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) {
        return res.status(400).json({ message: "Discount must be between zero and the order subtotal" });
      }
      const pickupCostAmount = Number(orderData.pickupCost || 0);
      const advanceAmount = Number(orderData.advancePayment || 0);
      const totalAmount = Math.max(0, subtotal - discountAmount + pickupCostAmount);
      const initialPaymentStatus = advanceAmount >= totalAmount ? "paid" : advanceAmount > 0 ? "partial" : "unpaid";
      const employee = await actorEmployee(req, siteId);
      const order = await storage.createOrder({
        ...orderData,
        createdByEmployeeId: employee?.id ?? null,
        status: "received",
        totalAmount: totalAmount.toString(),
        originalPrice: subtotal.toString(),
        discountPct: discountPct.toString(),
        discountAmount: discountAmount.toString(),
        discount: discountAmount.toString(),
        pickupCost: pickupCostAmount.toString(),
        paymentStatus: initialPaymentStatus,
        entryDate: orderData.entryDate ? new Date(orderData.entryDate) : new Date(),
        pickupDate: orderData.pickupDate ? new Date(orderData.pickupDate) : null,
        siteId,
      } as any, items, garments);
      await trackEmployeeActivity(req, {
        siteId,
        actionType: "order_created",
        orderId: order.id,
        amount: totalAmount,
        weightKg: items.reduce((sum, item) => sum + item.quantity, 0),
        metadata: { itemCount: items.length, garmentCount: garments?.length ?? 0 },
      });
      if (discountAmount > 0) {
        await trackEmployeeActivity(req, {
          siteId,
          actionType: "discount_applied",
          orderId: order.id,
          amount: discountAmount,
          metadata: { subtotal, totalAmount },
        });
      }
      for (const usage of machineUsages ?? []) {
        const machine = await storage.getMachine(usage.machineId);
        if (!machine || machine.siteId !== siteId) continue;
        await storage.createMachineUsage({
          machineId: usage.machineId,
          orderId: order.id,
          siteId,
          weightProcessed: usage.weightProcessed || "0",
          cycleDurationMinutes: usage.cycleDurationMinutes || 0,
        } as any);
      }
      if (advanceAmount > 0) {
        await storage.createPayment({
          orderId: order.id,
          collectedByEmployeeId: employee?.id ?? null,
          amount: advanceAmount.toString(),
          method: orderData.advancePaymentMethod || "Cash",
          date: order.entryDate || new Date(),
          isAdvance: true,
        } as any);
        await trackEmployeeActivity(req, {
          siteId,
          actionType: "payment_collected",
          orderId: order.id,
          amount: advanceAmount,
          metadata: { method: orderData.advancePaymentMethod || "Cash", isAdvance: true },
        });
      }
      res.status(201).json(order);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  app.patch(api.orders.updateStatus.path, isAuthenticated, async (req, res) => {
    const input = api.orders.updateStatus.input.parse(req.body);
    if (input.status && !VALID_PIPELINE_STATUSES.includes(input.status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_PIPELINE_STATUSES.join(", ")}` });
    }
    const userId = (req.session as any)?.userId || null;
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateOrderStatus(Number(req.params.id), input.status, input.paymentStatus, userId);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    if (updated.siteId != null) {
      const actionType = input.status === "delivered"
        ? "order_delivered"
        : input.status === "cancelled"
          ? "order_cancelled"
          : "order_processed";
      await trackEmployeeActivity(req, {
        siteId: updated.siteId,
        actionType,
        orderId: updated.id,
        amount: updated.totalAmount,
        weightKg: input.weightProcessed ?? null,
        metadata: { status: input.status, paymentStatus: input.paymentStatus },
      });
      if (input.machineId && ["washing", "drying", "ironing"].includes(input.status)) {
        const machine = await storage.getMachine(input.machineId);
        if (machine?.siteId === updated.siteId) {
          await storage.createMachineUsage({
            machineId: input.machineId,
            orderId: updated.id,
            siteId: updated.siteId,
            weightProcessed: input.weightProcessed || "0",
            cycleDurationMinutes: input.cycleDurationMinutes || 0,
          } as any);
        }
      }
      if (input.status === "delivered") {
        const site = await storage.getSite(updated.siteId);
        if (site) {
          await awardOrderPoints(updated.id, site.organisationId)
            .catch((error) => console.error("[Loyalty] Order points award failed", error));
          await awardReferralPoints(updated.id, site.organisationId)
            .catch((error) => console.error("[Loyalty] Referral points award failed", error));
        }
      }
    }
    res.json(updated);
  });

  app.get("/api/orders/:id/status-history", isAuthenticated, async (req, res) => {
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const history = await storage.getOrderStatusHistory(Number(req.params.id));
    res.json(history);
  });

  app.patch("/api/garment-items/:id/return", isAuthenticated, async (req, res) => {
    const { returnStage, returnNotes } = req.body;
    const item = await storage.getGarmentItem(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Garment item not found" });
    if (!(await canAccessOrder(req, item.orderId))) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.markGarmentReturned(Number(req.params.id), returnStage, returnNotes);
    if (!updated) return res.status(404).json({ message: "Garment item not found" });
    res.json(updated);
  });

  app.patch("/api/garment-items/:id/resolve", isAuthenticated, async (req, res) => {
    const item = await storage.getGarmentItem(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Garment item not found" });
    if (!(await canAccessOrder(req, item.orderId))) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.resolveGarmentReturn(Number(req.params.id));
    if (!updated) return res.status(404).json({ message: "Garment item not found" });
    res.json(updated);
  });

  app.post("/api/orders/:id/request-cancellation", isAuthenticated, async (req, res) => {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "reason is required" });
    const userId = (req.session as any)?.userId || "unknown";
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.requestCancellation(Number(req.params.id), reason, userId);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    if (updated.siteId != null) {
      await trackEmployeeActivity(req, {
        siteId: updated.siteId,
        actionType: "order_cancelled",
        orderId: updated.id,
        amount: updated.totalAmount,
        metadata: { reason, requested: true },
      });
    }
    res.json(updated);
  });

  app.post("/api/orders/:id/approve-cancellation", isAuthenticated, async (req, res) => {
    const userId = (req.session as any)?.userId || "unknown";
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const order = await storage.getOrder(Number(req.params.id));
    if (!order?.siteId || !(await requireSiteRole(req, res, order.siteId, ["owner", "manager"]))) return;
    const updated = await storage.approveCancellation(Number(req.params.id), userId);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    if (updated.siteId != null) {
      await trackEmployeeActivity(req, {
        siteId: updated.siteId,
        actionType: "order_cancelled",
        orderId: updated.id,
        amount: updated.totalAmount,
        metadata: { approved: true },
      });
    }
    res.json(updated);
  });

  app.post("/api/orders/:id/reject-cancellation", isAuthenticated, async (req, res) => {
    const { note } = req.body;
    const userId = (req.session as any)?.userId || "unknown";
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const order = await storage.getOrder(Number(req.params.id));
    if (!order?.siteId || !(await requireSiteRole(req, res, order.siteId, ["owner", "manager"]))) return;
    const updated = await storage.rejectCancellation(Number(req.params.id), userId, note || "");
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  app.patch("/api/orders/:id/deliver", isAuthenticated, async (req, res) => {
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.markDelivered(Number(req.params.id), new Date());
    if (!updated) return res.status(404).json({ message: "Order not found" });
    if (updated.siteId != null) {
      await trackEmployeeActivity(req, {
        siteId: updated.siteId,
        actionType: "order_delivered",
        orderId: updated.id,
        amount: updated.totalAmount,
      });
    }
    res.json(updated);
  });

  app.post(api.payments.create.path, isAuthenticated, async (req, res) => {
    const input = z.object({
      orderId: z.coerce.number().int().positive(),
      amount: z.coerce.string().default("0"),
      method: z.string().min(1).max(50),
      reference: z.string().max(255).optional(),
      date: z.coerce.date().optional(),
      creditToApply: z.coerce.string().default("0"),
      surplusDisposition: z.enum(["return", "credit"]).default("return"),
      idempotencyKey: z.string().min(16).max(80).optional(),
    }).parse(req.body);
    const order = await storage.getOrder(input.orderId);
    if (!order || order.siteId == null || !(await canAccessSite(req, order.siteId))) return res.status(403).json({ message: "Forbidden" });
    if (NON_PAYABLE_ORDER_STATUSES.has(order.status)) {
      return res.status(400).json({ message: "Payments cannot be registered for cancelled orders" });
    }
    const employee = await actorEmployee(req, order.siteId);
    const organisationId = Number((req as any).organisationId);
    if (!Number.isInteger(organisationId)) return res.status(403).json({ message: "Organisation context required" });
    const idempotencyKey = input.idempotencyKey ?? `server-${crypto.randomUUID()}`;
    let payment;
    try {
      payment = await recordPaymentWithCredit({
        orderId: input.orderId,
        amountReceived: input.amount,
        method: input.method,
        reference: input.reference,
        paymentDate: input.date,
        creditToApply: input.creditToApply,
        surplusDisposition: input.surplusDisposition,
        idempotencyKey,
        organisationId,
        siteId: order.siteId,
        actorUserId: (req.session as any)?.userId ?? null,
        collectedByEmployeeId: employee?.id ?? null,
      });
    } catch (error) {
      if (error instanceof CreditOperationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
    if (!payment.idempotentReplay) {
      await trackEmployeeActivity(req, {
        siteId: order.siteId,
        actionType: "payment_collected",
        orderId: input.orderId,
        amount: payment.cashApplied ?? input.amount,
        metadata: {
          method: input.method,
          creditApplied: payment.creditApplied ?? "0",
          creditAdded: payment.creditAdded ?? "0",
        },
      });
    }
    res.status(201).json(payment);
  });

  app.get(api.payments.listByOrder.path, isAuthenticated, async (req, res) => {
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const payments = await storage.getPaymentsByOrder(Number(req.params.id));
    res.json(payments);
  });

  app.get("/api/customers/:id/credit", isAuthenticated, async (req: any, res) => {
    const customerId = Number(req.params.id);
    const organisationId = Number(req.organisationId);
    if (!Number.isInteger(customerId) || !Number.isInteger(organisationId)) {
      return res.status(400).json({ message: "Invalid customer or organisation" });
    }
    if (!(await canAccessCustomer(req, customerId))) return res.status(403).json({ message: "Forbidden" });

    const result = await pool.query(
      `SELECT c.id, c.name, c.credit_balance, c.total_credit_added, c.total_credit_used
       FROM customers c
       JOIN sites s ON s.id = c.site_id
       WHERE c.id = $1 AND s.organisation_id = $2`,
      [customerId, organisationId],
    );
    if (!result.rowCount) return res.status(404).json({ message: "Customer not found" });
    const history = await pool.query(
      `SELECT ct.*, s.name AS site_name, o.id AS linked_order_id,
              NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS created_by_name
       FROM credit_transactions ct
       JOIN sites s ON s.id = ct.site_id
       LEFT JOIN orders o ON o.id = ct.order_id
       LEFT JOIN users u ON u.id = ct.created_by
       WHERE ct.customer_id = $1 AND ct.organisation_id = $2
       ORDER BY ct.created_at DESC, ct.id DESC
       LIMIT 100`,
      [customerId, organisationId],
    );
    const customer = result.rows[0];
    res.json({
      customerName: customer.name,
      creditBalance: customer.credit_balance,
      totalCreditAdded: customer.total_credit_added,
      totalCreditUsed: customer.total_credit_used,
      history: history.rows,
    });
  });

  app.post("/api/customers/:id/credit", isAuthenticated, async (req: any, res) => {
    const customerId = Number(req.params.id);
    const organisationId = Number(req.organisationId);
    const siteId = requireWriteSite(req, res);
    if (siteId === null) return;
    if (!Number.isInteger(customerId) || !Number.isInteger(organisationId)) {
      return res.status(400).json({ message: "Invalid customer or organisation" });
    }
    if (!(await canAccessCustomer(req, customerId))) return res.status(403).json({ message: "Forbidden" });
    if (!(await requireSiteRole(req, res, siteId, ["owner", "manager"]))) return;
    const body = z.object({
      amount: z.coerce.string(),
      reason: z.enum(CREDIT_REASONS),
      notes: z.string().max(500).optional(),
      idempotencyKey: z.string().min(16).max(80),
    }).parse(req.body);
    try {
      const transaction = await addManualCredit({
        customerId,
        amount: body.amount,
        reason: body.reason,
        notes: body.notes,
        organisationId,
        siteId,
        actorUserId: (req.session as any)?.userId ?? null,
        idempotencyKey: body.idempotencyKey,
      });
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof CreditOperationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.get("/api/analytics/credit-summary", isAuthenticated, async (req: any, res) => {
    const organisationId = Number(req.organisationId);
    if (!Number.isInteger(organisationId)) return res.status(403).json({ message: "Organisation context required" });
    const result = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE c.credit_balance > 0)::int AS clients_with_credit,
              COALESCE(SUM(c.credit_balance), 0)::text AS total_credit_balance,
              COALESCE(SUM(c.total_credit_added), 0)::text AS total_ever_credited,
              COALESCE(SUM(c.total_credit_used), 0)::text AS total_ever_used
       FROM customers c
       JOIN sites s ON s.id = c.site_id
       WHERE s.organisation_id = $1`,
      [organisationId],
    );
    const summary = result.rows[0];
    res.json({
      clientsWithCredit: summary.clients_with_credit,
      totalCreditBalance: summary.total_credit_balance,
      totalEverCredited: summary.total_ever_credited,
      totalEverUsed: summary.total_ever_used,
    });
  });

  app.get(api.expenditures.list.path, isAuthenticated, async (req: any, res) => {
    const expenditures = await storage.getExpendituresBySite(scopedSites(req));
    res.json(expenditures);
  });

  app.post(api.expenditures.create.path, isAuthenticated, async (req: any, res) => {
    const siteId = requireWriteSite(req, res);
    if (siteId === null) return;
    if (!(await requireSiteRole(req, res, siteId, ["owner", "manager"]))) return;
    const input = api.expenditures.create.input.parse(req.body);
    const expenditure = await storage.createExpenditure({
      ...input,
      date: input.date ? new Date(input.date) : new Date(),
      siteId,
    });
    res.status(201).json(expenditure);
  });

  app.patch("/api/expenditures/:id", isAuthenticated, async (req, res) => {
    try {
      if (!(await canAccessExpenditure(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
      const expenditure = await storage.getExpenditure(Number(req.params.id));
      if (!expenditure?.siteId || !(await requireSiteRole(req, res, expenditure.siteId, ["owner", "manager"]))) return;
      const body = { ...req.body };
      delete body.siteId;
      if (body.date && typeof body.date === "string") body.date = new Date(body.date);
      const updated = await storage.updateExpenditure(Number(req.params.id), body);
      if (!updated) return res.status(404).json({ message: "Expenditure not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete("/api/expenditures/:id", isAuthenticated, async (req, res) => {
    const expenditureId = Number(req.params.id);
    if (!Number.isInteger(expenditureId) || !(await canAccessExpenditure(req, expenditureId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const expenditure = await storage.getExpenditure(expenditureId);
    if (!expenditure?.siteId || !(await requireSiteRole(req, res, expenditure.siteId, ["owner", "manager"]))) return;
    const deleted = await storage.deleteExpenditure(expenditureId);
    if (!deleted) return res.status(404).json({ message: "Expenditure not found" });
    res.json({ success: true });
  });

  app.get(api.performance.get.path, isAuthenticated, async (req: any, res) => {
    const { start, end } = req.query;
    const now = new Date();
    const startDate = parseLocalDateParam(start as string | undefined, new Date(now.getFullYear(), now.getMonth(), 1));
    const endDate = parseLocalDateParam(end as string | undefined, now, true);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    const data = await storage.getPerformanceData(scopedSites(req), startDate, endDate);
    res.json(data);
  });

  app.get(api.reports.get.path, isAuthenticated, async (req: any, res) => {
    const { start, end } = req.query;
    const now = new Date();
    const startDate = parseLocalDateParam(start as string | undefined, new Date(now.getFullYear(), now.getMonth(), 1));
    const endDate = parseLocalDateParam(end as string | undefined, now, true);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    const data = await storage.getReportData(startDate, endDate, scopedSites(req));
    res.json(data);
  });

  app.get(api.stats.get.path, isAuthenticated, async (req: any, res) => {
    const stats = await storage.getStatsBySite(scopedSites(req));
    res.json(stats);
  });

  app.get("/api/machines", isAuthenticated, async (req: any, res) => {
    const machines = await storage.getMachines(scopedSites(req), (req.session as any).userId);
    res.json(machines);
  });

  const MACHINE_NUMERIC = ["capacityKg", "utilizationRate", "cycleCount", "totalKgProcessed", "maintenanceIntervalHours", "maintenanceCost"];
  const MACHINE_INTEGER = ["maintenanceIntervalDays"];
  const MACHINE_DATES = ["purchaseDate", "lastMaintenanceDate"];

  app.post("/api/machines", isAuthenticated, async (req: any, res) => {
    try {
      const siteId = requireWriteSite(req, res);
      if (siteId === null) return;
      if (!(await requireSiteRole(req, res, siteId, ["owner", "manager"]))) return;
      let body = sanitizeNumeric(req.body, MACHINE_NUMERIC);
      body = sanitizeInteger(body, MACHINE_INTEGER);
      body = sanitizeDates(body, MACHINE_DATES);
      if (!body.capacityKg) body.capacityKg = "0";
      const input = insertMachineSchema.parse({ ...body, userId: (req.session as any).userId, siteId });
      const machine = await storage.createMachine(input);
      res.status(201).json(machine);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      console.error("Machine save failed:", err);
      res.status(400).json({ message: "Invalid machine data" });
    }
  });

  app.patch("/api/machines/:id", isAuthenticated, async (req, res) => {
    if (!(await requireResourceRole(req, res, async () => (await storage.getMachine(Number(req.params.id)))?.siteId, ["owner", "manager"]))) return;
    let body = sanitizeNumeric(req.body, MACHINE_NUMERIC);
    body = sanitizeInteger(body, MACHINE_INTEGER);
    body = sanitizeDates(body, MACHINE_DATES);
    const updated = await storage.updateMachine(Number(req.params.id), body);
    if (!updated) return res.status(404).json({ message: "Machine not found" });
    res.json(updated);
  });

  app.delete("/api/machines/:id", isAuthenticated, async (req, res) => {
    if (!(await requireResourceRole(req, res, async () => (await storage.getMachine(Number(req.params.id)))?.siteId, ["owner", "manager"]))) return;
    const deleted = await storage.deleteMachine(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Machine not found" });
    res.json({ success: true });
  });

  app.post("/api/machines/:id/usage", isAuthenticated, async (req: any, res) => {
    const machineId = Number(req.params.id);
    if (!(await canAccessMachine(req, machineId))) return res.status(403).json({ message: "Forbidden" });
    const machine = await storage.getMachine(machineId);
    if (!machine?.siteId) return res.status(404).json({ message: "Machine not found" });
    const body = sanitizeNumeric(req.body, ["weightProcessed"]);
    const usage = await storage.createMachineUsage({
      machineId,
      orderId: body.orderId ? Number(body.orderId) : null,
      siteId: machine.siteId,
      usageDate: body.usageDate ? new Date(body.usageDate) : new Date(),
      weightProcessed: body.weightProcessed || "0",
      cycleDurationMinutes: Number(body.cycleDurationMinutes || 0),
    } as any);
    res.status(201).json(usage);
  });

  app.get("/api/employees", isAuthenticated, async (req: any, res) => {
    const employees = await storage.getEmployees(scopedSites(req), (req.session as any).userId);
    res.json(employees);
  });

  const EMPLOYEE_NUMERIC = ["salary", "kgProcessed", "ordersHandled"];
  const EMPLOYEE_INTEGER = ["ordersHandled"];
  const EMPLOYEE_DATES = ["dateHired"];

  app.post("/api/employees", isAuthenticated, async (req: any, res) => {
    try {
      const siteId = requireWriteSite(req, res);
      if (siteId === null) return;
      if (!(await requireSiteRole(req, res, siteId, ["owner", "manager"]))) return;
      let body = sanitizeNumeric(req.body, EMPLOYEE_NUMERIC);
      body = sanitizeInteger(body, EMPLOYEE_INTEGER);
      body = sanitizeDates(body, EMPLOYEE_DATES);
      const input = insertEmployeeSchema.parse({ ...body, userId: (req.session as any).userId, siteId });
      const employee = await storage.createEmployee(input);
      res.status(201).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      console.error("Employee save failed:", err);
      res.status(400).json({ message: "Invalid employee data" });
    }
  });

  app.patch("/api/employees/:id", isAuthenticated, async (req, res) => {
    if (!(await requireResourceRole(req, res, async () => (await storage.getEmployee(Number(req.params.id)))?.siteId, ["owner", "manager"]))) return;
    let body = sanitizeNumeric(req.body, EMPLOYEE_NUMERIC);
    body = sanitizeInteger(body, EMPLOYEE_INTEGER);
    body = sanitizeDates(body, EMPLOYEE_DATES);
    const updated = await storage.updateEmployee(Number(req.params.id), body);
    if (!updated) return res.status(404).json({ message: "Employee not found" });
    res.json(updated);
  });

  app.delete("/api/employees/:id", isAuthenticated, async (req, res) => {
    if (!(await requireResourceRole(req, res, async () => (await storage.getEmployee(Number(req.params.id)))?.siteId, ["owner", "manager"]))) return;
    const deleted = await storage.deleteEmployee(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Employee not found" });
    res.json({ success: true });
  });

  app.post("/api/employees/:id/attendance", isAuthenticated, async (req, res) => {
    const employeeId = Number(req.params.id);
    if (!(await canAccessEmployee(req, employeeId))) return res.status(403).json({ message: "Forbidden" });
    const employee = await storage.getEmployee(employeeId);
    if (!employee?.siteId) return res.status(404).json({ message: "Employee not found" });
    const attendance = await storage.createEmployeeAttendance({
      employeeId,
      siteId: employee.siteId,
      workDate: req.body.workDate ? new Date(req.body.workDate) : new Date(),
      checkInAt: req.body.checkInAt ? new Date(req.body.checkInAt) : null,
      checkOutAt: req.body.checkOutAt ? new Date(req.body.checkOutAt) : null,
      status: req.body.status || "present",
    } as any);
    res.status(201).json(attendance);
  });

  app.get("/api/plans", async (req, res) => {
    const plans = await storage.getPlans();
    res.json(plans);
  });

  app.get("/api/subscriptions/current", isAuthenticated, async (req, res) => {
    if (!(await requireOwnerOrganisation(req, res))) return;
    const sub = await storage.getUserSubscription((req.session as any).userId);
    res.json(sub);
  });

  app.post("/api/subscriptions/pay", isAuthenticated, async (req, res) => {
    if (!(await requireOwnerOrganisation(req, res))) return;
    const { planId, method } = req.body;
    if (!planId || !method) return res.status(400).json({ message: "planId and method are required" });
    try {
      const sub = await storage.createSubscription((req.session as any).userId, planId, method);
      res.status(201).json(sub);
    } catch (err) {
      res.status(400).json({ message: "Failed to create subscription" });
    }
  });

  app.get("/api/analytics/dashboard", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId as string;
    const sessionSiteId = (req.session as any).currentSiteId;
    // If session has no currentSiteId, look it up from the user record
    let siteId: number | null | undefined = sessionSiteId;
    if (sessionSiteId === undefined) {
      const { db } = await import("./db");
      const { users } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");
      const userRow = await db.select({ currentSiteId: users.currentSiteId }).from(users).where(eq(users.id, userId)).limit(1);
      siteId = userRow[0]?.currentSiteId ?? null;
    }
    const allSites = siteId === null || siteId === undefined;
    const data = await storage.getDashboardData(allSites ? scopedSites(req) : (siteId as number), allSites);
    res.json(data);
  });

  app.get("/api/analytics/kpis", isAuthenticated, async (req: any, res) => {
    const period = (req.query.period as string) || "month";
    const data = await storage.getAnalyticsKpis(period, scopedSites(req));
    res.json(data);
  });

  app.get("/api/analytics/decision-cockpit", isAuthenticated, async (req: any, res) => {
    const period = z.enum(["day", "week", "month", "year"]).catch("month").parse(req.query.period);
    const siteIds = scopedSites(req);
    if (!siteIds.length) return res.json({ period, metrics: {}, stages: [], confidence: { level: "insufficient", score: 0 } });

    const now = new Date();
    const start = period === "day"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : period === "week"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        : period === "year"
          ? new Date(now.getFullYear(), 0, 1)
          : new Date(now.getFullYear(), now.getMonth(), 1);
    const durationMs = Math.max(86400000, now.getTime() - start.getTime());
    const previousStart = new Date(start.getTime() - durationMs);

    const organisationSiteIds = orgScopedSites(req);
    const [ordersResult, previousResult, machineResult, teamResult, qualityResult, forecastResult, benchmarkResult] = await Promise.all([
      pool.query(
        `WITH scoped_orders AS (
           SELECT o.*,
             COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0) AS paid
           FROM orders o
           WHERE o.site_id = ANY($1::int[]) AND o.entry_date >= $2 AND o.entry_date <= $3
         ), scoped_expenses AS (
           SELECT amount, LOWER(COALESCE(category, '')) AS category
           FROM expenditures
           WHERE site_id = ANY($1::int[]) AND date >= $2 AND date <= $3
         )
         SELECT
           COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS total_orders,
           COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_orders,
           (SELECT COUNT(*) FROM orders live
             WHERE live.site_id = ANY($1::int[]) AND live.status NOT IN ('cancelled','delivered')
               AND live.pickup_date IS NOT NULL AND live.pickup_date < $3)::int AS delayed_orders,
           COALESCE(SUM(total_amount) FILTER (WHERE status <> 'cancelled'), 0)::text AS order_value,
           COALESCE((SELECT SUM(GREATEST(live.total_amount - COALESCE((
             SELECT SUM(lp.amount) FROM payments lp WHERE lp.order_id = live.id
           ), 0), 0)) FROM orders live
             WHERE live.site_id = ANY($1::int[]) AND live.status <> 'cancelled'), 0)::text AS outstanding,
           COALESCE((SELECT SUM(p.amount) FROM payments p JOIN orders po ON po.id = p.order_id
             WHERE po.site_id = ANY($1::int[]) AND p.date >= $2 AND p.date <= $3 AND po.status <> 'cancelled'), 0)::text AS revenue,
           COALESCE((SELECT SUM(amount) FROM scoped_expenses), 0)::text AS expenses,
           COALESCE((SELECT SUM(amount) FROM scoped_expenses WHERE category IN ('loyer','rent','salaire','salary','salaires')), 0)::text AS fixed_costs,
           COALESCE((SELECT SUM(amount) FROM scoped_expenses WHERE category NOT IN ('loyer','rent','salaire','salary','salaires')), 0)::text AS variable_costs,
           COALESCE(SUM(discount_amount) FILTER (WHERE status <> 'cancelled'), 0)::text AS discounts,
           (SELECT COUNT(*) FROM orders live WHERE live.site_id = ANY($1::int[]) AND live.status = 'received')::int AS received,
           (SELECT COUNT(*) FROM orders live WHERE live.site_id = ANY($1::int[]) AND live.status IN ('washing','stain_treatment'))::int AS washing,
           (SELECT COUNT(*) FROM orders live WHERE live.site_id = ANY($1::int[]) AND live.status = 'drying')::int AS drying,
           (SELECT COUNT(*) FROM orders live WHERE live.site_id = ANY($1::int[]) AND live.status = 'ironing')::int AS ironing,
           (SELECT COUNT(*) FROM orders live WHERE live.site_id = ANY($1::int[]) AND live.status = 'ready')::int AS ready,
           (SELECT COUNT(*) FROM orders live WHERE live.site_id = ANY($1::int[]) AND live.status = 'delivered'
             AND live.delivered_at >= $2 AND live.delivered_at <= $3)::int AS delivered,
           COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
           COUNT(*) FILTER (WHERE pickup_date IS NOT NULL)::int AS promised_date_coverage
         FROM scoped_orders`,
        [siteIds, start, now],
      ),
      pool.query(
        `SELECT
           COALESCE((SELECT SUM(p.amount) FROM payments p JOIN orders o ON o.id = p.order_id
             WHERE o.site_id = ANY($1::int[]) AND p.date >= $2 AND p.date < $3 AND o.status <> 'cancelled'), 0)::text AS revenue,
           COALESCE((SELECT SUM(e.amount) FROM expenditures e
             WHERE e.site_id = ANY($1::int[]) AND e.date >= $2 AND e.date < $3), 0)::text AS expenses,
           (SELECT COUNT(*) FROM orders o
             WHERE o.site_id = ANY($1::int[]) AND o.entry_date >= $2 AND o.entry_date < $3 AND o.status <> 'cancelled')::int AS orders`,
        [siteIds, previousStart, start],
      ),
      pool.query(
        `SELECT
           COUNT(mu.id)::int AS cycles,
           COUNT(*) FILTER (WHERE COALESCE(mu.weight_processed, 0) > 0)::int AS weighted_cycles,
           COALESCE(SUM(mu.weight_processed), 0)::text AS weight,
           COALESCE(SUM(mu.cycle_duration_minutes), 0)::int AS operating_minutes,
           COALESCE(SUM(m.capacity_kg), 0)::text AS cycle_capacity,
           (SELECT COUNT(*) FROM machines m2 WHERE m2.site_id = ANY($1::int[]) AND m2.status = 'active')::int AS active_machines
         FROM machine_usage mu
         JOIN machines m ON m.id = mu.machine_id
         WHERE mu.site_id = ANY($1::int[]) AND mu.usage_date >= $2 AND mu.usage_date <= $3`,
        [siteIds, start, now],
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM employees e WHERE e.site_id = ANY($1::int[]) AND e.status = 'active')::int AS active_employees,
           COUNT(*) FILTER (WHERE ea.action_type = 'order_delivered')::int AS completed_actions,
           COALESCE(SUM(ea.weight_kg), 0)::text AS tracked_weight,
           COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (att.check_out_at - att.check_in_at)) / 3600)
             FROM employee_attendance att
             WHERE att.site_id = ANY($1::int[]) AND att.work_date >= $2 AND att.work_date <= $3
               AND att.check_in_at IS NOT NULL AND att.check_out_at IS NOT NULL), 0)::float8 AS paid_hours
         FROM employee_activities ea
         WHERE ea.site_id = ANY($1::int[]) AND ea.action_date >= $2 AND ea.action_date <= $3`,
        [siteIds, start, now],
      ),
      pool.query(
        `SELECT COUNT(gi.id)::int AS returned_items
         FROM garment_items gi
         JOIN orders o ON o.id = gi.order_id
         WHERE o.site_id = ANY($1::int[]) AND gi.returned_at >= $2 AND gi.returned_at <= $3`,
        [siteIds, start, now],
      ),
      pool.query(
        `SELECT
           DATE(o.entry_date) AS business_date,
           EXTRACT(ISODOW FROM o.entry_date)::int AS weekday,
           COUNT(*) FILTER (WHERE o.status <> 'cancelled')::int AS orders,
           COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'cancelled'), 0)::text AS order_value
         FROM orders o
         WHERE o.site_id = ANY($1::int[])
           AND o.entry_date >= $2::timestamp - INTERVAL '56 days'
           AND o.entry_date < $2::timestamp
         GROUP BY DATE(o.entry_date), EXTRACT(ISODOW FROM o.entry_date)
         ORDER BY business_date`,
        [siteIds, now],
      ),
      pool.query(
        `SELECT
           s.id AS site_id,
           s.name AS site_name,
           COUNT(o.id) FILTER (WHERE o.status <> 'cancelled')::int AS orders,
           COUNT(o.id) FILTER (WHERE o.status = 'delivered')::int AS delivered_orders,
           COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'cancelled'), 0)::text AS order_value,
           COALESCE((SELECT SUM(p.amount)
             FROM payments p
             JOIN orders po ON po.id = p.order_id
             WHERE po.site_id = s.id AND p.date >= $2 AND p.date <= $3 AND po.status <> 'cancelled'), 0)::text AS revenue,
           COALESCE((SELECT SUM(e.amount)
             FROM expenditures e
             WHERE e.site_id = s.id AND e.date >= $2 AND e.date <= $3), 0)::text AS expenses
         FROM sites s
         LEFT JOIN orders o ON o.site_id = s.id AND o.entry_date >= $2 AND o.entry_date <= $3
         WHERE s.id = ANY($1::int[]) AND s.is_active = TRUE
         GROUP BY s.id, s.name
         ORDER BY s.name`,
        [organisationSiteIds, start, now],
      ),
    ]);

    const current = ordersResult.rows[0];
    const previous = previousResult.rows[0];
    const machine = machineResult.rows[0];
    const team = teamResult.rows[0];
    const quality = qualityResult.rows[0];
    const number = (value: unknown) => Number(value || 0);
    const delta = (currentValue: number, previousValue: number) =>
      previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : null;

    const revenue = number(current.revenue);
    const expenses = number(current.expenses);
    const fixedCosts = number(current.fixed_costs);
    const variableCosts = number(current.variable_costs);
    const contribution = revenue - variableCosts;
    const contributionMarginRatio = revenue > 0 ? contribution / revenue : 0;
    const breakEvenRevenue = fixedCosts > 0 && contributionMarginRatio > 0 ? fixedCosts / contributionMarginRatio : null;
    const totalOrders = number(current.total_orders);
    const loadEfficiency = number(machine.cycle_capacity) > 0 ? (number(machine.weight) / number(machine.cycle_capacity)) * 100 : null;
    const productivityPerHour = number(team.paid_hours) > 0 ? number(team.completed_actions) / number(team.paid_hours) : null;
    const qualityIncidents = number(quality.returned_items) + number(current.cancelled);
    const qualityRate = totalOrders > 0 ? Math.max(0, 100 - (qualityIncidents / totalOrders) * 100) : null;

    const coverageSignals = [
      totalOrders > 0,
      number(current.promised_date_coverage) >= Math.max(1, totalOrders * 0.7),
      number(machine.cycles) > 0 && number(machine.weighted_cycles) >= number(machine.cycles) * 0.7,
      number(team.paid_hours) > 0,
      expenses > 0,
    ];
    const confidenceScore = Math.round((coverageSignals.filter(Boolean).length / coverageSignals.length) * 100);
    const confidenceLevel = confidenceScore >= 80 ? "high" : confidenceScore >= 40 ? "partial" : "insufficient";
    const forecastHistory = forecastResult.rows.map((row) => ({
      date: String(row.business_date),
      weekday: number(row.weekday),
      orders: number(row.orders),
      orderValue: number(row.order_value),
    }));
    const recentCutoff = new Date(now.getTime() - 14 * 86400000);
    const earlierCutoff = new Date(now.getTime() - 28 * 86400000);
    const recentOrders = forecastHistory
      .filter((row) => new Date(row.date) >= recentCutoff)
      .reduce((sum, row) => sum + row.orders, 0);
    const earlierOrders = forecastHistory
      .filter((row) => new Date(row.date) >= earlierCutoff && new Date(row.date) < recentCutoff)
      .reduce((sum, row) => sum + row.orders, 0);
    const trendFactor = earlierOrders > 0 ? Math.min(1.3, Math.max(0.7, recentOrders / earlierOrders)) : 1;
    const forecast = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index + 1);
      const weekday = date.getDay() === 0 ? 7 : date.getDay();
      const comparable = forecastHistory.filter((row) => row.weekday === weekday);
      const predictedOrders = comparable.length
        ? Math.max(0, Math.round((comparable.reduce((sum, row) => sum + row.orders, 0) / comparable.length) * trendFactor))
        : null;
      const averageOrderValue = comparable.reduce((sum, row) => sum + row.orderValue, 0)
        / Math.max(1, comparable.reduce((sum, row) => sum + row.orders, 0));
      return {
        date: date.toISOString().slice(0, 10),
        orders: predictedOrders,
        revenue: predictedOrders == null ? null : Math.round(predictedOrders * averageOrderValue),
      };
    });
    const forecastCoverageDays = forecastHistory.filter((row) => row.orders > 0).length;
    const siteBenchmarks = benchmarkResult.rows.map((row) => {
      const siteRevenue = number(row.revenue);
      const siteExpenses = number(row.expenses);
      const siteOrders = number(row.orders);
      return {
        siteId: number(row.site_id),
        siteName: row.site_name,
        orders: siteOrders,
        deliveredOrders: number(row.delivered_orders),
        revenue: siteRevenue,
        expenses: siteExpenses,
        profit: siteRevenue - siteExpenses,
        marginPct: siteRevenue > 0 ? ((siteRevenue - siteExpenses) / siteRevenue) * 100 : null,
        averageOrderValue: siteOrders > 0 ? number(row.order_value) / siteOrders : null,
        completionRate: siteOrders > 0 ? (number(row.delivered_orders) / siteOrders) * 100 : null,
      };
    });
    const projectedOrders = forecast.reduce((sum, day) => sum + number(day.orders), 0);
    const forecastAverage = projectedOrders / Math.max(1, forecast.filter((day) => day.orders != null).length);
    const historyActiveDays = forecastHistory.filter((row) => row.orders > 0);
    const historicalDailyAverage = historyActiveDays.length
      ? historyActiveDays.reduce((sum, row) => sum + row.orders, 0) / historyActiveDays.length
      : 0;
    const demandSpikeDays = forecast
      .filter((day) => day.orders != null && historicalDailyAverage > 0 && number(day.orders) >= historicalDailyAverage * 1.25)
      .map((day) => day.date);
    const outstandingRatio = number(current.order_value) > 0
      ? (number(current.outstanding) / number(current.order_value)) * 100
      : null;
    const discountRatio = number(current.order_value) > 0
      ? (number(current.discounts) / number(current.order_value)) * 100
      : null;
    const marginPct = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : null;
    const predictiveAlerts: Array<{
      code: string;
      severity: "high" | "medium" | "low";
      value: number;
      evidence: Record<string, number | string | string[] | null>;
      href: string;
    }> = [];

    if (number(current.delayed_orders) > 0) {
      predictiveAlerts.push({
        code: "delivery_risk",
        severity: "high",
        value: number(current.delayed_orders),
        evidence: { delayedOrders: number(current.delayed_orders) },
        href: "/orders?status=active",
      });
    }
    if (forecastCoverageDays >= 14 && demandSpikeDays.length > 0) {
      predictiveAlerts.push({
        code: "demand_spike",
        severity: demandSpikeDays.length >= 3 ? "high" : "medium",
        value: demandSpikeDays.length,
        evidence: {
          days: demandSpikeDays,
          projectedDailyAverage: Math.round(forecastAverage * 10) / 10,
          historicalDailyAverage: Math.round(historicalDailyAverage * 10) / 10,
        },
        href: "/orders?period=week",
      });
    }
    if (outstandingRatio != null && outstandingRatio >= 25) {
      predictiveAlerts.push({
        code: "collection_pressure",
        severity: outstandingRatio >= 50 ? "high" : "medium",
        value: number(current.outstanding),
        evidence: { outstandingRatio: Math.round(outstandingRatio * 10) / 10 },
        href: "/payments",
      });
    }
    if (marginPct != null && marginPct < 10) {
      predictiveAlerts.push({
        code: "margin_pressure",
        severity: marginPct < 0 ? "high" : "medium",
        value: Math.round(marginPct * 10) / 10,
        evidence: { marginPct: Math.round(marginPct * 10) / 10, revenue, expenses },
        href: "/expenses",
      });
    }
    if (discountRatio != null && discountRatio >= 5) {
      predictiveAlerts.push({
        code: "discount_leakage",
        severity: discountRatio >= 10 ? "high" : "medium",
        value: number(current.discounts),
        evidence: { discountRatio: Math.round(discountRatio * 10) / 10 },
        href: "/orders",
      });
    }
    if (loadEfficiency != null && number(machine.cycles) >= 3 && loadEfficiency < 60) {
      predictiveAlerts.push({
        code: "machine_underload",
        severity: loadEfficiency < 40 ? "high" : "medium",
        value: Math.round(loadEfficiency * 10) / 10,
        evidence: { loadEfficiency: Math.round(loadEfficiency * 10) / 10, cycles: number(machine.cycles) },
        href: "/machines",
      });
    }
    if (qualityRate != null && totalOrders >= 5 && qualityRate < 95) {
      predictiveAlerts.push({
        code: "quality_risk",
        severity: qualityRate < 90 ? "high" : "medium",
        value: Math.round(qualityRate * 10) / 10,
        evidence: { qualityRate: Math.round(qualityRate * 10) / 10, incidents: qualityIncidents },
        href: "/orders",
      });
    }
    predictiveAlerts.sort((a, b) => {
      const rank = { high: 3, medium: 2, low: 1 };
      return rank[b.severity] - rank[a.severity];
    });

    res.json({
      period,
      range: { start, end: now },
      metrics: {
        revenue,
        expenses,
        profit: revenue - expenses,
        marginPct,
        orders: totalOrders,
        deliveredOrders: number(current.delivered_orders),
        delayedOrders: number(current.delayed_orders),
        outstandingPayments: number(current.outstanding),
        orderValue: number(current.order_value),
        discounts: number(current.discounts),
        revenueDeltaPct: delta(revenue, number(previous.revenue)),
        expenseDeltaPct: delta(expenses, number(previous.expenses)),
        orderDeltaPct: delta(totalOrders, number(previous.orders)),
        fixedCosts,
        variableCosts,
        contributionMarginRatio: contributionMarginRatio > 0 ? contributionMarginRatio * 100 : null,
        breakEvenRevenue,
        machineCycles: number(machine.cycles),
        machineWeight: number(machine.weight),
        machineOperatingMinutes: number(machine.operating_minutes),
        activeMachines: number(machine.active_machines),
        machineLoadEfficiency: loadEfficiency,
        activeEmployees: number(team.active_employees),
        paidHours: number(team.paid_hours),
        completedActions: number(team.completed_actions),
        productivityPerHour,
        returnedItems: number(quality.returned_items),
        qualityRate,
      },
      stages: [
        { key: "received", count: number(current.received) },
        { key: "washing", count: number(current.washing) },
        { key: "drying", count: number(current.drying) },
        { key: "ironing", count: number(current.ironing) },
        { key: "ready", count: number(current.ready) },
        { key: "delivered", count: number(current.delivered) },
      ],
      forecast: {
        days: forecast,
        coverageDays: forecastCoverageDays,
        confidence: forecastCoverageDays >= 28 ? "high" : forecastCoverageDays >= 14 ? "partial" : "insufficient",
        method: "weekday_average_56d_with_14d_trend",
      },
      siteBenchmarks,
      predictiveIntelligence: {
        alerts: predictiveAlerts,
        generatedAt: now,
        forecastEligible: forecastCoverageDays >= 14,
        signalsEvaluated: 7,
        methodology: "explainable_threshold_rules_v1",
      },
      confidence: {
        level: confidenceLevel,
        score: confidenceScore,
        coverage: {
          promisedDates: totalOrders > 0 ? (number(current.promised_date_coverage) / totalOrders) * 100 : 0,
          machineWeights: number(machine.cycles) > 0 ? (number(machine.weighted_cycles) / number(machine.cycles)) * 100 : 0,
          attendanceHours: number(team.paid_hours) > 0,
          expenseRecords: expenses > 0,
        },
      },
    });
  });

  app.get("/api/analytics/waste", isAuthenticated, async (req: any, res) => {
    const alerts = await storage.getWasteAlerts(scopedSites(req));
    res.json(alerts);
  });

  app.get("/api/analytics/performance-score", isAuthenticated, async (req: any, res) => {
    const score = await storage.getPerformanceScore(scopedSites(req));
    res.json(score);
  });

  app.get("/api/analytics/production-delays", isAuthenticated, async (req: any, res) => {
    const delays = await storage.getProductionDelays(scopedSites(req));
    res.json(delays);
  });

  app.get("/api/analytics/customer-behavior", isAuthenticated, async (req: any, res) => {
    const period = (req.query.period as string) || "month";
    const data = await storage.getCustomerBehaviorAnalytics(period, scopedSites(req));
    res.json(data);
  });

  app.get("/api/analytics/storage-occupancy", isAuthenticated, async (req: any, res) => {
    const data = await storage.getStorageOccupancyAlerts(scopedSites(req));
    res.json(data);
  });

  app.get("/api/analytics/advanced", isAuthenticated, async (req: any, res) => {
    const planSlug = await effectivePlanSlug(req);
    if (!["business", "enterprise"].includes(planSlug)) {
      return res.status(403).json({ message: "Business plan required for advanced analytics" });
    }
    const period = (req.query.period as string) || "month";
    const data = await storage.getAdvancedAnalytics(period, scopedSites(req), planSlug);
    res.json(data);
  });

  // ─── Business Settings (Prompt A) ───────────────────────────────────────────

  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const settingsOwnerId = await effectiveSettingsOwnerId(req);
      const settings = await storage.getSettings(settingsOwnerId);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const organisation = await requireOwnerOrganisation(req, res);
      if (!organisation) return;
      const userId = (req.session as any).userId;
      const parsed = insertBusinessSettingsSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid settings", errors: parsed.error.flatten() });
      }
      const settings = await storage.upsertSettings(userId, parsed.data);
      if (parsed.data.loyaltyProgramEnabled === true) {
        const { db } = await import("./db");
        const { loyaltyProgram } = await import("@shared/schema");
        await db.insert(loyaltyProgram).values({ organisationId: organisation.id })
          .onConflictDoNothing();
      }
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  // ─── Multi-Site Routes (Prompt B) ────────────────────────────────────────────

  app.get("/api/sites", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const org = await storage.getOrganisationByOwner(userId);
      if (!org) return res.json([]);
      const siteList = await storage.getSites(org.id);
      res.json(siteList);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sites" });
    }
  });

  app.post("/api/sites", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      let org = await storage.getOrganisationByOwner(userId);
      if (!org) {
        return res.status(403).json({ message: "Only organisation owners can create sites" });
      }
      const site = await storage.createSite(org.id, req.body);
      res.status(201).json(site);
    } catch (err) {
      res.status(500).json({ message: "Failed to create site" });
    }
  });

  app.put("/api/sites/:id", isAuthenticated, async (req, res) => {
    try {
      if (!(await canManageSite(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
      const raw = pickSiteUpdate(req.body);
      if (!raw.name?.trim()) return res.status(400).json({ message: "Site name is required" });
      const data = {
        name: raw.name.trim(),
        address: raw.address ?? "",
        city: raw.city ?? "",
        phone: raw.phone ?? "",
      };
      const updated = await storage.updateSite(Number(req.params.id), data);
      if (!updated) return res.status(404).json({ message: "Site not found" });
      res.json(updated);
    } catch (err: any) {
      const msg = err?.message || (typeof err === "string" ? err : JSON.stringify(err)) || "Failed to update site";
      console.error("Failed to update site:", msg, err?.stack ?? "");
      res.status(500).json({ message: msg });
    }
  });

  app.delete("/api/sites/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const org = await storage.getOrganisationByOwner(userId);
      if (!(await canManageSite(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
      if (org) {
        const siteList = await storage.getSites(org.id);
        if (siteList.length <= 1) return res.status(400).json({ message: "Cannot delete your only site" });
      }
      const deleted = await storage.deleteSite(Number(req.params.id));
      if (!deleted) return res.status(404).json({ message: "Site not found" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete site" });
    }
  });

  app.get("/api/sites/:id/members", isAuthenticated, async (req, res) => {
    try {
      if (!(await canManageSite(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
      const members = await storage.getSiteMembers(Number(req.params.id));
      res.json(members);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.patch("/api/sites/:id/members/:userId/role", isAuthenticated, async (req, res) => {
    try {
      if (!(await canManageSite(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateSiteMemberRole(Number(req.params.id), req.params.userId as string, req.body.role);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/sites/:id/members/:userId", isAuthenticated, async (req, res) => {
    try {
      if (!(await canManageSite(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
      await storage.removeSiteMember(Number(req.params.id), req.params.userId as string);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // Invitations
  app.post("/api/invitations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const org = await requireOwnerOrganisation(req, res);
      if (!org) return;
      const { siteId, identifier, role } = req.body;
      if (!siteId || !identifier || !role) return res.status(400).json({ message: "siteId, identifier and role are required" });
      if (!(await canManageSite(req, Number(siteId)))) return res.status(403).json({ message: "Forbidden" });
      const inv = await storage.createInvitation({ siteId: Number(siteId), organisationId: org.id, invitedBy: userId, identifier, role });
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      res.status(201).json({ ...inv, invitationLink: `${baseUrl}/join/${inv.token}` });
    } catch (err) {
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get("/api/invitations/pending", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const org = await requireOwnerOrganisation(req, res);
      if (!org) return;
      const invitations = await storage.getPendingInvitations(org.id);
      res.json(invitations);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.delete("/api/invitations/:id", isAuthenticated, async (req, res) => {
    try {
      if (!(await requireOwnerOrganisation(req, res))) return;
      await storage.revokeInvitation(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to revoke invitation" });
    }
  });

  app.get("/api/invitations/join/:token", async (req, res) => {
    try {
      const inv = await storage.getInvitationByToken(req.params.token);
      if (!inv) return res.status(404).json({ message: "Invitation not found or expired" });
      res.json(inv);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch invitation" });
    }
  });

  app.post("/api/invitations/accept/:token", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const result = await storage.acceptInvitation(req.params.token as string, userId);
      if (!result) return res.status(400).json({ message: "Invalid, expired, or already accepted invitation" });
      (req.session as any).currentSiteId = result.siteId;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );
      res.json({ success: true, invitation: result });
    } catch (err) {
      if (err instanceof Error && err.message === "OWNER_ACCOUNT_CANNOT_ACCEPT_STAFF_INVITATION") {
        return res.status(409).json({ message: "Owner accounts cannot be converted to staff. Use a different email for staff access." });
      }
      if (err instanceof Error && err.message === "INVITATION_IDENTIFIER_MISMATCH") {
        return res.status(403).json({ message: "This invitation is for a different email or phone number." });
      }
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Switch site
  app.post("/api/auth/switch-site", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { siteId } = req.body;
      const resolvedSiteId = siteId != null ? Number(siteId) : null;
      if (resolvedSiteId !== null && !(await canAccessSite(req, resolvedSiteId))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.switchSite(userId, resolvedSiteId);
      (req.session as any).currentSiteId = resolvedSiteId;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to switch site" });
    }
  });

  return httpServer;
}
