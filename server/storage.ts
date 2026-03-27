import { db } from "./db";
import { 
  customers, services, orders, orderItems, payments, expenditures, garmentItems,
  machines, employees, plans, subscriptions, subscriptionPayments,
  type Customer, type InsertCustomer,
  type Service, type InsertService,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type Payment, type InsertPayment,
  type GarmentItem, type InsertGarmentItem,
  type Expenditure, type InsertExpenditure,
  type Machine, type InsertMachine,
  type Employee, type InsertEmployee,
  type Plan,
  type Subscription, type SubscriptionWithPlan,
  type OrderWithDetails
} from "@shared/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;

  getServices(): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: number): Promise<boolean>;

  getOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<OrderWithDetails | undefined>;
  createOrder(order: InsertOrder, items: { serviceId: number; quantity: number }[], garments?: { itemName: string; quantity: number }[]): Promise<Order>;
  updateOrderStatus(id: number, status: string, paymentStatus?: string): Promise<Order | undefined>;
  
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentsByOrder(orderId: number): Promise<Payment[]>;

  getCustomerOrders(customerId: number): Promise<any[]>;

  getExpenditures(): Promise<Expenditure[]>;
  createExpenditure(expenditure: InsertExpenditure): Promise<Expenditure>;
  updateExpenditure(id: number, data: Partial<InsertExpenditure>): Promise<Expenditure | undefined>;

  getStats(): Promise<{ totalOrders: number; totalRevenue: number; pendingOrders: number; activeCustomers: number }>;

  getPerformanceData(): Promise<{
    currentMonthRevenue: number; currentMonthExpenses: number; currentMonthProfit: number;
    last30Revenue: number; prev30Revenue: number; last30Expenses: number; prev30Expenses: number;
    last30Profit: number; prev30Profit: number;
    monthlyComparison: { month: string; income: number; expenses: number }[];
  }>;

  getReportData(startDate: Date, endDate: Date): Promise<{
    totalRevenue: number; totalExpenses: number; netProfit: number; totalOrders: number;
    dailyRevenue: { date: string; revenue: number }[];
    serviceDistribution: { name: string; count: number }[];
    topCustomers: { name: string; orderCount: number; totalSpent: number }[];
  }>;

  getMachines(userId: string): Promise<Machine[]>;
  createMachine(machine: InsertMachine): Promise<Machine>;
  updateMachine(id: number, data: Partial<InsertMachine>): Promise<Machine | undefined>;
  deleteMachine(id: number): Promise<boolean>;

  getEmployees(userId: string): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<boolean>;

  getPlans(): Promise<Plan[]>;
  getPlan(id: number): Promise<Plan | undefined>;
  seedPlans(): Promise<void>;

  getUserSubscription(userId: string): Promise<SubscriptionWithPlan | null>;
  createSubscription(userId: string, planId: number, method: string): Promise<Subscription>;

  getDashboardData(): Promise<any>;
  getAnalyticsKpis(period: string): Promise<any>;
  getWasteAlerts(): Promise<any[]>;
  getPerformanceScore(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: number, update: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db.update(customers).set(update).where(eq(customers.id, id)).returning();
    return updated;
  }

  async getServices(): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.active, true)).orderBy(services.name);
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(insertService: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(insertService).returning();
    return service;
  }

  async updateService(id: number, update: Partial<InsertService>): Promise<Service | undefined> {
    const [updated] = await db.update(services).set(update).where(eq(services.id, id)).returning();
    return updated;
  }

  async deleteService(id: number): Promise<boolean> {
    const [updated] = await db.update(services).set({ active: false }).where(eq(services.id, id)).returning();
    return !!updated;
  }

  async getOrders(): Promise<any[]> {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const allCustomers = await db.select().from(customers);
    const customerMap = new Map(allCustomers.map(c => [c.id, c]));
    return allOrders.map(order => ({
      ...order,
      customer: customerMap.get(order.customerId) || null,
    }));
  }

  async getOrder(id: number): Promise<OrderWithDetails | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId));
    const items = await db.select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      serviceId: orderItems.serviceId,
      quantity: orderItems.quantity,
      priceAtOrder: orderItems.priceAtOrder,
      service: services
    })
    .from(orderItems)
    .innerJoin(services, eq(orderItems.serviceId, services.id))
    .where(eq(orderItems.orderId, id));

    const orderPayments = await db.select().from(payments).where(eq(payments.orderId, id));
    const orderGarments = await db.select().from(garmentItems).where(eq(garmentItems.orderId, id));

    return { ...order, customer, items, payments: orderPayments, garmentItems: orderGarments };
  }

  async createOrder(insertOrder: InsertOrder, items: { serviceId: number; quantity: number }[], garments?: { itemName: string; quantity: number }[]): Promise<Order> {
    return await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values(insertOrder).returning();

      for (const item of items) {
        const [service] = await tx.select().from(services).where(eq(services.id, item.serviceId));
        if (!service) throw new Error(`Service ${item.serviceId} not found`);
        await tx.insert(orderItems).values({
          orderId: order.id, serviceId: item.serviceId, quantity: item.quantity, priceAtOrder: service.price,
        });
      }

      if (garments && garments.length > 0) {
        for (const garment of garments) {
          await tx.insert(garmentItems).values({ orderId: order.id, itemName: garment.itemName, quantity: garment.quantity });
        }
      }

      return order;
    });
  }

  async updateOrderStatus(id: number, status: string, paymentStatus?: string): Promise<Order | undefined> {
    const updates: any = { status, updatedAt: new Date() };
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    const [updated] = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    return updated;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    return await db.transaction(async (tx) => {
      const [payment] = await tx.insert(payments).values(insertPayment).returning();
      const orderPayments = await tx.select().from(payments).where(eq(payments.orderId, insertPayment.orderId));
      const totalPaid = orderPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const [order] = await tx.select().from(orders).where(eq(orders.id, insertPayment.orderId));
      let newPaymentStatus = "partial";
      if (totalPaid >= Number(order.totalAmount)) newPaymentStatus = "paid";
      await tx.update(orders).set({ paymentStatus: newPaymentStatus }).where(eq(orders.id, insertPayment.orderId));
      return payment;
    });
  }

  async getPaymentsByOrder(orderId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.date));
  }

  async getCustomerOrders(customerId: number): Promise<any[]> {
    const customerOrders = await db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
    const result = [];
    for (const order of customerOrders) {
      const orderPayments = await db.select().from(payments).where(eq(payments.orderId, order.id));
      const totalPaid = orderPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      result.push({ ...order, totalPaid, balance: Math.max(0, Number(order.totalAmount) - totalPaid) });
    }
    return result;
  }

  async getExpenditures(): Promise<Expenditure[]> {
    return await db.select().from(expenditures).orderBy(desc(expenditures.date));
  }

  async createExpenditure(insertExpenditure: InsertExpenditure): Promise<Expenditure> {
    const [expenditure] = await db.insert(expenditures).values(insertExpenditure).returning();
    return expenditure;
  }

  async updateExpenditure(id: number, data: Partial<InsertExpenditure>): Promise<Expenditure | undefined> {
    const [updated] = await db.update(expenditures).set(data).where(eq(expenditures.id, id)).returning();
    return updated;
  }

  async getStats() {
    const [ordersCount] = await db.select({ count: sql<number>`count(*)` }).from(orders);
    const [revenueResult] = await db.select({ total: sql<string>`sum(amount)` }).from(payments);
    const totalRevenue = Number(revenueResult?.total || 0);
    const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "pending"));
    const [customersCount] = await db.select({ count: sql<number>`count(*)` }).from(customers);
    return {
      totalOrders: Number(ordersCount?.count || 0),
      totalRevenue,
      pendingOrders: Number(pendingCount?.count || 0),
      activeCustomers: Number(customersCount?.count || 0),
    };
  }

  private async sumPaymentsInRange(start: Date, end: Date): Promise<number> {
    const [result] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(and(sql`${payments.date} IS NOT NULL`, sql`${payments.date} >= ${start}`, sql`${payments.date} <= ${end}`));
    return Number(result?.total || 0);
  }

  private async sumExpensesInRange(start: Date, end: Date): Promise<number> {
    const [result] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(expenditures)
      .where(and(sql`${expenditures.date} IS NOT NULL`, sql`${expenditures.date} >= ${start}`, sql`${expenditures.date} <= ${end}`));
    return Number(result?.total || 0);
  }

  async getPerformanceData() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const last30Start = new Date(now); last30Start.setDate(last30Start.getDate() - 30);
    const prev30Start = new Date(last30Start); prev30Start.setDate(prev30Start.getDate() - 30);

    const currentMonthRevenue = await this.sumPaymentsInRange(currentMonthStart, currentMonthEnd);
    const currentMonthExpenses = await this.sumExpensesInRange(currentMonthStart, currentMonthEnd);
    const currentMonthProfit = currentMonthRevenue - currentMonthExpenses;
    const last30Revenue = await this.sumPaymentsInRange(last30Start, now);
    const prev30Revenue = await this.sumPaymentsInRange(prev30Start, last30Start);
    const last30Expenses = await this.sumExpensesInRange(last30Start, now);
    const prev30Expenses = await this.sumExpensesInRange(prev30Start, last30Start);

    const monthlyComparison: { month: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthLabel = mStart.toLocaleString("en-US", { month: "short", year: "2-digit" });
      monthlyComparison.push({ month: monthLabel, income: await this.sumPaymentsInRange(mStart, mEnd), expenses: await this.sumExpensesInRange(mStart, mEnd) });
    }

    return {
      currentMonthRevenue, currentMonthExpenses, currentMonthProfit,
      last30Revenue, prev30Revenue, last30Expenses, prev30Expenses,
      last30Profit: last30Revenue - last30Expenses,
      prev30Profit: prev30Revenue - prev30Expenses,
      monthlyComparison,
    };
  }

  async getReportData(startDate: Date, endDate: Date) {
    const filteredOrders = await db.select().from(orders)
      .where(and(sql`${orders.createdAt} >= ${startDate}`, sql`${orders.createdAt} <= ${endDate}`));
    const totalOrders = filteredOrders.length;

    const filteredPayments = await db.select().from(payments)
      .where(and(sql`${payments.date} >= ${startDate}`, sql`${payments.date} <= ${endDate}`));
    const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const filteredExpenses = await db.select().from(expenditures)
      .where(and(sql`${expenditures.date} >= ${startDate}`, sql`${expenditures.date} <= ${endDate}`));
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const dailyRevenueMap = new Map<string, number>();
    for (const p of filteredPayments) {
      const day = p.date ? new Date(p.date).toISOString().split('T')[0] : 'unknown';
      dailyRevenueMap.set(day, (dailyRevenueMap.get(day) || 0) + Number(p.amount));
    }
    const dailyRevenue = Array.from(dailyRevenueMap.entries()).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));

    const orderIds = filteredOrders.map(o => o.id);
    let serviceDistribution: { name: string; count: number }[] = [];
    if (orderIds.length > 0) {
      const items = await db.select({ serviceName: services.name, quantity: orderItems.quantity })
        .from(orderItems).innerJoin(services, eq(orderItems.serviceId, services.id))
        .where(sql`${orderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`);
      const serviceMap = new Map<string, number>();
      for (const item of items) serviceMap.set(item.serviceName, (serviceMap.get(item.serviceName) || 0) + item.quantity);
      serviceDistribution = Array.from(serviceMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }

    const customerOrderMap = new Map<number, { orderCount: number; totalSpent: number }>();
    for (const order of filteredOrders) {
      const existing = customerOrderMap.get(order.customerId) || { orderCount: 0, totalSpent: 0 };
      existing.orderCount++; existing.totalSpent += Number(order.totalAmount);
      customerOrderMap.set(order.customerId, existing);
    }
    const allCustomers = await db.select().from(customers);
    const customerMap = new Map(allCustomers.map(c => [c.id, c]));
    const topCustomers = Array.from(customerOrderMap.entries())
      .map(([customerId, data]) => ({ name: customerMap.get(customerId)?.name || 'Unknown', ...data }))
      .sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);

    return { totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, totalOrders, dailyRevenue, serviceDistribution, topCustomers };
  }

  // Machines
  async getMachines(userId: string): Promise<Machine[]> {
    return await db.select().from(machines).where(eq(machines.userId, userId)).orderBy(desc(machines.createdAt));
  }

  async createMachine(machine: InsertMachine): Promise<Machine> {
    const [created] = await db.insert(machines).values(machine).returning();
    return created;
  }

  async updateMachine(id: number, data: Partial<InsertMachine>): Promise<Machine | undefined> {
    const [updated] = await db.update(machines).set(data).where(eq(machines.id, id)).returning();
    return updated;
  }

  async deleteMachine(id: number): Promise<boolean> {
    const [deleted] = await db.delete(machines).where(eq(machines.id, id)).returning();
    return !!deleted;
  }

  // Employees
  async getEmployees(userId: string): Promise<Employee[]> {
    return await db.select().from(employees).where(eq(employees.userId, userId)).orderBy(desc(employees.createdAt));
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [created] = await db.insert(employees).values(employee).returning();
    return created;
  }

  async updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [updated] = await db.update(employees).set(data).where(eq(employees.id, id)).returning();
    return updated;
  }

  async deleteEmployee(id: number): Promise<boolean> {
    const [deleted] = await db.delete(employees).where(eq(employees.id, id)).returning();
    return !!deleted;
  }

  // Plans
  async getPlans(): Promise<Plan[]> {
    return await db.select().from(plans).where(eq(plans.active, true)).orderBy(plans.price);
  }

  async getPlan(id: number): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    return plan;
  }

  async seedPlans(): Promise<void> {
    const existing = await db.select().from(plans);
    if (existing.length > 0) return;

    await db.insert(plans).values([
      { name: "Starter", slug: "starter", price: "6000", maxOrders: 100, maxUsers: 1, features: ["Client management", "Order tracking", "Basic dashboard"] },
      { name: "Pro", slug: "pro", price: "15000", maxOrders: 500, maxUsers: 3, features: ["Everything in Starter", "Analytics & KPIs", "Break-even analysis", "Employee management", "Machine management"] },
      { name: "Business", slug: "business", price: "30000", maxOrders: 2000, maxUsers: 10, features: ["Everything in Pro", "Waste detection", "Performance score", "Smart alerts", "Financial forecasts"] },
      { name: "Enterprise", slug: "enterprise", price: "50000", maxOrders: null, maxUsers: null, features: ["Everything in Business", "Unlimited orders & users", "Custom API access", "Priority support 24/7"] },
    ]);
  }

  // Subscriptions
  async getUserSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
    const subs = await db.select().from(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))).orderBy(desc(subscriptions.createdAt)).limit(1);
    if (subs.length === 0) return null;
    const sub = subs[0];
    const [plan] = await db.select().from(plans).where(eq(plans.id, sub.planId));
    return { ...sub, plan };
  }

  async createSubscription(userId: string, planId: number, method: string): Promise<Subscription> {
    return await db.transaction(async (tx) => {
      await tx.update(subscriptions).set({ status: "cancelled" }).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      const [sub] = await tx.insert(subscriptions).values({ userId, planId, status: "active", endDate }).returning();
      const [plan] = await tx.select().from(plans).where(eq(plans.id, planId));
      await tx.insert(subscriptionPayments).values({ userId, planId, subscriptionId: sub.id, amount: plan.price, method, status: "completed" });
      return sub;
    });
  }

  // Dashboard
  async getDashboardData() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart); todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const todayRevenue = await this.sumPaymentsInRange(todayStart, todayEnd);
    const todayOrdersResult = await db.select({ count: sql<number>`count(*)` }).from(orders)
      .where(and(sql`${orders.createdAt} >= ${todayStart}`, sql`${orders.createdAt} <= ${todayEnd}`));
    const todayOrders = Number(todayOrdersResult[0]?.count || 0);

    const monthRevenue = await this.sumPaymentsInRange(monthStart, now);
    const monthExpenses = await this.sumExpensesInRange(monthStart, now);
    const monthOrdersResult = await db.select({ count: sql<number>`count(*)` }).from(orders)
      .where(and(sql`${orders.createdAt} >= ${monthStart}`, sql`${orders.createdAt} <= ${now}`));
    const monthOrders = Number(monthOrdersResult[0]?.count || 0);

    const profit = monthRevenue - monthExpenses;
    const dailyTarget = 50;
    const targetAchievement = dailyTarget > 0 ? Math.min(100, (todayOrders / dailyTarget) * 100) : 0;

    const statusCounts = await db.select({ status: orders.status, count: sql<number>`count(*)` }).from(orders).groupBy(orders.status);
    const ordersByStatus: any = { received: 0, washing: 0, ready: 0, delivered: 0 };
    for (const s of statusCounts) {
      if (s.status === "pending") ordersByStatus.received = Number(s.count);
      else if (s.status === "processing") ordersByStatus.washing = Number(s.count);
      else if (s.status === "ready") ordersByStatus.ready = Number(s.count);
      else if (s.status === "delivered") ordersByStatus.delivered = Number(s.count);
    }

    const revenueByDay: { date: string; value: number }[] = [];
    const kgByDay: { date: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - i); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999);
      const dateStr = dayStart.toISOString().split('T')[0];
      const rev = await this.sumPaymentsInRange(dayStart, dayEnd);
      revenueByDay.push({ date: dateStr, value: rev });
      kgByDay.push({ date: dateStr, value: 0 });
    }

    const costPerKg = monthRevenue > 0 ? monthExpenses / Math.max(monthOrders, 1) : 0;
    const profitPerKg = monthRevenue > 0 ? profit / Math.max(monthOrders, 1) : 0;

    const alerts: { type: string; message: string; detail?: string }[] = [];
    const pendingResult = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "pending"));
    const pendingCount = Number(pendingResult[0]?.count || 0);
    if (pendingCount > 10) alerts.push({ type: "warning", message: `You have ${pendingCount} pending orders`, detail: "Consider processing them soon" });
    if (monthExpenses > monthRevenue && monthRevenue > 0) alerts.push({ type: "danger", message: "Expenses exceed revenue this month", detail: "Review your expenditure logs" });

    return {
      todayKg: 0, todayOrders, todayRevenue, monthKg: 0, monthOrders, monthRevenue, monthExpenses,
      profit, costPerKg, profitPerKg, dailyTarget, targetAchievement,
      ordersByStatus, revenueByDay, kgByDay, alerts,
    };
  }

  // Analytics
  async getAnalyticsKpis(period: string) {
    const now = new Date();
    let start: Date;
    if (period === "day") { start = new Date(now); start.setHours(0, 0, 0, 0); }
    else if (period === "week") { start = new Date(now); start.setDate(start.getDate() - 7); }
    else if (period === "year") { start = new Date(now.getFullYear(), 0, 1); }
    else { start = new Date(now.getFullYear(), now.getMonth(), 1); }

    const totalRevenue = await this.sumPaymentsInRange(start, now);
    const totalExpenses = await this.sumExpensesInRange(start, now);
    const ordersResult = await db.select({ count: sql<number>`count(*)` }).from(orders)
      .where(and(sql`${orders.createdAt} >= ${start}`, sql`${orders.createdAt} <= ${now}`));
    const totalOrders = Number(ordersResult[0]?.count || 0);
    const profit = totalRevenue - totalExpenses;

    const allMachines = await db.select().from(machines);
    const machineUtilization = allMachines.length > 0
      ? allMachines.reduce((sum, m) => sum + Number(m.utilizationRate), 0) / allMachines.length : 0;

    const allEmployees = await db.select().from(employees);
    const employeeProductivity = allEmployees.length > 0
      ? allEmployees.reduce((sum, e) => sum + Number(e.kgProcessed), 0) / allEmployees.length : 0;

    const costPerKg = totalOrders > 0 ? totalExpenses / totalOrders : 0;
    const profitPerKg = totalOrders > 0 ? profit / totalOrders : 0;
    const breakEvenKg = profitPerKg !== 0 ? totalExpenses / Math.max(profitPerKg, 0.01) : 0;

    return {
      totalKg: 0, totalOrders, avgWeightPerOrder: 0, totalRevenue, totalExpenses,
      profit, costPerKg, profitPerKg, breakEvenKg: Math.max(0, breakEvenKg),
      machineUtilization, employeeProductivity, mrr: 0, performanceScore: 0,
    };
  }

  async getWasteAlerts(): Promise<any[]> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthExpenses = await this.sumExpensesInRange(monthStart, now);
    const monthRevenue = await this.sumPaymentsInRange(monthStart, now);
    const alerts: any[] = [];

    if (monthExpenses > monthRevenue * 0.8 && monthRevenue > 0) {
      alerts.push({ category: "Cost", severity: "high", message: "Operating costs are very high relative to revenue", recommendation: "Review and optimize your expense categories" });
    }

    const expensesByCategory = await db.select({ category: expenditures.category, total: sql<string>`SUM(amount)` })
      .from(expenditures).where(and(sql`${expenditures.date} >= ${monthStart}`, sql`${expenditures.date} <= ${now}`))
      .groupBy(expenditures.category);
    
    for (const cat of expensesByCategory) {
      if (Number(cat.total) > monthRevenue * 0.3 && monthRevenue > 0) {
        alerts.push({ category: cat.category, severity: "medium", message: `${cat.category} expenses are ${Math.round((Number(cat.total) / monthRevenue) * 100)}% of revenue`, recommendation: `Consider reducing ${cat.category.toLowerCase()} costs` });
      }
    }

    return alerts;
  }

  async getPerformanceScore() {
    const allMachines = await db.select().from(machines);
    const machineUsage = allMachines.length > 0
      ? allMachines.reduce((sum, m) => sum + Number(m.utilizationRate), 0) / allMachines.length : 50;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRevenue = await this.sumPaymentsInRange(monthStart, now);
    const monthExpenses = await this.sumExpensesInRange(monthStart, now);
    const costEfficiency = monthRevenue > 0 ? Math.min(100, ((monthRevenue - monthExpenses) / monthRevenue) * 100) : 50;

    const allEmployees = await db.select().from(employees);
    const productivity = allEmployees.length > 0
      ? Math.min(100, allEmployees.reduce((sum, e) => sum + Number(e.kgProcessed), 0) / (allEmployees.length * 10)) : 50;

    const wasteAlerts = await this.getWasteAlerts();
    const wasteLevel = Math.max(0, 100 - wasteAlerts.length * 20);

    const total = Math.round((machineUsage + costEfficiency + productivity + wasteLevel) / 4);
    let grade = "F";
    if (total >= 90) grade = "A"; else if (total >= 80) grade = "B"; else if (total >= 70) grade = "C"; else if (total >= 60) grade = "D";

    return { total, machineUsage: Math.round(machineUsage), costEfficiency: Math.round(costEfficiency), productivity: Math.round(productivity), wasteLevel: Math.round(wasteLevel), grade };
  }
}

export const storage = new DatabaseStorage();
