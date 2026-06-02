import { z } from 'zod';
import { 
  insertCustomerSchema, 
  insertServiceSchema, 
  insertOrderSchema, 
  insertPaymentSchema, 
  insertExpenditureSchema,
  customers,
  services,
  orders,
  payments,
  expenditures,
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// Input schema for creating an order with items
export const createOrderWithItemsSchema = z.object({
  customerId: z.number(),
  status: z.string().default("pending"),
  paymentStatus: z.string().default("unpaid"),
  entryDate: z.string().optional(),
  pickupDate: z.string().optional(),
  discount: z.string().optional(),
  pickupCost: z.string().optional().default("0"),
  items: z.array(z.object({
    serviceId: z.number().min(1, "Please select a service"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
  })),
  garmentItems: z.array(z.object({
    itemName: z.string(),
    quantity: z.number(),
  })).optional().default([]),
});

export const api = {
  customers: {
    list: {
      method: 'GET' as const,
      path: '/api/customers',
      responses: {
        200: z.array(z.custom<typeof customers.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/customers/:id',
      responses: {
        200: z.custom<typeof customers.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/customers',
      input: insertCustomerSchema,
      responses: {
        201: z.custom<typeof customers.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/customers/:id',
      input: insertCustomerSchema.partial(),
      responses: {
        200: z.custom<typeof customers.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  services: {
    list: {
      method: 'GET' as const,
      path: '/api/services',
      responses: {
        200: z.array(z.custom<typeof services.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/services',
      input: insertServiceSchema,
      responses: {
        201: z.custom<typeof services.$inferSelect>(),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/services/:id',
      input: insertServiceSchema.partial(),
      responses: {
        200: z.custom<typeof services.$inferSelect>(),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/services/:id',
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
      },
    },
  },
  orders: {
    list: {
      method: 'GET' as const,
      path: '/api/orders',
      responses: {
        200: z.array(z.any()), // TODO: Type properly with relations if needed
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/orders/:id',
      responses: {
        200: z.any(), // Returns OrderWithDetails
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/orders',
      input: createOrderWithItemsSchema,
      responses: {
        201: z.custom<typeof orders.$inferSelect>(),
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/orders/:id/status',
      input: z.object({ status: z.string(), paymentStatus: z.string().optional() }),
      responses: {
        200: z.custom<typeof orders.$inferSelect>(),
      },
    },
  },
  payments: {
    create: {
      method: 'POST' as const,
      path: '/api/payments',
      input: insertPaymentSchema,
      responses: {
        201: z.custom<typeof payments.$inferSelect>(),
      },
    },
    listByOrder: {
      method: 'GET' as const,
      path: '/api/orders/:id/payments',
      responses: {
        200: z.array(z.custom<typeof payments.$inferSelect>()),
      },
    },
  },
  expenditures: {
    list: {
      method: 'GET' as const,
      path: '/api/expenditures',
      responses: {
        200: z.array(z.custom<typeof expenditures.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/expenditures',
      input: insertExpenditureSchema.extend({ date: z.string().optional() }),
      responses: {
        201: z.custom<typeof expenditures.$inferSelect>(),
      },
    },
  },
  performance: {
    get: {
      method: 'GET' as const,
      path: '/api/reports/performance',
      responses: {
        200: z.object({
          currentMonthRevenue: z.number(),
          currentMonthExpenses: z.number(),
          currentMonthProfit: z.number(),
          last30Revenue: z.number(),
          prev30Revenue: z.number(),
          last30Expenses: z.number(),
          prev30Expenses: z.number(),
          last30Profit: z.number(),
          prev30Profit: z.number(),
          monthlyComparison: z.array(z.object({ month: z.string(), income: z.number(), expenses: z.number() })),
        }),
      },
    },
  },
  reports: {
    get: {
      method: 'GET' as const,
      path: '/api/reports',
      responses: {
        200: z.object({
          totalRevenue: z.number(),
          totalExpenses: z.number(),
          netProfit: z.number(),
          totalOrders: z.number(),
          dailyRevenue: z.array(z.object({ date: z.string(), revenue: z.number() })),
          serviceDistribution: z.array(z.object({ name: z.string(), count: z.number() })),
          topCustomers: z.array(z.object({ name: z.string(), orderCount: z.number(), totalSpent: z.number() })),
        }),
      },
    },
  },
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalOrders: z.number(),
          totalRevenue: z.number(),
          pendingOrders: z.number(),
          activeCustomers: z.number(),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
