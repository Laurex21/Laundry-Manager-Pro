type OrderReportingDateSource = {
  entryDate?: Date | string | null;
  orderDate?: Date | string | null;
  createdAt?: Date | string | null;
};

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validReportingTimeZone(value: unknown): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

function zonedDateTimeToUtc(date: string, timeZone: string, endOfDay: boolean): Date {
  const match = ISO_DATE_ONLY.exec(date);
  if (!match) return new Date(Number.NaN);
  const parts = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: endOfDay ? 23 : 0, minute: endOfDay ? 59 : 0,
    second: endOfDay ? 59 : 0, millisecond: endOfDay ? 999 : 0,
  };
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  let instant = desired;
  for (let attempt = 0; attempt < 2; attempt++) {
    const formatted = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const represented = Date.UTC(
      Number(formatted.year), Number(formatted.month) - 1, Number(formatted.day),
      Number(formatted.hour), Number(formatted.minute), Number(formatted.second), parts.millisecond,
    );
    instant += desired - represented;
  }
  return new Date(instant);
}

export function reportingDateRange(start: string, end: string, requestedTimeZone: unknown): { start: Date; end: Date } {
  const timeZone = validReportingTimeZone(requestedTimeZone);
  return {
    start: zonedDateTimeToUtc(start, timeZone, false),
    end: zonedDateTimeToUtc(end, timeZone, true),
  };
}

export function reportingDateString(date: Date, requestedTimeZone: unknown): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: validReportingTimeZone(requestedTimeZone),
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function shiftReportingDate(date: string, days: number): string {
  const match = ISO_DATE_ONLY.exec(date);
  if (!match) return date;
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return shifted.toISOString().slice(0, 10);
}

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

export function formatReportingDay(date: Date | string | null | undefined, timeZone: unknown = "UTC"): string {
  if (!date) return "unknown";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "unknown";

  return reportingDateString(parsed, timeZone);
}
