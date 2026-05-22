import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas, createOrderWithItemsSchema } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerCalculatorRoutes } from "./lib/calculator-routes";
import { registerDiagnosticRoutes } from "./lib/diagnostic-routes";

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
  seedDatabase().catch(console.error);
  storage.backfillNullSiteIds().catch(console.error);

  const VALID_PIPELINE_STATUSES = ["received", "washing", "stain_treatment", "drying", "ironing", "ready", "delivered", "cancelled", "cancellation_requested"];

  app.get(api.customers.list.path, isAuthenticated, async (req: any, res) => {
    const customers = await storage.getCustomersBySite(req.siteId);
    res.json(customers);
  });

  app.get(api.customers.get.path, isAuthenticated, async (req, res) => {
    const customer = await storage.getCustomer(Number(req.params.id));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
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
    const updated = await storage.updateCustomer(Number(req.params.id), input);
    if (!updated) return res.status(404).json({ message: "Customer not found" });
    res.json(updated);
  });

  app.get("/api/customers/:id/orders", isAuthenticated, async (req, res) => {
    const customer = await storage.getCustomer(Number(req.params.id));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    const customerOrders = await storage.getCustomerOrders(Number(req.params.id));
    res.json(customerOrders);
  });

  app.get(api.services.list.path, isAuthenticated, async (req, res) => {
    const services = await storage.getServices();
    res.json(services);
  });

  app.post(api.services.create.path, isAuthenticated, async (req, res) => {
    const input = api.services.create.input.parse(req.body);
    const service = await storage.createService(input);
    res.status(201).json(service);
  });

  app.patch(api.services.update.path, isAuthenticated, async (req, res) => {
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

  app.get("/api/orders/pending-cancellations", isAuthenticated, async (req, res) => {
    const pending = await storage.getPendingCancellations();
    res.json(pending);
  });

  app.get(api.orders.list.path, isAuthenticated, async (req: any, res) => {
    const orders = await storage.getOrdersBySite(req.siteId);
    res.json(orders);
  });

  app.get(api.orders.get.path, isAuthenticated, async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Order not found" });
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
      const discountPct = Number(orderData.discountPct || 0);
      const discountFixed = Number(orderData.discount || 0);
      const discountAmount = discountPct > 0 ? (subtotal * discountPct / 100) : discountFixed;
      const totalAmount = Math.max(0, subtotal - discountAmount);
      const order = await storage.createOrder({
        ...orderData,
        status: "received",
        totalAmount: totalAmount.toString(),
        originalPrice: subtotal.toString(),
        discountAmount: discountAmount.toString(),
        discountPct: discountPct > 0 ? discountPct.toString() : "0",
        discount: discountAmount.toString(),
        entryDate: orderData.entryDate ? new Date(orderData.entryDate) : new Date(),
        pickupDate: orderData.pickupDate ? new Date(orderData.pickupDate) : null,
        siteId: (req as any).siteId,
      }, items, garments);
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
    const updated = await storage.updateOrderStatus(Number(req.params.id), input.status, input.paymentStatus, userId);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  app.get("/api/orders/:id/status-history", isAuthenticated, async (req, res) => {
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
    const updated = await storage.requestCancellation(Number(req.params.id), reason, userId);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  app.post("/api/orders/:id/approve-cancellation", isAuthenticated, async (req, res) => {
    const userId = (req.session as any)?.userId || "unknown";
    const updated = await storage.approveCancellation(Number(req.params.id), userId);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  app.post("/api/orders/:id/reject-cancellation", isAuthenticated, async (req, res) => {
    const { note } = req.body;
    const userId = (req.session as any)?.userId || "unknown";
    const updated = await storage.rejectCancellation(Number(req.params.id), userId, note || "");
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  app.patch("/api/orders/:id/deliver", isAuthenticated, async (req, res) => {
    const { deliveredAt } = req.body;
    const date = deliveredAt ? new Date(deliveredAt) : new Date();
    const updated = await storage.markDelivered(Number(req.params.id), date);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  app.post(api.payments.create.path, isAuthenticated, async (req, res) => {
    const input = api.payments.create.input.parse(req.body);
    const payment = await storage.createPayment(input);
    res.status(201).json(payment);
  });

  app.get(api.payments.listByOrder.path, isAuthenticated, async (req, res) => {
    const payments = await storage.getPaymentsByOrder(Number(req.params.id));
    res.json(payments);
  });

  app.get(api.expenditures.list.path, isAuthenticated, async (req: any, res) => {
    const expenditures = await storage.getExpendituresBySite(req.siteId);
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

  app.get(api.performance.get.path, isAuthenticated, async (req, res) => {
    const data = await storage.getPerformanceData();
    res.json(data);
  });

  app.get(api.reports.get.path, isAuthenticated, async (req, res) => {
    const { start, end } = req.query;
    const startDate = start ? new Date(start as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = end ? new Date(end as string) : new Date();
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    endDate.setHours(23, 59, 59, 999);
    const data = await storage.getReportData(startDate, endDate);
    res.json(data);
  });

  app.get(api.stats.get.path, isAuthenticated, async (req: any, res) => {
    const stats = await storage.getStatsBySite(req.siteId);
    res.json(stats);
  });

  app.get("/api/machines", isAuthenticated, async (req, res) => {
    const machines = await storage.getMachines((req.session as any).userId);
    res.json(machines);
  });

  app.post("/api/machines", isAuthenticated, async (req, res) => {
    try {
      const machine = await storage.createMachine({ ...req.body, userId: (req.session as any).userId });
      res.status(201).json(machine);
    } catch (err) {
      res.status(400).json({ message: "Invalid machine data" });
    }
  });

  app.patch("/api/machines/:id", isAuthenticated, async (req, res) => {
    const updated = await storage.updateMachine(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Machine not found" });
    res.json(updated);
  });

  app.delete("/api/machines/:id", isAuthenticated, async (req, res) => {
    const deleted = await storage.deleteMachine(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Machine not found" });
    res.json({ success: true });
  });

  app.get("/api/employees", isAuthenticated, async (req, res) => {
    const employees = await storage.getEmployees((req.session as any).userId);
    res.json(employees);
  });

  app.post("/api/employees", isAuthenticated, async (req, res) => {
    try {
      const employee = await storage.createEmployee({ ...req.body, userId: (req.session as any).userId });
      res.status(201).json(employee);
    } catch (err) {
      res.status(400).json({ message: "Invalid employee data" });
    }
  });

  app.patch("/api/employees/:id", isAuthenticated, async (req, res) => {
    const updated = await storage.updateEmployee(Number(req.params.id), req.body);
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
    const data = await storage.getDashboardData(allSites ? null : (siteId as number), allSites);
    res.json(data);
  });

  app.get("/api/analytics/kpis", isAuthenticated, async (req, res) => {
    const period = (req.query.period as string) || "month";
    const data = await storage.getAnalyticsKpis(period);
    res.json(data);
  });

  app.get("/api/analytics/waste", isAuthenticated, async (req, res) => {
    const alerts = await storage.getWasteAlerts();
    res.json(alerts);
  });

  app.get("/api/analytics/performance-score", isAuthenticated, async (req, res) => {
    const score = await storage.getPerformanceScore();
    res.json(score);
  });

  app.get("/api/analytics/production-delays", isAuthenticated, async (req, res) => {
    const delays = await storage.getProductionDelays();
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
      const members = await storage.getSiteMembers(Number(req.params.id));
      res.json(members);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.patch("/api/sites/:id/members/:userId/role", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateSiteMemberRole(Number(req.params.id), req.params.userId, req.body.role);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/sites/:id/members/:userId", isAuthenticated, async (req, res) => {
    try {
      await storage.removeSiteMember(Number(req.params.id), req.params.userId);
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
      const result = await storage.acceptInvitation(req.params.token, userId);
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
      await storage.switchSite(userId, resolvedSiteId);
      (req.session as any).currentSiteId = resolvedSiteId;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to switch site" });
    }
  });

  return httpServer;
}
