import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, Sparkles, Users, Cog, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orderDisplayId } from "@/lib/order-display";
import { formatBusinessDateTime } from "@/lib/date-time";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Analytics() {
  const { t } = useTranslation();
  const { hasFeature } = useAuth();

  if (!hasFeature("analytics")) {
    return <UpgradePrompt title={t("analytics_kpis")} description="Get detailed insights into your laundry's financial performance." requiredPlan="Pro" />;
  }

  return <AnalyticsContent />;
}

function AnalyticsContent() {
  const { t } = useTranslation();
  const { hasFeature } = useAuth();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const [period, setPeriod] = useState("month");

  const { data: kpis, isLoading } = useQuery<any>({ queryKey: ["/api/analytics/kpis", period], queryFn: () => fetch(`/api/analytics/kpis?period=${period}`, { credentials: "include" }).then(r => r.json()) });

  const periods = [
    { key: "day", label: t("period_day") },
    { key: "week", label: t("period_week") },
    { key: "month", label: t("period_month") },
    { key: "year", label: t("period_year") },
  ];

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="text-analytics-title">{t("analytics_kpis")}</h1>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {periods.map(p => (
            <Button key={p.key} variant={period === p.key ? "default" : "ghost"} size="sm" onClick={() => setPeriod(p.key)}
              className={period === p.key ? "bg-primary text-white" : ""} data-testid={`button-period-${p.key}`}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("total_kg_label")} value={kpis?.totalKg || 0} />
        <KpiCard label={t("total_orders")} value={kpis?.totalOrders || 0} />
        <KpiCard label={t("avg_kg_order")} value={(kpis?.avgWeightPerOrder || 0).toFixed(1)} />
        <KpiCard label={t("total_revenue")} value={`${symbol}${(kpis?.totalRevenue || 0).toFixed(0)}`} />
        <KpiCard label={t("total_expenses_label")} value={`${symbol}${(kpis?.totalExpenses || 0).toFixed(0)}`} />
        <KpiCard label={t("net_profit")} value={`${symbol}${(kpis?.profit || 0).toFixed(0)}`} color={kpis?.profit >= 0 ? "text-green-600" : "text-red-600"} />
        <KpiCard label={t("cost_per_kg")} value={`${symbol}${(kpis?.costPerKg || 0).toFixed(2)}`} />
        <KpiCard label={t("profit_per_kg")} value={`${symbol}${(kpis?.profitPerKg || 0).toFixed(2)}`} color={kpis?.profitPerKg >= 0 ? "text-green-600" : "text-red-600"} />
      </div>

      <Card className="shadow-sm" data-testid="card-break-even">
        <CardHeader><CardTitle>{t("break_even")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{t("break_even_point")}: {(kpis?.breakEvenKg || 0).toFixed(0)} kg</div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${kpis?.totalKg >= kpis?.breakEvenKg ? "bg-green-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(100, kpis?.breakEvenKg > 0 ? (kpis?.totalKg / kpis?.breakEvenKg) * 100 : 0)}%` }} />
            </div>
            <div className="text-sm">
              {kpis?.totalKg >= kpis?.breakEvenKg
                ? <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {t("above_break_even")}</span>
                : <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {t("need_more_kg", { count: Math.round((kpis?.breakEvenKg || 0) - (kpis?.totalKg || 0)) })}</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm" data-testid="card-operational-kpis">
        <CardHeader><CardTitle>{t("operational_kpis")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span>{t("machine_utilization")}</span><span>{(kpis?.machineUtilization || 0).toFixed(0)}%</span></div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, kpis?.machineUtilization || 0)}%` }} />
            </div>
          </div>
          <div className="text-sm"><span className="text-muted-foreground">{t("employee_productivity")}:</span> {(kpis?.employeeProductivity || 0).toFixed(1)} {t("kg_per_person")}</div>
        </CardContent>
      </Card>

      <WasteSection />
      <CustomerBehaviorSection period={period} />
      <PerformanceScoreSection />
      <ProductionDelaysSection />
      <AdvancedAnalyticsSection period={period} />
    </div>
  );
}

function bucketOpacity(intensity: string): string {
  if (intensity === "full") return "1";
  if (intensity === "medium") return "0.6";
  if (intensity === "low") return "0.3";
  return "0.14";
}

function riskLabel(score: number | null | undefined): string {
  const value = Number(score ?? 0);
  if (value <= 15) return "Healthy";
  if (value <= 35) return "Monitor";
  if (value <= 55) return "Attention";
  if (value <= 85) return "High Risk";
  return "Critical";
}

function CustomerBehaviorSection({ period }: { period: string }) {
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/analytics/customer-behavior", period],
    queryFn: () => fetch(`/api/analytics/customer-behavior?period=${period}`, { credentials: "include" }).then((res) => res.json()),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (!data) return null;

  const depositData = (data.depositActivityByHour || []).map((row: any) => ({ ...row, label: `${row.hour}h` }));
  const pickupData = (data.pickupActivityByHour || []).map((row: any) => ({ ...row, label: `${row.hour}h` }));
  const dayData = data.activityByDayOfWeek || [];
  const churn = data.churn || {};
  const metrics = data.metrics || {};

  return (
    <div className="space-y-4" data-testid="section-customer-behavior">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Peak Deposit Hours</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={depositData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {depositData.map((entry: any) => <Cell key={entry.hour} fill="#2563eb" fillOpacity={Number(bucketOpacity(entry.intensity))} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Peak Pickup Hours</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pickupData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {pickupData.map((entry: any) => <Cell key={entry.hour} fill="#16a34a" fillOpacity={Number(bucketOpacity(entry.intensity))} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Activity by Day</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dayData.map((entry: any) => <Cell key={entry.day} fill="#7c3aed" fillOpacity={Number(bucketOpacity(entry.intensity))} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Churn Risk
              <Badge variant={Number(churn.atRiskCount || 0) > 0 ? "destructive" : "secondary"}>{churn.atRiskCount || 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">At-risk customers</p>
                <p className="text-2xl font-bold">{churn.atRiskCount || 0}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Revenue at risk</p>
                <p className="text-2xl font-bold">{symbol}{Number(churn.revenueAtRisk || 0).toFixed(0)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {(churn.customers || []).slice(0, 6).map((customer: any) => (
                <div key={customer.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Last visit: {formatBusinessDateTime(customer.lastVisitAt)} · Cycle: {customer.avgDaysBetweenVisits ? `${Math.round(customer.avgDaysBetweenVisits)} days` : "-"}
                    </p>
                  </div>
                  <Badge variant={Number(customer.churnRiskScore || 0) >= 86 ? "destructive" : "secondary"}>{riskLabel(customer.churnRiskScore)}</Badge>
                </div>
              ))}
              {!(churn.customers || []).length && <p className="text-sm text-muted-foreground">No churn risk detected.</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Customer Behavior</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MetricLine label="Average return frequency" value={`${Number(metrics.averageReturnFrequency || 0).toFixed(1)} days`} />
            <MetricLine label="Deposit-to-pickup delay" value={`${Number(metrics.depositToPickupDelayDays || 0).toFixed(1)} days`} />
            <MetricLine label="Average storage time" value={`${Number(metrics.averageStorageTimeDays || 0).toFixed(1)} days`} />
            <MetricLine label="Time-to-payment" value={`${Number(metrics.timeToPaymentHours || 0).toFixed(1)}h`} />
            <div className="pt-2 space-y-2">
              {(data.insights || []).map((insight: string) => (
                <div key={insight} className="rounded-md bg-muted/50 px-3 py-2">{insight}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold font-display ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function WasteSection() {
  const { t } = useTranslation();
  const { hasFeature } = useAuth();

  if (!hasFeature("waste")) {
    return (
      <Card className="shadow-sm" data-testid="card-waste-locked">
        <CardHeader><CardTitle>{t("waste_detection")}</CardTitle></CardHeader>
        <CardContent className="text-center py-6">
          <p className="text-muted-foreground mb-4">{t("business_plan_required")}</p>
          <Link href="/subscriptions"><Button variant="outline" data-testid="button-upgrade-waste">{t("upgrade")}</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return <WasteAlerts />;
}

function getAlertMessage(alert: any, t: (key: string, opts?: any) => string): string {
  if (alert.type === "costs_high") return t("alert_costs_high");
  if (alert.type === "category_pct") {
    const cat = (alert.category || "").toLowerCase();
    if (cat === "water") return t("alert_water_pct", { pct: alert.pct });
    if (cat === "electricity") return t("alert_electricity_pct", { pct: alert.pct });
    return `${alert.category} — ${alert.pct}%`;
  }
  return alert.message || "";
}

function getAlertRecommendation(alert: any, t: (key: string) => string): string {
  if (alert.type === "costs_high") return t("alert_costs_high_detail");
  if (alert.type === "category_pct") {
    const cat = (alert.category || "").toLowerCase();
    if (cat === "water") return t("alert_reduce_water");
    if (cat === "electricity") return t("alert_reduce_electricity");
  }
  return alert.recommendation || "";
}

function WasteAlerts() {
  const { t } = useTranslation();
  const { data: alerts } = useQuery<any[]>({ queryKey: ["/api/analytics/waste"] });

  return (
    <Card className="shadow-sm" data-testid="card-waste-detection">
      <CardHeader><CardTitle>{t("waste_detection")}</CardTitle></CardHeader>
      <CardContent>
        {!alerts || alerts.length === 0 ? (
          <div className="text-center py-4 text-green-600 flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" /> {t("no_waste_detected")}
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div key={i} className={`p-4 rounded-lg border ${alert.severity === "high" ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900" : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={alert.severity === "high" ? "destructive" : "secondary"}>{alert.severity}</Badge>
                  <span className="font-medium">{getAlertMessage(alert, t)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{getAlertRecommendation(alert, t)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PerformanceScoreSection() {
  const { t } = useTranslation();
  const { hasFeature } = useAuth();

  if (!hasFeature("performance")) {
    return (
      <Card className="shadow-sm" data-testid="card-performance-locked">
        <CardHeader><CardTitle>{t("performance_score")}</CardTitle></CardHeader>
        <CardContent className="text-center py-6">
          <p className="text-muted-foreground mb-4">{t("business_plan_required")}</p>
          <Link href="/subscriptions"><Button variant="outline" data-testid="button-upgrade-performance">{t("upgrade")}</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return <PerformanceScore />;
}

function AdvancedAnalyticsSection({ period }: { period: string }) {
  const { t } = useTranslation();
  const { hasFeature } = useAuth();

  if (!hasFeature("advancedAnalytics")) {
    return (
      <Card className="shadow-sm" data-testid="card-advanced-analytics-locked">
        <CardHeader><CardTitle>{t("advanced_analytics", "Advanced Analytics")}</CardTitle></CardHeader>
        <CardContent className="text-center py-6">
          <p className="text-muted-foreground mb-4">{t("business_plan_required")}</p>
          <Link href="/subscriptions"><Button variant="outline">{t("upgrade")}</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return <AdvancedAnalytics period={period} />;
}

function AdvancedAnalytics({ period }: { period: string }) {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/analytics/advanced", period],
    queryFn: () => fetch(`/api/analytics/advanced?period=${period}`, { credentials: "include" }).then(r => {
      if (!r.ok) throw new Error("Failed to load advanced analytics");
      return r.json();
    }),
  });

  if (isLoading) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  const summary = data?.summary || {};
  const employee = data?.employeeInsights || {};
  const machine = data?.machineInsights || {};
  const operations = data?.operationalInsights || {};
  const formatRecommendation = (recommendation: any) => formatAdvancedRecommendation(recommendation, t);
  const formatAlert = (alert: any) => formatAdvancedAlert(alert, t);

  return (
    <div className="space-y-6" data-testid="section-advanced-analytics">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {t("advanced_analytics", "Advanced Analytics")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label={t("total_orders_handled", "Orders Handled")} value={summary.totalOrdersHandled || 0} />
            <KpiCard label={t("payments_collected", "Payments Collected")} value={`${symbol}${Number(summary.totalPaymentsCollected || 0).toFixed(0)}`} />
            <KpiCard label={t("weight_processed", "Weight Processed")} value={`${Number(summary.totalWeightProcessed || 0).toFixed(1)} kg`} />
            <KpiCard label={t("revenue_per_employee", "Revenue / Employee")} value={`${symbol}${Number(summary.revenuePerEmployee || 0).toFixed(0)}`} />
          </div>

          <Tabs defaultValue="employees" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
              <TabsTrigger value="employees" className="min-h-11">{t("employees")}</TabsTrigger>
              <TabsTrigger value="machines" className="min-h-11">{t("machines")}</TabsTrigger>
              <TabsTrigger value="operations" className="min-h-11">{t("operations", "Operations")}</TabsTrigger>
              <TabsTrigger value="financial" className="min-h-11">{t("financial_intelligence", "Financial Intelligence")}</TabsTrigger>
            </TabsList>
            <TabsContent value="employees" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <InsightPanel icon={<Users className="w-4 h-4" />} title={t("employee_insights", "Employee Insights")} items={[
                  [t("most_productive_employee", "Most Productive"), employee.mostProductiveEmployee?.name],
                  [t("highest_revenue_employee", "Highest Revenue"), employee.highestRevenueEmployee?.name],
                  [t("highest_weight_processed", "Highest Weight"), employee.highestWeightProcessed?.name],
                  [t("most_active_employee", "Most Active"), employee.mostActiveEmployee?.name],
                ]} />
                <RankingPanel
                  title={t("productivity_ranking", "Productivity Ranking")}
                  rows={(employee.employees || []).slice(0, 5).map((row: any) => ({
                    label: row.name,
                    value: `${row.totalOrdersHandled || 0} ${t("orders", "orders")}`,
                    meta: `${symbol}${Number(row.totalRevenueHandled || 0).toFixed(0)}`,
                  }))}
                />
              </div>
            </TabsContent>
            <TabsContent value="machines" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <InsightPanel icon={<Cog className="w-4 h-4" />} title={t("machine_insights", "Machine Insights")} items={[
                  [t("most_used_machine", "Most Used"), machine.mostUsedMachine?.name],
                  [t("least_used_machine", "Least Used"), machine.leastUsedMachine?.name],
                  [t("highest_volume_machine", "Highest Volume"), machine.highestVolumeMachine?.name],
                  [t("underutilized_machine", "Underutilized"), machine.underutilizedMachine?.name],
                ]} />
                <RankingPanel
                  title={t("machine_utilization", "Machine Utilization")}
                  rows={(machine.machines || []).slice(0, 5).map((row: any) => ({
                    label: row.name,
                    value: `${row.utilizationScore || 0}%`,
                    meta: `${Number(row.totalWeightProcessed || 0).toFixed(1)} kg`,
                  }))}
                />
              </div>
            </TabsContent>
            <TabsContent value="operations" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <InsightPanel icon={<Target className="w-4 h-4" />} title={t("operational_insights", "Operational Insights")} items={[
                  [t("avg_processing_time", "Average Processing Time"), `${Number(operations.averageOrderProcessingTimeHours || 0).toFixed(1)}h`],
                  [t("delayed_orders", "Delayed Orders"), operations.ordersDeliveredLate || 0],
                  [t("avg_orders_day", "Avg Orders / Day"), Number(summary.averageOrdersPerDay || 0).toFixed(1)],
                  [t("weight_processed", "Weight Processed"), `${Number(summary.totalWeightProcessed || 0).toFixed(1)} kg`],
                ]} />
                <Card className="border-muted">
                  <CardHeader><CardTitle className="text-base">{t("what_should_owner_do", "What should the owner do next?")}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {data?.recommendations?.length ? data.recommendations.slice(0, 4).map((rec: string, i: number) => (
                      <div key={i} className="rounded-md border bg-muted/30 p-3 text-sm">{formatRecommendation(rec)}</div>
                    )) : <p className="text-sm text-muted-foreground">{t("not_enough_data_recommendations", "Not enough activity data yet for recommendations.")}</p>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="financial" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <InsightPanel icon={<TrendingUp className="w-4 h-4" />} title={t("financial_intelligence", "Financial Intelligence")} items={[
                  [t("revenue_forecast", "Revenue Forecast"), `${symbol}${(Number(summary.averageRevenuePerDay || 0) * 30).toFixed(0)}`],
                  [t("revenue_per_employee", "Revenue / Employee"), `${symbol}${Number(summary.revenuePerEmployee || 0).toFixed(0)}`],
                  [t("revenue_per_machine", "Revenue / Machine"), `${symbol}${Number(summary.revenuePerMachine || 0).toFixed(0)}`],
                  [t("payments_collected", "Payments Collected"), `${symbol}${Number(summary.totalPaymentsCollected || 0).toFixed(0)}`],
                ]} />
                <InsightPanel icon={<Target className="w-4 h-4" />} title={t("service_profitability", "Service Profitability")} items={[
                  [t("most_profitable_service", "Most Profitable"), operations.mostProfitableService?.name],
                  [t("least_profitable_service", "Least Profitable"), operations.leastProfitableService?.name],
                  [t("top_service_revenue", "Top Service Revenue"), `${symbol}${Number(operations.mostProfitableService?.revenue || 0).toFixed(0)}`],
                  [t("lowest_service_revenue", "Lowest Service Revenue"), `${symbol}${Number(operations.leastProfitableService?.revenue || 0).toFixed(0)}`],
                ]} />
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-muted">
              <CardHeader><CardTitle className="text-base">{t("alerts", "Alerts")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data?.alerts?.length ? data.alerts.map((alert: any, i: number) => (
                  <div key={i} className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/20">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{formatAlert(alert)}</span>
                  </div>
                )) : <p className="text-sm text-muted-foreground">{t("analytics_no_alerts", "No alerts detected.")}</p>}
              </CardContent>
            </Card>
            <Card className="border-muted">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4" />{t("smart_recommendations", "Smart Recommendations")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data?.recommendations?.length ? data.recommendations.map((rec: string, i: number) => (
                  <div key={i} className="rounded-md border bg-muted/30 p-3 text-sm">{formatRecommendation(rec)}</div>
                )) : <p className="text-sm text-muted-foreground">{t("not_enough_data_recommendations", "Not enough activity data yet for recommendations.")}</p>}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatAdvancedRecommendation(recommendation: any, t: ReturnType<typeof useTranslation>["t"]): string {
  if (typeof recommendation === "string") return recommendation;
  if (!recommendation || typeof recommendation !== "object") return "";

  switch (recommendation.type) {
    case "employee_orders_above_average":
      return t("rec_employee_orders_above_average", {
        employee: recommendation.employeeName,
        percent: recommendation.percent,
      });
    case "machine_underutilized":
      return t("rec_machine_underutilized", { machine: recommendation.machineName });
    case "machine_maintenance_soon":
      return t("rec_machine_maintenance_soon", {
        machine: recommendation.machineName,
        days: recommendation.days,
      });
    case "service_highest_revenue":
      return t("rec_service_highest_revenue", { service: recommendation.serviceName });
    default:
      return recommendation.message || "";
  }
}

function formatAdvancedAlert(alert: any, t: ReturnType<typeof useTranslation>["t"]): string {
  if (!alert || typeof alert !== "object") return "";

  switch (alert.type) {
    case "employee_risk":
      if (alert.message?.includes("order deletions")) return t("alert_employee_deletions", { employee: alert.message.split(" has ")[0] });
      if (alert.message?.includes("order cancellations")) return t("alert_employee_cancellations", { employee: alert.message.split(" has ")[0] });
      if (alert.message?.includes("unusual discounts")) return t("alert_employee_discounts", { employee: alert.message.split(" applied ")[0] });
      if (alert.message?.includes("payment modifications")) return t("alert_employee_payment_modifications", { employee: alert.message.split(" has ")[0] });
      break;
    case "maintenance":
      if (alert.message?.includes("maintenance is overdue")) return t("alert_machine_maintenance_overdue", { machine: alert.message.split(" maintenance ")[0] });
      if (alert.message?.includes("requires maintenance within")) {
        const machine = alert.message.split(" requires ")[0];
        const days = alert.message.match(/within (\d+) days/)?.[1] || "";
        return t("alert_machine_maintenance_soon", { machine, days });
      }
      break;
    case "maintenance_cost":
      return t("alert_machine_high_maintenance_cost", { machine: alert.message?.split(" has ")[0] });
  }

  return alert.message || "";
}

function InsightPanel({ icon, title, items }: { icon: React.ReactNode; title: string; items: [string, any][] }) {
  return (
    <Card className="border-muted">
      <CardHeader><CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right truncate max-w-[160px]">{value || "-"}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RankingPanel({ title, rows }: { title: string; rows: { label: string; value: string; meta?: string }[] }) {
  return (
    <Card className="border-muted">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length ? rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{index + 1}. {row.label}</p>
              {row.meta && <p className="text-xs text-muted-foreground">{row.meta}</p>}
            </div>
            <span className="font-mono font-semibold shrink-0">{row.value}</span>
          </div>
        )) : <p className="text-sm text-muted-foreground">-</p>}
      </CardContent>
    </Card>
  );
}

function ProductionDelaysSection() {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { data: delays } = useQuery<any[]>({ queryKey: ["/api/analytics/production-delays"] });

  if (!delays || delays.length === 0) return null;

  return (
    <Card className="shadow-sm" data-testid="card-production-delays">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t("production_delays")}
          <Badge variant="destructive">{delays.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {delays.map((order: any) => (
            <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900">
              <div>
                <p className="font-medium text-sm">{t("order_number", { id: orderDisplayId(order) })} — {order.customer?.name || t("unknown")}</p>
                <p className="text-xs text-muted-foreground capitalize">{t("status")}: {t("stage_" + order.status, { defaultValue: order.status.replace(/_/g, " ") })}</p>
              </div>
              <div className="text-right">
                <Badge variant="destructive" className="text-xs">{order.daysOverdue}d {t("delays_overdue")}</Badge>
                <p className="text-xs text-muted-foreground mt-1">{symbol}{Number(order.totalAmount).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceScore() {
  const { t } = useTranslation();
  const { data: score } = useQuery<any>({ queryKey: ["/api/analytics/performance-score"] });

  const gradeColors: Record<string, string> = { A: "text-green-600", B: "text-blue-600", C: "text-yellow-600", D: "text-orange-600", F: "text-red-600" };
  const gradeColor = gradeColors[score?.grade] || "text-gray-600";

  return (
    <Card className="shadow-sm" data-testid="card-performance-score">
      <CardHeader><CardTitle>{t("performance_score")}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center gap-8 mb-6">
          <div className="text-center">
            <div className={`text-6xl font-bold ${gradeColor}`}>{score?.grade || "-"}</div>
            <div className="text-sm text-muted-foreground">{score?.total || 0} / 100</div>
          </div>
          <div className="flex-1 space-y-3">
            {[
              { labelKey: "machine_usage", value: score?.machineUsage || 0 },
              { labelKey: "cost_efficiency", value: score?.costEfficiency || 0 },
              { labelKey: "productivity", value: score?.productivity || 0 },
              { labelKey: "waste_level", value: score?.wasteLevel || 0 },
            ].map(item => (
              <div key={item.labelKey} className="space-y-1">
                <div className="flex justify-between text-sm"><span>{t(item.labelKey)}</span><span>{item.value}%</span></div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
