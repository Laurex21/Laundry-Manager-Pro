import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
import { users } from "./models/auth";

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: text("email"),
  address: text("address").notNull(),
  notes: text("notes"),
  starchLevel: text("starch_level"),
  detergentType: text("detergent_type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  active: boolean("active").default(true),
  minimumCharge: decimal("minimum_charge", { precision: 10, scale: 2 }),
  estimatedDuration: integer("estimated_duration"),
  durationUnit: text("duration_unit"),
  expressAvailable: boolean("express_available").default(false),
  expressSurcharge: decimal("express_surcharge", { precision: 5, scale: 2 }),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  status: text("status").notNull().default("received"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  entryDate: timestamp("entry_date").defaultNow(),
  pickupDate: timestamp("pickup_date"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  quantity: integer("quantity").notNull(),
  priceAtOrder: decimal("price_at_order", { precision: 10, scale: 2 }).notNull(),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  status: text("status").notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
  changedBy: varchar("changed_by"),
  notes: text("notes"),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: varchar("method", { length: 50 }).notNull(),
  reference: varchar("reference", { length: 255 }),
  date: timestamp("date").defaultNow(),
});

export const garmentItems = pgTable("garment_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  returnedForTreatment: boolean("returned_for_treatment").default(false),
  returnStage: text("return_stage"),
  returnNotes: text("return_notes"),
  returnedAt: timestamp("returned_at"),
  resolvedAt: timestamp("resolved_at"),
});

export const expenditures = pgTable("expenditures", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: timestamp("date").defaultNow(),
});

export const machines = pgTable("machines", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("washer"),
  capacityKg: decimal("capacity_kg", { precision: 8, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  cycleCount: integer("cycle_count").notNull().default(0),
  totalKgProcessed: decimal("total_kg_processed", { precision: 10, scale: 2 }).notNull().default("0"),
  utilizationRate: decimal("utilization_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  salary: decimal("salary", { precision: 10, scale: 2 }),
  kgProcessed: decimal("kg_processed", { precision: 10, scale: 2 }).notNull().default("0"),
  ordersHandled: integer("orders_handled").notNull().default(0),
  productivityScore: decimal("productivity_score", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  maxOrders: integer("max_orders"),
  maxUsers: integer("max_users"),
  features: jsonb("features").notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  planId: integer("plan_id").notNull().references(() => plans.id),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  ordersUsed: integer("orders_used").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subscriptionPayments = pgTable("subscription_payments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  planId: integer("plan_id").notNull().references(() => plans.id),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: varchar("method", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  payments: many(payments),
  garmentItems: many(garmentItems),
  statusHistory: many(orderStatusHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  service: one(services, {
    fields: [orderItems.serviceId],
    references: [services.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const garmentItemsRelations = relations(garmentItems, ({ one }) => ({
  order: one(orders, {
    fields: [garmentItems.orderId],
    references: [orders.id],
  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatusHistory.orderId],
    references: [orders.id],
  }),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true, totalAmount: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, date: true });
export const insertGarmentItemSchema = createInsertSchema(garmentItems).omit({ id: true, returnedForTreatment: true, returnStage: true, returnNotes: true, returnedAt: true, resolvedAt: true });
export const insertExpenditureSchema = createInsertSchema(expenditures).omit({ id: true });
export const insertMachineSchema = createInsertSchema(machines).omit({ id: true, createdAt: true, cycleCount: true, totalKgProcessed: true, utilizationRate: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true, productivityScore: true });
export const insertPlanSchema = createInsertSchema(plans).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, ordersUsed: true });
export const insertOrderStatusHistorySchema = createInsertSchema(orderStatusHistory).omit({ id: true, changedAt: true });

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type GarmentItem = typeof garmentItems.$inferSelect;
export type InsertGarmentItem = z.infer<typeof insertGarmentItemSchema>;

export type Expenditure = typeof expenditures.$inferSelect;
export type InsertExpenditure = z.infer<typeof insertExpenditureSchema>;

export type Machine = typeof machines.$inferSelect;
export type InsertMachine = z.infer<typeof insertMachineSchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;

export type OrderStatusHistoryEntry = typeof orderStatusHistory.$inferSelect;

export type OrderWithCustomer = Order & { customer: Customer };
export type OrderWithDetails = OrderWithCustomer & { items: (OrderItem & { service: Service })[], payments: Payment[], garmentItems: GarmentItem[], statusHistory?: OrderStatusHistoryEntry[] };
export type SubscriptionWithPlan = Subscription & { plan: Plan };
