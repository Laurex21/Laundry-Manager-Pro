import { db } from "./db";
import { 
  customers, services, orders, orderItems, payments, expenditures, garmentItems,
  machines, employees, employeeActivities, employeeAttendance, machineUsage,
  plans, subscriptions, subscriptionPayments, orderStatusHistory,
  orderCorrections,
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
  type InsertEmployeeActivity,
  type InsertEmployeeAttendance,
  type InsertMachineUsage,
  type Plan,
  type Subscription, type SubscriptionWithPlan,
  type OrderWithDetails, type OrderStatusHistoryEntry,
  type BusinessSettings, type InsertBusinessSettings,
  type Organisation, type Site, type SiteMember, type SiteInvitation
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { eq, ne, desc, asc, sql, and, gte, lte, inArray, or, isNull } from "drizzle-orm";
import { formatReportingDay } from "./lib/reporting-date";
import { refreshCustomerAnalyticsFromHistory } from "./lib/temporal-intelligence";
import { ensureOrderItemQuantitySupportsDecimals } from "./lib/order-item-quantity-schema";
import { aggregateCustomerReportMetrics } from "./lib/customer-report-metrics";

let businessSettingsSchemaReady = false;

async function ensureBusinessSettingsSchema(): Promise<void> {
  if (businessSettingsSchemaReady) return;
  await db.execute(sql`
    ALTER TABLE business_settings
    ADD COLUMN IF NOT EXISTS company_registration_number varchar(100) DEFAULT ''
  `);
  await db.execute(sql`
    ALTER TABLE business_settings
    ADD COLUMN IF NOT EXISTS whatsapp_app_preference varchar(20) NOT NULL DEFAULT 'ask'
  `);
  businessSettingsSchemaReady = true;
}

export interface IStorage {
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;

  getServices(): Promise<Service[]>;
  getServicesBySite(siteId: number | number[] | null): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: number): Promise<boolean>;

  getOrders(): Promise<any[]>;
  getOrder(id: number): Promise<OrderWithDetails | undefined>;
  createOrder(order: InsertOrder, items: { serviceId: number; quantity: number }[], garments?: { itemName: string; quantity: number; color?: string | null }[]): Promise<Order>;
  updateOrderStatus(id: number, status: string, paymentStatus?: string, changedBy?: string | null): Promise<Order | undefined>;
  getOrderStatusHistory(orderId: number): Promise<OrderStatusHistoryEntry[]>;
  
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentsByOrder(orderId: number): Promise<Payment[]>;

  getCustomerOrders(customerId: number): Promise<any[]>;

  getGarmentItem(id: number): Promise<GarmentItem | undefined>;
  markGarmentReturned(id: number, returnStage: string, returnNotes?: string): Promise<GarmentItem | undefined>;
  resolveGarmentReturn(id: number): Promise<GarmentItem | undefined>;

  getExpenditures(): Promise<Expenditure[]>;
  getExpenditure(id: number): Promise<Expenditure | undefined>;
  createExpenditure(expenditure: InsertExpenditure): Promise<Expenditure>;
  updateExpenditure(id: number, data: Partial<InsertExpenditure>): Promise<Expenditure | undefined>;
  deleteExpenditure(id: number): Promise<boolean>;

  getPublicStats(): Promise<{ totalOrders: number; totalCustomers: number; totalTransactions: number; totalLaundries: number; totalGarments: number; totalCountries: number }>;
  getStats(): Promise<{ totalOrders: number; totalRevenue: number; pendingOrders: number; activeCustomers: number }>;

  getPerformanceData(siteId: number | number[] | null, startDate?: Date, endDate?: Date): Promise<{
    currentMonthRevenue: number; currentMonthExpenses: number; currentMonthProfit: number;
    last30Revenue: number; prev30Revenue: number; last30Expenses: number; prev30Expenses: number;
    last30Profit: number; prev30Profit: number;
    monthlyComparison: { month: string; income: number; expenses: number }[];
  }>;

  getReportData(startDate: Date, endDate: Date, siteId: number | number[] | null): Promise<{
    totalRevenue: number; totalExpenses: number; netProfit: number; totalOrders: number;
    dailyRevenue: { date: string; revenue: number }[];
    serviceDistribution: { name: string; count: number }[];
    topCustomers: { name: string; orderCount: number; orderValue: number; amountCollected: number; outstandingBalance: number }[];
    customerAreas: { area: string; customerCount: number; orderCount: number; orderValue: number; amountCollected: number; outstandingBalance: number }[];
  }>;

  getMachines(siteId: number | number[] | null, userId: string): Promise<Machine[]>;
  getMachine(id: number): Promise<Machine | undefined>;
  createMachine(machine: InsertMachine): Promise<Machine>;
  updateMachine(id: number, data: Partial<InsertMachine>): Promise<Machine | undefined>;
  deleteMachine(id: number): Promise<boolean>;
  createMachineUsage(data: InsertMachineUsage): Promise<any>;

  getEmployees(siteId: number | number[] | null, userId: string): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  getOrCreateActorEmployee(actorUserId: string, siteId: number): Promise<Employee>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<boolean>;
  createEmployeeActivity(activity: InsertEmployeeActivity): Promise<any>;
  createEmployeeAttendance(attendance: InsertEmployeeAttendance): Promise<any>;

  getPlans(): Promise<Plan[]>;
  getPlan(id: number): Promise<Plan | undefined>;
  seedPlans(): Promise<void>;

  getUserSubscription(userId: string): Promise<SubscriptionWithPlan | null>;
  createSubscription(userId: string, planId: number, method: string): Promise<Subscription>;

  requestCancellation(id: number, reason: string, requestedBy: string): Promise<Order | undefined>;
  approveCancellation(id: number, reviewedBy: string): Promise<Order | undefined>;
  rejectCancellation(id: number, reviewedBy: string, note: string): Promise<Order | undefined>;
  getPendingCancellations(siteId: number | number[] | null): Promise<any[]>;
  markDelivered(id: number, deliveredAt: Date): Promise<Order | undefined>;
  getProductionDelays(siteId: number | number[] | null): Promise<any[]>;

  getOrdersBySite(siteId: number | number[] | null): Promise<any[]>;
  getCustomersBySite(siteId: number | number[] | null): Promise<Customer[]>;
  getExpendituresBySite(siteId: number | number[] | null): Promise<Expenditure[]>;
  getStatsBySite(siteId: number | number[] | null): Promise<{ totalOrders: number; totalRevenue: number; pendingOrders: number; activeCustomers: number }>;
  backfillNullSiteIds(): Promise<void>;

  getDashboardData(siteId?: number | number[] | null, allSites?: boolean): Promise<any>;
  getAnalyticsKpis(period: string, siteId: number | number[] | null): Promise<any>;
  getWasteAlerts(siteId: number | number[] | null): Promise<any[]>;
  getPerformanceScore(siteId: number | number[] | null): Promise<any>;
  getAdvancedAnalytics(period: string, siteId: number | number[] | null, planSlug?: string): Promise<any>;
  getCustomerBehaviorAnalytics(period: string, siteId: number | number[] | null): Promise<any>;
  getStorageOccupancyAlerts(siteId: number | number[] | null): Promise<any[]>;

  getSettings(userId: string): Promise<BusinessSettings>;
  upsertSettings(userId: string, data: Partial<InsertBusinessSettings>): Promise<BusinessSettings>;

  getOrganisationByOwner(ownerId: string): Promise<Organisation | null>;
  createOrganisationWithSite(ownerId: string, orgName: string, siteName: string): Promise<{ organisation: Organisation; site: Site }>;
  getSites(organisationId: number): Promise<(Site & { memberCount: number })[]>;
  getSite(siteId: number): Promise<Site | null>;
  createSite(organisationId: number, data: { name: string; address?: string; city?: string; phone?: string }): Promise<Site>;
  updateSite(id: number, data: { name: string; address: string; city: string; phone: string }): Promise<Site | undefined>;
  deleteSite(id: number): Promise<boolean>;
  getSiteMembers(siteId: number): Promise<(SiteMember & { name: string; email: string | null; phone: string | null })[]>;
  addSiteMember(siteId: number, userId: string, role: string): Promise<SiteMember>;
  removeSiteMember(siteId: number, userId: string): Promise<boolean>;
  updateSiteMemberRole(siteId: number, userId: string, role: string): Promise<SiteMember | undefined>;
  createInvitation(data: { siteId: number; organisationId: number; invitedBy: string; identifier: string; role: string }): Promise<SiteInvitation>;
  getInvitationByToken(token: string): Promise<(SiteInvitation & { siteName: string; organisationName: string; inviterName: string }) | null>;
  createStaffFromInvitation(token: string, data: { email?: string | null; phone?: string | null; passwordHash: string; firstName?: string | null; lastName?: string | null }): Promise<User | null>;
  acceptInvitation(token: string, userId: string): Promise<SiteInvitation | null>;
  getPendingInvitations(organisationId: number): Promise<(SiteInvitation & { siteName: string })[]>;
  revokeInvitation(id: number): Promise<boolean>;
  switchSite(userId: string, siteId: number | null): Promise<void>;
  migrateToMultiSite(): Promise<void>;
  getUserSiteRole(userId: string, siteId: number): Promise<string | null>;
}

export class DatabaseStorage implements IStorage {
  private siteIds(scope: number | number[] | null | undefined): number[] {
    if (Array.isArray(scope)) return scope.filter((siteId) => Number.isInteger(siteId));
    if (typeof scope === "number") return [scope];
    return [];
  }

  private siteWhere(column: any, scope: number | number[] | null | undefined) {
    const siteIds = this.siteIds(scope);
    if (siteIds.length === 0) return sql`false`;
    return inArray(column, siteIds);
  }

  private async customersForScopedOrders(orderRows: { customerId: number }[]): Promise<Customer[]> {
    const customerIds = Array.from(new Set(orderRows.map((order) => order.customerId).filter((id) => Number.isInteger(id))));
    if (customerIds.length === 0) return [];
    return await db.select().from(customers).where(inArray(customers.id, customerIds));
  }

  private async withSiteOrderNumbers<T extends { id: number; siteId: number | null; orderNumber?: number | null }>(rows: T[]): Promise<(T & { orderNumber: number })[]> {
    const scopes = Array.from(new Set(rows.map((row) => row.siteId).filter((siteId): siteId is number => typeof siteId === "number")));
    const fallbackNumbers = new Map<number, number>();

    for (const siteId of scopes) {
      const siteRows = await db.select({ id: orders.id })
        .from(orders)
        .where(eq(orders.siteId, siteId))
        .orderBy(asc(orders.createdAt), asc(orders.id));
      siteRows.forEach((row, index) => fallbackNumbers.set(row.id, index + 1));
    }

    return rows.map((row) => ({
      ...row,
      orderNumber: fallbackNumbers.get(row.id) ?? row.id,
    }));
  }

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

  async getServicesBySite(siteId: number | number[] | null): Promise<Service[]> {
    const siteWhere = this.siteWhere(services.siteId, siteId);
    return await db.select().from(services)
      .where(and(eq(services.active, true), siteWhere))
      .orderBy(services.name);
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
    const allOrders = await this.withSiteOrderNumbers(await db.select().from(orders).orderBy(desc(orders.createdAt)));
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
    const [orderWithNumber] = await this.withSiteOrderNumbers([order]);

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
    const employeeIds = new Set<number>();
    if (order.createdByEmployeeId) employeeIds.add(order.createdByEmployeeId);
    for (const payment of orderPayments) {
      if (payment.collectedByEmployeeId) employeeIds.add(payment.collectedByEmployeeId);
    }
    const orderEmployees = employeeIds.size > 0
      ? await db.select().from(employees).where(inArray(employees.id, Array.from(employeeIds)))
      : [];
    const employeeMap = new Map(orderEmployees.map((employee) => [employee.id, employee]));
    const paymentsWithEmployees = orderPayments.map((payment) => ({
      ...payment,
      collectedByEmployee: payment.collectedByEmployeeId ? employeeMap.get(payment.collectedByEmployeeId) || null : null,
    }));
    const orderGarments = await db.select().from(garmentItems).where(eq(garmentItems.orderId, id));
    const history = await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, id)).orderBy(orderStatusHistory.changedAt);
    const corrections = await db.select().from(orderCorrections).where(eq(orderCorrections.orderId, id)).orderBy(desc(orderCorrections.createdAt));

    return {
      ...orderWithNumber,
      customer,
      items,
      payments: paymentsWithEmployees,
      garmentItems: orderGarments,
      statusHistory: history,
      corrections,
      createdByEmployee: order.createdByEmployeeId ? employeeMap.get(order.createdByEmployeeId) || null : null,
    };
  }

  async createOrder(insertOrder: InsertOrder, items: { serviceId: number; quantity: number }[], garments?: { itemName: string; quantity: number; color?: string | null }[]): Promise<Order> {
    await ensureOrderItemQuantitySupportsDecimals();
    const created = await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values(insertOrder).returning();
      let orderWithNumber = { ...order, orderNumber: order.id };
      if (typeof order.siteId === "number") {
        const siteRows = await tx.select({ id: orders.id })
          .from(orders)
          .where(eq(orders.siteId, order.siteId))
          .orderBy(asc(orders.createdAt), asc(orders.id));
        const index = siteRows.findIndex((row) => row.id === order.id);
        orderWithNumber = { ...order, orderNumber: index >= 0 ? index + 1 : order.id };
      }

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
          await tx.insert(garmentItems).values({ orderId: order.id, itemName: garment.itemName, quantity: garment.quantity, color: garment.color || null });
        }
      }

      return orderWithNumber;
    });
    await refreshCustomerAnalyticsFromHistory(created.customerId);
    return created;
  }

  async updateOrderStatus(id: number, status: string, paymentStatus?: string, changedBy?: string | null): Promise<Order | undefined> {
    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existing) return undefined;
    const now = new Date();
    const updates: any = { status, updatedAt: new Date() };
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    if (status === "ready" && !existing.readyAt) updates.readyAt = now;
    if (status === "delivered" && !existing.deliveredAt) updates.deliveredAt = now;
    if (status === "cancelled" && !existing.cancelledAt) updates.cancelledAt = now;
    const [updated] = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    if (updated) {
      await db.insert(orderStatusHistory).values({
        orderId: id,
        status,
        changedBy: changedBy || null,
      });
      if (status === "cancelled") await refreshCustomerAnalyticsFromHistory(updated.customerId);
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
      cancelledAt: new Date(),
      cancellationReviewedBy: reviewedBy,
      cancellationReviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(orders.id, id)).returning();
    if (updated) {
      await db.insert(orderStatusHistory).values({ orderId: id, status: "cancelled", changedBy: reviewedBy, notes: "Cancellation approved" });
      await refreshCustomerAnalyticsFromHistory(updated.customerId);
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

  async getPendingCancellations(siteId: number | number[] | null): Promise<any[]> {
    const siteWhere = this.siteWhere(orders.siteId, siteId);
    const pendingOrders = await db.select().from(orders)
      .where(siteWhere ? and(eq(orders.status, "cancellation_requested"), siteWhere) : eq(orders.status, "cancellation_requested"))
      .orderBy(desc(orders.updatedAt));
    const allCustomers = siteWhere ? await db.select().from(customers).where(this.siteWhere(customers.siteId, siteId)!) : await db.select().from(customers);
    const customerMap = new Map(allCustomers.map(c => [c.id, c]));
    return pendingOrders.map(o => ({ ...o, customer: customerMap.get(o.customerId) || null }));
  }

  async markDelivered(id: number, deliveredAt: Date): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;
    const serverDeliveredAt = new Date();

    const [updated] = await db.update(orders).set({
      status: "delivered",
      deliveredAt: order.deliveredAt ?? serverDeliveredAt,
      updatedAt: new Date(),
    }).where(eq(orders.id, id)).returning();

    if (updated) {
      await db.insert(orderStatusHistory).values({
        orderId: id,
        status: "delivered",
        notes: `Delivered on ${deliveredAt.toISOString().split('T')[0]}`,
      });

      const effectiveDeliveredAt = updated.deliveredAt ? new Date(updated.deliveredAt) : serverDeliveredAt;
      const isOnTime = !order.pickupDate || effectiveDeliveredAt <= new Date(order.pickupDate);
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

  async getProductionDelays(siteId: number | number[] | null): Promise<any[]> {
    const activeStatuses = ["received", "sorting", "stain_treatment", "washing", "drying", "ironing", "packaging"];
    const statusFilter = sql`${orders.status} = ANY(${sql`ARRAY[${sql.join(activeStatuses.map(s => sql`${s}`), sql`, `)}]`})`;
    const siteWhere = this.siteWhere(orders.siteId, siteId);
    const activeOrders = await db.select().from(orders)
      .where(siteWhere ? and(statusFilter, siteWhere) : statusFilter);
    const allCustomers = await this.customersForScopedOrders(activeOrders);
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

  private analyticsStart(period: string): Date {
    const now = new Date();
    if (period === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === "week") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    if (period === "year") return new Date(now.getFullYear(), 0, 1);
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private hourlyBuckets(rows: Date[]): { hour: number; count: number; intensity: string }[] {
    const counts = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, intensity: "muted" }));
    for (const date of rows) counts[date.getHours()].count += 1;
    const sorted = counts.map((row) => row.count).sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
    const p25 = percentile(0.25);
    const p50 = percentile(0.5);
    const p75 = percentile(0.75);
    return counts.map((row) => ({
      ...row,
      intensity: row.count >= p75 && row.count > 0 ? "full" : row.count >= p50 && row.count > 0 ? "medium" : row.count >= p25 && row.count > 0 ? "low" : "muted",
    }));
  }

  private dayBuckets(rows: Date[]): { day: string; count: number; intensity: string }[] {
    const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const counts = names.map((day) => ({ day, count: 0, intensity: "muted" }));
    for (const date of rows) {
      const index = (date.getDay() + 6) % 7;
      counts[index].count += 1;
    }
    const sorted = counts.map((row) => row.count).sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
    const p25 = percentile(0.25);
    const p50 = percentile(0.5);
    const p75 = percentile(0.75);
    return counts.map((row) => ({
      ...row,
      intensity: row.count >= p75 && row.count > 0 ? "full" : row.count >= p50 && row.count > 0 ? "medium" : row.count >= p25 && row.count > 0 ? "low" : "muted",
    }));
  }

  async getStorageOccupancyAlerts(siteId: number | number[] | null): Promise<any[]> {
    const siteWhere = this.siteWhere(orders.siteId, siteId);
    const now = new Date();
    const readyRows = await db.select().from(orders)
      .where(and(
        siteWhere,
        eq(orders.status, "ready"),
        sql`${orders.deliveredAt} IS NULL`,
        sql`COALESCE(${orders.readyAt}, ${orders.updatedAt}, ${orders.createdAt}) < ${new Date(now.getTime() - 3 * 86400000)}`,
      ))
      .orderBy(asc(orders.readyAt), asc(orders.updatedAt));
    if (!readyRows.length) return [];
    const scopedCustomers = await this.customersForScopedOrders(readyRows);
    const customerMap = new Map(scopedCustomers.map((customer) => [customer.id, customer]));
    return readyRows.map((order) => {
      const customer = customerMap.get(order.customerId) || null;
      const readyDate = order.readyAt || order.updatedAt || order.createdAt || new Date();
      const daysWaiting = Math.max(0, Math.floor((now.getTime() - new Date(readyDate).getTime()) / 86400000));
      const firstName = (customer?.name || "").trim().split(/\s+/)[0] || "client";
      const message = `Bonjour ${firstName},\n\nVos vêtements sont prêts depuis ${daysWaiting} jours.\n\nVous pouvez venir les récupérer à votre convenance.\n\nMerci.`;
      return {
        ...order,
        customer,
        readyDate,
        daysWaiting,
        whatsappMessage: message,
        whatsappUrl: customer?.phone ? `https://wa.me/${String(customer.phone).replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}` : null,
      };
    });
  }

  async getCustomerBehaviorAnalytics(period: string, siteId: number | number[] | null) {
    const start = this.analyticsStart(period);
    const now = new Date();
    const siteWhere = this.siteWhere(orders.siteId, siteId);
    const customerSiteWhere = this.siteWhere(customers.siteId, siteId);
    const orderRows = await db.select().from(orders)
      .where(and(siteWhere, sql`${orders.createdAt} >= ${start}`, sql`${orders.createdAt} <= ${now}`, ne(orders.status, "cancelled")));
    const deliveredRows = await db.select().from(orders)
      .where(and(siteWhere, sql`${orders.deliveredAt} IS NOT NULL`, sql`${orders.deliveredAt} >= ${start}`, sql`${orders.deliveredAt} <= ${now}`, ne(orders.status, "cancelled")));
    const paymentRows = await db.select({
      orderCreatedAt: orders.createdAt,
      paymentDate: payments.date,
    }).from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(and(siteWhere, sql`${payments.date} >= ${start}`, sql`${payments.date} <= ${now}`, ne(orders.status, "cancelled")));

    const customersBySite = await db.select().from(customers).where(customerSiteWhere);
    const customersByOrder = await this.customersForScopedOrders([...orderRows, ...deliveredRows]);
    const scopedCustomers = Array.from(new Map([...customersBySite, ...customersByOrder].map((customer) => [customer.id, customer])).values());
    const depositDates = orderRows
      .map((order) => order.createdAt ? new Date(order.createdAt) : null)
      .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()));
    const pickupDates = deliveredRows
      .map((order) => order.deliveredAt ? new Date(order.deliveredAt) : null)
      .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()));
    const pickupDelays = deliveredRows
      .filter((order) => order.createdAt && order.deliveredAt)
      .map((order) => (new Date(order.deliveredAt!).getTime() - new Date(order.createdAt!).getTime()) / 86400000);
    const storageTimes = deliveredRows
      .filter((order) => order.readyAt && order.deliveredAt)
      .map((order) => (new Date(order.deliveredAt!).getTime() - new Date(order.readyAt!).getTime()) / 86400000);
    const paymentTimes = paymentRows
      .filter((row) => row.orderCreatedAt && row.paymentDate)
      .map((row) => (new Date(row.paymentDate!).getTime() - new Date(row.orderCreatedAt!).getTime()) / 3600000);
    const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

    const atRiskCustomers = scopedCustomers.filter((customer) => Number(customer.churnRiskScore || 0) >= 55 || customer.segment === "at_risk" || customer.segment === "lost");
    const averageMonthlySpend = scopedCustomers.length
      ? scopedCustomers.reduce((sum, customer) => {
          const avgDays = Number(customer.avgDaysBetweenVisits || 0);
          const spendPerVisit = customer.visitCount > 0 ? Number(customer.totalRevenue || 0) / customer.visitCount : 0;
          return sum + (avgDays > 0 ? spendPerVisit * (30 / avgDays) : spendPerVisit);
        }, 0) / scopedCustomers.length
      : 0;

    const customerCycles = scopedCustomers
      .filter((customer) => customer.visitCount >= 3)
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        segment: customer.segment,
        visitCount: customer.visitCount,
        avgDaysBetweenVisits: customer.avgDaysBetweenVisits == null ? null : Number(customer.avgDaysBetweenVisits),
        lastVisitAt: customer.lastVisitAt,
        expectedNextVisitDate: customer.expectedNextVisitDate,
        churnRiskScore: customer.churnRiskScore,
        regularity: customer.visitCount >= 5 ? "Predictable" : customer.visitCount >= 3 ? "Fairly Regular" : "Irregular",
      }));

    const morningDeposits = depositDates.filter((date) => date.getHours() >= 8 && date.getHours() < 11).length;
    const eveningPickups = pickupDates.filter((date) => date.getHours() >= 17).length;
    const averageReturnFrequency = average(scopedCustomers.map((customer) => Number(customer.avgDaysBetweenVisits || 0)).filter(Boolean));

    return {
      period,
      depositActivityByHour: this.hourlyBuckets(depositDates),
      pickupActivityByHour: this.hourlyBuckets(pickupDates),
      activityByDayOfWeek: this.dayBuckets(depositDates),
      customerCycles,
      churn: {
        atRiskCount: atRiskCustomers.length,
        revenueAtRisk: averageMonthlySpend * atRiskCustomers.length,
        customers: atRiskCustomers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          segment: customer.segment,
          churnRiskScore: customer.churnRiskScore,
          lastVisitAt: customer.lastVisitAt,
          avgDaysBetweenVisits: customer.avgDaysBetweenVisits == null ? null : Number(customer.avgDaysBetweenVisits),
          totalRevenue: Number(customer.totalRevenue || 0),
        })),
      },
      metrics: {
        averageReturnFrequency,
        depositToPickupDelayDays: average(pickupDelays),
        averageStorageTimeDays: average(storageTimes),
        timeToPaymentHours: average(paymentTimes),
      },
      insights: [
        depositDates.length ? { type: "deposits_morning", pct: Math.round((morningDeposits / depositDates.length) * 100) } : null,
        pickupDates.length ? { type: "pickups_evening", pct: Math.round((eveningPickups / pickupDates.length) * 100) } : null,
        averageReturnFrequency ? { type: "average_customer_returns", days: Math.round(averageReturnFrequency) } : null,
      ].filter(Boolean),
      storageOccupancy: await this.getStorageOccupancyAlerts(siteId),
    };
  }

  async getGarmentItem(id: number): Promise<GarmentItem | undefined> {
    const [item] = await db.select().from(garmentItems).where(eq(garmentItems.id, id));
    return item;
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
    const customerOrders = await this.withSiteOrderNumbers(await db.select().from(orders)
      .where(and(eq(orders.customerId, customerId), ne(orders.status, "cancelled")))
      .orderBy(desc(orders.createdAt)));
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

  async getExpenditure(id: number): Promise<Expenditure | undefined> {
    const [expenditure] = await db.select().from(expenditures).where(eq(expenditures.id, id));
    return expenditure;
  }

  async createExpenditure(insertExpenditure: InsertExpenditure): Promise<Expenditure> {
    const [expenditure] = await db.insert(expenditures).values(insertExpenditure).returning();
    return expenditure;
  }

  async updateExpenditure(id: number, data: Partial<InsertExpenditure>): Promise<Expenditure | undefined> {
    const [updated] = await db.update(expenditures).set(data).where(eq(expenditures.id, id)).returning();
    return updated;
  }

  async deleteExpenditure(id: number): Promise<boolean> {
    const [deleted] = await db.delete(expenditures).where(eq(expenditures.id, id)).returning({ id: expenditures.id });
    return !!deleted;
  }

  async getStats() {
    const [ordersCount] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(ne(orders.status, "cancelled"));
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

  async getOrdersBySite(siteId: number | number[] | null): Promise<any[]> {
    const siteWhere = this.siteWhere(orders.siteId, siteId);
    const allOrders = await this.withSiteOrderNumbers(siteWhere
      ? await db.select().from(orders).where(siteWhere).orderBy(desc(orders.createdAt))
      : await db.select().from(orders).orderBy(desc(orders.createdAt)));
    const allCustomers = await this.customersForScopedOrders(allOrders);
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

  async getCustomersBySite(siteId: number | number[] | null): Promise<Customer[]> {
    const siteWhere = this.siteWhere(customers.siteId, siteId);
    if (siteWhere) {
      return await db.select().from(customers).where(siteWhere).orderBy(desc(customers.createdAt));
    }
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getExpendituresBySite(siteId: number | number[] | null): Promise<Expenditure[]> {
    const siteWhere = this.siteWhere(expenditures.siteId, siteId);
    if (siteWhere) {
      return await db.select().from(expenditures).where(siteWhere).orderBy(desc(expenditures.date));
    }
    return await db.select().from(expenditures).orderBy(desc(expenditures.date));
  }

  async getStatsBySite(siteId: number | number[] | null): Promise<{ totalOrders: number; totalRevenue: number; pendingOrders: number; activeCustomers: number }> {
    const orderSiteWhere = this.siteWhere(orders.siteId, siteId);
    const customerSiteWhere = this.siteWhere(customers.siteId, siteId);
    const siteFilter = !!orderSiteWhere;
    const [ordersCount] = siteFilter
      ? await db.select({ count: sql<number>`count(*)` }).from(orders).where(and(orderSiteWhere!, ne(orders.status, "cancelled")))
      : await db.select({ count: sql<number>`count(*)` }).from(orders).where(ne(orders.status, "cancelled"));
    const siteOrderIds = siteFilter
      ? (await db.select({ id: orders.id }).from(orders).where(and(orderSiteWhere!, ne(orders.status, "cancelled")))).map(o => o.id)
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
      ? await db.select({ count: sql<number>`count(*)` }).from(orders).where(and(orderSiteWhere!, eq(orders.status, "received")))
      : await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "received"));
    const [customersCount] = siteFilter
      ? await db.select({ count: sql<number>`count(*)` }).from(customers).where(customerSiteWhere!)
      : await db.select({ count: sql<number>`count(*)` }).from(customers);
    return {
      totalOrders: Number(ordersCount?.count || 0),
      totalRevenue,
      pendingOrders: Number(pendingCount?.count || 0),
      activeCustomers: Number(customersCount?.count || 0),
    };
  }

  async backfillNullSiteIds(): Promise<void> {
    console.warn("[backfill] Disabled: automatic tenant data reassignment is unsafe in multi-tenant production.");
  }

  private async sumPaymentsInRange(start: Date, end: Date): Promise<number> {
    const [result] = await db.select({ total: sql<string>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(and(
        sql`${payments.date} IS NOT NULL`,
        sql`${payments.date} >= ${start}`,
        sql`${payments.date} <= ${end}`,
        ne(orders.status, "cancelled")
      ));
    return Number(result?.total || 0);
  }

  private async sumExpensesInRange(start: Date, end: Date): Promise<number> {
    const [result] = await db.select({ total: sql<string>`COALESCE(SUM(${expenditures.amount}), 0)` })
      .from(expenditures)
      .where(and(sql`${expenditures.date} IS NOT NULL`, sql`${expenditures.date} >= ${start}`, sql`${expenditures.date} <= ${end}`));
    return Number(result?.total || 0);
  }

  private async sumPaymentsInRangeBySite(start: Date, end: Date, siteId: number | number[] | null): Promise<number> {
    const siteWhere = this.siteWhere(orders.siteId, siteId);
    if (!siteWhere) return this.sumPaymentsInRange(start, end);
    const [result] = await db.select({ total: sql<string>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(and(
        sql`${payments.date} IS NOT NULL`,
        sql`${payments.date} >= ${start}`,
        sql`${payments.date} <= ${end}`,
        siteWhere,
        ne(orders.status, "cancelled")
      ));
    return Number(result?.total || 0);
  }

  private async sumExpensesInRangeBySite(start: Date, end: Date, siteId: number | number[] | null): Promise<number> {
    const siteWhere = this.siteWhere(expenditures.siteId, siteId);
    if (!siteWhere) return this.sumExpensesInRange(start, end);
    const [result] = await db.select({ total: sql<string>`COALESCE(SUM(${expenditures.amount}), 0)` })
      .from(expenditures)
      .where(and(
        sql`${expenditures.date} IS NOT NULL`,
        sql`${expenditures.date} >= ${start}`,
        sql`${expenditures.date} <= ${end}`,
        siteWhere
      ));
    return Number(result?.total || 0);
  }

  async getPerformanceData(siteId: number | number[] | null, startDate?: Date, endDate?: Date) {
    const now = new Date();
    const selectedStart = startDate ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const selectedEnd = endDate ?? now;
    const periodMs = Math.max(0, selectedEnd.getTime() - selectedStart.getTime());
    const previousEnd = new Date(selectedStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - periodMs);

    const currentMonthRevenue = await this.sumPaymentsInRangeBySite(selectedStart, selectedEnd, siteId);
    const currentMonthExpenses = await this.sumExpensesInRangeBySite(selectedStart, selectedEnd, siteId);
    const currentMonthProfit = currentMonthRevenue - currentMonthExpenses;
    const last30Revenue = currentMonthRevenue;
    const prev30Revenue = await this.sumPaymentsInRangeBySite(previousStart, previousEnd, siteId);
    const last30Expenses = currentMonthExpenses;
    const prev30Expenses = await this.sumExpensesInRangeBySite(previousStart, previousEnd, siteId);

    const monthlyComparison: { month: string; income: number; expenses: number }[] = [];
    const comparisonStart = new Date(selectedStart.getFullYear(), selectedStart.getMonth(), 1);
    const comparisonEnd = new Date(selectedEnd.getFullYear(), selectedEnd.getMonth(), 1);
    for (let cursor = new Date(comparisonStart); cursor <= comparisonEnd; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
      const periodMonthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const periodMonthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      const mStart = new Date(Math.max(periodMonthStart.getTime(), selectedStart.getTime()));
      const mEnd = new Date(Math.min(periodMonthEnd.getTime(), selectedEnd.getTime()));
      const monthLabel = periodMonthStart.toLocaleString("en-US", { month: "short", year: "2-digit" });
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

  async getReportData(startDate: Date, endDate: Date, siteId: number | number[] | null) {
    const orderSiteWhere = this.siteWhere(orders.siteId, siteId);
    const expenseSiteWhere = this.siteWhere(expenditures.siteId, siteId);
    const siteOrderWhere = orderSiteWhere
      ? and(sql`${orders.entryDate} >= ${startDate}`, sql`${orders.entryDate} <= ${endDate}`, orderSiteWhere)
      : and(sql`${orders.entryDate} >= ${startDate}`, sql`${orders.entryDate} <= ${endDate}`);
    const filteredOrders = await db.select().from(orders).where(siteOrderWhere);
    const reportOrders = filteredOrders.filter(order => order.status !== "cancelled");
    const totalOrders = reportOrders.length;

    const orderIds = reportOrders.map(o => o.id);
    const paymentWhere = orderSiteWhere
      ? and(sql`${payments.date} IS NOT NULL`, sql`${payments.date} >= ${startDate}`, sql`${payments.date} <= ${endDate}`, orderSiteWhere, ne(orders.status, "cancelled"))
      : and(sql`${payments.date} IS NOT NULL`, sql`${payments.date} >= ${startDate}`, sql`${payments.date} <= ${endDate}`, ne(orders.status, "cancelled"));
    const filteredPayments = await db.select({
      id: payments.id,
      orderId: payments.orderId,
      customerId: orders.customerId,
      amount: payments.amount,
      date: payments.date,
    }).from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(paymentWhere);
    const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const siteExpenseWhere = expenseSiteWhere
      ? and(sql`${expenditures.date} >= ${startDate}`, sql`${expenditures.date} <= ${endDate}`, expenseSiteWhere)
      : and(sql`${expenditures.date} >= ${startDate}`, sql`${expenditures.date} <= ${endDate}`);
    const filteredExpenses = await db.select().from(expenditures).where(siteExpenseWhere);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const dailyRevenueMap = new Map<string, number>();
    for (const payment of filteredPayments) {
      const day = formatReportingDay(payment.date);
      dailyRevenueMap.set(day, (dailyRevenueMap.get(day) || 0) + Number(payment.amount));
    }
    const dailyRevenue = Array.from(dailyRevenueMap.entries()).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));

    let serviceDistribution: { name: string; count: number }[] = [];
    if (orderIds.length > 0) {
      const items = await db.select({ serviceName: services.name, quantity: orderItems.quantity })
        .from(orderItems).innerJoin(services, eq(orderItems.serviceId, services.id))
        .where(sql`${orderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`);
      const serviceMap = new Map<string, number>();
      for (const item of items) serviceMap.set(item.serviceName, (serviceMap.get(item.serviceName) || 0) + Number(item.quantity || 0));
      serviceDistribution = Array.from(serviceMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }

    const customerIds = Array.from(new Set([...reportOrders.map(o => o.customerId), ...filteredPayments.map(p => p.customerId)]));
    const allCustomers = customerIds.length
      ? await db.select().from(customers).where(inArray(customers.id, customerIds))
      : [];
    const paymentsAppliedToPeriodOrders = orderIds.length > 0
      ? await db.select({
          orderId: payments.orderId,
          customerId: orders.customerId,
          amount: payments.amount,
        }).from(payments)
          .innerJoin(orders, eq(payments.orderId, orders.id))
          .where(inArray(payments.orderId, orderIds))
      : [];
    const { topCustomers, customerAreas } = aggregateCustomerReportMetrics({
      customers: allCustomers,
      periodOrders: reportOrders,
      paymentsReceivedInPeriod: filteredPayments,
      paymentsAppliedToPeriodOrders,
    });

    return { totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, totalOrders, dailyRevenue, serviceDistribution, topCustomers, customerAreas };
  }

  async getMachines(siteId: number | number[] | null, userId: string): Promise<Machine[]> {
    const where = this.siteWhere(machines.siteId, siteId) ?? eq(machines.userId, userId);
    return await db.select().from(machines).where(where).orderBy(desc(machines.createdAt));
  }

  async getMachine(id: number): Promise<Machine | undefined> {
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    return machine;
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

  async createMachineUsage(data: InsertMachineUsage): Promise<any> {
    return await db.transaction(async (tx) => {
      const [usage] = await tx.insert(machineUsage).values(data).returning();
      await tx.update(machines).set({
        cycleCount: sql`${machines.cycleCount} + 1`,
        totalKgProcessed: sql`${machines.totalKgProcessed} + ${data.weightProcessed ?? "0"}`,
      }).where(eq(machines.id, data.machineId));
      return usage;
    });
  }

  async getEmployees(siteId: number | number[] | null, userId: string): Promise<Employee[]> {
    const where = this.siteWhere(employees.siteId, siteId) ?? eq(employees.userId, userId);
    return await db.select().from(employees).where(where).orderBy(desc(employees.createdAt));
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async getOrCreateActorEmployee(actorUserId: string, siteId: number): Promise<Employee> {
    const [existing] = await db.select().from(employees)
      .where(and(eq(employees.authUserId, actorUserId), eq(employees.siteId, siteId)))
      .limit(1);
    if (existing) return existing;

    const [user] = await db.select().from(users).where(eq(users.id, actorUserId)).limit(1);
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    const [org] = site?.organisationId
      ? await db.select().from(organisations).where(eq(organisations.id, site.organisationId)).limit(1)
      : [undefined as any];
    const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || user?.phone || "Employee";
    const role = user?.role || await this.getUserSiteRole(actorUserId, siteId) || "operator";
    const [created] = await db.insert(employees).values({
      userId: org?.ownerId || actorUserId,
      authUserId: actorUserId,
      employeeCode: `EMP-${actorUserId.slice(0, 8)}`,
      name,
      role,
      position: role,
      phone: user?.phone || null,
      email: user?.email || null,
      status: "active",
      siteId,
    } as any).returning();
    return created;
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

  async createEmployeeActivity(activity: InsertEmployeeActivity): Promise<any> {
    const [created] = await db.insert(employeeActivities).values(activity).returning();
    if (["order_created", "order_processed", "order_delivered"].includes(activity.actionType)) {
      await db.update(employees).set({
        ordersHandled: sql`${employees.ordersHandled} + 1`,
        kgProcessed: activity.weightKg != null ? sql`${employees.kgProcessed} + ${activity.weightKg}` : employees.kgProcessed,
      }).where(eq(employees.id, activity.employeeId));
    }
    return created;
  }

  async createEmployeeAttendance(attendance: InsertEmployeeAttendance): Promise<any> {
    const [created] = await db.insert(employeeAttendance).values(attendance).returning();
    return created;
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
    if (existing.length > 0) {
      const featureUpdates: Record<string, string[]> = {
        starter: ["Client management", "Order tracking", "Basic dashboard", "Basic Employee Module", "Basic Machine Module"],
        pro: ["Everything in Starter", "Employee Analytics", "Machine Analytics", "Reports"],
        business: ["Everything in Pro", "Advanced Analytics", "Smart Recommendations", "Performance Scores", "Waste detection"],
        enterprise: ["Everything in Business", "Full Analytics", "Predictive Maintenance", "Multi-Site Benchmarking", "Advanced Intelligence", "Custom API access"],
      };
      for (const [slug, features] of Object.entries(featureUpdates)) {
        await db.update(plans).set({ features }).where(eq(plans.slug, slug));
      }
      return;
    }

    await db.insert(plans).values([
      { name: "Starter", slug: "starter", price: "6000", maxOrders: 100, maxUsers: 1, features: ["Client management", "Order tracking", "Basic dashboard", "Basic Employee Module", "Basic Machine Module"] },
      { name: "Pro", slug: "pro", price: "15000", maxOrders: 500, maxUsers: 3, features: ["Everything in Starter", "Employee Analytics", "Machine Analytics", "Reports"] },
      { name: "Business", slug: "business", price: "30000", maxOrders: 2000, maxUsers: 10, features: ["Everything in Pro", "Advanced Analytics", "Smart Recommendations", "Performance Scores", "Waste detection"] },
      { name: "Enterprise", slug: "enterprise", price: "50000", maxOrders: null, maxUsers: null, features: ["Everything in Business", "Full Analytics", "Predictive Maintenance", "Multi-Site Benchmarking", "Advanced Intelligence", "Custom API access"] },
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

  async getDashboardData(siteId?: number | number[] | null, allSites?: boolean) {
    const scope = siteId ?? null;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart); todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);

    const siteWhere = this.siteWhere(orders.siteId, scope) ?? sql`1=1`;
    const expSiteWhere = this.siteWhere(expenditures.siteId, scope) ?? sql`1=1`;
    const customerSiteWhere = this.siteWhere(customers.siteId, scope);
    const scopedSiteIds = this.siteIds(scope);

    const todayRevenue = await this.sumPaymentsInRangeBySite(todayStart, todayEnd, scope);
    const todayOrdersResult = await db.select({ count: sql<number>`count(*)` }).from(orders)
      .where(and(siteWhere, sql`${orders.entryDate} >= ${todayStart}`, sql`${orders.entryDate} <= ${todayEnd}`, ne(orders.status, "cancelled")));
    const todayOrders = Number(todayOrdersResult[0]?.count || 0);

    const weekRevenue = await this.sumPaymentsInRangeBySite(weekStart, now, scope);
    const weekOrdersResult = await db.select({ count: sql<number>`count(*)` }).from(orders)
      .where(and(siteWhere, sql`${orders.entryDate} >= ${weekStart}`, sql`${orders.entryDate} <= ${now}`, ne(orders.status, "cancelled")));
    const weekOrders = Number(weekOrdersResult[0]?.count || 0);

    const monthRevenue = await this.sumPaymentsInRangeBySite(monthStart, now, scope);
    const monthExpenses = await this.sumExpensesInRangeBySite(monthStart, now, scope);
    const monthOrdersResult = await db.select({ count: sql<number>`count(*)` }).from(orders)
      .where(and(siteWhere, sql`${orders.entryDate} >= ${monthStart}`, sql`${orders.entryDate} <= ${now}`, ne(orders.status, "cancelled")));
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
      const rev = await this.sumPaymentsInRangeBySite(dayStart, dayEnd, scope);
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
      .innerJoin(orders, eq(garmentItems.orderId, orders.id))
      .where(and(siteWhere, eq(garmentItems.returnedForTreatment, true), sql`${garmentItems.resolvedAt} IS NULL`));
    const returnedCount = Number(returnedGarments[0]?.count || 0);
    if (returnedCount > 0) alerts.push({ type: "warning", message: `${returnedCount} garment(s) returned for treatment`, detail: "Check orders with returned items" });

    // Build site overview for All Sites mode
    let sitesOverview: { id: number; name: string; city?: string | null; memberCount: number; isActive: boolean }[] = [];
    if (allSites) {
      const allSiteRows = scopedSiteIds.length > 0
        ? await db.select().from(sites).where(and(eq(sites.isActive, true), inArray(sites.id, scopedSiteIds)))
        : [];
      const memberCounts = await db.select({ siteId: siteMembers.siteId, count: sql<number>`count(*)` })
        .from(siteMembers)
        .where(scopedSiteIds.length > 0 ? inArray(siteMembers.siteId, scopedSiteIds) : sql`false`)
        .groupBy(siteMembers.siteId);
      const countMap: Record<number, number> = {};
      for (const mc of memberCounts) countMap[mc.siteId] = Number(mc.count);
      sitesOverview = allSiteRows.map(s => ({
        id: s.id, name: s.name, city: s.city, memberCount: countMap[s.id] ?? 0, isActive: s.isActive ?? true,
      }));
      for (const site of sitesOverview) {
        const siteOrdersResult = await db.select({ count: sql<number>`count(*)` }).from(orders)
          .where(and(eq(orders.siteId, site.id), sql`${orders.entryDate} >= ${monthStart}`, sql`${orders.entryDate} <= ${now}`, ne(orders.status, "cancelled")));
        (site as any).orders = Number(siteOrdersResult[0]?.count || 0);
        (site as any).revenue = await this.sumPaymentsInRangeBySite(monthStart, now, site.id);
      }
    }

    const readyOrders = await db.select().from(orders).where(and(siteWhere, eq(orders.status, "ready"))).orderBy(desc(orders.updatedAt));
    const readyCustomers = customerSiteWhere
      ? await db.select().from(customers).where(customerSiteWhere)
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

  async getAnalyticsKpis(period: string, siteId: number | number[] | null) {
    const now = new Date();
    let start: Date;
    if (period === "day") { start = new Date(now); start.setHours(0, 0, 0, 0); }
    else if (period === "week") { start = new Date(now); start.setDate(start.getDate() - 7); }
    else if (period === "year") { start = new Date(now.getFullYear(), 0, 1); }
    else { start = new Date(now.getFullYear(), now.getMonth(), 1); }

    const totalRevenue = await this.sumPaymentsInRangeBySite(start, now, siteId);
    const totalExpenses = await this.sumExpensesInRangeBySite(start, now, siteId);
    const orderSiteWhere = this.siteWhere(orders.siteId, siteId);
    const ordersWhere = orderSiteWhere
      ? and(sql`${orders.entryDate} >= ${start}`, sql`${orders.entryDate} <= ${now}`, orderSiteWhere, ne(orders.status, "cancelled"))
      : and(sql`${orders.entryDate} >= ${start}`, sql`${orders.entryDate} <= ${now}`, ne(orders.status, "cancelled"));
    const ordersResult = await db.select({ count: sql<number>`count(*)` }).from(orders).where(ordersWhere);
    const totalOrders = Number(ordersResult[0]?.count || 0);
    const profit = totalRevenue - totalExpenses;

    const machineWhere = this.siteWhere(machines.siteId, siteId);
    const allMachines = machineWhere ? await db.select().from(machines).where(machineWhere) : await db.select().from(machines);
    const machineUtilization = allMachines.length > 0
      ? allMachines.reduce((sum, m) => sum + Number(m.utilizationRate), 0) / allMachines.length : 0;

    const employeeWhere = this.siteWhere(employees.siteId, siteId);
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

  async getWasteAlerts(siteId: number | number[] | null): Promise<any[]> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthExpenses = await this.sumExpensesInRangeBySite(monthStart, now, siteId);
    const monthRevenue = await this.sumPaymentsInRangeBySite(monthStart, now, siteId);
    const alerts: any[] = [];

    if (monthExpenses > monthRevenue * 0.8 && monthRevenue > 0) {
      alerts.push({ category: "Cost", severity: "high", type: "costs_high" });
    }

    const expenseSiteWhere = this.siteWhere(expenditures.siteId, siteId);
    const expenseCatWhere = expenseSiteWhere
      ? and(sql`${expenditures.date} >= ${monthStart}`, sql`${expenditures.date} <= ${now}`, expenseSiteWhere)
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

  async getPerformanceScore(siteId: number | number[] | null) {
    const machineWhere = this.siteWhere(machines.siteId, siteId);
    const allMachines = machineWhere ? await db.select().from(machines).where(machineWhere) : await db.select().from(machines);
    const machineUsage = allMachines.length > 0
      ? allMachines.reduce((sum, m) => sum + Number(m.utilizationRate), 0) / allMachines.length : 50;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRevenue = await this.sumPaymentsInRangeBySite(monthStart, now, siteId);
    const monthExpenses = await this.sumExpensesInRangeBySite(monthStart, now, siteId);
    const costEfficiency = monthRevenue > 0 ? Math.min(100, Math.max(0, ((monthRevenue - monthExpenses) / monthRevenue) * 100)) : 50;

    const employeeWhere = this.siteWhere(employees.siteId, siteId);
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

  async getAdvancedAnalytics(period: string, siteId: number | number[] | null, planSlug = "starter") {
    const now = new Date();
    const start = period === "year"
      ? new Date(now.getFullYear(), 0, 1)
      : period === "week"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        : period === "day"
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
          : new Date(now.getFullYear(), now.getMonth(), 1);

    const siteFilter = this.siteWhere(employeeActivities.siteId, siteId);
    const machineSiteFilter = this.siteWhere(machineUsage.siteId, siteId);
    const orderSiteFilter = this.siteWhere(orders.siteId, siteId);
    const scopedEmployees = await db.select().from(employees).where(this.siteWhere(employees.siteId, siteId)).orderBy(employees.name);
    const employeeMap = new Map(scopedEmployees.map((employee) => [employee.id, employee]));

    const activityRows = await db.select().from(employeeActivities)
      .where(and(siteFilter, sql`${employeeActivities.actionDate} >= ${start}`, sql`${employeeActivities.actionDate} <= ${now}`));
    const paymentRows = await db.select().from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(and(orderSiteFilter, sql`${payments.date} >= ${start}`, sql`${payments.date} <= ${now}`));
    const machineRows = await db.select().from(machines).where(this.siteWhere(machines.siteId, siteId)).orderBy(machines.name);
    const usageRows = await db.select().from(machineUsage)
      .where(and(machineSiteFilter, sql`${machineUsage.usageDate} >= ${start}`, sql`${machineUsage.usageDate} <= ${now}`));

    const days = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000));
    const employeeStats = new Map<number, any>();
    for (const employee of scopedEmployees) {
      employeeStats.set(employee.id, {
        id: employee.id,
        name: employee.name,
        employeeCode: employee.employeeCode,
        role: employee.position || employee.role,
        status: employee.status,
        totalOrdersHandled: 0,
        totalRevenueHandled: 0,
        totalPaymentsCollected: 0,
        totalWeightProcessed: 0,
        activityCount: 0,
        deletions: 0,
        cancellations: 0,
        discounts: 0,
        paymentModifications: 0,
      });
    }

    for (const activity of activityRows) {
      const stat = employeeStats.get(activity.employeeId);
      if (!stat) continue;
      stat.activityCount += 1;
      if (["order_created", "order_processed", "order_delivered"].includes(activity.actionType)) stat.totalOrdersHandled += 1;
      if (activity.actionType === "order_deleted") stat.deletions += 1;
      if (activity.actionType === "order_cancelled") stat.cancellations += 1;
      if (activity.actionType === "discount_applied") stat.discounts += Number(activity.amount || 0);
      if (activity.actionType === "payment_modified") stat.paymentModifications += 1;
      if (activity.actionType !== "payment_collected") stat.totalRevenueHandled += Number(activity.amount || 0);
      stat.totalWeightProcessed += Number(activity.weightKg || 0);
    }

    for (const paymentJoin of paymentRows as any[]) {
      const employeeId = paymentJoin.payments?.collectedByEmployeeId;
      const stat = employeeId ? employeeStats.get(employeeId) : null;
      if (stat) {
        const amount = Number(paymentJoin.payments.amount || 0);
        stat.totalPaymentsCollected += amount;
        stat.totalRevenueHandled += amount;
      }
    }

    const employeesRanked = Array.from(employeeStats.values()).map((stat) => ({
      ...stat,
      averageOrdersPerDay: stat.totalOrdersHandled / days,
      averageRevenuePerDay: stat.totalRevenueHandled / days,
    }));
    const topBy = (key: string) => [...employeesRanked].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))[0] || null;

    const machineStats = machineRows.map((machine) => {
      const rows = usageRows.filter((usage) => usage.machineId === machine.id);
      const totalCycles = rows.length;
      const totalOperatingHours = rows.reduce((sum, usage) => sum + Number(usage.cycleDurationMinutes || 0) / 60, 0);
      const totalWeightProcessed = rows.reduce((sum, usage) => sum + Number(usage.weightProcessed || 0), 0);
      const expectedCapacity = Math.max(1, Number(machine.capacityKg || 0) * days);
      const utilizationScore = Math.round(Math.min(100, (totalWeightProcessed / expectedCapacity) * 100));
      const maintenanceDays = machine.lastMaintenanceDate && machine.maintenanceIntervalDays
        ? Math.ceil((new Date(machine.lastMaintenanceDate).getTime() + machine.maintenanceIntervalDays * 86400000 - now.getTime()) / 86400000)
        : null;
      const maintenanceHours = machine.maintenanceIntervalHours
        ? Number(machine.maintenanceIntervalHours) - totalOperatingHours
        : null;
      return {
        id: machine.id,
        name: machine.name,
        type: machine.type,
        brand: machine.brand,
        model: machine.model,
        status: machine.status,
        totalCycles,
        totalOperatingHours,
        totalWeightProcessed,
        averageDailyUsage: totalCycles / days,
        utilizationScore,
        utilizationLabel: utilizationScore >= 80 ? "excellent" : utilizationScore >= 55 ? "good" : utilizationScore >= 25 ? "underutilized" : "critical",
        daysUntilNextMaintenance: maintenanceDays,
        hoursUntilNextMaintenance: maintenanceHours,
        maintenanceCost: Number(machine.maintenanceCost || 0),
      };
    });
    type MachineMetricKey = keyof (typeof machineStats)[number];
    const machineTopBy = (key: MachineMetricKey, asc = false) => [...machineStats].sort((a, b) => {
      const av = Number(a[key] || 0);
      const bv = Number(b[key] || 0);
      return asc ? av - bv : bv - av;
    })[0] || null;

    const alerts: any[] = [];
    for (const employee of employeesRanked) {
      if (employee.deletions >= 3) alerts.push({ type: "employee_risk", severity: "high", message: `${employee.name} has a high number of order deletions.` });
      if (employee.cancellations >= 5) alerts.push({ type: "employee_risk", severity: "medium", message: `${employee.name} has frequent order cancellations.` });
      if (employee.discounts >= 100) alerts.push({ type: "employee_risk", severity: "medium", message: `${employee.name} applied unusual discounts.` });
      if (employee.paymentModifications >= 3) alerts.push({ type: "employee_risk", severity: "high", message: `${employee.name} has frequent payment modifications.` });
    }
    for (const machine of machineStats) {
      if (machine.daysUntilNextMaintenance != null && machine.daysUntilNextMaintenance < 0) alerts.push({ type: "maintenance", severity: "high", message: `${machine.name} maintenance is overdue.` });
      else if (machine.daysUntilNextMaintenance != null && machine.daysUntilNextMaintenance <= 14) alerts.push({ type: "maintenance", severity: "medium", message: `${machine.name} requires maintenance within ${machine.daysUntilNextMaintenance} days.` });
      if (machine.maintenanceCost > 0 && machine.totalWeightProcessed > 0 && machine.maintenanceCost / machine.totalWeightProcessed > 50) alerts.push({ type: "maintenance_cost", severity: "medium", message: `${machine.name} has high maintenance cost per kg.` });
    }

    const serviceRows = await db.select({
      name: services.name,
      revenue: sql<string>`COALESCE(SUM(${orderItems.quantity} * ${orderItems.priceAtOrder}), 0)`,
      quantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::float8`,
    }).from(orderItems)
      .innerJoin(services, eq(orderItems.serviceId, services.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(orderSiteFilter, sql`${orders.entryDate} >= ${start}`, sql`${orders.entryDate} <= ${now}`))
      .groupBy(services.name);
    const servicesRanked = serviceRows.map((row) => ({ name: row.name, revenue: Number(row.revenue || 0), quantity: Number(row.quantity || 0) }));
    const mostProfitableService = [...servicesRanked].sort((a, b) => b.revenue - a.revenue)[0] || null;
    const leastProfitableService = [...servicesRanked].sort((a, b) => a.revenue - b.revenue)[0] || null;

    const recommendations: any[] = [];
    const avgOrders = employeesRanked.length ? employeesRanked.reduce((sum, e) => sum + e.totalOrdersHandled, 0) / employeesRanked.length : 0;
    const mostProductive = topBy("totalOrdersHandled");
    if (mostProductive && avgOrders > 0) recommendations.push({
      type: "employee_orders_above_average",
      employeeName: mostProductive.name,
      percent: Math.round(((mostProductive.totalOrdersHandled - avgOrders) / avgOrders) * 100),
    });
    const underused = machineStats.find((machine) => machine.utilizationLabel === "critical" || machine.utilizationLabel === "underutilized");
    if (underused) recommendations.push({
      type: "machine_underutilized",
      machineName: underused.name,
    });
    const maintenanceOverdue = machineStats.find((machine) => machine.daysUntilNextMaintenance != null && machine.daysUntilNextMaintenance < 0);
    if (maintenanceOverdue) recommendations.push({
      type: "machine_maintenance_overdue",
      machineName: maintenanceOverdue.name,
    });
    const maintenanceSoon = machineStats.find((machine) => machine.daysUntilNextMaintenance != null && machine.daysUntilNextMaintenance >= 0 && machine.daysUntilNextMaintenance <= 14);
    if (maintenanceSoon) recommendations.push({
      type: "machine_maintenance_soon",
      machineName: maintenanceSoon.name,
      days: maintenanceSoon.daysUntilNextMaintenance,
    });
    if (mostProfitableService) recommendations.push({
      type: "service_highest_revenue",
      serviceName: mostProfitableService.name,
    });

    const orderCount = employeesRanked.reduce((sum, employee) => sum + employee.totalOrdersHandled, 0);
    const revenue = await this.sumPaymentsInRangeBySite(start, now, siteId);
    return {
      period,
      planSlug,
      summary: {
        totalOrdersHandled: orderCount,
        totalRevenueHandled: revenue,
        totalPaymentsCollected: employeesRanked.reduce((sum, employee) => sum + employee.totalPaymentsCollected, 0),
        totalWeightProcessed: machineStats.reduce((sum, machine) => sum + machine.totalWeightProcessed, 0),
        averageOrdersPerDay: orderCount / days,
        averageRevenuePerDay: revenue / days,
        revenuePerEmployee: scopedEmployees.length ? revenue / scopedEmployees.length : 0,
        revenuePerMachine: machineRows.length ? revenue / machineRows.length : 0,
      },
      employeeInsights: {
        employees: employeesRanked,
        mostProductiveEmployee: mostProductive,
        highestRevenueEmployee: topBy("totalRevenueHandled"),
        highestWeightProcessed: topBy("totalWeightProcessed"),
        mostActiveEmployee: topBy("activityCount"),
      },
      machineInsights: {
        machines: machineStats,
        mostUsedMachine: machineTopBy("totalCycles"),
        leastUsedMachine: machineTopBy("totalCycles", true),
        highestVolumeMachine: machineTopBy("totalWeightProcessed"),
        underutilizedMachine: machineStats.find((machine) => machine.utilizationLabel === "critical" || machine.utilizationLabel === "underutilized") || null,
      },
      operationalInsights: {
        mostProfitableService,
        leastProfitableService,
        averageOrderProcessingTimeHours: 0,
        ordersDeliveredLate: 0,
      },
      alerts,
      recommendations,
    };
  }

  // ─── Business Settings (Prompt A) ───────────────────────────────────────────

  async getSettings(userId: string): Promise<BusinessSettings> {
    await ensureBusinessSettingsSchema();
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
    await ensureBusinessSettingsSchema();
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
    return await db.transaction(async (tx) => {
      const [site] = await tx.insert(sites).values({ organisationId, ...data }).returning();
      const [org] = await tx.select().from(organisations).where(eq(organisations.id, organisationId));
      if (org?.ownerId) {
        await tx.insert(siteMembers).values({ siteId: site.id, userId: org.ownerId, role: "owner" });
      }
      return site;
    });
  }

  async updateSite(id: number, data: { name: string; address: string; city: string; phone: string }): Promise<Site | undefined> {
    const [updated] = await db.update(sites)
      .set({ name: data.name, address: data.address, city: data.city, phone: data.phone })
      .where(eq(sites.id, id))
      .returning();
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

  async createStaffFromInvitation(
    token: string,
    data: { email?: string | null; phone?: string | null; passwordHash: string; firstName?: string | null; lastName?: string | null }
  ): Promise<User | null> {
    const [inv] = await db.select().from(siteInvitations).where(eq(siteInvitations.token, token));
    if (!inv || inv.status !== "pending" || inv.expiresAt < new Date()) return null;

    const normalisedIdentifier = inv.identifier.trim().toLowerCase();
    const candidateIdentifiers = [data.email, data.phone]
      .filter((value): value is string => !!value)
      .map((value) => value.trim().toLowerCase());
    if (candidateIdentifiers.length === 0 || !candidateIdentifiers.includes(normalisedIdentifier)) {
      return null;
    }

    return await db.transaction(async (tx) => {
      const [site] = await tx.select().from(sites).where(eq(sites.id, inv.siteId));
      if (!site || site.organisationId !== inv.organisationId) return null;

      const [staffUser] = await tx.insert(users).values({
        email: data.email || null,
        phone: data.phone || null,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        passwordHash: data.passwordHash,
        userType: "staff",
        role: inv.role,
        organisationId: inv.organisationId,
        currentSiteId: inv.siteId,
      }).returning();

      await tx.insert(siteMembers).values({ siteId: inv.siteId, userId: staffUser.id, role: inv.role });
      await tx.update(siteInvitations).set({ status: "accepted" }).where(eq(siteInvitations.id, inv.id));
      return staffUser;
    });
  }

  async acceptInvitation(token: string, userId: string): Promise<SiteInvitation | null> {
    const [inv] = await db.select().from(siteInvitations).where(eq(siteInvitations.token, token));
    if (!inv || inv.status !== "pending" || inv.expiresAt < new Date()) return null;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || user.userType !== "staff") {
      throw new Error("OWNER_ACCOUNT_CANNOT_ACCEPT_STAFF_INVITATION");
    }
    const invitedIdentifier = inv.identifier.trim().toLowerCase();
    const userIdentifiers = [user.email, user.phone]
      .filter((value): value is string => !!value)
      .map((value) => value.trim().toLowerCase());
    if (!userIdentifiers.includes(invitedIdentifier)) {
      throw new Error("INVITATION_IDENTIFIER_MISMATCH");
    }
    return await db.transaction(async (tx) => {
      const existing = await tx.select().from(siteMembers).where(and(eq(siteMembers.siteId, inv.siteId), eq(siteMembers.userId, userId)));
      if (existing.length === 0) {
        await tx.insert(siteMembers).values({ siteId: inv.siteId, userId, role: inv.role });
      }
      const [site] = await tx.select().from(sites).where(eq(sites.id, inv.siteId));
      await tx.update(users).set({ currentSiteId: inv.siteId, organisationId: site?.organisationId, userType: "staff", role: inv.role }).where(eq(users.id, userId));
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

  async getPublicStats() {
    const [[o], [c], [p], [g], [countryStats]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(orders),
      db.select({ count: sql<number>`count(*)::int` }).from(customers),
      db.select({ count: sql<number>`count(*)::int` }).from(payments),
      db.select({ total: sql<number>`coalesce(sum(${orderItems.quantity}),0)::float8` }).from(orderItems),
      db
        .select({ count: sql<number>`count(distinct lower(trim(${businessSettings.country})))::int` })
        .from(businessSettings)
        .innerJoin(users, eq(businessSettings.userId, users.id))
        .where(and(ne(users.userType, "staff"), sql`trim(coalesce(${businessSettings.country}, '')) <> ''`)),
    ]);
    const laundries = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organisations)
      .innerJoin(users, eq(organisations.ownerId, users.id))
      .where(ne(users.userType, "staff"));
    return {
      totalOrders: o?.count || 0,
      totalCustomers: c?.count || 0,
      totalTransactions: p?.count || 0,
      totalLaundries: laundries[0]?.count || 0,
      totalGarments: g?.total || 0,
      totalCountries: countryStats?.count || 0,
    };
  }

  async migrateToMultiSite(): Promise<void> {
    const allUsers = await db.select().from(users);
    for (const user of allUsers) {
      if (user.organisationId) continue;
      if (user.userType === "staff") continue;
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
