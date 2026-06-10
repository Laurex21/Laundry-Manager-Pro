import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
      <PerformanceScoreSection />
      <ProductionDelaysSection />
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
                <p className="font-medium text-sm">{t("order_number", { id: order.id })} — {order.customer?.name || t("unknown")}</p>
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
