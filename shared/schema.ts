import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar, jsonb, index, date, uniqueIndex, check, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  lastVisitAt: timestamp("last_visit_at"),
  avgDaysBetweenVisits: decimal("avg_days_between_visits", { precision: 10, scale: 2 }),
  visitCount: integer("visit_count").default(0).notNull(),
  expectedNextVisitDate: timestamp("expected_next_visit_date"),
  segment: varchar("segment", { length: 50 }),
  churnRiskScore: integer("churn_risk_score"),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0").notNull(),
  loyaltyPoints: integer("loyalty_points").default(0).notNull(),
  loyaltyTier: varchar("loyalty_tier", { length: 20 }).default("bronze").notNull(),
  referredByCustomerId: integer("referred_by_customer_id"),
  avgDepositHour: decimal("avg_deposit_hour", { precision: 5, scale: 2 }),
  siteId: integer("site_id"),
  creditBalance: decimal("credit_balance", { precision: 12, scale: 2 }).default("0").notNull(),
  totalCreditAdded: decimal("total_credit_added", { precision: 12, scale: 2 }).default("0").notNull(),
  totalCreditUsed: decimal("total_credit_used", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_clients_last_visit").on(table.lastVisitAt),
  index("idx_customers_positive_credit")
    .on(table.creditBalance)
    .where(sql`${table.creditBalance} > 0`),
]);

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id"),
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
  createdByEmployeeId: integer("created_by_employee_id"),
  status: text("status").notNull().default("received"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  entryDate: timestamp("entry_date").defaultNow(),
  pickupDate: timestamp("pickup_date"),
  readyAt: timestamp("ready_at"),
  deliveredAt: timestamp("delivered_at"),
  cancelledAt: timestamp("cancelled_at"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  discountPct: decimal("discount_pct", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  pickupCost: decimal("pickup_cost", { precision: 10, scale: 2 }).default("0"),
  cancellationReason: text("cancellation_reason"),
  cancellationRequestedBy: varchar("cancellation_requested_by"),
  cancellationRequestedAt: timestamp("cancellation_requested_at"),
  cancellationReviewedBy: varchar("cancellation_reviewed_by"),
  cancellationReviewedAt: timestamp("cancellation_reviewed_at"),
  cancellationRejectionNote: text("cancellation_rejection_note"),
  correctedFromOrderId: integer("corrected_from_order_id"),
  correctionReason: text("correction_reason"),
  idempotencyKey: varchar("idempotency_key", { length: 120 }),
  requestFingerprint: varchar("request_fingerprint", { length: 64 }),
  postedAt: timestamp("posted_at").notNull().defaultNow(),
  siteId: integer("site_id").notNull(),
  organisationId: integer("organisation_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ name: "orders_site_tenant_fkey", columns: [table.siteId, table.organisationId], foreignColumns: [sites.id, sites.organisationId] }),
  index("idx_orders_site_status_ready")
    .on(table.siteId, table.status, table.readyAt)
    .where(sql`${table.status} = 'ready'`),
  index("idx_orders_created_at").on(table.createdAt),
  index("idx_orders_delivered_at").on(table.deliveredAt),
  index("idx_orders_corrected_from").on(table.correctedFromOrderId),
  uniqueIndex("orders_tenant_identity").on(table.id, table.organisationId, table.siteId),
  uniqueIndex("orders_organisation_id_site_id_idempotency_key_key").on(table.organisationId, table.siteId, table.idempotencyKey).where(sql`${table.idempotencyKey} IS NOT NULL`),
  check("orders_request_fingerprint_check", sql`${table.requestFingerprint} IS NULL OR ${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`),
]);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  quantity: decimal("quantity", { precision: 10, scale: 2, mode: "number" }).notNull(),
  priceAtOrder: decimal("price_at_order", { precision: 10, scale: 2 }).notNull(),
}, (table) => [
  uniqueIndex("order_items_id_order_id_key").on(table.id, table.orderId),
]);

export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  status: text("status").notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
  changedBy: varchar("changed_by"),
  notes: text("notes"),
});

export const orderCorrections = pgTable("order_corrections", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  siteId: integer("site_id").notNull(),
  reason: text("reason").notNull(),
  beforeSnapshot: jsonb("before_snapshot").notNull(),
  afterSnapshot: jsonb("after_snapshot").notNull(),
  changedBy: varchar("changed_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_order_corrections_order_created").on(table.orderId, table.createdAt),
  index("idx_order_corrections_site").on(table.siteId),
]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  collectedByEmployeeId: integer("collected_by_employee_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: varchar("method", { length: 50 }).notNull(),
  reference: varchar("reference", { length: 255 }),
  date: timestamp("date").defaultNow(),
  isAdvance: boolean("is_advance").default(false),
  // These four columns are intentionally nullable in the declarative Drizzle
  // model because Replit schema sync applies constraints before data backfills.
  // The production startup migration backfills legacy rows, validates them,
  // and then applies NOT NULL atomically.
  idempotencyKey: varchar("idempotency_key", { length: 100 }),
  organisationId: integer("organisation_id"),
  siteId: integer("site_id"),
  requestFingerprint: varchar("request_fingerprint", { length: 64 }),
}, (table) => [
  uniqueIndex("idx_payments_tenant_idempotency_key")
    .on(table.organisationId, table.siteId, table.idempotencyKey)
    .where(sql`${table.idempotencyKey} IS NOT NULL`),
  uniqueIndex("payments_tenant_identity").on(table.id, table.organisationId, table.siteId),
  foreignKey({ name: "payments_order_tenant_fkey", columns: [table.orderId, table.organisationId, table.siteId], foreignColumns: [orders.id, orders.organisationId, orders.siteId] }),
  check("payments_request_fingerprint_valid", sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`),
]);

export const garmentItems = pgTable("garment_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  itemName: text("item_name").notNull(),
  color: varchar("color", { length: 40 }),
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
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  capacityKg: decimal("capacity_kg", { precision: 8, scale: 2 }).notNull(),
  purchaseDate: timestamp("purchase_date"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  cycleCount: integer("cycle_count").notNull().default(0),
  totalKgProcessed: decimal("total_kg_processed", { precision: 10, scale: 2 }).notNull().default("0"),
  utilizationRate: decimal("utilization_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  lastMaintenanceDate: timestamp("last_maintenance_date"),
  maintenanceIntervalDays: integer("maintenance_interval_days"),
  maintenanceIntervalHours: decimal("maintenance_interval_hours", { precision: 10, scale: 2 }),
  maintenanceCost: decimal("maintenance_cost", { precision: 10, scale: 2 }).default("0"),
  siteId: integer("site_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  authUserId: varchar("auth_user_id"),
  employeeCode: varchar("employee_code", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  photoUrl: text("photo_url"),
  role: varchar("role", { length: 100 }).notNull(),
  position: varchar("position", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  salary: decimal("salary", { precision: 10, scale: 2 }),
  dateHired: timestamp("date_hired"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  kgProcessed: decimal("kg_processed", { precision: 10, scale: 2 }).notNull().default("0"),
  ordersHandled: integer("orders_handled").notNull().default(0),
  productivityScore: decimal("productivity_score", { precision: 5, scale: 2 }).notNull().default("0"),
  siteId: integer("site_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeeActivities = pgTable("employee_activities", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  actorUserId: varchar("actor_user_id"),
  siteId: integer("site_id").notNull(),
  actionDate: timestamp("action_date").defaultNow(),
  actionType: varchar("action_type", { length: 60 }).notNull(),
  orderId: integer("order_id").references(() => orders.id),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  weightKg: decimal("weight_kg", { precision: 10, scale: 2 }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeeAttendance = pgTable("employee_attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  siteId: integer("site_id").notNull(),
  workDate: timestamp("work_date").defaultNow(),
  checkInAt: timestamp("check_in_at"),
  checkOutAt: timestamp("check_out_at"),
  status: varchar("status", { length: 30 }).notNull().default("present"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const machineUsage = pgTable("machine_usage", {
  id: serial("id").primaryKey(),
  machineId: integer("machine_id").notNull().references(() => machines.id),
  orderId: integer("order_id").references(() => orders.id),
  siteId: integer("site_id").notNull(),
  usageDate: timestamp("usage_date").defaultNow(),
  weightProcessed: decimal("weight_processed", { precision: 10, scale: 2 }).default("0"),
  cycleDurationMinutes: integer("cycle_duration_minutes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productionCycles = pgTable("production_cycles", {
  id: serial("id").primaryKey(),
  machineId: integer("machine_id").notNull().references(() => machines.id),
  siteId: integer("site_id").notNull(),
  stage: varchar("stage", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("preparing"),
  capacityKg: decimal("capacity_kg", { precision: 10, scale: 2 }).notNull(),
  totalWeightKg: decimal("total_weight_kg", { precision: 10, scale: 2 }).notNull().default("0"),
  plannedDurationMinutes: integer("planned_duration_minutes").notNull().default(0),
  actualDurationMinutes: integer("actual_duration_minutes"),
  startedBy: varchar("started_by"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_production_cycles_site_status").on(table.siteId, table.status),
  index("idx_production_cycles_machine_status").on(table.machineId, table.status),
]);

export const productionCycleOrders = pgTable("production_cycle_orders", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id").notNull().references(() => productionCycles.id, { onDelete: "cascade" }),
  orderId: integer("order_id").notNull().references(() => orders.id),
  weightKg: decimal("weight_kg", { precision: 10, scale: 2 }).notNull(),
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_production_cycle_order_unique").on(table.cycleId, table.orderId),
  index("idx_production_cycle_orders_order").on(table.orderId),
]);

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
  companyRegistrationNumber: varchar("company_registration_number", { length: 100 }).default(""),
  tagline: varchar("tagline", { length: 255 }).default(""),
  logoBase64: text("logo_base64"),
  address: varchar("address", { length: 500 }).default(""),
  city: varchar("city", { length: 100 }).default(""),
  country: varchar("country", { length: 100 }).default(""),
  phone: varchar("phone", { length: 50 }).default(""),
  phone2: varchar("phone2", { length: 50 }).default(""),
  email: varchar("email", { length: 255 }).default(""),
  website: varchar("website", { length: 255 }).default(""),
  whatsappAppPreference: varchar("whatsapp_app_preference", { length: 20 }).notNull().default("ask"),
  receiptHeaderColor: varchar("receipt_header_color", { length: 7 }).notNull().default("#1e3a5f"),
  receiptLanguage: varchar("receipt_language", { length: 5 }).notNull().default("en"),
  showLogo: boolean("show_logo").notNull().default(true),
  showPickupDate: boolean("show_pickup_date").notNull().default(true),
  showGarmentList: boolean("show_garment_list").notNull().default(true),
  showPaymentHistory: boolean("show_payment_history").notNull().default(true),
  showTerms: boolean("show_terms").notNull().default(true),
  termsOfService: text("terms_of_service"),
  receiptFooterNote: varchar("receipt_footer_note", { length: 500 }).default(""),
  loyaltyProgramEnabled: boolean("loyalty_program_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Multi-site tables (Prompt B)
export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: varchar("owner_id").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("FCFA"),
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
}, (table) => [
  uniqueIndex("sites_tenant_identity").on(table.id, table.organisationId),
]);

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  siteId: integer("site_id").notNull().references(() => sites.id),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  orderId: integer("order_id").references(() => orders.id),
  paymentId: integer("payment_id").references(() => payments.id),
  type: varchar("type", { length: 10 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  balanceBefore: decimal("balance_before", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
  reversalOfId: integer("reversal_of_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_credit_tx_customer").on(table.customerId, table.createdAt),
  index("idx_credit_tx_org_site").on(table.organisationId, table.siteId),
  index("idx_credit_tx_order").on(table.orderId),
  uniqueIndex("idx_credit_tx_idempotency").on(table.idempotencyKey),
]);

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull(),
  durationDays: integer("duration_days").notNull(),
  activationFee: decimal("activation_fee", { precision: 12, scale: 2 }).default("0"),
  recurringPrice: decimal("recurring_price", { precision: 12, scale: 2 }).notNull(),
  includedWeightKg: decimal("included_weight_kg", { precision: 10, scale: 2 }),
  includedPieces: integer("included_pieces"),
  maxOrders: integer("max_orders"),
  allowCarryForward: boolean("allow_carry_forward").default(false),
  carryForwardLimit: decimal("carry_forward_limit", { precision: 10, scale: 2 }),
  overagePricePerKg: decimal("overage_price_per_kg", { precision: 10, scale: 2 }),
  overagePricePerPiece: decimal("overage_price_per_piece", { precision: 10, scale: 2 }),
  pickupIncluded: boolean("pickup_included").default(false),
  deliveryIncluded: boolean("delivery_included").default(false),
  expressIncluded: boolean("express_included").default(false),
  priorityQueue: boolean("priority_queue").default(false),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  autoRenew: boolean("auto_renew").default(true),
  gracePeriodDays: integer("grace_period_days").default(3),
  renewalReminderDays: integer("renewal_reminder_days").default(7),
  cancellationPolicy: text("cancellation_policy"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_sub_plans_org").on(table.organisationId),
]);

export const subscriptionPlanServices = pgTable("subscription_plan_services", {
  id: serial("id").primaryKey(),
  subscriptionPlanId: integer("subscription_plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_sub_plan_service_unique").on(table.subscriptionPlanId, table.serviceId),
]);

export const customerSubscriptions = pgTable("customer_subscriptions", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  subscriptionPlanId: integer("subscription_plan_id").notNull().references(() => subscriptionPlans.id),
  membershipNumber: varchar("membership_number", { length: 50 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  startDate: date("start_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  renewalDate: date("renewal_date"),
  nextBillingDate: date("next_billing_date"),
  remainingKg: decimal("remaining_kg", { precision: 10, scale: 2 }),
  remainingPieces: integer("remaining_pieces"),
  remainingOrders: integer("remaining_orders"),
  totalConsumedKg: decimal("total_consumed_kg", { precision: 10, scale: 2 }).default("0"),
  totalConsumedPieces: integer("total_consumed_pieces").default(0),
  totalOrdersUsed: integer("total_orders_used").default(0),
  autoRenew: boolean("auto_renew").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => [
  index("idx_customer_subs_org").on(table.organisationId),
  index("idx_customer_subs_client").on(table.customerId),
  index("idx_customer_subs_status").on(table.status),
  index("idx_customer_subs_expiry").on(table.expiryDate),
]);

export const subscriptionNotifications = pgTable("subscription_notifications", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  customerSubscriptionId: integer("customer_subscription_id").references(() => customerSubscriptions.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => customers.id, { onDelete: "cascade" }),
  trigger: varchar("trigger", { length: 50 }).notNull(),
  occurrenceKey: varchar("occurrence_key", { length: 100 }),
  channel: varchar("channel", { length: 20 }).notNull().default("whatsapp"),
  message: text("message"),
  whatsappUrl: text("whatsapp_url"),
  sentAt: timestamp("sent_at"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sub_notifications_org").on(table.organisationId),
  index("idx_sub_notifications_status").on(table.status),
  uniqueIndex("idx_sub_notifications_occurrence_unique")
    .on(table.organisationId, table.customerSubscriptionId, table.trigger, table.occurrenceKey)
    .where(sql`${table.occurrenceKey} is not null`),
]);

export const loyaltyProgram = pgTable("loyalty_program", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  pointsPerOrder: integer("points_per_order").notNull().default(10),
  pointsPerFcfa: decimal("points_per_fcfa", { precision: 6, scale: 4 }),
  renewalBonus: integer("renewal_bonus_points").notNull().default(50),
  referralBonus: integer("referral_bonus_points").notNull().default(100),
  pointExpireDays: integer("point_expire_days"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_loyalty_program_org").on(table.organisationId),
]);

export const loyaltyPoints = pgTable("loyalty_points", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  reason: varchar("reason", { length: 100 }).notNull(),
  orderId: integer("order_id").references(() => orders.id),
  subscriptionPaymentId: integer("subscription_payment_id"),
  referredClientId: integer("referred_client_id").references(() => customers.id),
  expiresAt: timestamp("expires_at"),
  expiredAt: timestamp("expired_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_loyalty_points_client").on(table.clientId),
  index("idx_loyalty_points_org").on(table.organisationId),
  uniqueIndex("idx_loyalty_points_order_reason").on(table.organisationId, table.orderId, table.reason)
    .where(sql`${table.orderId} is not null`),
  uniqueIndex("idx_loyalty_points_renewal_reason").on(table.organisationId, table.subscriptionPaymentId, table.reason)
    .where(sql`${table.subscriptionPaymentId} is not null`),
  uniqueIndex("idx_loyalty_points_referral_reason").on(table.organisationId, table.referredClientId, table.reason)
    .where(sql`${table.referredClientId} is not null`),
]);

export const subscriptionTransactions = pgTable("subscription_transactions", {
  id: serial("id").primaryKey(),
  customerSubscriptionId: integer("customer_subscription_id").notNull().references(() => customerSubscriptions.id),
  orderId: integer("order_id").references(() => orders.id),
  serviceId: integer("service_id").references(() => services.id),
  kgConsumed: decimal("kg_consumed", { precision: 10, scale: 2 }),
  piecesConsumed: integer("pieces_consumed"),
  amountCovered: decimal("amount_covered", { precision: 12, scale: 2 }),
  extraAmountCharged: decimal("extra_amount_charged", { precision: 12, scale: 2 }).default("0"),
  transactionDate: timestamp("transaction_date").defaultNow(),
}, (table) => [
  index("idx_sub_transactions_sub").on(table.customerSubscriptionId),
  uniqueIndex("idx_sub_transactions_order_unique").on(table.customerSubscriptionId, table.orderId).where(sql`${table.orderId} is not null`),
]);

export const membershipSubscriptionPayments = pgTable("membership_subscription_payments", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => customerSubscriptions.id),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  paymentDate: timestamp("payment_date").defaultNow(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  reference: varchar("reference", { length: 100 }),
  invoiceNumber: varchar("invoice_number", { length: 50 }),
  status: varchar("status", { length: 20 }).default("completed"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_membership_sub_payments_sub").on(table.subscriptionId),
  index("idx_sub_payments_org").on(table.organisationId),
]);

export const membershipCards = pgTable("membership_cards", {
  id: serial("id").primaryKey(),
  customerSubscriptionId: integer("customer_subscription_id").notNull().references(() => customerSubscriptions.id, { onDelete: "cascade" }),
  cardNumber: varchar("card_number", { length: 50 }).notNull().unique(),
  qrCode: text("qr_code"),
  barcode: varchar("barcode", { length: 100 }),
  issueDate: date("issue_date").defaultNow(),
  expiryDate: date("expiry_date"),
  digitalCardImage: text("digital_card_image"),
  physicalPrinted: boolean("physical_printed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const siteMembers = pgTable("site_members", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  check("site_members_capabilities_valid", sql`jsonb_typeof(${table.capabilities}) = 'array' AND ${table.capabilities} <@ '["manage_stain_treatment_pricing", "view_stain_treatment_reports"]'::jsonb`),
]);

export const VALID_SITE_MEMBER_CAPABILITIES = [
  "manage_stain_treatment_pricing",
  "view_stain_treatment_reports",
] as const;

export const stainTreatmentPricingSets = pgTable("stain_treatment_pricing_sets", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  siteId: integer("site_id").notNull(),
  currentVersion: integer("current_version").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("stain_treatment_pricing_sets_organisation_id_site_id_key").on(table.organisationId, table.siteId),
  uniqueIndex("stain_treatment_pricing_sets_id_organisation_id_site_id_key").on(table.id, table.organisationId, table.siteId),
  foreignKey({ name: "stain_treatment_pricing_sets_site_tenant_fkey", columns: [table.siteId, table.organisationId], foreignColumns: [sites.id, sites.organisationId] }),
  check("stain_treatment_pricing_sets_version_check", sql`${table.currentVersion} >= 0`),
]);

export const stainTreatmentPriceVersions = pgTable("stain_treatment_price_versions", {
  id: serial("id").primaryKey(),
  pricingSetId: integer("pricing_set_id").notNull(),
  organisationId: integer("organisation_id").notNull(),
  siteId: integer("site_id").notNull(),
  setVersion: integer("set_version").notNull(),
  level: varchar("level", { length: 30 }).notNull(),
  unit: varchar("unit", { length: 10 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  effectiveAt: timestamp("effective_at").notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("stain_treatment_price_versions_identity").on(table.id, table.organisationId, table.siteId),
  uniqueIndex("stain_treatment_price_versions_version_identity").on(table.id, table.organisationId, table.siteId, table.setVersion),
  uniqueIndex("stain_treatment_price_versions_set_level_unit_key").on(table.pricingSetId, table.setVersion, table.level, table.unit),
  uniqueIndex("stain_treatment_active_rate_key").on(table.organisationId, table.siteId, table.level, table.unit).where(sql`${table.active}`),
  index("idx_stain_treatment_price_versions_site_effective").on(table.organisationId, table.siteId, table.effectiveAt),
  foreignKey({ name: "stain_treatment_price_versions_set_tenant_fkey", columns: [table.pricingSetId, table.organisationId, table.siteId], foreignColumns: [stainTreatmentPricingSets.id, stainTreatmentPricingSets.organisationId, stainTreatmentPricingSets.siteId] }),
  check("stain_treatment_price_versions_level_check", sql`${table.level} IN ('standard','intensive','very_intensive')`),
  check("stain_treatment_price_versions_unit_check", sql`${table.unit} IN ('piece','kg')`),
  check("stain_treatment_price_versions_currency_check", sql`${table.currency} ~ '^[A-Z]{3,10}$'`),
  check("stain_treatment_price_versions_price_check", sql`${table.price} > 0 AND ${table.price} <= 99999999.99 AND ${table.price} = round(${table.price}, 2)`),
  check("stain_treatment_price_versions_version_check", sql`${table.setVersion} > 0`),
]);

export const orderStainTreatments = pgTable("order_stain_treatments", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull(),
  siteId: integer("site_id").notNull(),
  orderId: integer("order_id").notNull(),
  orderItemId: integer("order_item_id").notNull(),
  level: varchar("level", { length: 30 }).notNull(),
  unit: varchar("unit", { length: 10 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  capturedRate: decimal("captured_rate", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  pricingVersionId: integer("pricing_version_id").notNull(),
  pricingSetVersion: integer("pricing_set_version").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
  acknowledgementAffirmed: boolean("acknowledgement_affirmed"),
  acknowledgementTextVersion: varchar("acknowledgement_text_version", { length: 120 }),
  acknowledgedBy: varchar("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  correctedFromTreatmentId: integer("corrected_from_treatment_id"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("order_stain_treatments_identity").on(table.id, table.organisationId, table.siteId),
  uniqueIndex("order_stain_treatments_organisation_id_idempotency_key_key").on(table.organisationId, table.idempotencyKey),
  uniqueIndex("order_stain_treatments_corrected_from_key").on(table.correctedFromTreatmentId).where(sql`${table.correctedFromTreatmentId} IS NOT NULL`),
  index("idx_order_stain_treatments_tenant_date").on(table.organisationId, table.siteId, table.createdAt),
  index("idx_order_stain_treatments_order_item").on(table.orderId, table.orderItemId),
  foreignKey({ name: "order_stain_treatments_order_tenant_fkey", columns: [table.orderId, table.organisationId, table.siteId], foreignColumns: [orders.id, orders.organisationId, orders.siteId] }),
  foreignKey({ name: "order_stain_treatments_item_order_fkey", columns: [table.orderItemId, table.orderId], foreignColumns: [orderItems.id, orderItems.orderId] }),
  foreignKey({ name: "order_stain_treatments_pricing_version_tenant_fkey", columns: [table.pricingVersionId, table.organisationId, table.siteId, table.pricingSetVersion], foreignColumns: [stainTreatmentPriceVersions.id, stainTreatmentPriceVersions.organisationId, stainTreatmentPriceVersions.siteId, stainTreatmentPriceVersions.setVersion] }),
  foreignKey({ name: "order_stain_treatments_corrected_from_tenant_fkey", columns: [table.correctedFromTreatmentId, table.organisationId, table.siteId], foreignColumns: [table.id, table.organisationId, table.siteId] }),
  check("order_stain_treatments_level_check", sql`${table.level} IN ('standard','intensive','very_intensive')`),
  check("order_stain_treatments_unit_check", sql`${table.unit} IN ('piece','kg')`),
  check("order_stain_treatments_currency_check", sql`${table.currency} ~ '^[A-Z]{3,10}$'`),
  check("order_stain_treatments_amount_check", sql`${table.quantity} > 0 AND ${table.quantity} = round(${table.quantity}, 2) AND (${table.unit} <> 'piece' OR ${table.quantity} = trunc(${table.quantity})) AND ${table.capturedRate} > 0 AND ${table.capturedRate} = round(${table.capturedRate}, 2) AND ${table.lineTotal} > 0 AND ${table.lineTotal} = round(${table.quantity} * ${table.capturedRate}, 2)`),
  check("order_stain_treatments_acknowledgement_check", sql`(${table.level} <> 'very_intensive' AND ${table.acknowledgementAffirmed} IS NULL AND ${table.acknowledgementTextVersion} IS NULL AND ${table.acknowledgedBy} IS NULL AND ${table.acknowledgedAt} IS NULL) OR (${table.level} = 'very_intensive' AND ${table.acknowledgementAffirmed} IS TRUE AND ${table.acknowledgementTextVersion} IS NOT NULL AND ${table.acknowledgedBy} IS NOT NULL AND ${table.acknowledgedAt} IS NOT NULL)`),
  check("order_stain_treatments_correction_check", sql`${table.correctedFromTreatmentId} IS NULL OR ${table.correctedFromTreatmentId} <> ${table.id}`),
]);

export const orderStainTreatmentAdjustments = pgTable("order_stain_treatment_adjustments", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull(),
  siteId: integer("site_id").notNull(),
  treatmentId: integer("treatment_id").notNull(),
  quantityEffect: decimal("quantity_effect", { precision: 10, scale: 2 }).notNull(),
  amountEffect: decimal("amount_effect", { precision: 10, scale: 2 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  reason: text("reason").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
  acknowledgementAffirmed: boolean("acknowledgement_affirmed"),
  acknowledgementTextVersion: varchar("acknowledgement_text_version", { length: 120 }),
  acknowledgedBy: varchar("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("order_stain_treatment_adjustments_organisation_id_idempotency_key_key").on(table.organisationId, table.idempotencyKey),
  uniqueIndex("order_stain_treatment_adjustments_single_void").on(table.treatmentId).where(sql`${table.action} = 'void'`),
  index("idx_order_stain_treatment_adjustments_tenant_date").on(table.organisationId, table.siteId, table.createdAt),
  foreignKey({ name: "order_stain_treatment_adjustments_treatment_tenant_fkey", columns: [table.treatmentId, table.organisationId, table.siteId], foreignColumns: [orderStainTreatments.id, orderStainTreatments.organisationId, orderStainTreatments.siteId] }),
  check("order_stain_treatment_adjustments_action_check", sql`${table.action} IN ('adjustment','void')`),
  check("order_stain_treatment_adjustments_effect_check", sql`${table.quantityEffect} <> 0 AND ${table.quantityEffect} = round(${table.quantityEffect}, 2) AND ${table.amountEffect} <> 0 AND ${table.amountEffect} = round(${table.amountEffect}, 2)`),
  check("order_stain_treatment_adjustments_reason_check", sql`length(btrim(${table.reason})) > 0`),
  check("order_stain_treatment_adjustments_acknowledgement_check", sql`(${table.acknowledgementAffirmed} IS NULL AND ${table.acknowledgementTextVersion} IS NULL AND ${table.acknowledgedBy} IS NULL AND ${table.acknowledgedAt} IS NULL) OR (${table.acknowledgementAffirmed} IS TRUE AND ${table.acknowledgementTextVersion} IS NOT NULL AND ${table.acknowledgedBy} IS NOT NULL AND ${table.acknowledgedAt} IS NOT NULL)`),
]);

export const orderRefunds = pgTable("order_refunds", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id),
  siteId: integer("site_id").notNull(),
  orderId: integer("order_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("approved_internal"),
  idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
  requestFingerprint: varchar("request_fingerprint", { length: 64 }).notNull(),
  approvedBy: varchar("approved_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("order_refunds_id_organisation_id_site_id_key").on(table.id, table.organisationId, table.siteId),
  uniqueIndex("order_refunds_organisation_id_site_id_idempotency_key_key").on(table.organisationId, table.siteId, table.idempotencyKey),
  foreignKey({ name: "order_refunds_order_id_organisation_id_site_id_fkey", columns: [table.orderId, table.organisationId, table.siteId], foreignColumns: [orders.id, orders.organisationId, orders.siteId] }),
  check("order_refunds_amount_check", sql`${table.amount} > 0 AND ${table.amount} <= 99999999.99`),
  check("order_refunds_status_check", sql`${table.status} IN ('approved_internal', 'customer_credit')`),
  check("order_refunds_request_fingerprint_check", sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`),
]);

export const orderPaymentAllocations = pgTable("order_payment_allocations", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull(),
  organisationId: integer("organisation_id").notNull(),
  siteId: integer("site_id").notNull(),
  serviceAmount: decimal("service_amount", { precision: 10, scale: 2 }),
  treatmentId: integer("treatment_id"),
  treatmentAmount: decimal("treatment_amount", { precision: 10, scale: 2 }),
  pickupDeliveryAmount: decimal("pickup_delivery_amount", { precision: 10, scale: 2 }),
  unallocatedAmount: decimal("unallocated_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: "order_payment_allocations_payment_id_organisation_id_site_id_fkey", columns: [table.paymentId, table.organisationId, table.siteId], foreignColumns: [payments.id, payments.organisationId, payments.siteId] }),
  foreignKey({ name: "order_payment_allocations_treatment_tenant_fkey", columns: [table.treatmentId, table.organisationId, table.siteId], foreignColumns: [orderStainTreatments.id, orderStainTreatments.organisationId, orderStainTreatments.siteId] }),
  check("order_payment_allocation_one_target", sql`num_nonnulls(${table.serviceAmount}, ${table.treatmentAmount}, ${table.pickupDeliveryAmount}, ${table.unallocatedAmount}) = 1 AND (${table.treatmentAmount} IS NULL OR ${table.treatmentId} IS NOT NULL) AND (${table.treatmentAmount} IS NOT NULL OR ${table.treatmentId} IS NULL)`),
  check("order_payment_allocation_positive", sql`coalesce(${table.serviceAmount}, ${table.treatmentAmount}, ${table.pickupDeliveryAmount}, ${table.unallocatedAmount}) > 0`),
]);

export const orderRefundAllocations = pgTable("order_refund_allocations", {
  id: serial("id").primaryKey(),
  refundId: integer("refund_id").notNull(),
  organisationId: integer("organisation_id").notNull(),
  siteId: integer("site_id").notNull(),
  serviceAmount: decimal("service_amount", { precision: 10, scale: 2 }),
  treatmentId: integer("treatment_id"),
  treatmentAmount: decimal("treatment_amount", { precision: 10, scale: 2 }),
  pickupDeliveryAmount: decimal("pickup_delivery_amount", { precision: 10, scale: 2 }),
  unallocatedAmount: decimal("unallocated_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: "order_refund_allocations_refund_id_organisation_id_site_id_fkey", columns: [table.refundId, table.organisationId, table.siteId], foreignColumns: [orderRefunds.id, orderRefunds.organisationId, orderRefunds.siteId] }),
  foreignKey({ name: "order_refund_allocations_treatment_tenant_fkey", columns: [table.treatmentId, table.organisationId, table.siteId], foreignColumns: [orderStainTreatments.id, orderStainTreatments.organisationId, orderStainTreatments.siteId] }),
  check("order_refund_allocation_one_target", sql`num_nonnulls(${table.serviceAmount}, ${table.treatmentAmount}, ${table.pickupDeliveryAmount}, ${table.unallocatedAmount}) = 1 AND (${table.treatmentAmount} IS NULL OR ${table.treatmentId} IS NOT NULL) AND (${table.treatmentAmount} IS NOT NULL OR ${table.treatmentId} IS NULL)`),
  check("order_refund_allocation_positive", sql`coalesce(${table.serviceAmount}, ${table.treatmentAmount}, ${table.pickupDeliveryAmount}, ${table.unallocatedAmount}) > 0`),
]);

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

export const legalDocuments = pgTable("legal_documents", {
  id: serial("id").primaryKey(),
  documentType: varchar("document_type", { length: 30 }).notNull(),
  version: varchar("version", { length: 80 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  effectiveAt: timestamp("effective_at").notNull(),
  contentUrl: varchar("content_url", { length: 500 }).notNull(),
  documentHash: varchar("document_hash", { length: 64 }).notNull(),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_legal_documents_type_version").on(table.documentType, table.version),
]);

export const legalAcceptances = pgTable("legal_acceptances", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  organisationId: integer("organisation_id"),
  siteId: integer("site_id"),
  termsVersion: varchar("terms_version", { length: 80 }).notNull(),
  privacyVersion: varchar("privacy_version", { length: 80 }).notNull(),
  cookieVersion: varchar("cookie_version", { length: 80 }).notNull(),
  documentHash: varchar("document_hash", { length: 64 }).notNull(),
  source: varchar("source", { length: 40 }).notNull(),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").notNull().default({}),
  acceptedAt: timestamp("accepted_at").defaultNow(),
}, (table) => [
  index("idx_legal_acceptances_user_versions").on(table.userId, table.termsVersion, table.privacyVersion, table.cookieVersion),
  index("idx_legal_acceptances_organisation").on(table.organisationId),
]);

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  creditTransactions: many(creditTransactions),
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
  corrections: many(orderCorrections),
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

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  customer: one(customers, {
    fields: [creditTransactions.customerId],
    references: [customers.id],
  }),
  order: one(orders, {
    fields: [creditTransactions.orderId],
    references: [orders.id],
  }),
  payment: one(payments, {
    fields: [creditTransactions.paymentId],
    references: [payments.id],
  }),
  site: one(sites, {
    fields: [creditTransactions.siteId],
    references: [sites.id],
  }),
  organisation: one(organisations, {
    fields: [creditTransactions.organisationId],
    references: [organisations.id],
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

export const orderCorrectionsRelations = relations(orderCorrections, ({ one }) => ({
  order: one(orders, {
    fields: [orderCorrections.orderId],
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
  stainTreatmentPricingSets: many(stainTreatmentPricingSets),
}));

export const stainTreatmentPricingSetsRelations = relations(stainTreatmentPricingSets, ({ one, many }) => ({
  organisation: one(organisations, { fields: [stainTreatmentPricingSets.organisationId], references: [organisations.id] }),
  site: one(sites, { fields: [stainTreatmentPricingSets.siteId], references: [sites.id] }),
  versions: many(stainTreatmentPriceVersions),
}));

export const stainTreatmentPriceVersionsRelations = relations(stainTreatmentPriceVersions, ({ one, many }) => ({
  pricingSet: one(stainTreatmentPricingSets, { fields: [stainTreatmentPriceVersions.pricingSetId], references: [stainTreatmentPricingSets.id] }),
  treatments: many(orderStainTreatments),
}));

export const orderStainTreatmentsRelations = relations(orderStainTreatments, ({ one, many }) => ({
  order: one(orders, { fields: [orderStainTreatments.orderId], references: [orders.id] }),
  orderItem: one(orderItems, { fields: [orderStainTreatments.orderItemId], references: [orderItems.id] }),
  pricingVersion: one(stainTreatmentPriceVersions, { fields: [orderStainTreatments.pricingVersionId], references: [stainTreatmentPriceVersions.id] }),
  adjustments: many(orderStainTreatmentAdjustments),
}));

export const orderStainTreatmentAdjustmentsRelations = relations(orderStainTreatmentAdjustments, ({ one }) => ({
  treatment: one(orderStainTreatments, { fields: [orderStainTreatmentAdjustments.treatmentId], references: [orderStainTreatments.id] }),
}));

// Insert schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  lastVisitAt: true,
  avgDaysBetweenVisits: true,
  visitCount: true,
  expectedNextVisitDate: true,
  segment: true,
  churnRiskScore: true,
  totalRevenue: true,
  avgDepositHour: true,
  creditBalance: true,
  totalCreditAdded: true,
  totalCreditUsed: true,
});
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalAmount: true,
  readyAt: true,
  deliveredAt: true,
  cancelledAt: true,
  organisationId: true,
  siteId: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(payments)
  .omit({ id: true, organisationId: true, siteId: true, requestFingerprint: true })
  .extend({ date: z.coerce.date().optional() });
export const insertGarmentItemSchema = createInsertSchema(garmentItems).omit({ id: true, returnedForTreatment: true, returnStage: true, returnNotes: true, returnedAt: true, resolvedAt: true });
export const insertExpenditureSchema = createInsertSchema(expenditures).omit({ id: true });
export const insertMachineSchema = createInsertSchema(machines).omit({ id: true, createdAt: true, cycleCount: true, totalKgProcessed: true, utilizationRate: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true, productivityScore: true });
export const insertEmployeeActivitySchema = createInsertSchema(employeeActivities).omit({ id: true, createdAt: true });
export const insertEmployeeAttendanceSchema = createInsertSchema(employeeAttendance).omit({ id: true, createdAt: true });
export const insertMachineUsageSchema = createInsertSchema(machineUsage).omit({ id: true, createdAt: true });
export const insertPlanSchema = createInsertSchema(plans).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, ordersUsed: true });
export const insertOrderStatusHistorySchema = createInsertSchema(orderStatusHistory).omit({ id: true, changedAt: true });
export const insertBusinessSettingsSchema = createInsertSchema(businessSettings)
  .omit({ id: true, userId: true, updatedAt: true })
  .extend({
    whatsappAppPreference: z.enum(["ask", "whatsapp", "business"]).optional(),
  });
export const insertSiteSchema = createInsertSchema(sites).omit({ id: true, createdAt: true });
export const insertSiteMemberSchema = createInsertSchema(siteMembers).omit({ id: true, createdAt: true });
export const insertSiteInvitationSchema = createInsertSchema(siteInvitations).omit({ id: true, createdAt: true });
export const insertLegalAcceptanceSchema = createInsertSchema(legalAcceptances).omit({ id: true, acceptedAt: true });
export const insertStainTreatmentPricingSetSchema = createInsertSchema(stainTreatmentPricingSets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStainTreatmentPriceVersionSchema = createInsertSchema(stainTreatmentPriceVersions).omit({ id: true, createdAt: true });
export const insertOrderStainTreatmentSchema = createInsertSchema(orderStainTreatments).omit({ id: true, createdAt: true });
export const insertOrderStainTreatmentAdjustmentSchema = createInsertSchema(orderStainTreatmentAdjustments).omit({ id: true, createdAt: true });

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

export type EmployeeActivity = typeof employeeActivities.$inferSelect;
export type InsertEmployeeActivity = z.infer<typeof insertEmployeeActivitySchema>;

export type EmployeeAttendance = typeof employeeAttendance.$inferSelect;
export type InsertEmployeeAttendance = z.infer<typeof insertEmployeeAttendanceSchema>;

export type MachineUsage = typeof machineUsage.$inferSelect;
export type ProductionCycle = typeof productionCycles.$inferSelect;
export type ProductionCycleOrder = typeof productionCycleOrders.$inferSelect;
export type InsertMachineUsage = z.infer<typeof insertMachineUsageSchema>;

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
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type LegalAcceptance = typeof legalAcceptances.$inferSelect;
export type InsertLegalAcceptance = z.infer<typeof insertLegalAcceptanceSchema>;
export type StainTreatmentPricingSet = typeof stainTreatmentPricingSets.$inferSelect;
export type InsertStainTreatmentPricingSet = z.infer<typeof insertStainTreatmentPricingSetSchema>;
export type StainTreatmentPriceVersion = typeof stainTreatmentPriceVersions.$inferSelect;
export type InsertStainTreatmentPriceVersion = z.infer<typeof insertStainTreatmentPriceVersionSchema>;
export type OrderStainTreatment = typeof orderStainTreatments.$inferSelect;
export type InsertOrderStainTreatment = z.infer<typeof insertOrderStainTreatmentSchema>;
export type OrderStainTreatmentAdjustment = typeof orderStainTreatmentAdjustments.$inferSelect;
export type InsertOrderStainTreatmentAdjustment = z.infer<typeof insertOrderStainTreatmentAdjustmentSchema>;

export type OrderWithCustomer = Order & { customer: Customer };
export type PaymentWithEmployee = Payment & { collectedByEmployee?: Employee | null };
export type OrderWithDetails = OrderWithCustomer & { items: (OrderItem & { service: Service })[], payments: PaymentWithEmployee[], garmentItems: GarmentItem[], statusHistory?: OrderStatusHistoryEntry[], corrections?: (typeof orderCorrections.$inferSelect)[], createdByEmployee?: Employee | null };
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

export const diagnosticLeads = pgTable("diagnostic_leads", {
  id: serial("id").primaryKey(),
  fullName:     varchar("full_name",     { length: 200 }),
  phone:        varchar("phone",         { length: 50 }),
  email:        varchar("email",         { length: 255 }),
  country:      varchar("country",       { length: 100 }),
  city:         varchar("city",          { length: 100 }),
  businessName: varchar("business_name", { length: 200 }),
  yearCreated:  varchar("year_created",  { length: 10 }),
  employees:    varchar("employees",     { length: 20 }),
  activityType: varchar("activity_type", { length: 50 }),
  objectives:   text("objectives").array(),
  answers:      jsonb("answers"),
  totalScore:   integer("total_score"),
  level:        varchar("level",      { length: 100 }),
  riskIndex:    varchar("risk_index", { length: 50 }),
  completedAt:  timestamp("completed_at"),
  createdAt:    timestamp("created_at").defaultNow(),
});

export type DiagnosticLead = typeof diagnosticLeads.$inferSelect;

export const leadsCalculateurRentabilite = pgTable("leads_calculateur_rentabilite", {
  id: serial("id").primaryKey(),
  name:    varchar("name",    { length: 200 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  city:    varchar("city",    { length: 100 }).notNull(),
  phone:   varchar("phone",   { length: 50  }).notNull(),
  email:   varchar("email",   { length: 255 }).notNull(),
  status:          varchar("status", { length: 30 }).default("pending_calculation"),
  calculationJson: jsonb("calculation_json"),
  completedAt:     timestamp("completed_at"),
  createdAt:       timestamp("created_at").defaultNow(),
});

export type LeadCalculateurRentabilite = typeof leadsCalculateurRentabilite.$inferSelect;
