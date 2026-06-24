const DAY_MS = 24 * 60 * 60 * 1000;

export type CustomerCacheInput = {
  totalRevenue: number;
  visitsPerMonth: number;
  avgDepositHour: number | null;
  visitCount: number;
  avgDaysBetweenVisits: number | null;
  daysSinceLastVisit: number | null;
  totalOrders: number;
};

export function calculateChurnRiskScore(visitCount: number, daysSinceLastVisit: number | null, avgDaysBetweenVisits: number | null): number | null {
  if (visitCount < 3 || !daysSinceLastVisit || !avgDaysBetweenVisits || avgDaysBetweenVisits <= 0) return null;
  const ratio = daysSinceLastVisit / avgDaysBetweenVisits;
  if (ratio >= 3) return 100;
  if (ratio >= 2.5) return 85;
  if (ratio >= 2) return 70;
  if (ratio >= 1.8) return 55;
  if (ratio >= 1.5) return 35;
  if (ratio >= 1.2) return 15;
  return 0;
}

export function calculateCustomerSegment(input: CustomerCacheInput): string {
  const avgDays = input.avgDaysBetweenVisits ?? 0;
  const daysSince = input.daysSinceLastVisit ?? 0;

  if (input.totalOrders <= 2) return "new";
  if (input.totalRevenue > 50000 && input.visitsPerMonth >= 2) return "vip";
  if (input.visitCount >= 5 && input.avgDepositHour != null && input.avgDepositHour < 9) return "early_morning";
  if (input.visitCount >= 5 && input.avgDepositHour != null && input.avgDepositHour >= 17) return "evening";
  if (avgDays > 0 && daysSince > avgDays * 3 && input.totalOrders >= 3) return "lost";
  if (avgDays > 0 && daysSince > avgDays * 1.8 && input.totalOrders >= 3) return "at_risk";
  if (avgDays >= 5 && avgDays <= 10) return "weekly";
  if (avgDays >= 20 && avgDays <= 40) return "monthly";
  return "regular";
}

export function calculateRegularityLabel(visitDates: Date[]): "Predictable" | "Fairly Regular" | "Irregular" {
  if (visitDates.length < 3) return "Irregular";
  const sorted = [...visitDates].sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push((sorted[i].getTime() - sorted[i - 1].getTime()) / DAY_MS);
  }
  if (!intervals.length) return "Irregular";
  const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const variance = intervals.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  if (visitDates.length >= 5 && stdDev < 3) return "Predictable";
  if (visitDates.length >= 3 && stdDev >= 3 && stdDev <= 7) return "Fairly Regular";
  return "Irregular";
}
