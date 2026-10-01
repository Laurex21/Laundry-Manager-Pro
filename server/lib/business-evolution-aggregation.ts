import { formatReportingDay, reportingWeekStart } from "./reporting-date";

export type EvolutionGranularity = "day" | "week" | "month";
export type EvolutionRow = {
  period: string;
  customersServed: number;
  newCustomers: number;
  revenue: number;
  expenses: number;
  profit: number;
};

export function evolutionPeriod(day: string, granularity: EvolutionGranularity): string {
  if (granularity === "week") return reportingWeekStart(day);
  if (granularity === "month") return `${day.slice(0, 7)}-01`;
  return day;
}

export function aggregateBusinessEvolution(input: {
  startDay: string;
  endDay: string;
  granularity: EvolutionGranularity;
  timeZone: string;
  orderRows: { customerId: number; entryDate: Date | null }[];
  firstOrders: { customerId: number; firstDate: Date | null }[];
  paymentRows: { date: Date | null; amount: string }[];
  expenseRows: { date: Date | null; amount: string }[];
}): EvolutionRow[] {
  const rows = new Map<string, EvolutionRow>();
  const served = new Map<string, Set<number>>();
  const first = new Map<number, string>();
  const bucket = (date: Date | null): string | null => {
    if (!date) return null;
    const day = formatReportingDay(date, input.timeZone);
    return day >= input.startDay && day <= input.endDay ? evolutionPeriod(day, input.granularity) : null;
  };
  const row = (period: string) => {
    let value = rows.get(period);
    if (!value) {
      value = { period, customersServed: 0, newCustomers: 0, revenue: 0, expenses: 0, profit: 0 };
      rows.set(period, value);
    }
    return value;
  };
  for (const item of input.firstOrders) {
    if (item.firstDate) first.set(item.customerId, formatReportingDay(item.firstDate, input.timeZone));
  }
  for (const item of input.orderRows) {
    const period = bucket(item.entryDate);
    if (!period) continue;
    row(period);
    let customers = served.get(period);
    if (!customers) { customers = new Set(); served.set(period, customers); }
    customers.add(item.customerId);
  }
  for (const [period, customers] of served) {
    const current = row(period);
    current.customersServed = customers.size;
    current.newCustomers = [...customers].filter(customerId => {
      const firstDay = first.get(customerId);
      return firstDay && evolutionPeriod(firstDay, input.granularity) === period && firstDay >= input.startDay;
    }).length;
  }
  for (const item of input.paymentRows) {
    const period = bucket(item.date);
    if (period) row(period).revenue += Number(item.amount);
  }
  for (const item of input.expenseRows) {
    const period = bucket(item.date);
    if (period) row(period).expenses += Number(item.amount);
  }
  // Include zero-activity periods so an empty week/month remains visible.
  const cursor = new Date(`${input.startDay}T12:00:00Z`);
  const end = new Date(`${input.endDay}T12:00:00Z`);
  while (cursor <= end) {
    row(evolutionPeriod(cursor.toISOString().slice(0, 10), input.granularity));
    if (input.granularity === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    else cursor.setUTCDate(cursor.getUTCDate() + (input.granularity === "week" ? 7 : 1));
  }
  return [...rows.values()].sort((a, b) => a.period.localeCompare(b.period)).map(value => ({
    ...value, profit: value.revenue - value.expenses,
  }));
}

