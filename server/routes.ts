import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas, createOrderWithItemsSchema } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

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
  seedDatabase().catch(console.error);

  const VALID_PIPELINE_STATUSES = ["received", "washing", "stain_treatment", "drying", "ironing", "ready", "delivered", "cancelled"];

  app.get(api.customers.list.path, isAuthenticated, async (req, res) => {
    const customers = await storage.getCustomers();
    res.json(customers);
  });

  app.get(api.customers.get.path, isAuthenticated, async (req, res) => {
    const customer = await storage.getCustomer(Number(req.params.id));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  });

  app.post(api.customers.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.customers.create.input.parse(req.body);
      const customer = await storage.createCustomer(input);
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

  app.get(api.orders.list.path, isAuthenticated, async (req, res) => {
    const orders = await storage.getOrders();
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
      let totalAmount = 0;
      const itemsWithPrices = await Promise.all(items.map(async (item) => {
        const service = await storage.getService(item.serviceId);
        if (!service) throw new Error(`Service ${item.serviceId} not found`);
        totalAmount += Number(service.price) * item.quantity;
        return { ...item, priceAtOrder: service.price };
      }));
      const discount = Number(orderData.discount || 0);
      totalAmount = Math.max(0, totalAmount - discount);
      const order = await storage.createOrder({
        ...orderData,
        status: "received",
        totalAmount: totalAmount.toString(),
        entryDate: orderData.entryDate ? new Date(orderData.entryDate) : new Date(),
        pickupDate: orderData.pickupDate ? new Date(orderData.pickupDate) : null,
        discount: discount.toString(),
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

  app.post(api.payments.create.path, isAuthenticated, async (req, res) => {
    const input = api.payments.create.input.parse(req.body);
    const payment = await storage.createPayment(input);
    res.status(201).json(payment);
  });

  app.get(api.payments.listByOrder.path, isAuthenticated, async (req, res) => {
    const payments = await storage.getPaymentsByOrder(Number(req.params.id));
    res.json(payments);
  });

  app.get(api.expenditures.list.path, isAuthenticated, async (req, res) => {
    const expenditures = await storage.getExpenditures();
    res.json(expenditures);
  });

  app.post(api.expenditures.create.path, isAuthenticated, async (req, res) => {
    const input = api.expenditures.create.input.parse(req.body);
    const expenditure = await storage.createExpenditure(input);
    res.status(201).json(expenditure);
  });

  app.patch("/api/expenditures/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateExpenditure(Number(req.params.id), req.body);
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

  app.get(api.stats.get.path, isAuthenticated, async (req, res) => {
    const stats = await storage.getStats();
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
    const data = await storage.getDashboardData();
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

  return httpServer;
}
