type CustomerInput = { id: number; name: string; address?: string | null };
type OrderInput = { id: number; customerId: number; totalAmount: string | number };
type PaymentInput = { orderId: number; customerId: number; amount: string | number };

export type CustomerReportRow = {
  name: string;
  orderCount: number;
  orderValue: number;
  amountCollected: number;
  outstandingBalance: number;
};

export type CustomerAreaReportRow = Omit<CustomerReportRow, "name"> & {
  area: string;
  customerCount: number;
};

export function aggregateCustomerReportMetrics(input: {
  customers: CustomerInput[];
  periodOrders: OrderInput[];
  paymentsReceivedInPeriod: PaymentInput[];
  paymentsAppliedToPeriodOrders: PaymentInput[];
}): { topCustomers: CustomerReportRow[]; customerAreas: CustomerAreaReportRow[] } {
  const customerById = new Map(input.customers.map((customer) => [customer.id, customer]));
  const orderIds = new Set(input.periodOrders.map((order) => order.id));
  const metrics = new Map<number, {
    orderCount: number;
    orderValue: number;
    amountCollected: number;
    paymentsApplied: number;
  }>();

  const getMetrics = (customerId: number) => {
    const existing = metrics.get(customerId) ?? {
      orderCount: 0,
      orderValue: 0,
      amountCollected: 0,
      paymentsApplied: 0,
    };
    metrics.set(customerId, existing);
    return existing;
  };

  for (const order of input.periodOrders) {
    const row = getMetrics(order.customerId);
    row.orderCount += 1;
    row.orderValue += Number(order.totalAmount);
  }

  for (const payment of input.paymentsReceivedInPeriod) {
    getMetrics(payment.customerId).amountCollected += Number(payment.amount);
  }

  for (const payment of input.paymentsAppliedToPeriodOrders) {
    if (orderIds.has(payment.orderId)) {
      getMetrics(payment.customerId).paymentsApplied += Number(payment.amount);
    }
  }

  const customerRows = Array.from(metrics.entries()).map(([customerId, row]) => ({
    customerId,
    name: customerById.get(customerId)?.name || "Unknown",
    orderCount: row.orderCount,
    orderValue: row.orderValue,
    amountCollected: row.amountCollected,
    outstandingBalance: Math.max(0, row.orderValue - row.paymentsApplied),
  }));

  const topCustomers = customerRows
    .filter((row) => row.orderCount > 0 || row.amountCollected > 0)
    .sort((a, b) => b.orderValue - a.orderValue || b.amountCollected - a.amountCollected)
    .slice(0, 10)
    .map(({ customerId: _customerId, ...row }) => row);

  const areaMap = new Map<string, CustomerAreaReportRow & { customerIds: Set<number> }>();
  for (const row of customerRows) {
    if (row.orderCount === 0 && row.amountCollected === 0) continue;
    const area = (customerById.get(row.customerId)?.address || "").trim() || "Unknown area";
    const key = area.toLowerCase();
    const current = areaMap.get(key) ?? {
      area,
      customerIds: new Set<number>(),
      customerCount: 0,
      orderCount: 0,
      orderValue: 0,
      amountCollected: 0,
      outstandingBalance: 0,
    };
    current.customerIds.add(row.customerId);
    current.customerCount = current.customerIds.size;
    current.orderCount += row.orderCount;
    current.orderValue += row.orderValue;
    current.amountCollected += row.amountCollected;
    current.outstandingBalance += row.outstandingBalance;
    areaMap.set(key, current);
  }

  const customerAreas = Array.from(areaMap.values())
    .map(({ customerIds: _customerIds, ...row }) => row)
    .sort((a, b) => b.orderCount - a.orderCount || b.orderValue - a.orderValue);

  return { topCustomers, customerAreas };
}
