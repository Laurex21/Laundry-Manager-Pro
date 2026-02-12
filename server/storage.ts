import { db } from "./db";
import { 
  customers, services, orders, orderItems, payments, expenditures, garmentItems,
  type Customer, type InsertCustomer,
  type Service, type InsertService,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type Payment, type InsertPayment,
  type GarmentItem, type InsertGarmentItem,
  type Expenditure, type InsertExpenditure,
  type OrderWithDetails
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;

  // Services
  getServices(): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: number): Promise<boolean>;

  // Orders
  getOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<OrderWithDetails | undefined>;
  createOrder(order: InsertOrder, items: { serviceId: number; quantity: number }[], garments?: { itemName: string; quantity: number }[]): Promise<Order>;
  updateOrderStatus(id: number, status: string, paymentStatus?: string): Promise<Order | undefined>;
  
  // Payments
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentsByOrder(orderId: number): Promise<Payment[]>;

  // Customer Orders
  getCustomerOrders(customerId: number): Promise<any[]>;

  // Expenditures
  getExpenditures(): Promise<Expenditure[]>;
  createExpenditure(expenditure: InsertExpenditure): Promise<Expenditure>;

  // Stats
  getStats(): Promise<{
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    activeCustomers: number;
  }>;

  // Performance Monitor
  getPerformanceData(): Promise<{
    currentMonthRevenue: number;
    currentMonthExpenses: number;
    currentMonthProfit: number;
    last30Revenue: number;
    prev30Revenue: number;
    last30Expenses: number;
    prev30Expenses: number;
    last30Profit: number;
    prev30Profit: number;
    monthlyComparison: { month: string; income: number; expenses: number }[];
  }>;

  // Reports
  getReportData(startDate: Date, endDate: Date): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    totalOrders: number;
    dailyRevenue: { date: string; revenue: number }[];
    serviceDistribution: { name: string; count: number }[];
    topCustomers: { name: string; orderCount: number; totalSpent: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // Customers
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

  // Services
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

  // Orders
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

    return {
      ...order,
      customer,
      items,
      payments: orderPayments,
      garmentItems: orderGarments,
    };
  }

  async createOrder(insertOrder: InsertOrder, items: { serviceId: number; quantity: number }[], garments?: { itemName: string; quantity: number }[]): Promise<Order> {
    return await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values(insertOrder).returning();

      for (const item of items) {
        const [service] = await tx.select().from(services).where(eq(services.id, item.serviceId));
        if (!service) throw new Error(`Service ${item.serviceId} not found`);
        
        await tx.insert(orderItems).values({
          orderId: order.id,
          serviceId: item.serviceId,
          quantity: item.quantity,
          priceAtOrder: service.price,
        });
      }

      if (garments && garments.length > 0) {
        for (const garment of garments) {
          await tx.insert(garmentItems).values({
            orderId: order.id,
            itemName: garment.itemName,
            quantity: garment.quantity,
          });
        }
      }

      return order;
    });
  }

  async updateOrderStatus(id: number, status: string, paymentStatus?: string): Promise<Order | undefined> {
    const updates: any = { status, updatedAt: new Date() };
    if (paymentStatus) {
      updates.paymentStatus = paymentStatus;
    }
    const [updated] = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    return updated;
  }

  // Payments
  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    return await db.transaction(async (tx) => {
      const [payment] = await tx.insert(payments).values(insertPayment).returning();
      
      // Check if order is fully paid
      const orderPayments = await tx.select().from(payments).where(eq(payments.orderId, insertPayment.orderId));
      const totalPaid = orderPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      const [order] = await tx.select().from(orders).where(eq(orders.id, insertPayment.orderId));
      
      let newPaymentStatus = "partial";
      if (totalPaid >= Number(order.totalAmount)) {
        newPaymentStatus = "paid";
      }

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
      result.push({
        ...order,
        totalPaid,
        balance: Math.max(0, Number(order.totalAmount) - totalPaid),
      });
    }
    return result;
  }

  // Expenditures
  async getExpenditures(): Promise<Expenditure[]> {
    return await db.select().from(expenditures).orderBy(desc(expenditures.date));
  }

  async createExpenditure(insertExpenditure: InsertExpenditure): Promise<Expenditure> {
    const [expenditure] = await db.insert(expenditures).values(insertExpenditure).returning();
    return expenditure;
  }

  // Stats
  async getStats(): Promise<{ totalOrders: number; totalRevenue: number; pendingOrders: number; activeCustomers: number }> {
    const [ordersCount] = await db.select({ count: sql<number>`count(*)` }).from(orders);
    
    // Revenue is sum of paid orders or payments table? Let's use totalAmount of orders that are not cancelled for simplicity, 
    // or better, sum of payments. Let's use sum of payments for "Cash in hand" revenue.
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
  // Performance Monitor
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

    const last30Start = new Date(now);
    last30Start.setDate(last30Start.getDate() - 30);
    const prev30Start = new Date(last30Start);
    prev30Start.setDate(prev30Start.getDate() - 30);

    const currentMonthRevenue = await this.sumPaymentsInRange(currentMonthStart, currentMonthEnd);
    const currentMonthExpenses = await this.sumExpensesInRange(currentMonthStart, currentMonthEnd);
    const currentMonthProfit = currentMonthRevenue - currentMonthExpenses;

    const last30Revenue = await this.sumPaymentsInRange(last30Start, now);
    const prev30Revenue = await this.sumPaymentsInRange(prev30Start, last30Start);
    const last30Expenses = await this.sumExpensesInRange(last30Start, now);
    const prev30Expenses = await this.sumExpensesInRange(prev30Start, last30Start);
    const last30Profit = last30Revenue - last30Expenses;
    const prev30Profit = prev30Revenue - prev30Expenses;

    const monthlyComparison: { month: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthLabel = mStart.toLocaleString("en-US", { month: "short", year: "2-digit" });
      monthlyComparison.push({
        month: monthLabel,
        income: await this.sumPaymentsInRange(mStart, mEnd),
        expenses: await this.sumExpensesInRange(mStart, mEnd),
      });
    }

    return {
      currentMonthRevenue,
      currentMonthExpenses,
      currentMonthProfit,
      last30Revenue,
      prev30Revenue,
      last30Expenses,
      prev30Expenses,
      last30Profit,
      prev30Profit,
      monthlyComparison,
    };
  }

  // Reports
  async getReportData(startDate: Date, endDate: Date) {
    const gte = sql`${startDate}`;
    const lte = sql`${endDate}`;

    const filteredOrders = await db.select().from(orders)
      .where(and(sql`${orders.createdAt} >= ${gte}`, sql`${orders.createdAt} <= ${lte}`));

    const totalOrders = filteredOrders.length;

    const filteredPayments = await db.select().from(payments)
      .where(and(sql`${payments.date} >= ${gte}`, sql`${payments.date} <= ${lte}`));
    const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const filteredExpenses = await db.select().from(expenditures)
      .where(and(sql`${expenditures.date} >= ${gte}`, sql`${expenditures.date} <= ${lte}`));
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const netProfit = totalRevenue - totalExpenses;

    const dailyRevenueMap = new Map<string, number>();
    for (const p of filteredPayments) {
      const day = p.date ? new Date(p.date).toISOString().split('T')[0] : 'unknown';
      dailyRevenueMap.set(day, (dailyRevenueMap.get(day) || 0) + Number(p.amount));
    }
    const dailyRevenue = Array.from(dailyRevenueMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const orderIds = filteredOrders.map(o => o.id);
    let serviceDistribution: { name: string; count: number }[] = [];
    if (orderIds.length > 0) {
      const items = await db.select({
        serviceName: services.name,
        quantity: orderItems.quantity,
      }).from(orderItems)
        .innerJoin(services, eq(orderItems.serviceId, services.id))
        .where(sql`${orderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`);

      const serviceMap = new Map<string, number>();
      for (const item of items) {
        serviceMap.set(item.serviceName, (serviceMap.get(item.serviceName) || 0) + item.quantity);
      }
      serviceDistribution = Array.from(serviceMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }

    const customerOrderMap = new Map<number, { orderCount: number; totalSpent: number }>();
    for (const order of filteredOrders) {
      const existing = customerOrderMap.get(order.customerId) || { orderCount: 0, totalSpent: 0 };
      existing.orderCount++;
      existing.totalSpent += Number(order.totalAmount);
      customerOrderMap.set(order.customerId, existing);
    }

    const allCustomers = await db.select().from(customers);
    const customerMap = new Map(allCustomers.map(c => [c.id, c]));

    const topCustomers = Array.from(customerOrderMap.entries())
      .map(([customerId, data]) => ({
        name: customerMap.get(customerId)?.name || 'Unknown',
        orderCount: data.orderCount,
        totalSpent: data.totalSpent,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    return { totalRevenue, totalExpenses, netProfit, totalOrders, dailyRevenue, serviceDistribution, topCustomers };
  }
}

export const storage = new DatabaseStorage();
