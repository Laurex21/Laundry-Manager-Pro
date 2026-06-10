type OrderReportingDateSource = {
  entryDate?: Date | string | null;
  orderDate?: Date | string | null;
  createdAt?: Date | string | null;
};

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDateParam(value: string | undefined, fallback: Date, endOfDay = false): Date {
  const match = value ? ISO_DATE_ONLY.exec(value) : null;
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : value
      ? new Date(value)
      : new Date(fallback);

  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

export function getOrderReportingDate(order: OrderReportingDateSource): Date | null {
  const source = order.orderDate ?? order.entryDate ?? null;
  if (!source) return null;
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isWithinReportingRange(order: OrderReportingDateSource, start: Date, end: Date): boolean {
  const reportingDate = getOrderReportingDate(order);
  return !!reportingDate && reportingDate >= start && reportingDate <= end;
}

export function formatReportingDay(date: Date | string | null | undefined): string {
  if (!date) return "unknown";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "unknown";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
