import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Import auth models
export * from "./models/auth";
import { users } from "./models/auth";

// === TABLE DEFINITIONS ===

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
  unit: text("unit").notNull(), // e.g., "kg", "piece"
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(), // "washing", "dry_cleaning", "ironing"
  imageUrl: text("image_url"),
  active: boolean("active").default(true),
  minimumCharge: decimal("minimum_charge", { precision: 10, scale: 2 }),
  estimatedDuration: integer("estimated_duration"),
  durationUnit: text("duration_unit"), // "hours", "days"
  expressAvailable: boolean("express_available").default(false),
  expressSurcharge: decimal("express_surcharge", { precision: 5, scale: 2 }),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  status: text("status").notNull().default("pending"), // pending, processing, ready, delivered, cancelled
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid, paid, partial
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

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: text("method").notNull(), // cash, card, online
  date: timestamp("date").defaultNow(),
});

export const garmentItems = pgTable("garment_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
});

export const expenditures = pgTable("expenditures", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // utilities, supplies, maintenance, rent, other
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: timestamp("date").defaultNow(),
});

// === RELATIONS ===

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


// === ZOD SCHEMAS ===

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true, totalAmount: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, date: true });
export const insertGarmentItemSchema = createInsertSchema(garmentItems).omit({ id: true });
export const insertExpenditureSchema = createInsertSchema(expenditures).omit({ id: true, date: true });

// === TYPES ===

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

// Complex types for UI
export type OrderWithCustomer = Order & { customer: Customer };
export type OrderWithDetails = OrderWithCustomer & { items: (OrderItem & { service: Service })[], payments: Payment[], garmentItems: GarmentItem[] };
