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
  defaultDiscountPct: decimal("default_discount_pct", { precision: 5, scale: 2 }).default("0"),
  totalDeliveries: integer("total_deliveries").default(0).notNull(),
  onTimeDeliveries: integer("on_time_deliveries").default(0).notNull(),
  lateDeliveries: integer("late_deliveries").default(0).notNull(),
  siteId: integer("site_id"),
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
  turnaroundDays: decimal("turnaround_days", { precision: 4, scale: 1 }).default("1"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  status: text("status").notNull().default("received"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  entryDate: timestamp("entry_date").defaultNow(),
  pickupDate: timestamp("pickup_date"),
  deliveredAt: timestamp("delivered_at"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  discountPct: decimal("discount_pct", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  cancellationReason: text("cancellation_reason"),
  cancellationRequestedBy: varchar("cancellation_requested_by"),
  cancellationRequestedAt: timestamp("cancellation_requested_at"),
  cancellationReviewedBy: varchar("cancellation_reviewed_by"),
  cancellationReviewedAt: timestamp("cancellation_reviewed_at"),
  cancellationRejectionNote: text("cancellation_rejection_note"),
  siteId: integer("site_id"),
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
  siteId: integer("site_id"),
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
  siteId: integer("site_id"),
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
  siteId: integer("site_id"),
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

// Business Settings (Prompt A)
export const businessSettings = pgTable("business_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  businessName: varchar("business_name", { length: 255 }).notNull().default("My Laundry"),
  tagline: varchar("tagline", { length: 255 }).default(""),
  logoBase64: text("logo_base64"),
  address: varchar("address", { length: 500 }).default(""),
  city: varchar("city", { length: 100 }).default(""),
  country: varchar("country", { length: 100 }).default(""),
  phone: varchar("phone", { length: 50 }).default(""),
  phone2: varchar("phone2", { length: 50 }).default(""),
  email: varchar("email", { length: 255 }).default(""),
  website: varchar("website", { length: 255 }).default(""),
  receiptHeaderColor: varchar("receipt_header_color", { length: 7 }).notNull().default("#1e3a5f"),
  receiptLanguage: varchar("receipt_language", { length: 5 }).notNull().default("en"),
  showLogo: boolean("show_logo").notNull().default(true),
  showPickupDate: boolean("show_pickup_date").notNull().default(true),
  showGarmentList: boolean("show_garment_list").notNull().default(true),
  showPaymentHistory: boolean("show_payment_history").notNull().default(true),
  showTerms: boolean("show_terms").notNull().default(true),
  termsOfService: text("terms_of_service"),
  receiptFooterNote: varchar("receipt_footer_note", { length: 500 }).default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Multi-site tables (Prompt B)
export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: varchar("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }).default(""),
  city: varchar("city", { length: 100 }).default(""),
  phone: varchar("phone", { length: 50 }).default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const siteMembers = pgTable("site_members", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const siteInvitations = pgTable("site_invitations", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  invitedBy: varchar("invited_by").notNull(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
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

export const organisationsRelations = relations(organisations, ({ many }) => ({
  sites: many(sites),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [sites.organisationId],
    references: [organisations.id],
  }),
  members: many(siteMembers),
  invitations: many(siteInvitations),
}));

// Insert schemas
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
export const insertBusinessSettingsSchema = createInsertSchema(businessSettings).omit({ id: true, updatedAt: true });
export const insertSiteSchema = createInsertSchema(sites).omit({ id: true, createdAt: true });
export const insertSiteMemberSchema = createInsertSchema(siteMembers).omit({ id: true, createdAt: true });
export const insertSiteInvitationSchema = createInsertSchema(siteInvitations).omit({ id: true, createdAt: true });

// Types
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

export type BusinessSettings = typeof businessSettings.$inferSelect;
export type InsertBusinessSettings = z.infer<typeof insertBusinessSettingsSchema>;

export type Organisation = typeof organisations.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type SiteMember = typeof siteMembers.$inferSelect;
export type SiteInvitation = typeof siteInvitations.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;

export type OrderWithCustomer = Order & { customer: Customer };
export type OrderWithDetails = OrderWithCustomer & { items: (OrderItem & { service: Service })[], payments: Payment[], garmentItems: GarmentItem[], statusHistory?: OrderStatusHistoryEntry[] };
export type SubscriptionWithPlan = Subscription & { plan: Plan };

export const calculatorLeads = pgTable("calculator_leads", {
  id: serial("id").primaryKey(),

  firstName:      varchar("first_name", { length: 100 }),
  lastName:       varchar("last_name", { length: 100 }),
  phone:          varchar("phone", { length: 50 }),
  whatsapp:       varchar("whatsapp", { length: 50 }),
  whatsappOptIn:  boolean("whatsapp_opt_in").default(true),
  email:          varchar("email", { length: 255 }),
  country:        varchar("country", { length: 100 }).notNull(),
  city:           varchar("city", { length: 100 }).notNull(),
  contactZone:    varchar("contact_zone", { length: 20 }),
  referralSource: varchar("referral_source", { length: 100 }),

  pressingType:  varchar("pressing_type", { length: 50 }),
  dailyCapacity: varchar("daily_capacity", { length: 50 }),

  estimatedMinBudget:  integer("estimated_min_budget"),
  estimatedMaxBudget:  integer("estimated_max_budget"),
  currency:            varchar("currency", { length: 10 }).default("FCFA"),
  aiReportJson:        text("ai_report_json"),
  aiReportGeneratedAt: timestamp("ai_report_generated_at"),
  reportUrl:           varchar("report_url", { length: 500 }),
  pdfGeneratedAt:      timestamp("pdf_generated_at"),

  whatsappSent:   boolean("whatsapp_sent").default(false),
  whatsappSentAt: timestamp("whatsapp_sent_at"),

  convertedToTrial:    boolean("converted_to_trial").default(false),
  convertedToTraining: boolean("converted_to_training").default(false),
  expertContactedAt:   timestamp("expert_contacted_at"),

  utmSource:   varchar("utm_source", { length: 100 }),
  utmMedium:   varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),

  completedPage1: boolean("completed_page1").default(false),
  completedPage2: boolean("completed_page2").default(false),
  completedPage3: boolean("completed_page3").default(false),
  completedPage4: boolean("completed_page4").default(false),

  createdAt: timestamp("created_at").defaultNow(),
});

export type CalculatorLead = typeof calculatorLeads.$inferSelect;
