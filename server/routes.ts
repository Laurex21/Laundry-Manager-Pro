import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas, createOrderWithItemsSchema } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerCalculatorRoutes } from "./lib/calculator-routes";
import { registerDiagnosticRoutes } from "./lib/diagnostic-routes";
import { registerRentabiliteRoutes } from "./lib/rentabilite-routes";
import { insertEmployeeSchema, insertMachineSchema } from "@shared/schema";
import { parseLocalDateParam } from "./lib/reporting-date";

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

function scopedSites(req: any): number[] {
  return Array.isArray(req.siteScope) ? req.siteScope : [];
}

async function canAccessSite(req: any, siteId: number): Promise<boolean> {
  return Array.isArray(req.authorizedSiteIds) && req.authorizedSiteIds.includes(siteId);
}

async function canAccessOrder(req: any, orderId: number): Promise<boolean> {
  const order = await storage.getOrder(orderId);
  return !!order && order.siteId != null && (await canAccessSite(req, order.siteId));
}

async function canManageSite(req: any, siteId: number): Promise<boolean> {
  const userId = (req.session as any).userId;
  const org = await storage.getOrganisationByOwner(userId);
  const site = await storage.getSite(siteId);
  return !!org && !!site && site.organisationId === org.id;
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
  registerCalculatorRoutes(app);
  registerDiagnosticRoutes(app);
  registerRentabiliteRoutes(app);
  seedDatabase().catch(console.error);

  app.get("/api/public/stats", async (_req, res) => {
    try {
      const stats = await storage.getPublicStats();
      res.json(stats);
    } catch {
      res.json({ totalOrders: 0, totalCustomers: 0, totalTransactions: 0, totalLaundries: 0, totalGarments: 0 });
    }
  });

  const VALID_PIPELINE_STATUSES = ["received", "washing", "stain_treatment", "drying", "ironing", "ready", "delivered", "cancelled", "cancellation_requested"];

  app.get(api.customers.list.path, isAuthenticated, async (req: any, res) => {
    const customers = await storage.getCustomersBySite(scopedSites(req));
    res.json(customers);
  });

  app.get(api.customers.get.path, isAuthenticated, async (req, res) => {
    const customer = await storage.getCustomer(Number(req.params.id));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    if (customer.siteId == null || !(await canAccessSite(req, customer.siteId))) return res.status(403).json({ message: "Forbidden" });
    res.json(customer);
  });

  app.post(api.customers.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.customers.create.input.parse(req.body);
      const customer = await storage.createCustomer({ ...input, siteId: req.siteId });
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
    if (existing.siteId == null || !(await canAccessSite(req, existing.siteId))) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateCustomer(Number(req.params.id), input);
    if (!updated) return res.status(404).json({ message: "Customer not found" });
    res.json(updated);
  });

  app.get("/api/customers/:id/orders", isAuthenticated, async (req, res) => {
    const customer = await storage.getCustomer(Number(req.params.id));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    if (customer.siteId == null || !(await canAccessSite(req, customer.siteId))) return res.status(403).json({ message: "Forbidden" });
    const customerOrders = await storage.getCustomerOrders(Number(req.params.id));
    res.json(customerOrders);
  });

  app.get(api.services.list.path, isAuthenticated, async (req: any, res) => {
    let svcList = await storage.getServicesBySite(scopedSites(req));
    // Auto-seed default services for a brand-new site
    if (svcList.length === 0 && req.siteId != null) {
      await storage.createService({ name: "Lavage & Repassage", unit: "kg", price: "15.00", category: "washing", description: "Service de lavage et repassage standard", imageUrl: "", active: true, siteId: req.siteId } as any);
      await storage.createService({ name: "Nettoyage à sec (Costume)", unit: "piece", price: "150.00", category: "dry_cleaning", description: "Nettoyage à sec professionnel pour costumes", imageUrl: "", active: true, siteId: req.siteId } as any);
      await storage.createService({ name: "Repassage (Chemise)", unit: "piece", price: "25.00", category: "ironing", description: "Repassage à la vapeur", imageUrl: "", active: true, siteId: req.siteId } as any);
      svcList = await storage.getServicesBySite(req.siteId);
    }
    res.json(svcList);
  });

  app.post(api.services.create.path, isAuthenticated, async (req: any, res) => {
    const input = api.services.create.input.parse(req.body);
    const service = await storage.createService({ ...input, siteId: req.siteId } as any);
    res.status(201).json(service);
  });

  app.patch(api.services.update.path, isAuthenticated, async (req: any, res) => {
    const input = api.services.update.input.parse(req.body);
    const updated = await storage.updateService(Number(req.params.id), input);
    if (!updated) return res.status(404).json({ message: "Service not found" });
    res.json(updated);
  });

  app.delete(api.services.delete.path, isAuthenticated, async (req, res) => {
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
      const input = api.orders.create.input.parse(req.body);
      const { items, garmentItems: garments, ...orderData } = input;
      let subtotal = 0;
      const itemsWithPrices = await Promise.all(items.map(async (item) => {
        const service = await storage.getService(item.serviceId);
        if (!service) throw new Error(`Service ${item.serviceId} not found`);
        subtotal += Number(service.price) * item.quantity;
        return { ...item, priceAtOrder: service.price };
      }));
      const discountAmount = Number(orderData.discount || 0);
      const pickupCostAmount = Number(orderData.pickupCost || 0);
      const advanceAmount = Number(orderData.advancePayment || 0);
      const totalAmount = Math.max(0, subtotal - discountAmount + pickupCostAmount);
      const initialPaymentStatus = advanceAmount >= totalAmount ? "paid" : advanceAmount > 0 ? "partial" : "unpaid";
      const order = await storage.createOrder({
        ...orderData,
        status: "received",
        totalAmount: totalAmount.toString(),
        originalPrice: subtotal.toString(),
        discountAmount: discountAmount.toString(),
        discount: discountAmount.toString(),
        pickupCost: pickupCostAmount.toString(),
        paymentStatus: initialPaymentStatus,
        entryDate: orderData.entryDate ? new Date(orderData.entryDate) : new Date(),
        pickupDate: orderData.pickupDate ? new Date(orderData.pickupDate) : null,
        siteId: (req as any).siteId,
      } as any, items, garments);
      if (advanceAmount > 0) {
        await storage.createPayment({
          orderId: order.id,
          amount: advanceAmount.toString(),
          method: orderData.advancePaymentMethod || "Cash",
          isAdvance: true,
        } as any);
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
    res.json(updated);
  });

  app.get("/api/orders/:id/status-history", isAuthenticated, async (req, res) => {
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const history = await storage.getOrderStatusHistory(Number(req.params.id));
    res.json(history);
  });

  app.patch("/api/garment-items/:id/return", isAuthenticated, async (req, res) => {
    const { returnStage, returnNotes } = req.body;
    const updated = await storage.markGarmentReturned(Number(req.params.id), returnStage, returnNotes);
    if (!updated) return res.status(404).json({ message: "Garment item not found" });
    res.json(updated);
  });

  app.patch("/api/garment-items/:id/resolve", isAuthenticated, async (req, res) => {
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
    res.json(updated);
  });

  app.post("/api/orders/:id/approve-cancellation", isAuthenticated, async (req, res) => {
    const userId = (req.session as any)?.userId || "unknown";
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.approveCancellation(Number(req.params.id), userId);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  app.post("/api/orders/:id/reject-cancellation", isAuthenticated, async (req, res) => {
    const { note } = req.body;
    const userId = (req.session as any)?.userId || "unknown";
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.rejectCancellation(Number(req.params.id), userId, note || "");
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  app.patch("/api/orders/:id/deliver", isAuthenticated, async (req, res) => {
    const { deliveredAt } = req.body;
    const date = deliveredAt ? new Date(deliveredAt) : new Date();
    if (!(await canAccessOrder(req, Number(req.params.id)))) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.markDelivered(Number(req.params.id), date);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  app.post(api.payments.create.path, isAuthenticated, async (req, res) => {
    const input = api.payments.create.input.parse(req.body);
    if (!(await canAccessOrder(req, input.orderId))) return res.status(403).json({ message: "Forbidden" });
    const payment = await storage.createPayment(input);
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
    const input = api.expenditures.create.input.parse(req.body);
    const expenditure = await storage.createExpenditure({
      ...input,
      date: input.date ? new Date(input.date) : new Date(),
      siteId: req.siteId,
    });
    res.status(201).json(expenditure);
  });

  app.patch("/api/expenditures/:id", isAuthenticated, async (req, res) => {
    try {
      const body = { ...req.body };
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
    const data = await storage.getPerformanceData(scopedSites(req));
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

  const MACHINE_NUMERIC = ["capacityKg", "utilizationRate", "cycleCount", "totalKgProcessed"];

  app.post("/api/machines", isAuthenticated, async (req: any, res) => {
    try {
      const body = sanitizeNumeric(req.body, MACHINE_NUMERIC);
      if (!body.capacityKg) body.capacityKg = "0";
      const input = insertMachineSchema.parse({ ...body, userId: (req.session as any).userId, siteId: req.siteId });
      const machine = await storage.createMachine(input);
      res.status(201).json(machine);
    } catch (err) {
      res.status(400).json({ message: "Invalid machine data" });
    }
  });

  app.patch("/api/machines/:id", isAuthenticated, async (req, res) => {
    const body = sanitizeNumeric(req.body, MACHINE_NUMERIC);
    const updated = await storage.updateMachine(Number(req.params.id), body);
    if (!updated) return res.status(404).json({ message: "Machine not found" });
    res.json(updated);
  });

  app.delete("/api/machines/:id", isAuthenticated, async (req, res) => {
    const deleted = await storage.deleteMachine(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Machine not found" });
    res.json({ success: true });
  });

  app.get("/api/employees", isAuthenticated, async (req: any, res) => {
    const employees = await storage.getEmployees(scopedSites(req), (req.session as any).userId);
    res.json(employees);
  });

  const EMPLOYEE_NUMERIC = ["salary", "kgProcessed", "ordersHandled"];

  app.post("/api/employees", isAuthenticated, async (req: any, res) => {
    try {
      const body = sanitizeNumeric(req.body, EMPLOYEE_NUMERIC);
      const input = insertEmployeeSchema.parse({ ...body, userId: (req.session as any).userId, siteId: req.siteId });
      const employee = await storage.createEmployee(input);
      res.status(201).json(employee);
    } catch (err) {
      res.status(400).json({ message: "Invalid employee data" });
    }
  });

  app.patch("/api/employees/:id", isAuthenticated, async (req, res) => {
    const body = sanitizeNumeric(req.body, EMPLOYEE_NUMERIC);
    const updated = await storage.updateEmployee(Number(req.params.id), body);
    if (!updated) return res.status(404).json({ message: "Employee not found" });
    res.json(updated);
  });

  app.delete("/api/employees/:id", isAuthenticated, async (req, res) => {
    const deleted = await storage.deleteEmployee(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Employee not found" });
    res.json({ success: true });
  });

  app.get("/api/plans", async (req, res) => {
    const plans = await storage.getPlans();
    res.json(plans);
  });

  app.get("/api/subscriptions/current", isAuthenticated, async (req, res) => {
    const sub = await storage.getUserSubscription((req.session as any).userId);
    res.json(sub);
  });

  app.post("/api/subscriptions/pay", isAuthenticated, async (req, res) => {
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

  // ─── Business Settings (Prompt A) ───────────────────────────────────────────

  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const settings = await storage.getSettings(userId);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", isAuthenticated, async (req, res) => {
    try {
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
        const { organisation } = await storage.createOrganisationWithSite(userId, req.body.name, req.body.name);
        org = organisation;
        return res.status(201).json(org);
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
      const updated = await storage.updateSite(Number(req.params.id), req.body);
      if (!updated) return res.status(404).json({ message: "Site not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update site" });
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
      const org = await storage.getOrganisationByOwner(userId);
      if (!org) return res.status(400).json({ message: "No organisation found" });
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
      const org = await storage.getOrganisationByOwner(userId);
      if (!org) return res.json([]);
      const invitations = await storage.getPendingInvitations(org.id);
      res.json(invitations);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.delete("/api/invitations/:id", isAuthenticated, async (req, res) => {
    try {
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
