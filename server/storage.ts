import { db } from "./db";
import { 
  customers, services, orders, orderItems, payments, expenditures, garmentItems,
  machines, employees, plans, subscriptions, subscriptionPayments, orderStatusHistory,
  businessSettings, organisations, sites, siteMembers, siteInvitations,
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
  type OrderWithDetails, type OrderStatusHistoryEntry,
  type BusinessSettings, type InsertBusinessSettings,
  type Organisation, type Site, type InsertSite, type SiteMember, type SiteInvitation
} from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq, desc, sql, and, gte, lte, isNull } from "drizzle-orm";

export interface IStorage {
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;

  getServices(): Promise<Service[]>;
  getServicesBySite(siteId: number | null): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: number): Promise<boolean>;

  getOrders(): Promise<any[]>;
  getOrder(id: number): Promise<OrderWithDetails | undefined>;
  createOrder(order: InsertOrder, items: { serviceId: number; quantity: number }[], garments?: { itemName: string; quantity: number }[]): Promise<Order>;
  updateOrderStatus(id: number, status: string, paymentStatus?: string, changedBy?: string | null): Promise<Order | undefined>;
  getOrderStatusHistory(orderId: number): Promise<OrderStatusHistoryEntry[]>;
  
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentsByOrder(orderId: number): Promise<Payment[]>;

  getCustomerOrders(customerId: number): Promise<any[]>;

  markGarmentReturned(id: number, returnStage: string, returnNotes?: string): Promise<GarmentItem | undefined>;
  resolveGarmentReturn(id: number): Promise<GarmentItem | undefined>;

  getExpenditures(): Promise<Expenditure[]>;
  createExpenditure(expenditure: InsertExpenditure): Promise<Expenditure>;
  updateExpenditure(id: number, data: Partial<InsertExpenditure>): Promise<Expenditure | undefined>;

  getStats(): Promise<{ totalOrders: number; totalRevenue: number; pendingOrders: number; activeCustomers: number }>;

  getPerformanceData(siteId: number | null): Promise<{
    currentMonthRevenue: number; currentMonthExpenses: number; currentMonthProfit: number;
    last30Revenue: number; prev30Revenue: number; last30Expenses: number; prev30Expenses: number;
    last30Profit: number; prev30Profit: number;
    monthlyComparison: { month: string; income: number; expenses: number }[];
  }>;

  getReportData(startDate: Date, endDate: Date, siteId: number | null): Promise<{
    totalRevenue: number; totalExpenses: number; netProfit: number; totalOrders: number;
    dailyRevenue: { date: string; revenue: number }[];
    serviceDistribution: { name: string; count: number }[];
    topCustomers: { name: string; orderCount: number; totalSpent: number }[];
  }>;

  getMachines(siteId: number | null, userId: string): Promise<Machine[]>;
  createMachine(machine: InsertMachine): Promise<Machine>;
  updateMachine(id: number, data: Partial<InsertMachine>): Promise<Machine | undefined>;
  deleteMachine(id: number): Promise<boolean>;

  getEmployees(siteId: number | null, userId: string): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<boolean>;

  getPlans(): Promise<Plan[]>;
  getPlan(id: number): Promise<Plan | undefined>;
  seedPlans(): Promise<void>;

  getUserSubscription(userId: string): Promise<SubscriptionWithPlan | null>;
  createSubscription(userId: string, planId: number, method: string): Promise<Subscription>;

  requestCancellation(id: number, reason: string, requestedBy: string): Promise<Order | undefined>;
  approveCancellation(id: number, reviewedBy: string): Promise<Order | undefined>;
  rejectCancellation(id: number, reviewedBy: string, note: string): Promise<Order | undefined>;
  getPendingCancellations(siteId: number | null): Promise<any[]>;
  markDelivered(id: number, deliveredAt: Date): Promise<Order | undefined>;
  getProductionDelays(siteId: number | null): Promise<any[]>;

  getOrdersBySite(siteId: number | null): Promise<any[]>;
  getCustomersBySite(siteId: number | null): Promise<Customer[]>;
  getExpendituresBySite(siteId: number | null): Promise<Expenditure[]>;
  getStatsBySite(siteId: number | null): Promise<{ totalOrders: number; totalRevenue: number; pendingOrders: number; activeCustomers: number }>;
  backfillNullSiteIds(): Promise<void>;

  getDashboardData(siteId?: number | null, allSites?: boolean): Promise<any>;
  getAnalyticsKpis(period: string, siteId: number | null): Promise<any>;
  getWasteAlerts(siteId: number | null): Promise<any[]>;
  getPerformanceScore(siteId: number | null): Promise<any>;

  getSettings(userId: string): Promise<BusinessSettings>;
  upsertSettings(userId: string, data: Partial<InsertBusinessSettings>): Promise<BusinessSettings>;

  getOrganisationByOwner(ownerId: string): Promise<Organisation | null>;
  createOrganisationWithSite(ownerId: string, orgName: string, siteName: string): Promise<{ organisation: Organisation; site: Site }>;
  getSites(organisationId: number): Promise<(Site & { memberCount: number })[]>;
  getSite(siteId: number): Promise<Site | null>;
  createSite(organisationId: number, data: { name: string; address?: string; city?: string; phone?: string }): Promise<Site>;
  updateSite(id: number, data: Partial<InsertSite>): Promise<Site | undefined>;
  deleteSite(id: number): Promise<boolean>;
  getSiteMembers(siteId: number): Promise<(SiteMember & { name: string; email: string | null; phone: string | null })[]>;
  addSiteMember(siteId: number, userId: string, role: string): Promise<SiteMember>;
  removeSiteMember(siteId: number, userId: string): Promise<boolean>;
  updateSiteMemberRole(siteId: number, userId: string, role: string): Promise<SiteMember | undefined>;
  createInvitation(data: { siteId: number; organisationId: number; invitedBy: string; identifier: string; role: string }): Promise<SiteInvitation>;
  getInvitationByToken(token: string): Promise<(SiteInvitation & { siteName: string; organisationName: string; inviterName: string }) | null>;
  acceptInvitation(token: string, userId: string): Promise<SiteInvitation | null>;
  getPendingInvitations(organisationId: number): Promise<(SiteInvitation & { siteName: string })[]>;
  revokeInvitation(id: number): Promise<boolean>;
  switchSite(userId: string, siteId: number | null): Promise<void>;
  migrateToMultiSite(): Promise<void>;
  getUserSiteRole(userId: string, siteId: number): Promise<string | null>;
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

  async getServicesBySite(siteId: number | null): Promise<Service[]> {
    if (siteId !== null) {
      return await db.select().from(services)
        .where(and(eq(services.active, true), eq(services.siteId, siteId)))
        .orderBy(services.name);
    }
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
    const allGarments = await db.select().from(garmentItems);
    const garmentsByOrder = new Map<number, typeof allGarments>();
    for (const g of allGarments) {
      const list = garmentsByOrder.get(g.orderId) || [];
      list.push(g);
      garmentsByOrder.set(g.orderId, list);
    }
    return allOrders.map(order => {
      const orderGarments = garmentsByOrder.get(order.id) || [];
      const hasReturnedItems = orderGarments.some(g => g.returnedForTreatment && !g.resolvedAt);
      return {
        ...order,
        customer: customerMap.get(order.customerId) || null,
        hasReturnedItems,
      };
    });
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
    const history = await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, id)).orderBy(orderStatusHistory.changedAt);

    return { ...order, customer, items, payments: orderPayments, garmentItems: orderGarments, statusHistory: history };
  }

  async createOrder(insertOrder: InsertOrder, items: { serviceId: number; quantity: number }[], garments?: { itemName: string; quantity: number }[]): Promise<Order> {
    return await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values(insertOrder).returning();

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        status: order.status,
        notes: "Order created",
      });

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

  async updateOrderStatus(id: number, status: string, paymentStatus?: string, changedBy?: string | null): Promise<Order | undefined> {
    const updates: any = { status, updatedAt: new Date() };
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    const [updated] = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    if (updated) {
      await db.insert(orderStatusHistory).values({
        orderId: id,
        status,
        changedBy: changedBy || null,
      });
    }
    return updated;
  }

  async getOrderStatusHistory(orderId: number): Promise<OrderStatusHistoryEntry[]> {
    return await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId)).orderBy(orderStatusHistory.changedAt);
  }

  async requestCancellation(id: number, reason: string, requestedBy: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set({
      status: "cancellation_requested",
      cancellationReason: reason,
      cancellationRequestedBy: requestedBy,
      cancellationRequestedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(orders.id, id)).returning();
    if (updated) {
      await db.insert(orderStatusHistory).values({ orderId: id, status: "cancellation_requested", changedBy: requestedBy, notes: `Cancellation requested: ${reason}` });
    }
    return updated;
  }

  async approveCancellation(id: number, reviewedBy: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set({
      status: "cancelled",
      cancellationReviewedBy: reviewedBy,
      cancellationReviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(orders.id, id)).returning();
    if (updated) {
      await db.insert(orderStatusHistory).values({ orderId: id, status: "cancelled", changedBy: reviewedBy, notes: "Cancellation approved" });
    }
    return updated;
  }

  async rejectCancellation(id: number, reviewedBy: string, note: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set({
      status: "received",
      cancellationReviewedBy: reviewedBy,
      cancellationReviewedAt: new Date(),
      cancellationRejectionNote: note,
      updatedAt: new Date(),
    }).where(eq(orders.id, id)).returning();
    if (updated) {
      await db.insert(orderStatusHistory).values({ orderId: id, status: "received", changedBy: reviewedBy, notes: `Cancellation rejected: ${note}` });
    }
    return updated;
  }

  async getPendingCancellations(siteId: number | null): Promise<any[]> {
    const siteWhere = siteId !== null ? eq(orders.siteId, siteId) : undefined;
    const pendingOrders = await db.select().from(orders)
      .where(siteWhere ? and(eq(orders.status, "cancellation_requested"), siteWhere) : eq(orders.status, "cancellation_requested"))
      .orderBy(desc(orders.updatedAt));
    const allCustomers = await db.select().from(customers);
    const customerMap = new Map(allCustomers.map(c => [c.id, c]));
    return pendingOrders.map(o => ({ ...o, customer: customerMap.get(o.customerId) || null }));
  }

  async markDelivered(id: number, deliveredAt: Date): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const [updated] = await db.update(orders).set({
      status: "delivered",
      deliveredAt,
      updatedAt: new Date(),
    }).where(eq(orders.id, id)).returning();

    if (updated) {
      await db.insert(orderStatusHistory).values({
        orderId: id,
        status: "delivered",
        notes: `Delivered on ${deliveredAt.toISOString().split('T')[0]}`,
      });

      const isOnTime = !order.pickupDate || deliveredAt <= new Date(order.pickupDate);
      await db.update(customers)
        .set({
          totalDeliveries: sql`${customers.totalDeliveries} + 1`,
          onTimeDeliveries: isOnTime
            ? sql`${customers.onTimeDeliveries} + 1`
            : customers.onTimeDeliveries,
          lateDeliveries: !isOnTime
            ? sql`${customers.lateDeliveries} + 1`
            : customers.lateDeliveries,
        })
        .where(eq(customers.id, order.customerId));
    }
    return updated;
  }

  async getProductionDelays(siteId: number | null): Promise<any[]> {
    const activeStatuses = ["received", "washing", "stain_treatment", "drying", "ironing"];
    const statusFilter = sql`${orders.status} = ANY(${sql`ARRAY[${sql.join(activeStatuses.map(s => sql`${s}`), sql`, `)}]`})`;
    const activeOrders = await db.select().from(orders)
      .where(siteId !== null ? and(statusFilter, eq(orders.siteId, siteId)) : statusFilter);
    const allCustomers = await db.select().from(customers);
    const customerMap = new Map(allCustomers.map(c => [c.id, c]));
    const now = new Date();
    const delays: any[] = [];
    for (const order of activeOrders) {
      const entryDate = order.entryDate ? new Date(order.entryDate) : new Date(order.createdAt!);
      const daysSinceEntry = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      const expectedPickup = order.pickupDate ? new Date(order.pickupDate) : null;
      const isOverdue = expectedPickup ? now > expectedPickup : daysSinceEntry > 3;
      const daysOverdue = expectedPickup ? Math.max(0, Math.floor((now.getTime() - expectedPickup.getTime()) / (1000 * 60 * 60 * 24))) : Math.max(0, daysSinceEntry - 3);
      if (isOverdue) {
        delays.push({
          ...order,
          customer: customerMap.get(order.customerId) || null,
          daysSinceEntry,
          daysOverdue,
          expectedPickup,
        });
      }
    }
    return delays.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  async markGarmentReturned(id: number, returnStage: string, returnNotes?: string): Promise<GarmentItem | undefined> {
    const [updated] = await db.update(garmentItems).set({
      returnedForTreatment: true,
      returnStage,
      returnNotes: returnNotes || null,
      returnedAt: new Date(),
      resolvedAt: null,
    }).where(eq(garmentItems.id, id)).returning();
    return updated;
  }

  async resolveGarmentReturn(id: number): Promise<GarmentItem | undefined> {
    const [updated] = await db.update(garmentItems).set({
      returnedForTreatment: false,
      resolvedAt: new Date(),
    }).where(eq(garmentItems.id, id)).returning();
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
    const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "received"));
    const [customersCount] = await db.select({ count: sql<number>`count(*)` }).from(customers);
    return {
      totalOrders: Number(ordersCount?.count || 0),
      totalRevenue,
      pendingOrders: Number(pendingCount?.count || 0),
      activeCustomers: Number(customersCount?.count || 0),
    };
  }

  async getOrdersBySite(siteId: number | null): Promise<any[]> {
    const allOrders = siteId !== null
      ? await db.select().from(orders).where(eq(orders.siteId, siteId)).orderBy(desc(orders.createdAt))
      : await db.select().from(orders).orderBy(desc(orders.createdAt));
    const allCustomers = await db.select().from(customers);
    const customerMap = new Map(allCustomers.map(c => [c.id, c]));
    const allGarments = await db.select().from(garmentItems);
    const garmentsByOrder = new Map<number, typeof allGarments>();
    for (const g of allGarments) {
      const list = garmentsByOrder.get(g.orderId) || [];
      list.push(g);
      garmentsByOrder.set(g.orderId, list);
    }
    return allOrders.map(order => {
      const orderGarments = garmentsByOrder.get(order.id) || [];
      const hasReturnedItems = orderGarments.some(g => g.returnedForTreatment && !g.resolvedAt);
      return { ...order, customer: customerMap.get(order.customerId) || null, hasReturnedItems };
    });
  }

  async getCustomersBySite(siteId: number | null): Promise<Customer[]> {
    if (siteId !== null) {
      return await db.select().from(customers).where(eq(customers.siteId, siteId)).orderBy(desc(customers.createdAt));
    }
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getExpendituresBySite(siteId: number | null): Promise<Expenditure[]> {
    if (siteId !== null) {
      return await db.select().from(expenditures).where(eq(expenditures.siteId, siteId)).orderBy(desc(expenditures.date));
    }
    return await db.select().from(expenditures).orderBy(desc(expenditures.date));
  }

  async getStatsBySite(siteId: number | null): Promise<{ totalOrders: number; totalRevenue: number; pendingOrders: number; activeCustomers: number }> {
    const siteFilter = siteId !== null;
    const [ordersCount] = siteFilter
      ? await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.siteId, siteId!))
      : await db.select({ count: sql<number>`count(*)` }).from(orders);
    const siteOrderIds = siteFilter
      ? (await db.select({ id: orders.id }).from(orders).where(eq(orders.siteId, siteId!))).map(o => o.id)
      : null;
    let totalRevenue = 0;
    if (!siteFilter) {
      const [revenueResult] = await db.select({ total: sql<string>`sum(amount)` }).from(payments);
      totalRevenue = Number(revenueResult?.total || 0);
    } else if (siteOrderIds && siteOrderIds.length > 0) {
      const [revenueResult] = await db.select({ total: sql<string>`sum(amount)` }).from(payments)
        .where(sql`${payments.orderId} IN (${sql.join(siteOrderIds.map(id => sql`${id}`), sql`, `)})`);
      totalRevenue = Number(revenueResult?.total || 0);
    }
    const [pendingCount] = siteFilter
      ? await db.select({ count: sql<number>`count(*)` }).from(orders).where(and(eq(orders.siteId, siteId!), eq(orders.status, "received")))
      : await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "received"));
    const [customersCount] = siteFilter
      ? await db.select({ count: sql<number>`count(*)` }).from(customers).where(eq(customers.siteId, siteId!))
      : await db.select({ count: sql<number>`count(*)` }).from(customers);
    return {
      totalOrders: Number(ordersCount?.count || 0),
      totalRevenue,
      pendingOrders: Number(pendingCount?.count || 0),
      activeCustomers: Number(customersCount?.count || 0),
    };
  }

  async backfillNullSiteIds(): Promise<void> {
    // Use the earliest registered user's site as the legacy site for all pre-tenancy data
    const [legacyUser] = await db.select({ currentSiteId: users.currentSiteId })
      .from(users)
      .where(sql`${users.currentSiteId} IS NOT NULL`)
      .orderBy(users.createdAt)
      .limit(1);
    if (!legacyUser?.currentSiteId) return;
    const targetSiteId = legacyUser.currentSiteId;

    // Collect all siteIds currently used by any user (these are "valid" sites)
    const activeUserSites = new Set(
      (await db.select({ id: users.currentSiteId }).from(users).where(sql`${users.currentSiteId} IS NOT NULL`))
        .map(u => u.id as number)
    );

    // Move null-siteId records to the legacy site
    await db.update(orders).set({ siteId: targetSiteId }).where(isNull(orders.siteId));
    await db.update(customers).set({ siteId: targetSiteId }).where(isNull(customers.siteId));
    await db.update(expenditures).set({ siteId: targetSiteId }).where(isNull(expenditures.siteId));

    // Move records at orphaned sites (site not in any user's currentSiteId) to the legacy site
    const orderSites = await db.selectDistinct({ siteId: orders.siteId }).from(orders).where(sql`${orders.siteId} IS NOT NULL`);
    for (const { siteId } of orderSites) {
      if (siteId !== null && !activeUserSites.has(siteId)) {
        await db.update(orders).set({ siteId: targetSiteId }).where(eq(orders.siteId, siteId));
        console.log(`[backfill] Moved orphaned orders from site ${siteId} → site ${targetSiteId}`);
      }
    }
    const customerSites = await db.selectDistinct({ siteId: customers.siteId }).from(customers).where(sql`${customers.siteId} IS NOT NULL`);
    for (const { siteId } of customerSites) {
      if (siteId !== null && !activeUserSites.has(siteId)) {
        await db.update(customers).set({ siteId: targetSiteId }).where(eq(customers.siteId, siteId));
        console.log(`[backfill] Moved orphaned customers from site ${siteId} → site ${targetSiteId}`);
      }
    }
    const expSites = await db.selectDistinct({ siteId: expenditures.siteId }).from(expenditures).where(sql`${expenditures.siteId} IS NOT NULL`);
    for (const { siteId } of expSites) {
      if (siteId !== null && !activeUserSites.has(siteId)) {
        await db.update(expenditures).set({ siteId: targetSiteId }).where(eq(expenditures.siteId, siteId));
        console.log(`[backfill] Moved orphaned expenditures from site ${siteId} → site ${targetSiteId}`);
      }
    }
    console.log(`[backfill] Backfill complete. Legacy site: ${targetSiteId}, active sites: ${[...activeUserSites].join(', ')}`);
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

  private async sumPaymentsInRangeBySite(start: Date, end: Date, siteId: number | null): Promise<number> {
    if (siteId === null) return this.sumPaymentsInRange(start, end);
    const siteOrderIds = (await db.select({ id: orders.id }).from(orders).where(eq(orders.siteId, siteId))).map(o => o.id);
    if (siteOrderIds.length === 0) return 0;
    const [result] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(and(
        sql`${payments.date} IS NOT NULL`,
        sql`${payments.date} >= ${start}`,
        sql`${payments.date} <= ${end}`,
        sql`${payments.orderId} IN (${sql.join(siteOrderIds.map(id => sql`${id}`), sql`, `)})`
      ));
    return Number(result?.total || 0);
  }

  private async sumExpensesInRangeBySite(start: Date, end: Date, siteId: number | null): Promise<number> {
    if (siteId === null) return this.sumExpensesInRange(start, end);
    const [result] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(expenditures)
      .where(and(
        sql`${expenditures.date} IS NOT NULL`,
        sql`${expenditures.date} >= ${start}`,
        sql`${expenditures.date} <= ${end}`,
        eq(expenditures.siteId, siteId)
      ));
    return Number(result?.total || 0);
  }

  async getPerformanceData(siteId: number | null) {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const last30Start = new Date(now); last30Start.setDate(last30Start.getDate() - 30);
    const prev30Start = new Date(last30Start); prev30Start.setDate(prev30Start.getDate() - 30);

    const currentMonthRevenue = await this.sumPaymentsInRangeBySite(currentMonthStart, currentMonthEnd, siteId);
    const currentMonthExpenses = await this.sumExpensesInRangeBySite(currentMonthStart, currentMonthEnd, siteId);
    const currentMonthProfit = currentMonthRevenue - currentMonthExpenses;
    const last30Revenue = await this.sumPaymentsInRangeBySite(last30Start, now, siteId);
    const prev30Revenue = await this.sumPaymentsInRangeBySite(prev30Start, last30Start, siteId);
    const last30Expenses = await this.sumExpensesInRangeBySite(last30Start, now, siteId);
    const prev30Expenses = await this.sumExpensesInRangeBySite(prev30Start, last30Start, siteId);

    const monthlyComparison: { month: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthLabel = mStart.toLocaleString("en-US", { month: "short", year: "2-digit" });
      monthlyComparison.push({ month: monthLabel, income: await this.sumPaymentsInRangeBySite(mStart, mEnd, siteId), expenses: await this.sumExpensesInRangeBySite(mStart, mEnd, siteId) });
    }

    return {
      currentMonthRevenue, currentMonthExpenses, currentMonthProfit,
      last30Revenue, prev30Revenue, last30Expenses, prev30Expenses,
      last30Profit: last30Revenue - last30Expenses,
      prev30Profit: prev30Revenue - prev30Expenses,
      monthlyComparison,
    };
  }

  async getReportData(startDate: Date, endDate: Date, siteId: number | null) {
    const siteOrderWhere = siteId !== null
      ? and(sql`${orders.createdAt} >= ${startDate}`, sql`${orders.createdAt} <= ${endDate}`, eq(orders.siteId, siteId))
      : and(sql`${orders.createdAt} >= ${startDate}`, sql`${orders.createdAt} <= ${endDate}`);
    const filteredOrders = await db.select().from(orders).where(siteOrderWhere);
    const totalOrders = filteredOrders.length;

    const orderIds = filteredOrders.map(o => o.id);
    let filteredPayments: any[] = [];
    if (orderIds.length > 0) {
      filteredPayments = await db.select().from(payments)
        .where(and(
          sql`${payments.date} >= ${startDate}`,
          sql`${payments.date} <= ${endDate}`,
          sql`${payments.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`
        ));
    }
    const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const siteExpenseWhere = siteId !== null
      ? and(sql`${expenditures.date} >= ${startDate}`, sql`${expenditures.date} <= ${endDate}`, eq(expenditures.siteId, siteId))
      : and(sql`${expenditures.date} >= ${startDate}`, sql`${expenditures.date} <= ${endDate}`);
    const filteredExpenses = await db.select().from(expenditures).where(siteExpenseWhere);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const dailyRevenueMap = new Map<string, number>();
    for (const p of filteredPayments) {
      const day = p.date ? new Date(p.date).toISOString().split('T')[0] : 'unknown';
      dailyRevenueMap.set(day, (dailyRevenueMap.get(day) || 0) + Number(p.amount));
    }
    const dailyRevenue = Array.from(dailyRevenueMap.entries()).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));

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

  async getMachines(siteId: number | null, userId: string): Promise<Machine[]> {
    const where = siteId !== null ? eq(machines.siteId, siteId) : eq(machines.userId, userId);
    return await db.select().from(machines).where(where).orderBy(desc(machines.createdAt));
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

  async getEmployees(siteId: number | null, userId: string): Promise<Employee[]> {
    const where = siteId !== null ? eq(employees.siteId, siteId) : eq(employees.userId, userId);
    return await db.select().from(employees).where(where).orderBy(desc(employees.createdAt));
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

  async getDashboardData(siteId?: number | null, allSites?: boolean) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart); todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);

    const siteFilter = siteId !== null && siteId !== undefined && !allSites;
    const siteWhere = siteFilter ? eq(orders.siteId, siteId as number) : sql`1=1`;
    const expSiteWhere = siteFilter ? eq(expenditures.siteId, siteId as number) : sql`1=1`;

    const todayRevenue = await this.sumPaymentsInRangeBySite(todayStart, todayEnd, siteFilter ? siteId as number : null);
    const todayOrdersResult = await db.select({ count: sql<number>`count(*)` }).from(orders)
      .where(and(siteWhere, sql`${orders.createdAt} >= ${todayStart}`, sql`${orders.createdAt} <= ${todayEnd}`));
    const todayOrders = Number(todayOrdersResult[0]?.count || 0);

    const weekRevenue = await this.sumPaymentsInRangeBySite(weekStart, now, siteFilter ? siteId as number : null);
    const weekOrdersResult = await db.select({ count: sql<number>`count(*)` }).from(orders)
      .where(and(siteWhere, sql`${orders.createdAt} >= ${weekStart}`, sql`${orders.createdAt} <= ${now}`));
    const weekOrders = Number(weekOrdersResult[0]?.count || 0);

    const monthRevenue = await this.sumPaymentsInRangeBySite(monthStart, now, siteFilter ? siteId as number : null);
    const monthExpenses = await this.sumExpensesInRangeBySite(monthStart, now, siteFilter ? siteId as number : null);
    const monthOrdersResult = await db.select({ count: sql<number>`count(*)` }).from(orders)
      .where(and(siteWhere, sql`${orders.createdAt} >= ${monthStart}`, sql`${orders.createdAt} <= ${now}`));
    const monthOrders = Number(monthOrdersResult[0]?.count || 0);

    const profit = monthRevenue - monthExpenses;
    const dailyTarget = 50;
    const targetAchievement = dailyTarget > 0 ? Math.min(100, (todayOrders / dailyTarget) * 100) : 0;

    const statusCounts = await db.select({ status: orders.status, count: sql<number>`count(*)` }).from(orders).where(siteWhere).groupBy(orders.status);
    const ordersByStatus: any = { received: 0, washing: 0, ready: 0, delivered: 0 };
    for (const s of statusCounts) {
      if (s.status === "received" || s.status === "pending") ordersByStatus.received = (ordersByStatus.received || 0) + Number(s.count);
      else if (s.status === "washing" || s.status === "processing") ordersByStatus.washing = (ordersByStatus.washing || 0) + Number(s.count);
      else if (s.status === "ready") ordersByStatus.ready = Number(s.count);
      else if (s.status === "delivered") ordersByStatus.delivered = Number(s.count);
    }

    const revenueByDay: { date: string; value: number }[] = [];
    const kgByDay: { date: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - i); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999);
      const dateStr = dayStart.toISOString().split('T')[0];
      const rev = await this.sumPaymentsInRangeBySite(dayStart, dayEnd, siteFilter ? siteId as number : null);
      revenueByDay.push({ date: dateStr, value: rev });
      kgByDay.push({ date: dateStr, value: 0 });
    }

    const costPerKg = monthRevenue > 0 ? monthExpenses / Math.max(monthOrders, 1) : 0;
    const profitPerKg = monthRevenue > 0 ? profit / Math.max(monthOrders, 1) : 0;

    const alerts: { type: string; message: string; detail?: string }[] = [];
    const pendingResult = await db.select({ count: sql<number>`count(*)` }).from(orders).where(and(siteWhere, eq(orders.status, "received")));
    const pendingCount = Number(pendingResult[0]?.count || 0);
    if (pendingCount > 10) alerts.push({ type: "warning", message: `You have ${pendingCount} pending orders`, detail: "Consider processing them soon" });
    if (monthExpenses > monthRevenue && monthRevenue > 0) alerts.push({ type: "danger", message: "Expenses exceed revenue this month", detail: "Review your expenditure logs" });

    const returnedGarments = await db.select({ count: sql<number>`count(*)` }).from(garmentItems)
      .where(and(eq(garmentItems.returnedForTreatment, true), sql`${garmentItems.resolvedAt} IS NULL`));
    const returnedCount = Number(returnedGarments[0]?.count || 0);
    if (returnedCount > 0) alerts.push({ type: "warning", message: `${returnedCount} garment(s) returned for treatment`, detail: "Check orders with returned items" });

    // Build site overview for All Sites mode
    let sitesOverview: { id: number; name: string; city?: string | null; memberCount: number; isActive: boolean }[] = [];
    if (allSites) {
      const allSiteRows = await db.select().from(sites).where(eq(sites.isActive, true));
      const memberCounts = await db.select({ siteId: siteMembers.siteId, count: sql<number>`count(*)` })
        .from(siteMembers).groupBy(siteMembers.siteId);
      const countMap: Record<number, number> = {};
      for (const mc of memberCounts) countMap[mc.siteId] = Number(mc.count);
      sitesOverview = allSiteRows.map(s => ({
        id: s.id, name: s.name, city: s.city, memberCount: countMap[s.id] ?? 0, isActive: s.isActive ?? true,
      }));
    }

    const readyOrders = await db.select().from(orders).where(and(siteWhere, eq(orders.status, "ready"))).orderBy(desc(orders.updatedAt));
    const readyCustomers = siteFilter
      ? await db.select().from(customers).where(eq(customers.siteId, siteId as number))
      : await db.select().from(customers);
    const readyCustMap = new Map(readyCustomers.map(c => [c.id, c]));
    const readyForPickup = readyOrders.map(o => ({ ...o, customer: readyCustMap.get(o.customerId) || null }));

    return {
      todayKg: 0, todayOrders, todayRevenue,
      weekOrders, weekRevenue,
      monthKg: 0, monthOrders, monthRevenue, monthExpenses,
      profit, costPerKg, profitPerKg, dailyTarget, targetAchievement,
      ordersByStatus, revenueByDay, kgByDay, alerts,
      readyForPickup,
      isAllSites: allSites ?? false,
      siteCount: sitesOverview.length,
      sitesOverview,
    };
  }

  async getAnalyticsKpis(period: string, siteId: number | null) {
    const now = new Date();
    let start: Date;
    if (period === "day") { start = new Date(now); start.setHours(0, 0, 0, 0); }
    else if (period === "week") { start = new Date(now); start.setDate(start.getDate() - 7); }
    else if (period === "year") { start = new Date(now.getFullYear(), 0, 1); }
    else { start = new Date(now.getFullYear(), now.getMonth(), 1); }

    const totalRevenue = await this.sumPaymentsInRangeBySite(start, now, siteId);
    const totalExpenses = await this.sumExpensesInRangeBySite(start, now, siteId);
    const ordersWhere = siteId !== null
      ? and(sql`${orders.createdAt} >= ${start}`, sql`${orders.createdAt} <= ${now}`, eq(orders.siteId, siteId))
      : and(sql`${orders.createdAt} >= ${start}`, sql`${orders.createdAt} <= ${now}`);
    const ordersResult = await db.select({ count: sql<number>`count(*)` }).from(orders).where(ordersWhere);
    const totalOrders = Number(ordersResult[0]?.count || 0);
    const profit = totalRevenue - totalExpenses;

    const machineWhere = siteId !== null ? eq(machines.siteId, siteId) : undefined;
    const allMachines = machineWhere ? await db.select().from(machines).where(machineWhere) : await db.select().from(machines);
    const machineUtilization = allMachines.length > 0
      ? allMachines.reduce((sum, m) => sum + Number(m.utilizationRate), 0) / allMachines.length : 0;

    const employeeWhere = siteId !== null ? eq(employees.siteId, siteId) : undefined;
    const allEmployees = employeeWhere ? await db.select().from(employees).where(employeeWhere) : await db.select().from(employees);
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

  async getWasteAlerts(siteId: number | null): Promise<any[]> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthExpenses = await this.sumExpensesInRangeBySite(monthStart, now, siteId);
    const monthRevenue = await this.sumPaymentsInRangeBySite(monthStart, now, siteId);
    const alerts: any[] = [];

    if (monthExpenses > monthRevenue * 0.8 && monthRevenue > 0) {
      alerts.push({ category: "Cost", severity: "high", type: "costs_high" });
    }

    const expenseCatWhere = siteId !== null
      ? and(sql`${expenditures.date} >= ${monthStart}`, sql`${expenditures.date} <= ${now}`, eq(expenditures.siteId, siteId))
      : and(sql`${expenditures.date} >= ${monthStart}`, sql`${expenditures.date} <= ${now}`);
    const expensesByCategory = await db.select({ category: expenditures.category, total: sql<string>`SUM(amount)` })
      .from(expenditures).where(expenseCatWhere)
      .groupBy(expenditures.category);
    
    for (const cat of expensesByCategory) {
      if (Number(cat.total) > monthRevenue * 0.3 && monthRevenue > 0) {
        const pct = Math.round((Number(cat.total) / monthRevenue) * 100);
        alerts.push({ category: cat.category, severity: "medium", type: "category_pct", pct });
      }
    }

    return alerts;
  }

  async getPerformanceScore(siteId: number | null) {
    const machineWhere = siteId !== null ? eq(machines.siteId, siteId) : undefined;
    const allMachines = machineWhere ? await db.select().from(machines).where(machineWhere) : await db.select().from(machines);
    const machineUsage = allMachines.length > 0
      ? allMachines.reduce((sum, m) => sum + Number(m.utilizationRate), 0) / allMachines.length : 50;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRevenue = await this.sumPaymentsInRangeBySite(monthStart, now, siteId);
    const monthExpenses = await this.sumExpensesInRangeBySite(monthStart, now, siteId);
    const costEfficiency = monthRevenue > 0 ? Math.min(100, Math.max(0, ((monthRevenue - monthExpenses) / monthRevenue) * 100)) : 50;

    const employeeWhere = siteId !== null ? eq(employees.siteId, siteId) : undefined;
    const allEmployees = employeeWhere ? await db.select().from(employees).where(employeeWhere) : await db.select().from(employees);
    const productivity = allEmployees.length > 0
      ? Math.min(100, allEmployees.reduce((sum, e) => sum + Number(e.kgProcessed), 0) / (allEmployees.length * 10)) : 50;

    const wasteAlerts = await this.getWasteAlerts(siteId);
    const wasteLevel = Math.max(0, 100 - wasteAlerts.length * 20);

    const total = Math.round((machineUsage + costEfficiency + productivity + wasteLevel) / 4);
    let grade = "F";
    if (total >= 90) grade = "A"; else if (total >= 80) grade = "B"; else if (total >= 70) grade = "C"; else if (total >= 60) grade = "D";

    return { total, machineUsage: Math.round(machineUsage), costEfficiency: Math.round(costEfficiency), productivity: Math.round(productivity), wasteLevel: Math.round(wasteLevel), grade };
  }

  // ─── Business Settings (Prompt A) ───────────────────────────────────────────

  async getSettings(userId: string): Promise<BusinessSettings> {
    const [existing] = await db.select().from(businessSettings).where(eq(businessSettings.userId, userId));
    if (existing) return existing;
    const [userRow] = await db.select().from(users).where(eq(users.id, userId));
    const [created] = await db.insert(businessSettings).values({
      userId,
      businessName: userRow?.businessName || "My Laundry",
    }).returning();
    return created;
  }

  async upsertSettings(userId: string, data: Partial<InsertBusinessSettings>): Promise<BusinessSettings> {
    const [existing] = await db.select().from(businessSettings).where(eq(businessSettings.userId, userId));
    if (existing) {
      const [updated] = await db.update(businessSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(businessSettings.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(businessSettings).values({ userId, ...data }).returning();
    return created;
  }

  // ─── Multi-Site (Prompt B) ───────────────────────────────────────────────────

  async getOrganisationByOwner(ownerId: string): Promise<Organisation | null> {
    const [org] = await db.select().from(organisations).where(eq(organisations.ownerId, ownerId));
    return org || null;
  }

  async createOrganisationWithSite(ownerId: string, orgName: string, siteName: string): Promise<{ organisation: Organisation; site: Site }> {
    return await db.transaction(async (tx) => {
      const [org] = await tx.insert(organisations).values({ name: orgName, ownerId }).returning();
      const [site] = await tx.insert(sites).values({ organisationId: org.id, name: siteName }).returning();
      await tx.insert(siteMembers).values({ siteId: site.id, userId: ownerId, role: "owner" });
      await tx.update(users).set({ organisationId: org.id, currentSiteId: site.id }).where(eq(users.id, ownerId));
      return { organisation: org, site };
    });
  }

  async getSites(organisationId: number): Promise<(Site & { memberCount: number })[]> {
    const allSites = await db.select().from(sites)
      .where(and(eq(sites.organisationId, organisationId), eq(sites.isActive, true)))
      .orderBy(sites.name);
    const result = [];
    for (const site of allSites) {
      const [cnt] = await db.select({ count: sql<number>`count(*)` }).from(siteMembers).where(eq(siteMembers.siteId, site.id));
      result.push({ ...site, memberCount: Number(cnt?.count || 0) });
    }
    return result;
  }

  async getSite(siteId: number): Promise<Site | null> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId));
    return site || null;
  }

  async createSite(organisationId: number, data: { name: string; address?: string; city?: string; phone?: string }): Promise<Site> {
    const [site] = await db.insert(sites).values({ organisationId, ...data }).returning();
    return site;
  }

  async updateSite(id: number, data: Partial<InsertSite>): Promise<Site | undefined> {
    const [updated] = await db.update(sites).set(data).where(eq(sites.id, id)).returning();
    return updated;
  }

  async deleteSite(id: number): Promise<boolean> {
    const [updated] = await db.update(sites).set({ isActive: false }).where(eq(sites.id, id)).returning();
    return !!updated;
  }

  async getSiteMembers(siteId: number): Promise<(SiteMember & { name: string; email: string | null; phone: string | null })[]> {
    const members = await db.select().from(siteMembers).where(eq(siteMembers.siteId, siteId));
    const result = [];
    for (const m of members) {
      const [u] = await db.select().from(users).where(eq(users.id, m.userId));
      result.push({ ...m, name: `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || m.userId, email: u?.email || null, phone: u?.phone || null });
    }
    return result;
  }

  async addSiteMember(siteId: number, userId: string, role: string): Promise<SiteMember> {
    const [existing] = await db.select().from(siteMembers).where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId)));
    if (existing) {
      const [updated] = await db.update(siteMembers).set({ role }).where(eq(siteMembers.id, existing.id)).returning();
      return updated;
    }
    const [member] = await db.insert(siteMembers).values({ siteId, userId, role }).returning();
    return member;
  }

  async removeSiteMember(siteId: number, userId: string): Promise<boolean> {
    const [deleted] = await db.delete(siteMembers).where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId))).returning();
    return !!deleted;
  }

  async updateSiteMemberRole(siteId: number, userId: string, role: string): Promise<SiteMember | undefined> {
    const [updated] = await db.update(siteMembers).set({ role }).where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId))).returning();
    return updated;
  }

  async createInvitation(data: { siteId: number; organisationId: number; invitedBy: string; identifier: string; role: string }): Promise<SiteInvitation> {
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const [inv] = await db.insert(siteInvitations).values({ ...data, token, status: "pending", expiresAt }).returning();
    return inv;
  }

  async getInvitationByToken(token: string): Promise<(SiteInvitation & { siteName: string; organisationName: string; inviterName: string }) | null> {
    const [inv] = await db.select().from(siteInvitations).where(eq(siteInvitations.token, token));
    if (!inv) return null;
    const [site] = await db.select().from(sites).where(eq(sites.id, inv.siteId));
    const [org] = await db.select().from(organisations).where(eq(organisations.id, inv.organisationId));
    const [inviter] = await db.select().from(users).where(eq(users.id, inv.invitedBy));
    return {
      ...inv,
      siteName: site?.name || "Unknown Site",
      organisationName: org?.name || "Unknown Organisation",
      inviterName: `${inviter?.firstName || ''} ${inviter?.lastName || ''}`.trim() || "Someone",
    };
  }

  async acceptInvitation(token: string, userId: string): Promise<SiteInvitation | null> {
    const [inv] = await db.select().from(siteInvitations).where(eq(siteInvitations.token, token));
    if (!inv || inv.status !== "pending" || inv.expiresAt < new Date()) return null;
    return await db.transaction(async (tx) => {
      const existing = await tx.select().from(siteMembers).where(and(eq(siteMembers.siteId, inv.siteId), eq(siteMembers.userId, userId)));
      if (existing.length === 0) {
        await tx.insert(siteMembers).values({ siteId: inv.siteId, userId, role: inv.role });
      }
      const [site] = await tx.select().from(sites).where(eq(sites.id, inv.siteId));
      await tx.update(users).set({ currentSiteId: inv.siteId, organisationId: site?.organisationId }).where(eq(users.id, userId));
      const [updated] = await tx.update(siteInvitations).set({ status: "accepted" }).where(eq(siteInvitations.id, inv.id)).returning();
      return updated;
    });
  }

  async getPendingInvitations(organisationId: number): Promise<(SiteInvitation & { siteName: string })[]> {
    const invs = await db.select().from(siteInvitations)
      .where(and(eq(siteInvitations.organisationId, organisationId), eq(siteInvitations.status, "pending")))
      .orderBy(desc(siteInvitations.createdAt));
    const result = [];
    for (const inv of invs) {
      const [site] = await db.select().from(sites).where(eq(sites.id, inv.siteId));
      result.push({ ...inv, siteName: site?.name || "Unknown" });
    }
    return result;
  }

  async revokeInvitation(id: number): Promise<boolean> {
    const [updated] = await db.update(siteInvitations).set({ status: "expired" }).where(eq(siteInvitations.id, id)).returning();
    return !!updated;
  }

  async switchSite(userId: string, siteId: number | null): Promise<void> {
    await db.update(users).set({ currentSiteId: siteId }).where(eq(users.id, userId));
  }

  async getUserSiteRole(userId: string, siteId: number): Promise<string | null> {
    const [member] = await db.select().from(siteMembers).where(and(eq(siteMembers.userId, userId), eq(siteMembers.siteId, siteId)));
    return member?.role || null;
  }

  async migrateToMultiSite(): Promise<void> {
    const allUsers = await db.select().from(users);
    for (const user of allUsers) {
      if (user.organisationId) continue;
      try {
        const orgName = user.businessName || `${user.firstName || 'My'} Business`;
        const siteName = user.businessName || "Main Site";
        const [org] = await db.insert(organisations).values({ name: orgName, ownerId: user.id }).returning();
        const [site] = await db.insert(sites).values({ organisationId: org.id, name: siteName }).returning();
        const existing = await db.select().from(siteMembers).where(and(eq(siteMembers.siteId, site.id), eq(siteMembers.userId, user.id)));
        if (existing.length === 0) {
          await db.insert(siteMembers).values({ siteId: site.id, userId: user.id, role: "owner" });
        }
        await db.update(users).set({ organisationId: org.id, currentSiteId: site.id }).where(eq(users.id, user.id));
      } catch (err) {
        console.error(`migrateToMultiSite: error for user ${user.id}:`, err);
      }
    }
  }
}

export const storage = new DatabaseStorage();
