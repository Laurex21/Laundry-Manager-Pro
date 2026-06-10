// Fixture data for demo mode. No real backend calls are made.

const now = new Date();
const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();

export const DEMO_USER = {
  id: "demo-user-001",
  email: "owner@xpresspro.cm",
  firstName: "Alex",
  lastName: "Osei",
  profileImageUrl: null,
  phone: "+237 655 012 345",
  businessName: "XpressPro",
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
    specialNotes: "", createdAt: d(45), updatedAt: d(10), organisationId: 1, siteId: 2,
  },
  {
    id: 3, name: "Clara Owusu", phone: "+237 699 010 303",
    email: "clara.o@gmail.com", address: "Molyko, Buea",
    notes: "Sensitive skin - no fragrance", starchLevel: "none",
    detergentType: "fragrance_free", specialNotes: "Hypoallergenic only",
    createdAt: d(30), updatedAt: d(2), organisationId: 1, siteId: 1,
  },
  {
    id: 4, name: "Marceline Ngono", phone: "+237 699 210 404",
    email: "marceline.ngono@gmail.com", address: "Quartier Bastos, Yaounde",
    notes: "Weekly hotel linens pickup", starchLevel: "none",
    detergentType: "regular", specialNotes: "Separate white linens",
    createdAt: d(25), updatedAt: d(3), organisationId: 1, siteId: 2,
  },
  {
    id: 5, name: "Thierry Mbarga", phone: "+237 677 210 505",
    email: "thierry.mbarga@gmail.com", address: "Omnisports, Yaounde",
    notes: "Prefers evening pickup", starchLevel: "heavy",
    detergentType: "regular", specialNotes: "Business shirts only",
    createdAt: d(18), updatedAt: d(4), organisationId: 1, siteId: 2,
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
  {
    id: 4, name: "Pressing chemises", price: "900", unit: "piece",
    category: "Repassage", description: "Service express chemises pour bureaux Bastos",
    minimumCharge: "1800", estimatedDuration: 8, durationUnit: "hours",
    expressAvailable: true, expressSurcharge: "40",
    createdAt: d(80), updatedAt: d(20), organisationId: 1, siteId: 2,
  },
  {
    id: 5, name: "Linge hotelier", price: "650", unit: "kg",
    category: "Lavage", description: "Lavage volume pour linge hotelier et bureaux",
    minimumCharge: "6000", estimatedDuration: 24, durationUnit: "hours",
    expressAvailable: false, expressSurcharge: "0",
    createdAt: d(80), updatedAt: d(20), organisationId: 1, siteId: 2,
  },
];

const mkOrder = (
  id: number, customerId: number, status: string, paymentStatus: string,
  totalAmount: string, daysAgo: number, siteId = 1
) => {
  const servicePool = DEMO_SERVICES.filter((service) => service.siteId === siteId);
  const service = servicePool[id % servicePool.length] ?? DEMO_SERVICES[0];
  return {
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
    siteId,
    hasReturnedItems: false,
    customer: DEMO_CUSTOMERS.find((c) => c.id === customerId),
    items: [
      { id: id * 10, orderId: id, serviceId: service.id, quantity: 2, unitPrice: service.price,
        service },
    ],
    garmentItems: [
      { id: id * 100 + 1, orderId: id, name: "Chemise", quantity: 2, notes: "" },
      { id: id * 100 + 2, orderId: id, name: "Pantalon", quantity: 1, notes: "" },
    ],
  };
};

export const DEMO_ORDERS = [
  mkOrder(1, 1, "delivered", "paid", "15000", 14, 1),
  mkOrder(2, 2, "ready", "unpaid", "19000", 5, 2),
  mkOrder(3, 3, "washing", "unpaid", "9500", 3),
  mkOrder(4, 1, "received", "unpaid", "24000", 1),
  mkOrder(5, 4, "delivered", "paid", "14000", 20, 2),
  mkOrder(6, 3, "delivered", "paid", "10500", 25),
  mkOrder(7, 4, "received", "unpaid", "17500", 2, 2),
  mkOrder(8, 5, "delivered", "paid", "22500", 8, 2),
];

export const DEMO_PAYMENTS = [
  { id: 1, orderId: 1, amount: "15000", method: "mobile_money", note: "",
    createdAt: d(13), updatedAt: d(13), organisationId: 1 },
  { id: 2, orderId: 5, amount: "14000", method: "mobile_money", note: "",
    createdAt: d(19), updatedAt: d(19), organisationId: 1 },
  { id: 3, orderId: 6, amount: "10500", method: "cash", note: "",
    createdAt: d(24), updatedAt: d(24), organisationId: 1 },
  { id: 4, orderId: 8, amount: "22500", method: "mobile_money", note: "",
    createdAt: d(7), updatedAt: d(7), organisationId: 1 },
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
  { id: 6, title: "Transport Bastos", description: "Livraison bureaux et hotels", amount: "42000", category: "Transport",
    date: d(6), notes: "", createdAt: d(6), organisationId: 1, siteId: 2 },
  { id: 7, title: "Eau & electricite", description: "Charges site Yaounde", amount: "98000", category: "Utilities",
    date: d(11), notes: "", createdAt: d(11), organisationId: 1, siteId: 2 },
  { id: 8, title: "Salaires equipe Yaounde", description: "Paiement salaires quinzaine", amount: "280000", category: "Payroll",
    date: d(4), notes: "", createdAt: d(4), organisationId: 1, siteId: 2 },
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
  { id: 3, name: "Washer Bastos", type: "washer", brand: "Whirlpool", model: "FWG91284W",
    status: "active", capacity: "14kg", capacityKg: 14, purchaseDate: d(260), lastServiceDate: d(18),
    utilizationRate: 71, cycleCount: 810, totalKgProcessed: 11840,
    notes: "Dedicated to hotel linens", organisationId: 1, siteId: 2, createdAt: d(260), updatedAt: d(18) },
  { id: 4, name: "Press Station YDE", type: "ironer", brand: "Miele", model: "PM1210",
    status: "maintenance", capacity: "10kg", capacityKg: 10, purchaseDate: d(220), lastServiceDate: d(2),
    utilizationRate: 52, cycleCount: 430, totalKgProcessed: 6240,
    notes: "Awaiting steam valve inspection", organisationId: 1, siteId: 2, createdAt: d(220), updatedAt: d(2) },
];

export const DEMO_EMPLOYEES = [
  { id: 1, name: "Kwame Boateng", role: "operator", phone: "+237 655 020 101",
    email: "kwame@xpresspro.cm", status: "active", hireDate: d(180),
    salary: "150000", notes: "", kgProcessed: 2140, ordersHandled: 98,
    organisationId: 1, siteId: 1, createdAt: d(180) },
  { id: 2, name: "Esi Asante", role: "manager", phone: "+237 677 020 202",
    email: "esi@xpresspro.cm", status: "active", hireDate: d(365),
    salary: "250000", notes: "Responsable equipe nuit", kgProcessed: 3860, ordersHandled: 175,
    organisationId: 1, siteId: 1, createdAt: d(365) },
  { id: 3, name: "Mireille Fotsing", role: "manager", phone: "+237 699 020 303",
    email: "mireille@xpresspro.cm", status: "active", hireDate: d(140),
    salary: "230000", notes: "Manages Yaounde business accounts", kgProcessed: 2880, ordersHandled: 122,
    organisationId: 1, siteId: 2, createdAt: d(140) },
  { id: 4, name: "Jean Paul Nkoa", role: "operator", phone: "+237 677 020 404",
    email: "jeanpaul@xpresspro.cm", status: "active", hireDate: d(95),
    salary: "135000", notes: "Pressing specialist", kgProcessed: 1740, ordersHandled: 84,
    organisationId: 1, siteId: 2, createdAt: d(95) },
];

const siteFromId = (siteId?: number | null) =>
  DEMO_USER.allSites.find((site) => site.id === siteId) ?? null;

const makeDemoUser = (siteId?: number | null) => {
  const currentSite = siteFromId(siteId);
  return {
    ...DEMO_USER,
    currentSiteId: currentSite?.id ?? null,
    currentSite,
  };
};

const filterBySite = <T extends { siteId?: number }>(items: T[], siteId?: number | null): T[] =>
  siteId ? items.filter((item) => item.siteId === siteId) : items;

const ordersForSite = (siteId?: number | null) => filterBySite(DEMO_ORDERS, siteId);
const expensesForSite = (siteId?: number | null) => filterBySite(DEMO_EXPENDITURES, siteId);
const customersForSite = (siteId?: number | null) => filterBySite(DEMO_CUSTOMERS, siteId);
const servicesForSite = (siteId?: number | null) => filterBySite(DEMO_SERVICES, siteId);
const machinesForSite = (siteId?: number | null) => filterBySite(DEMO_MACHINES, siteId);
const employeesForSite = (siteId?: number | null) => filterBySite(DEMO_EMPLOYEES, siteId);
const paymentsForSite = (siteId?: number | null) => {
  const orderIds = new Set(ordersForSite(siteId).map((order) => order.id));
  return siteId ? DEMO_PAYMENTS.filter((payment) => orderIds.has(payment.orderId)) : DEMO_PAYMENTS;
};

const moneySum = (items: { amount?: string; totalAmount?: string }[]) =>
  items.reduce((total, item) => total + Number(item.totalAmount ?? item.amount ?? 0), 0);

const statusCounts = (orders: typeof DEMO_ORDERS) =>
  orders.reduce<Record<string, number>>((counts, order) => {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
    return counts;
  }, { received: 0, washing: 0, ready: 0, delivered: 0 });

const makeStats = (siteId?: number | null) => {
  const orders = ordersForSite(siteId);
  return {
    totalOrders: orders.length,
    totalRevenue: moneySum(orders),
    pendingOrders: orders.filter((order) => order.status !== "delivered").length,
    activeCustomers: customersForSite(siteId).length,
  };
};

const makeDashboard = (siteId?: number | null) => {
  const orders = ordersForSite(siteId);
  const expenses = expensesForSite(siteId);
  const revenue = moneySum(orders);
  const expensesTotal = moneySum(expenses);
  const weekOrders = orders.filter((order) => new Date(order.createdAt) >= new Date(now.getTime() - 7 * 86400000));
  const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === now.toDateString());

  return {
    siteCount: DEMO_USER.allSites.length,
    todayOrders: todayOrders.length,
    todayRevenue: moneySum(todayOrders),
    weekOrders: weekOrders.length,
    weekRevenue: moneySum(weekOrders),
    monthOrders: orders.length,
    monthRevenue: revenue,
    monthExpenses: expensesTotal,
    ordersByStatus: statusCounts(orders),
    readyForPickup: orders.filter((order) => order.status === "ready"),
    alerts: siteId === 2
      ? [{ type: "warning", message: "Yaounde Bastos press station needs service", detail: "Steam valve inspection pending" }]
      : [],
    sitesOverview: siteId ? [] : DEMO_USER.allSites.map((site) => {
      const siteOrders = ordersForSite(site.id);
      return {
        id: site.id,
        name: site.name,
        city: site.city,
        revenue: moneySum(siteOrders),
        orders: siteOrders.length,
        memberCount: site.memberCount,
        isActive: site.isActive,
      };
    }),
  };
};

// Deterministic daily revenue: sine wave only, no Math.random.
const DAILY_REVENUE_OFFSETS = [0,4,8,10,8,4,0,-4,-6,-4,0,6,10,12,10,6,2,-2,-4,-2,2,8,12,14,12,8,4,0,-2,0];
const DAILY_REVENUE = Array.from({ length: 30 }, (_, i) => ({
  date: d(29 - i).slice(0, 10),
  revenue: (80000 + Math.round(Math.sin(i / 4) * 30000) + DAILY_REVENUE_OFFSETS[i] * 1000),
}));

const makeReports = (siteId?: number | null) => {
  const orders = ordersForSite(siteId).filter((order) => order.status !== "cancelled");
  const expenses = expensesForSite(siteId);
  const revenue = moneySum(orders);
  const expenseTotal = moneySum(expenses);
  const services = servicesForSite(siteId);

  return {
    totalRevenue: revenue,
    totalExpenses: expenseTotal,
    netProfit: revenue - expenseTotal,
    totalOrders: orders.length,
    dailyRevenue: DAILY_REVENUE.map((day, index) => ({
      ...day,
      revenue: Math.round(day.revenue * (siteId === 1 ? 0.58 : siteId === 2 ? 0.42 : 1)),
    })),
    serviceDistribution: services.map((service) => ({
      name: service.name,
      count: orders.filter((order) => order.items.some((item) => item.serviceId === service.id)).length,
    })),
    topCustomers: customersForSite(siteId).map((customer) => {
      const customerOrders = orders.filter((order) => order.customerId === customer.id);
      return {
        name: customer.name,
        orderCount: customerOrders.length,
        totalSpent: moneySum(customerOrders),
      };
    }).filter((customer) => customer.orderCount > 0),
  };
};

const makePerformance = (siteId?: number | null) => {
  const reports = makeReports(siteId);
  const revenue = reports.totalRevenue;
  const expenses = reports.totalExpenses;
  return {
    currentMonthRevenue: revenue,
    currentMonthExpenses: expenses,
    currentMonthProfit: revenue - expenses,
    last30Revenue: revenue,
    prev30Revenue: Math.round(revenue * 0.86),
    last30Expenses: expenses,
    prev30Expenses: Math.round(expenses * 0.91),
    last30Profit: revenue - expenses,
    prev30Profit: Math.round((revenue - expenses) * 0.81),
    monthlyComparison: [
      { month: "Fev", income: Math.round(revenue * 0.74), expenses: Math.round(expenses * 0.78) },
      { month: "Mar", income: Math.round(revenue * 0.83), expenses: Math.round(expenses * 0.84) },
      { month: "Avr", income: Math.round(revenue * 0.86), expenses: Math.round(expenses * 0.91) },
      { month: "Mai", income: revenue, expenses },
    ],
  };
};

const makeKpis = (siteId?: number | null) => {
  const reports = makeReports(siteId);
  return {
    revenue: reports.totalRevenue,
    orders: reports.totalOrders,
    avgOrderValue: reports.totalOrders ? Math.round(reports.totalRevenue / reports.totalOrders) : 0,
    repeatCustomers: reports.topCustomers.filter((customer) => customer.orderCount > 1).length,
    topService: reports.serviceDistribution.sort((a, b) => b.count - a.count)[0]?.name ?? "Lavage & Pliage",
    revenueGrowth: siteId === 2 ? 12.4 : 17.8,
  };
};

export const DEMO_SETTINGS = {
  businessName: "XpressPro Cameroon",
  address: "Rue Joss, Akwa, Douala",
  phone: "+237 655 012 345",
  email: "owner@xpresspro.cm",
  currency: "FCFA",
  timezone: "Africa/Douala",
};

export const DEMO_SITES = DEMO_USER.allSites;

// Given a fetch URL, return demo fixture data or undefined if no match.
export function getDemoFixture(url: string, selectedSiteId: number | null = null): unknown {
  const path = url.split("?")[0];

  // Auth
  if (path === "/api/auth/user") return makeDemoUser(selectedSiteId);

  // Stats
  if (path === "/api/stats") return makeStats(selectedSiteId);

  // Orders list or single order
  if (path === "/api/orders") return ordersForSite(selectedSiteId);
  const orderMatch = path.match(/^\/api\/orders\/(\d+)$/);
  if (orderMatch) {
    const found = DEMO_ORDERS.find((o) => o.id === Number(orderMatch[1]));
    return found ?? DEMO_ORDERS[0];
  }
  const orderPaymentsMatch = path.match(/^\/api\/orders\/(\d+)\/payments$/);
  if (orderPaymentsMatch) {
    const oid = Number(orderPaymentsMatch[1]);
    return paymentsForSite(selectedSiteId).filter((p) => p.orderId === oid);
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
  if (path === "/api/customers") return customersForSite(selectedSiteId);
  const customerMatch = path.match(/^\/api\/customers\/(\d+)$/);
  if (customerMatch) {
    const found = DEMO_CUSTOMERS.find((c) => c.id === Number(customerMatch[1]));
    return found ?? DEMO_CUSTOMERS[0];
  }
  const customerOrdersMatch = path.match(/^\/api\/customers\/(\d+)\/orders$/);
  if (customerOrdersMatch) {
    const cid = Number(customerOrdersMatch[1]);
    return ordersForSite(selectedSiteId).filter((o) => o.customerId === cid && o.status !== "cancelled");
  }

  // Services
  if (path === "/api/services") return servicesForSite(selectedSiteId);

  // Expenditures
  if (path === "/api/expenditures") return expensesForSite(selectedSiteId);

  // Payments list (some pages may call this)
  if (path === "/api/payments") return paymentsForSite(selectedSiteId);

  // Analytics
  if (path === "/api/analytics/dashboard") return makeDashboard(selectedSiteId);
  if (path.startsWith("/api/analytics/kpis")) return makeKpis(selectedSiteId);
  if (path === "/api/analytics/waste") return [];
  if (path === "/api/analytics/production-delays") return [];
  if (path === "/api/analytics/performance-score") return { score: 82, label: "Good" };

  // Reports
  if (path === "/api/reports") return makeReports(selectedSiteId);
  if (path === "/api/reports/performance") return makePerformance(selectedSiteId);

  // Machines
  if (path === "/api/machines") return machinesForSite(selectedSiteId);

  // Employees
  if (path === "/api/employees") return employeesForSite(selectedSiteId);

  // Settings
  if (path === "/api/settings") return DEMO_SETTINGS;

  // Sites
  if (path === "/api/sites") return DEMO_SITES;
  const siteMembersMatch = path.match(/^\/api\/sites\/(\d+)\/members$/);
  if (siteMembersMatch) {
    const siteId = Number(siteMembersMatch[1]);
    const manager = siteId === 2
      ? { id: 3, userId: "demo-emp-003", siteId, role: "manager", name: "Mireille Fotsing", email: "mireille@xpresspro.cm" }
      : { id: 2, userId: "demo-emp-002", siteId, role: "manager", name: "Esi Asante", email: "esi@xpresspro.cm" };
    return [
      { id: 1, userId: "demo-user-001", siteId, role: "owner",
        name: "Alex Osei", email: "owner@xpresspro.cm" },
      manager,
    ];
  }

  // Invitations
  if (path === "/api/invitations/pending") return [];

  return undefined;
}
