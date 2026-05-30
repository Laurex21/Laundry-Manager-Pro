// Fixture data for demo mode. No real backend calls are made.

const now = new Date();
const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();

export const DEMO_USER = {
  id: "demo-user-001",
  email: "owner@xpressclean.cm",
  firstName: "Alex",
  lastName: "Osei",
  profileImageUrl: null,
  phone: "+237 655 012 345",
  businessName: "Xpress Clean",
  role: "owner",
  organisationId: 1,
  currentSiteId: null,
  createdAt: d(90),
  updatedAt: d(1),
  // Extended fields read by useAuth
  planSlug: "business",
  subscription: { plan: { slug: "business" } },
  currentSite: null,
  allSites: [
    { id: 1, name: "Douala Akwa", address: "Rue Joss, Akwa", city: "Douala", memberCount: 3, isActive: true },
    { id: 2, name: "Yaounde Bastos", address: "Avenue Foch, Bastos", city: "Yaounde", memberCount: 2, isActive: true },
  ],
};

export const DEMO_CUSTOMERS = [
  {
    id: 1, name: "Alice Mensah", phone: "+237 655 010 101",
    email: "alice.mensah@gmail.com", address: "Rue Joss, Akwa",
    notes: "Prefers eco-friendly detergent", starchLevel: "light",
    detergentType: "eco_friendly", specialNotes: "Handle with care",
    createdAt: d(60), updatedAt: d(5), organisationId: 1, siteId: 1,
  },
  {
    id: 2, name: "Bernard Tetteh", phone: "+237 677 010 202",
    email: "b.tetteh@gmail.com", address: "Avenue Ahmadou Ahidjo, Yaounde",
    notes: "", starchLevel: "medium", detergentType: "regular",
    specialNotes: "", createdAt: d(45), updatedAt: d(10), organisationId: 1, siteId: 1,
  },
  {
    id: 3, name: "Clara Owusu", phone: "+237 699 010 303",
    email: "clara.o@gmail.com", address: "Molyko, Buea",
    notes: "Sensitive skin - no fragrance", starchLevel: "none",
    detergentType: "fragrance_free", specialNotes: "Hypoallergenic only",
    createdAt: d(30), updatedAt: d(2), organisationId: 1, siteId: 1,
  },
];

export const DEMO_SERVICES = [
  {
    id: 1, name: "Lavage & Pliage", price: "750", unit: "kg",
    category: "Lavage", description: "Lavage machine, sechage et pliage",
    minimumCharge: "3000", estimatedDuration: 24, durationUnit: "hours",
    expressAvailable: true, expressSurcharge: "50",
    createdAt: d(90), updatedAt: d(90), organisationId: 1, siteId: 1,
  },
  {
    id: 2, name: "Nettoyage a sec", price: "2500", unit: "piece",
    category: "Nettoyage", description: "Nettoyage professionnel pour vetements delicats",
    minimumCharge: "2500", estimatedDuration: 48, durationUnit: "hours",
    expressAvailable: true, expressSurcharge: "75",
    createdAt: d(90), updatedAt: d(90), organisationId: 1, siteId: 1,
  },
  {
    id: 3, name: "Repassage vapeur", price: "500", unit: "piece",
    category: "Repassage", description: "Repassage professionnel a la vapeur",
    minimumCharge: "500", estimatedDuration: 12, durationUnit: "hours",
    expressAvailable: false, expressSurcharge: "0",
    createdAt: d(90), updatedAt: d(90), organisationId: 1, siteId: 1,
  },
];

const mkOrder = (
  id: number, customerId: number, status: string, paymentStatus: string,
  totalAmount: string, daysAgo: number
) => ({
  id,
  customerId,
  status,
  paymentStatus,
  totalAmount,
  discount: "0",
  entryDate: d(daysAgo),
  pickupDate: d(daysAgo - 2),
  createdAt: d(daysAgo),
  updatedAt: d(daysAgo - 1),
  organisationId: 1,
  siteId: 1,
  hasReturnedItems: false,
  customer: DEMO_CUSTOMERS.find((c) => c.id === customerId),
  items: [
    { id: id * 10, orderId: id, serviceId: (id % 3) + 1, quantity: 2, unitPrice: "750",
      service: DEMO_SERVICES[(id % 3)] },
  ],
  garmentItems: [
    { id: id * 100 + 1, orderId: id, name: "Chemise", quantity: 2, notes: "" },
    { id: id * 100 + 2, orderId: id, name: "Pantalon", quantity: 1, notes: "" },
  ],
});

export const DEMO_ORDERS = [
  mkOrder(1, 1, "delivered", "paid", "15000", 14),
  mkOrder(2, 2, "ready", "unpaid", "19000", 5),
  mkOrder(3, 3, "washing", "unpaid", "9500", 3),
  mkOrder(4, 1, "received", "unpaid", "24000", 1),
  mkOrder(5, 2, "delivered", "paid", "14000", 20),
  mkOrder(6, 3, "delivered", "paid", "10500", 25),
];

export const DEMO_PAYMENTS = [
  { id: 1, orderId: 1, amount: "15000", method: "mobile_money", note: "",
    createdAt: d(13), updatedAt: d(13), organisationId: 1 },
  { id: 2, orderId: 5, amount: "14000", method: "mobile_money", note: "",
    createdAt: d(19), updatedAt: d(19), organisationId: 1 },
  { id: 3, orderId: 6, amount: "10500", method: "cash", note: "",
    createdAt: d(24), updatedAt: d(24), organisationId: 1 },
];

export const DEMO_EXPENDITURES = [
  { id: 1, title: "Fournitures detergent", description: "Achat mensuel en gros", amount: "48000", category: "Supplies",
    date: d(7), notes: "Achat mensuel en gros", createdAt: d(7), organisationId: 1, siteId: 1 },
  { id: 2, title: "Facture electricite", description: "Paiement mensuel ENEO", amount: "125000", category: "Utilities",
    date: d(10), notes: "", createdAt: d(10), organisationId: 1, siteId: 1 },
  { id: 3, title: "Entretien machine", description: "Remplacement courroie tambour", amount: "75000", category: "Maintenance",
    date: d(15), notes: "Remplacement courroie tambour", createdAt: d(15), organisationId: 1, siteId: 1 },
  { id: 4, title: "Salaires personnel", description: "Paiement salaires quinzaine", amount: "350000", category: "Payroll",
    date: d(3), notes: "", createdAt: d(3), organisationId: 1, siteId: 1 },
  { id: 5, title: "Sacs & Cintres", description: "Reapprovisionnement emballages", amount: "24000", category: "Supplies",
    date: d(5), notes: "", createdAt: d(5), organisationId: 1, siteId: 1 },
];

export const DEMO_MACHINES = [
  { id: 1, name: "Washer A", type: "washer", brand: "Samsung", model: "WF18T8000GW",
    status: "active", capacity: "18kg", capacityKg: 18, purchaseDate: d(365), lastServiceDate: d(15),
    utilizationRate: 78, cycleCount: 1240, totalKgProcessed: 19840,
    notes: "", organisationId: 1, siteId: 1, createdAt: d(365), updatedAt: d(15) },
  { id: 2, name: "Dryer B", type: "dryer", brand: "LG", model: "DV22EN1J31H",
    status: "active", capacity: "22kg", capacityKg: 22, purchaseDate: d(300), lastServiceDate: d(20),
    utilizationRate: 65, cycleCount: 980, totalKgProcessed: 16320,
    notes: "", organisationId: 1, siteId: 1, createdAt: d(300), updatedAt: d(20) },
];

export const DEMO_EMPLOYEES = [
  { id: 1, name: "Kwame Boateng", role: "operator", phone: "+237 655 020 101",
    email: "kwame@xpressclean.cm", status: "active", hireDate: d(180),
    salary: "150000", notes: "", kgProcessed: 2140, ordersHandled: 98,
    organisationId: 1, siteId: 1, createdAt: d(180) },
  { id: 2, name: "Esi Asante", role: "manager", phone: "+237 677 020 202",
    email: "esi@xpressclean.cm", status: "active", hireDate: d(365),
    salary: "250000", notes: "Responsable equipe nuit", kgProcessed: 3860, ordersHandled: 175,
    organisationId: 1, siteId: 1, createdAt: d(365) },
];

export const DEMO_STATS = {
  totalOrders: 6,
  totalRevenue: 155000,
  pendingOrders: 2,
  activeCustomers: 3,
};

export const DEMO_DASHBOARD = {
  siteCount: 2,
  monthRevenue: 2840000,
  monthExpenses: 1055000,
  ordersByStatus: { received: 1, washing: 1, ready: 1, delivered: 3 },
  readyForPickup: [DEMO_ORDERS[1]],
  alerts: [],
  sitesOverview: [
    { id: 1, name: "Douala Akwa", city: "Douala", revenue: 1820000, orders: 4, memberCount: 3, isActive: true },
    { id: 2, name: "Yaounde Bastos", city: "Yaounde", revenue: 1020000, orders: 2, memberCount: 2, isActive: true },
  ],
};

// Deterministic daily revenue: sine wave only, no Math.random.
const DAILY_REVENUE_OFFSETS = [0,4,8,10,8,4,0,-4,-6,-4,0,6,10,12,10,6,2,-2,-4,-2,2,8,12,14,12,8,4,0,-2,0];
const DAILY_REVENUE = Array.from({ length: 30 }, (_, i) => ({
  date: d(29 - i).slice(0, 10),
  revenue: (80000 + Math.round(Math.sin(i / 4) * 30000) + DAILY_REVENUE_OFFSETS[i] * 1000),
}));

export const DEMO_REPORTS = {
  totalRevenue: 2840000,
  totalExpenses: 1055000,
  netProfit: 1785000,
  totalOrders: 6,
  dailyRevenue: DAILY_REVENUE,
  serviceDistribution: [
    { name: "Lavage & Pliage", count: 8 },
    { name: "Nettoyage a sec", count: 5 },
    { name: "Repassage vapeur", count: 3 },
  ],
  topCustomers: [
    { name: "Alice Mensah", orderCount: 2, totalSpent: 29000 },
    { name: "Bernard Tetteh", orderCount: 2, totalSpent: 33000 },
    { name: "Clara Owusu", orderCount: 2, totalSpent: 20000 },
  ],
};

export const DEMO_PERFORMANCE = {
  currentMonthRevenue: 2840000,
  currentMonthExpenses: 1055000,
  currentMonthProfit: 1785000,
  last30Revenue: 2840000,
  prev30Revenue: 2410000,
  last30Expenses: 1055000,
  prev30Expenses: 980000,
  last30Profit: 1785000,
  prev30Profit: 1430000,
  monthlyComparison: [
    { month: "Fev", income: 2100000, expenses: 900000 },
    { month: "Mar", income: 2350000, expenses: 940000 },
    { month: "Avr", income: 2410000, expenses: 980000 },
    { month: "Mai", income: 2840000, expenses: 1055000 },
  ],
};

export const DEMO_KPIS = {
  revenue: 2840000,
  orders: 6,
  avgOrderValue: 473000,
  repeatCustomers: 2,
  topService: "Lavage & Pliage",
  revenueGrowth: 17.8,
};

export const DEMO_SETTINGS = {
  businessName: "Xpress Clean Cameroon",
  address: "Rue Joss, Akwa, Douala",
  phone: "+237 655 012 345",
  email: "owner@xpressclean.cm",
  currency: "XAF",
  timezone: "Africa/Douala",
};

export const DEMO_SITES = DEMO_USER.allSites;

// Given a fetch URL, return demo fixture data or undefined if no match.
export function getDemoFixture(url: string): unknown {
  const path = url.split("?")[0];

  // Auth
  if (path === "/api/auth/user") return DEMO_USER;

  // Stats
  if (path === "/api/stats") return DEMO_STATS;

  // Orders list or single order
  if (path === "/api/orders") return DEMO_ORDERS;
  const orderMatch = path.match(/^\/api\/orders\/(\d+)$/);
  if (orderMatch) {
    const found = DEMO_ORDERS.find((o) => o.id === Number(orderMatch[1]));
    return found ?? DEMO_ORDERS[0];
  }
  const orderPaymentsMatch = path.match(/^\/api\/orders\/(\d+)\/payments$/);
  if (orderPaymentsMatch) {
    const oid = Number(orderPaymentsMatch[1]);
    return DEMO_PAYMENTS.filter((p) => p.orderId === oid);
  }
  const orderStatusHistoryMatch = path.match(/^\/api\/orders\/(\d+)\/status-history$/);
  if (orderStatusHistoryMatch) {
    const oid = Number(orderStatusHistoryMatch[1]);
    const order = DEMO_ORDERS.find((o) => o.id === oid) ?? DEMO_ORDERS[0];
    return [
      { id: oid * 10 + 1, orderId: oid, status: "received", changedAt: order.createdAt, note: "" },
      { id: oid * 10 + 2, orderId: oid, status: order.status, changedAt: order.updatedAt, note: "" },
    ];
  }

  // Customers
  if (path === "/api/customers") return DEMO_CUSTOMERS;
  const customerMatch = path.match(/^\/api\/customers\/(\d+)$/);
  if (customerMatch) {
    const found = DEMO_CUSTOMERS.find((c) => c.id === Number(customerMatch[1]));
    return found ?? DEMO_CUSTOMERS[0];
  }
  const customerOrdersMatch = path.match(/^\/api\/customers\/(\d+)\/orders$/);
  if (customerOrdersMatch) {
    const cid = Number(customerOrdersMatch[1]);
    return DEMO_ORDERS.filter((o) => o.customerId === cid);
  }

  // Services
  if (path === "/api/services") return DEMO_SERVICES;

  // Expenditures
  if (path === "/api/expenditures") return DEMO_EXPENDITURES;

  // Payments list (some pages may call this)
  if (path === "/api/payments") return DEMO_PAYMENTS;

  // Analytics
  if (path === "/api/analytics/dashboard") return DEMO_DASHBOARD;
  if (path.startsWith("/api/analytics/kpis")) return DEMO_KPIS;
  if (path === "/api/analytics/waste") return [];
  if (path === "/api/analytics/production-delays") return [];
  if (path === "/api/analytics/performance-score") return { score: 82, label: "Good" };

  // Reports
  if (path === "/api/reports") return DEMO_REPORTS;
  if (path === "/api/reports/performance") return DEMO_PERFORMANCE;

  // Machines
  if (path === "/api/machines") return DEMO_MACHINES;

  // Employees
  if (path === "/api/employees") return DEMO_EMPLOYEES;

  // Settings
  if (path === "/api/settings") return DEMO_SETTINGS;

  // Sites
  if (path === "/api/sites") return DEMO_SITES;
  const siteMembersMatch = path.match(/^\/api\/sites\/(\d+)\/members$/);
  if (siteMembersMatch) {
    return [
      { id: 1, userId: "demo-user-001", siteId: Number(siteMembersMatch[1]), role: "owner",
        name: "Alex Osei", email: "owner@cleanease.demo" },
      { id: 2, userId: "demo-emp-002", siteId: Number(siteMembersMatch[1]), role: "manager",
        name: "Esi Asante", email: "esi@cleanease.demo" },
    ];
  }

  // Invitations
  if (path === "/api/invitations/pending") return [];

  return undefined;
}
