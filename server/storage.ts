import { db } from "./db";
import { 
  customers, services, orders, orderItems, payments, expenditures,
  type Customer, type InsertCustomer,
  type Service, type InsertService,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type Payment, type InsertPayment,
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

  // Orders
  getOrders(): Promise<Order[]>; // Simplified list
  getOrder(id: number): Promise<OrderWithDetails | undefined>;
  createOrder(order: InsertOrder, items: { serviceId: number; quantity: number }[]): Promise<Order>;
  updateOrderStatus(id: number, status: string, paymentStatus?: string): Promise<Order | undefined>;
  
  // Payments
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentsByOrder(orderId: number): Promise<Payment[]>;

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

  // Orders
  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
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

    return {
      ...order,
      customer,
      items,
      payments: orderPayments
    };
  }

  async createOrder(insertOrder: InsertOrder, items: { serviceId: number; quantity: number }[]): Promise<Order> {
    return await db.transaction(async (tx) => {
      // 1. Create Order
      const [order] = await tx.insert(orders).values(insertOrder).returning();

      // 2. Create Items
      for (const item of items) {
        const [service] = await tx.select().from(services).where(eq(services.id, item.serviceId));
        if (!service) throw new Error(`Service ${item.serviceId} not found`);
        
        await tx.insert(orderItems).values({
          orderId: order.id,
          serviceId: item.serviceId,
          quantity: item.quantity,
          priceAtOrder: service.price, // Store as string/decimal from DB
        });
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
}

export const storage = new DatabaseStorage();
