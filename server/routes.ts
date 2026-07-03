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
import { insertEmployeeSchema, insertMachineSchema } from "@shared/schema";
import { parseLocalDateParam } from "./lib/reporting-date";
import { startTemporalIntelligenceJob } from "./lib/temporal-intelligence";
import { renderHtmlToPdf } from "./lib/pdf-render";

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
  seedDatabase().catch(console.error);
  startTemporalIntelligenceJob();

  app.post("/api/receipts/render-pdf", isAuthenticated, async (req: any, res) => {
    try {
      const { html, filename } = req.body || {};
      if (typeof html !== "string" || !html.trim()) {
        return res.status(400).json({ message: "Missing html content" });
      }
      const pdfBuffer = await renderHtmlToPdf(html);
      const safeFilename = String(filename || "receipt.pdf").replace(/[^a-zA-Z0-9_\-.]/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("PDF render failed:", err);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

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
      const discountAmount = Number(orderData.discount || 0);
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
    const input = api.payments.create.input.parse(req.body);
    const order = await storage.getOrder(input.orderId);
    if (!order || order.siteId == null || !(await canAccessSite(req, order.siteId))) return res.status(403).json({ message: "Forbidden" });
    if (NON_PAYABLE_ORDER_STATUSES.has(order.status)) {
      return res.status(400).json({ message: "Payments cannot be registered for cancelled orders" });
    }
    const employee = await actorEmployee(req, order.siteId);
    const payment = await storage.createPayment({ ...input, collectedByEmployeeId: employee?.id ?? null } as any);
    await trackEmployeeActivity(req, {
      siteId: order.siteId,
      actionType: "payment_collected",
      orderId: input.orderId,
      amount: input.amount,
      metadata: { method: input.method, isAdvance: input.isAdvance ?? false },
    });
    res.status(201).json(payment);
  });

  app.get(api.payments.listByOrder.path, isAuthenticated, async (req, res) => {
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const payments = await storage.getPaymentsByOrder(Number(req.params.id));
    res.json(payments);
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
      if (!(await requireOwnerOrganisation(req, res))) return;
      const userId = (req.session as any).userId;
      const settings = await storage.upsertSettings(userId, req.body);
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
