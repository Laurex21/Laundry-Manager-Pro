import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, Sparkles, Users, Cog, Lightbulb, Wallet, ArrowRight, Banknote, Clock3, Gauge, Activity, ShieldCheck, CalendarRange, Building2, SlidersHorizontal, Radar, CircleAlert } from "lucide-react";
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
  const [period, setPeriod] = useState("month");

  const periods = [
    { key: "day", label: t("period_day") },
    { key: "week", label: t("period_week") },
    { key: "month", label: t("period_month") },
    { key: "year", label: t("period_year") },
  ];

  return (
    <div className="space-y-8 page-fade-in">
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

      <ExecutiveDecisionCockpit period={period} />

      <StainTreatmentAnalyticsSection />

      <CustomerCreditAnalyticsSection />
      <WasteSection />
      <CustomerBehaviorSection period={period} />
      <ProductionDelaysSection />
      <AdvancedAnalyticsSection period={period} />
    </div>
  );
}

function StainTreatmentAnalyticsSection() {
  const { t } = useTranslation();
  const { hasCapability, currentSite } = useAuth();
  const [mode, setMode] = useState<"booked" | "collected">("booked");
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const allowed = hasCapability("view_stain_treatment_reports");
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/stain-treatment/report", mode, currentSite?.id, from, to], enabled: allowed,
    queryFn: async () => {
      const params = new URLSearchParams({ mode, from, to, siteId: currentSite?.id ? String(currentSite.id) : "all", page: "1", pageSize: "100" });
      const response = await fetch(`/api/stain-treatment/report?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load stain treatment report");
      return response.json();
    },
  });
  if (!allowed) return null;
  return <Card data-testid="stain-treatment-analytics">
    <CardHeader className="flex-row items-center justify-between gap-3"><CardTitle>{t("stain_treatment_report")}</CardTitle>
      <div className="flex gap-1"><Button size="sm" variant={mode === "booked" ? "default" : "outline"} onClick={() => setMode("booked")}>{t("stain_treatment_booked")}</Button><Button size="sm" variant={mode === "collected" ? "default" : "outline"} onClick={() => setMode("collected")}>{t("stain_treatment_collected")}</Button></div>
    </CardHeader>
    <CardContent>
      {isLoading ? <Skeleton className="h-28" /> : isError ? <p role="alert" className="text-destructive">{t("stain_treatment_report_error")}</p> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">{t("site")}</th><th>{t("level")}</th><th>{t("unit")}</th><th>{t("quantity")}</th><th>{t("stain_treatment_booked")}</th><th>{t("stain_treatment_collected")}</th><th>{t("orders")}</th><th>{t("average")}</th></tr></thead><tbody>
          {(data?.groups || []).map((row: any) => <tr key={`${row.site_id}-${row.level}-${row.unit}-${row.currency}`} className="border-t"><td className="p-2">{row.site_name}</td><td>{t(`stain_treatment_${row.level}`)}</td><td>{t(`stain_treatment_unit_${row.unit}`)}</td><td>{row.quantity}</td><td>{row.currency} {row.bookedRevenue}</td><td>{row.currency} {row.collectedRevenue}</td><td>{row.treatedOrders}</td><td>{row.currency} {row.averageBookedRevenue}</td></tr>)}
        </tbody></table>{(data?.groups || []).some((row: any) => row.acknowledgementExceptions > 0) && <p role="alert" className="mt-3 text-amber-700">{t("stain_treatment_acknowledgement_exceptions")}</p>}</div>}
    </CardContent>
  </Card>;
}

function ExecutiveDecisionCockpit({ period }: { period: string }) {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/analytics/decision-cockpit", period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/decision-cockpit?period=${period}`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load decision cockpit");
      return response.json();
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>;
  if (isError || !data?.metrics) return <Card><CardContent className="p-6 text-destructive" role="alert">{t("decision_cockpit_error")}</CardContent></Card>;

  const m = data.metrics;
  const money = (value: unknown) => `${symbol}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const pct = (value: unknown) => value == null ? t("insufficient_data") : `${Number(value).toFixed(1)}%`;
  const delta = (value: unknown) => value == null ? undefined : Number(value);
  const actions = [
    Number(m.delayedOrders) > 0 ? { severity: "high", text: t("action_delayed_orders", { count: m.delayedOrders }), href: "/orders?status=active" } : null,
    Number(m.outstandingPayments) > 0 ? { severity: "medium", text: t("action_collect_outstanding", { amount: money(m.outstandingPayments) }), href: "/payments" } : null,
    m.machineLoadEfficiency != null && Number(m.machineLoadEfficiency) < 60 ? { severity: "medium", text: t("action_improve_machine_load", { value: Number(m.machineLoadEfficiency).toFixed(0) }), href: "/machines" } : null,
    Number(m.returnedItems) > 0 ? { severity: "medium", text: t("action_review_returns", { count: m.returnedItems }), href: "/orders" } : null,
    Number(m.profit) < 0 ? { severity: "high", text: t("action_costs_exceed_revenue"), href: "/expenses" } : null,
  ].filter(Boolean) as { severity: string; text: string; href: string }[];

  return (
    <div className="space-y-5" data-testid="section-executive-decision-cockpit">
      <section aria-labelledby="decision-summary-title" className="overflow-hidden rounded-xl border bg-slate-950 text-white shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.5fr_1fr] lg:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">{t("decision_cockpit")}</p>
              <Badge className={data.confidence?.level === "high" ? "bg-emerald-500 text-white" : data.confidence?.level === "partial" ? "bg-amber-400 text-slate-950" : "bg-red-500 text-white"}>
                {t("data_confidence")}: {t(`confidence_${data.confidence?.level || "insufficient"}`)} · {data.confidence?.score || 0}%
              </Badge>
            </div>
            <h2 id="decision-summary-title" className="mt-3 text-2xl font-bold font-display sm:text-3xl">{t("decision_summary_title")}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">{t("decision_summary_subtitle")}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("net_operating_result")}</p>
            <p className={`mt-1 text-3xl font-bold ${Number(m.profit) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(m.profit)}</p>
            <p className="mt-1 text-sm text-slate-300">{t("margin")}: {pct(m.marginPct)}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="attention-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="attention-title" className="text-lg font-semibold">{t("decisions_requiring_attention")}</h2>
          <Badge variant={actions.length ? "destructive" : "secondary"}>{actions.length}</Badge>
        </div>
        {actions.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {actions.map((action, index) => (
              <li key={`${action.text}-${index}`}>
                <Button asChild variant="outline" className="h-auto min-h-12 w-full justify-between whitespace-normal p-3 text-left">
                  <Link href={action.href}>
                    <span className="flex items-start gap-2">
                      <AlertTriangle className={`mt-0.5 h-4 w-4 ${action.severity === "high" ? "text-red-600" : "text-amber-600"}`} aria-hidden="true" />
                      {action.text}
                    </span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CheckCircle className="h-4 w-4" aria-hidden="true" /> {t("no_urgent_decisions")}
          </div>
        )}
      </section>

      <section aria-labelledby="management-metrics-title">
        <h2 id="management-metrics-title" className="sr-only">{t("management_metrics")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DecisionMetric icon={<Banknote />} label={t("revenue_collected")} value={money(m.revenue)} delta={delta(m.revenueDeltaPct)} />
          <DecisionMetric icon={<Activity />} label={t("orders_received")} value={Number(m.orders || 0).toLocaleString()} delta={delta(m.orderDeltaPct)} />
          <DecisionMetric icon={<Clock3 />} label={t("orders_at_delay_risk")} value={Number(m.delayedOrders || 0).toLocaleString()} tone={Number(m.delayedOrders) > 0 ? "danger" : "good"} />
          <DecisionMetric icon={<Wallet />} label={t("outstanding_payments")} value={money(m.outstandingPayments)} tone={Number(m.outstandingPayments) > 0 ? "warning" : "good"} />
          <DecisionMetric icon={<ShieldCheck />} label={t("quality_rate")} value={pct(m.qualityRate)} tone={Number(m.qualityRate ?? 100) < 95 ? "warning" : "good"} />
        </div>
      </section>

      <LaundryOperationsFlow stages={data.stages || []} />

      <div className="grid gap-4 lg:grid-cols-3">
        <DecisionModule title={t("profitability")} icon={<Banknote />} items={[
          [t("total_revenue"), money(m.revenue)],
          [t("total_expenses_label"), money(m.expenses)],
          [t("contribution_margin"), pct(m.contributionMarginRatio)],
          [t("break_even_revenue"), m.breakEvenRevenue == null ? t("insufficient_data") : money(m.breakEvenRevenue)],
          [t("discounts"), money(m.discounts)],
        ]} />
        <DecisionModule title={t("capacity_efficiency")} icon={<Gauge />} items={[
          [t("machine_load_efficiency"), pct(m.machineLoadEfficiency)],
          [t("machine_cycles"), Number(m.machineCycles || 0).toLocaleString()],
          [t("processed_weight"), Number(m.machineWeight || 0) > 0 ? `${Number(m.machineWeight).toFixed(1)} kg` : t("insufficient_data")],
          [t("operating_time"), Number(m.machineOperatingMinutes || 0) > 0 ? `${Math.round(Number(m.machineOperatingMinutes) / 60)} h` : t("insufficient_data")],
        ]} />
        <DecisionModule title={t("team_output")} icon={<Users />} items={[
          [t("active_employees"), Number(m.activeEmployees || 0).toLocaleString()],
          [t("completed_orders"), Number(m.deliveredOrders || 0).toLocaleString()],
          [t("paid_hours"), Number(m.paidHours || 0) > 0 ? Number(m.paidHours).toFixed(1) : t("insufficient_data")],
          [t("orders_per_paid_hour"), m.productivityPerHour == null ? t("insufficient_data") : Number(m.productivityPerHour).toFixed(2)],
        ]} />
      </div>

      <PhaseTwoDecisionTools
        forecast={data.forecast}
        siteBenchmarks={data.siteBenchmarks || []}
        metrics={m}
      />
      <PredictiveIntelligence
        intelligence={data.predictiveIntelligence}
        confidence={data.confidence}
      />
    </div>
  );
}

interface ForecastDay {
  date: string;
  orders: number | null;
  revenue: number | null;
}

interface ForecastData {
  days: ForecastDay[];
  coverageDays: number;
  confidence: "high" | "partial" | "insufficient";
}

interface SiteBenchmark {
  siteId: number;
  siteName: string;
  orders: number;
  deliveredOrders: number;
  revenue: number;
  expenses: number;
  profit: number;
  marginPct: number | null;
  averageOrderValue: number | null;
  completionRate: number | null;
}

interface ScenarioMetrics {
  revenue: number;
  expenses: number;
  orders: number;
  fixedCosts?: number;
  variableCosts?: number;
}

interface PredictiveAlert {
  code: "delivery_risk" | "demand_spike" | "collection_pressure" | "margin_pressure" | "discount_leakage" | "machine_underload" | "quality_risk";
  severity: "high" | "medium" | "low";
  value: number;
  evidence: Record<string, number | string | string[] | null>;
  href: string;
}

interface PredictiveIntelligenceData {
  alerts: PredictiveAlert[];
  generatedAt: string;
  forecastEligible: boolean;
  signalsEvaluated: number;
  methodology: string;
}

function PredictiveIntelligence({
  intelligence,
  confidence,
}: {
  intelligence?: PredictiveIntelligenceData;
  confidence?: { level?: string; score?: number };
}) {
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const alerts = intelligence?.alerts || [];
  const formatMoney = (value: number) => `${symbol}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formatEvidence = (alert: PredictiveAlert) => {
    switch (alert.code) {
      case "delivery_risk":
        return t("predictive_evidence_delivery", { count: Number(alert.evidence.delayedOrders || 0) });
      case "demand_spike":
        return t("predictive_evidence_demand", {
          count: alert.value,
          projected: alert.evidence.projectedDailyAverage,
          baseline: alert.evidence.historicalDailyAverage,
        });
      case "collection_pressure":
        return t("predictive_evidence_collection", {
          amount: formatMoney(alert.value),
          ratio: alert.evidence.outstandingRatio,
        });
      case "margin_pressure":
        return t("predictive_evidence_margin", { ratio: alert.evidence.marginPct });
      case "discount_leakage":
        return t("predictive_evidence_discount", {
          amount: formatMoney(alert.value),
          ratio: alert.evidence.discountRatio,
        });
      case "machine_underload":
        return t("predictive_evidence_machine", {
          ratio: alert.evidence.loadEfficiency,
          cycles: alert.evidence.cycles,
        });
      case "quality_risk":
        return t("predictive_evidence_quality", {
          ratio: alert.evidence.qualityRate,
          incidents: alert.evidence.incidents,
        });
    }
  };

  return (
    <section aria-labelledby="predictive-intelligence-title" className="space-y-4" data-testid="section-predictive-intelligence">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
            <h2 id="predictive-intelligence-title" className="text-xl font-bold font-display">{t("predictive_intelligence")}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("predictive_intelligence_help")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">{t("signals_evaluated", { count: intelligence?.signalsEvaluated || 0 })}</Badge>
          <Badge variant={confidence?.level === "high" ? "default" : "outline"}>
            {t("data_confidence")}: {t(`confidence_${confidence?.level || "insufficient"}`)}
          </Badge>
        </div>
      </div>

      {!intelligence?.forecastEligible && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200" role="status">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("predictive_history_notice")}</p>
        </div>
      )}

      {alerts.length ? (
        <ol className="grid gap-4 lg:grid-cols-2">
          {alerts.map((alert, index) => (
            <li key={`${alert.code}-${index}`}>
              <Card className={`h-full shadow-sm ${alert.severity === "high" ? "border-red-300 dark:border-red-900" : "border-amber-200 dark:border-amber-900"}`}>
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg p-2 ${alert.severity === "high" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t(`severity_${alert.severity}`)}
                        </p>
                        <h3 className="mt-1 font-semibold">{t(`predictive_${alert.code}_title`)}</h3>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{formatEvidence(alert)}</p>
                  <div className="mt-4 rounded-lg bg-muted/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("recommended_action")}</p>
                    <p className="mt-1 text-sm">{t(`predictive_${alert.code}_action`)}</p>
                  </div>
                  <Button asChild variant="outline" className="mt-4 min-h-11 w-full justify-between whitespace-normal">
                    <Link href={alert.href}>
                      {t("review_underlying_data")}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardContent className="flex items-start gap-3 p-5 text-emerald-900 dark:text-emerald-200">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="font-semibold">{t("no_predictive_alerts")}</h3>
              <p className="mt-1 text-sm">{t("no_predictive_alerts_help")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {t("predictive_methodology_note")}
        {intelligence?.generatedAt ? ` · ${new Date(intelligence.generatedAt).toLocaleString(i18n.language)}` : ""}
      </p>
    </section>
  );
}

function PhaseTwoDecisionTools({
  forecast,
  siteBenchmarks,
  metrics,
}: {
  forecast?: ForecastData;
  siteBenchmarks: SiteBenchmark[];
  metrics: ScenarioMetrics;
}) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="phase-two-decision-tools-title" className="space-y-4" data-testid="section-phase-two-decision-tools">
      <div>
        <h2 id="phase-two-decision-tools-title" className="text-xl font-bold font-display">
          {t("decision_planning")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("decision_planning_help")}
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <DemandForecast forecast={forecast} />
        <SiteBenchmarking sites={siteBenchmarks} />
      </div>
      <WhatIfSimulator metrics={metrics} />
    </section>
  );
}

function DemandForecast({ forecast }: { forecast?: ForecastData }) {
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const days = forecast?.days || [];
  const hasForecast = forecast?.confidence !== "insufficient" && days.some((day) => day.orders != null);
  const projectedOrders = days.reduce((sum, day) => sum + Number(day.orders || 0), 0);
  const projectedOrderValue = days.reduce((sum, day) => sum + Number(day.revenue || 0), 0);
  const chartData = days.map((day) => ({
    ...day,
    label: new Date(`${day.date}T12:00:00`).toLocaleDateString(i18n.language, { weekday: "short", day: "numeric" }),
  }));

  return (
    <Card className="shadow-sm" data-testid="card-demand-forecast">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-4 w-4" aria-hidden="true" />
          {t("seven_day_forecast")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("seven_day_forecast_help")}</p>
      </CardHeader>
      <CardContent>
        {!hasForecast ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("insufficient_data")}</p>
            <p className="mt-1">{t("forecast_needs_history", { days: forecast?.coverageDays || 0 })}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <CreditAnalyticsMetric label={t("projected_orders")} value={projectedOrders.toLocaleString()} />
              <CreditAnalyticsMetric label={t("projected_order_value")} value={`${symbol}${projectedOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            </div>
            <div className="h-52" role="img" aria-label={t("forecast_chart_accessible", { count: projectedOrders })}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [value, t("orders")]} />
                  <Bar dataKey="orders" fill="#0891b2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{t("forecast_history_coverage", { days: forecast?.coverageDays || 0 })}</span>
              <Badge variant="secondary">{t(`confidence_${forecast?.confidence || "insufficient"}`)}</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SiteBenchmarking({ sites }: { sites: SiteBenchmark[] }) {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const rankedSites = [...sites].sort((a, b) => Number(b.marginPct ?? -Infinity) - Number(a.marginPct ?? -Infinity));

  return (
    <Card className="shadow-sm" data-testid="card-site-benchmarking">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          {t("site_benchmarking")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("site_benchmarking_help")}</p>
      </CardHeader>
      <CardContent>
        {rankedSites.length < 2 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            {t("benchmark_requires_multiple_sites")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="pb-2 pr-3 font-medium">{t("site")}</th>
                  <th scope="col" className="pb-2 px-3 text-right font-medium">{t("orders")}</th>
                  <th scope="col" className="pb-2 px-3 text-right font-medium">{t("margin")}</th>
                  <th scope="col" className="pb-2 px-3 text-right font-medium">{t("average_order_value")}</th>
                  <th scope="col" className="pb-2 pl-3 text-right font-medium">{t("completion_rate")}</th>
                </tr>
              </thead>
              <tbody>
                {rankedSites.map((site, index) => (
                  <tr key={site.siteId} className="border-b last:border-0">
                    <th scope="row" className="py-3 pr-3 text-left font-medium">
                      <span className="mr-2 text-xs text-muted-foreground">#{index + 1}</span>
                      {site.siteName}
                    </th>
                    <td className="px-3 py-3 text-right font-mono">{site.orders}</td>
                    <td className="px-3 py-3 text-right font-mono">{site.marginPct == null ? t("insufficient_data") : `${site.marginPct.toFixed(1)}%`}</td>
                    <td className="px-3 py-3 text-right font-mono">{site.averageOrderValue == null ? t("insufficient_data") : `${symbol}${site.averageOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</td>
                    <td className="py-3 pl-3 text-right font-mono">{site.completionRate == null ? t("insufficient_data") : `${site.completionRate.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WhatIfSimulator({ metrics }: { metrics: ScenarioMetrics }) {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const [priceChange, setPriceChange] = useState(0);
  const [volumeChange, setVolumeChange] = useState(0);
  const [costChange, setCostChange] = useState(0);
  const projectedRevenue = metrics.revenue * (1 + priceChange / 100) * (1 + volumeChange / 100);
  const fixedCosts = Number(metrics.fixedCosts || 0);
  const variableCosts = Number(metrics.variableCosts ?? Math.max(0, metrics.expenses - fixedCosts));
  const projectedExpenses = fixedCosts + variableCosts * (1 + costChange / 100) * (1 + volumeChange / 100);
  const projectedProfit = projectedRevenue - projectedExpenses;
  const currentProfit = metrics.revenue - metrics.expenses;
  const profitDelta = projectedProfit - currentProfit;
  const projectedOrders = Math.max(0, Math.round(metrics.orders * (1 + volumeChange / 100)));
  const money = (value: number) => `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <Card className="shadow-sm" data-testid="card-what-if-simulator">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("what_if_simulator")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("what_if_simulator_help")}</p>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <fieldset className="space-y-5">
          <legend className="sr-only">{t("scenario_assumptions")}</legend>
          <ScenarioSlider id="price-change" label={t("average_price_change")} value={priceChange} min={-20} max={30} onChange={setPriceChange} />
          <ScenarioSlider id="volume-change" label={t("order_volume_change")} value={volumeChange} min={-30} max={50} onChange={setVolumeChange} />
          <ScenarioSlider id="cost-change" label={t("unit_cost_change")} value={costChange} min={-30} max={30} onChange={setCostChange} />
        </fieldset>
        <div className="rounded-lg border bg-muted/20 p-4" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("projected_scenario")}</p>
          <div className="mt-4 space-y-3">
            <MetricLine label={t("projected_orders")} value={projectedOrders.toLocaleString()} />
            <MetricLine label={t("projected_revenue")} value={money(projectedRevenue)} />
            <MetricLine label={t("projected_expenses")} value={money(projectedExpenses)} />
            <MetricLine label={t("projected_profit")} value={money(projectedProfit)} />
            <div className="border-t pt-3">
              <MetricLine label={t("profit_impact")} value={`${profitDelta >= 0 ? "+" : ""}${money(profitDelta)}`} />
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("scenario_not_forecast")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScenarioSlider({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <output htmlFor={id} className="min-w-14 rounded-md border bg-background px-2 py-1 text-center font-mono text-sm">{value > 0 ? "+" : ""}{value}%</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

function DecisionMetric({ icon, label, value, delta, tone }: { icon: React.ReactNode; label: string; value: string; delta?: number; tone?: "danger" | "warning" | "good" }) {
  const toneClass = tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-700 dark:text-amber-400" : tone === "good" ? "text-emerald-600" : "";
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground"><span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>{delta != null && <span className={`text-xs font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}%</span>}</div>
        <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-bold font-display ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function LaundryOperationsFlow({ stages }: { stages: { key: string; count: number }[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...stages.map((stage) => Number(stage.count || 0)));
  return (
    <section aria-labelledby="laundry-flow-title">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle id="laundry-flow-title">{t("laundry_operations_flow")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("laundry_operations_flow_help")}</p>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 md:grid-cols-6">
            {stages.map((stage, index) => (
              <li key={stage.key} className="relative rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{t(`stage_${stage.key}`, { defaultValue: stage.key })}</span>
                  <span className="font-mono text-lg font-bold">{stage.count}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-cyan-600" style={{ width: `${Math.max(5, (stage.count / max) * 100)}%` }} />
                </div>
                {index < stages.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground md:block" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}

function DecisionModule({ title, icon, items }: { title: string; icon: React.ReactNode; items: [string, string][] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><span className="[&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">{icon}</span>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map(([label, value]) => <MetricLine key={label} label={label} value={value} />)}
      </CardContent>
    </Card>
  );
}

function CustomerCreditAnalyticsSection() {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/analytics/credit-summary"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/credit-summary", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load customer credit analytics");
      return response.json();
    },
  });

  if (isLoading) return <Skeleton className="h-72 rounded-xl" />;

  const outstanding = Number(data?.totalCreditBalance ?? 0);
  const credited = Number(data?.totalEverCredited ?? 0);
  const used = Number(data?.totalEverUsed ?? 0);
  const clients = Number(data?.clientsWithCredit ?? 0);
  const utilization = credited > 0 ? Math.min(100, (used / credited) * 100) : 0;
  const formatMoney = (value: number) => `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <section aria-labelledby="customer-credit-analytics-title" data-testid="section-customer-credit-analytics">
      <Card className="overflow-hidden border-amber-200 shadow-sm dark:border-amber-900/60">
        <CardHeader className="border-b border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle id="customer-credit-analytics-title">{t("customer_credit_analytics")}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t("customer_credit_liability_note")}</p>
                <Badge variant="secondary" className="mt-2">{t("organisation_all_time")}</Badge>
              </div>
            </div>
            <Button asChild variant="outline" className="w-full gap-2 bg-background sm:w-auto" data-testid="button-view-credit-customers">
              <Link href="/customers?filter=credit">
                {t("view_credit_customers")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {isError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
              {t("customer_credit_analytics_error")}
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <CreditAnalyticsMetric label={t("credit_outstanding_liability")} value={formatMoney(outstanding)} emphasis />
                <CreditAnalyticsMetric label={t("customers_with_credit_balance")} value={clients.toLocaleString()} />
                <CreditAnalyticsMetric label={t("total_credited")} value={formatMoney(credited)} />
                <CreditAnalyticsMetric label={t("total_used")} value={formatMoney(used)} />
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{t("credit_utilization_rate")}</span>
                  <span className="font-mono font-semibold">{utilization.toFixed(1)}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={t("credit_utilization_rate")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(utilization)}
                >
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${utilization}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t("credit_utilization_explanation")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function CreditAnalyticsMetric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${emphasis ? "border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20" : "bg-card"}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold font-display ${emphasis ? "text-amber-800 dark:text-amber-300" : ""}`}>{value}</p>
    </div>
  );
}

function bucketOpacity(intensity: string): string {
  if (intensity === "full") return "1";
  if (intensity === "medium") return "0.6";
  if (intensity === "low") return "0.3";
  return "0.14";
}

function riskLabel(score: number | null | undefined, t: ReturnType<typeof useTranslation>["t"]): string {
  const value = Number(score ?? 0);
  if (value <= 15) return t("churn_risk_healthy");
  if (value <= 35) return t("churn_risk_monitor");
  if (value <= 55) return t("churn_risk_attention");
  if (value <= 85) return t("churn_risk_high");
  return t("churn_risk_critical");
}

function CustomerBehaviorSection({ period }: { period: string }) {
  const { t } = useTranslation();
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
          <CardHeader><CardTitle className="text-base">{t("peak_deposit_hours")}</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">{t("peak_pickup_hours")}</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">{t("activity_by_day")}</CardTitle></CardHeader>
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
              {t("churn_risk")}
              <Badge variant={Number(churn.atRiskCount || 0) > 0 ? "destructive" : "secondary"}>{churn.atRiskCount || 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{t("at_risk_customers")}</p>
                <p className="text-2xl font-bold">{churn.atRiskCount || 0}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{t("revenue_at_risk")}</p>
                <p className="text-2xl font-bold">{symbol}{Number(churn.revenueAtRisk || 0).toFixed(0)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {(churn.customers || []).slice(0, 6).map((customer: any) => (
                <div key={customer.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("last_visit")}: {formatBusinessDateTime(customer.lastVisitAt)} · {t("cycle")}: {customer.avgDaysBetweenVisits ? t("days_value", { count: Math.round(customer.avgDaysBetweenVisits) }) : "-"}
                    </p>
                  </div>
                  <Badge variant={Number(customer.churnRiskScore || 0) >= 86 ? "destructive" : "secondary"}>{riskLabel(customer.churnRiskScore, t)}</Badge>
                </div>
              ))}
              {!(churn.customers || []).length && <p className="text-sm text-muted-foreground">{t("no_churn_risk_detected")}</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">{t("customer_behavior")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MetricLine label={t("average_return_frequency")} value={t("days_decimal_value", { value: Number(metrics.averageReturnFrequency || 0).toFixed(1) })} />
            <MetricLine label={t("deposit_to_pickup_delay")} value={t("days_decimal_value", { value: Number(metrics.depositToPickupDelayDays || 0).toFixed(1) })} />
            <MetricLine label={t("average_storage_time")} value={t("days_decimal_value", { value: Number(metrics.averageStorageTimeDays || 0).toFixed(1) })} />
            <MetricLine label={t("time_to_payment")} value={t("hours_decimal_value", { value: Number(metrics.timeToPaymentHours || 0).toFixed(1) })} />
            <div className="pt-2 space-y-2">
              {(data.insights || []).map((insight: any, index: number) => (
                <div key={`${insight?.type || insight}-${index}`} className="rounded-md bg-muted/50 px-3 py-2">{formatCustomerBehaviorInsight(insight, t)}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatCustomerBehaviorInsight(insight: any, t: ReturnType<typeof useTranslation>["t"]): string {
  if (!insight) return "";
  if (typeof insight === "string") {
    const depositMatch = insight.match(/^(\d+)% of deposits occur between 8h and 11h$/);
    if (depositMatch) return t("insight_deposits_morning", { pct: depositMatch[1] });
    const pickupMatch = insight.match(/^(\d+)% of pickups occur after 17h$/);
    if (pickupMatch) return t("insight_pickups_evening", { pct: pickupMatch[1] });
    const returnMatch = insight.match(/^Average customer returns every (\d+) days$/);
    if (returnMatch) return t("insight_average_customer_returns", { days: returnMatch[1] });
    return insight;
  }

  switch (insight.type) {
    case "deposits_morning":
      return t("insight_deposits_morning", { pct: insight.pct });
    case "pickups_evening":
      return t("insight_pickups_evening", { pct: insight.pct });
    case "average_customer_returns":
      return t("insight_average_customer_returns", { days: insight.days });
    default:
      return insight.message || "";
  }
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
        <p className="mb-1 text-sm text-muted-foreground">{label}</p>
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
                  <Badge variant={alert.severity === "high" ? "destructive" : "secondary"}>{t(`severity_${alert.severity}`, { defaultValue: alert.severity })}</Badge>
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
  if (typeof recommendation === "string") {
    const employeeMatch = recommendation.match(/^(.+) processed (\d+)% more orders than average this period\.$/);
    if (employeeMatch) return t("rec_employee_orders_above_average", { employee: employeeMatch[1], percent: employeeMatch[2] });
    const maintenanceSoonMatch = recommendation.match(/^(.+) will require maintenance within (-?\d+) days\.$/);
    if (maintenanceSoonMatch) {
      const days = Number(maintenanceSoonMatch[2]);
      if (days < 0) return t("rec_machine_maintenance_overdue", { machine: maintenanceSoonMatch[1] });
      return t("rec_machine_maintenance_soon", { machine: maintenanceSoonMatch[1], days });
    }
    const serviceMatch = recommendation.match(/^(.+) generated the highest service revenue this period\.$/);
    if (serviceMatch) return t("rec_service_highest_revenue", { service: serviceMatch[1] });
    const underutilizedMatch = recommendation.match(/^(.+) is underutilized and should be reviewed for scheduling or maintenance issues\.$/);
    if (underutilizedMatch) return t("rec_machine_underutilized", { machine: underutilizedMatch[1] });
    return recommendation;
  }
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
    case "machine_maintenance_overdue":
      return t("rec_machine_maintenance_overdue", { machine: recommendation.machineName });
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
        const days = alert.message.match(/within (-?\d+) days/)?.[1] || "";
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
