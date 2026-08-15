import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bell, Clock, DollarSign, Download, Percent, RefreshCw, TrendingDown, UserPlus, Users, XCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/use-currency";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Period = "month" | "quarter" | "year";
type DashboardData = {
  mrr: number; arr: number; activeSubscribers: number; newSubscribersThisPeriod: number;
  renewalsThisPeriod: number; renewalRate: number; expiringSoon: number; cancelledThisPeriod: number;
  churnRate: number; avgRevenuePerSubscriber: number;
  collectedRevenueThisPeriod: number; outstandingBalance: number; advanceCredit: number; pendingSubscribers: number;
  revenueByPlan: Array<{ planId: number; planName: string; subscriberCount: number; monthlyRevenue: number; pctOfTotal: number }>;
  topSubscribers: Array<{ clientId: number; clientName: string; planName: string; totalSpend: number; utilizationPct: number }>;
  expiringSoonList: Array<{ clientId: number; clientName: string; planName: string; daysUntilExpiry: number; whatsappUrl: string }>;
  pendingSubscriberList: Array<{ clientId: number; clientName: string; planName: string; balance: number }>;
  mrrTrend: Array<{ month: string; mrr: number }>;
  subscriptionGrowth: Array<{ month: string; new: number; cancelled: number; net: number }>;
  planDistribution: Array<{ planName: string; count: number; pct: number }>;
};

const PLAN_COLORS = ["#1E63F0", "#16A34A", "#D97706", "#7C3AED", "#0E7490"];

async function fetchDashboard(period: Period): Promise<DashboardData> {
  const response = await fetch(`/api/subscriptions/dashboard?period=${period}`, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load subscription dashboard");
  return response.json();
}

export default function SubscriptionDashboardPage() {
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const [period, setPeriod] = useState<Period>("month");
  const { data, isLoading, error } = useQuery({
    queryKey: ["subscription-dashboard", period],
    queryFn: () => fetchDashboard(period),
  });
  const money = (value: number) => `${getSymbol()}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const localizeMonth = (month: string) => {
    const [year, value] = month.split("-").map(Number);
    if (!year || !value) return month;
    return new Intl.DateTimeFormat(i18n.language, { month: "short", year: "2-digit", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, value - 1, 1)));
  };
  const mrrTrend = (data?.mrrTrend ?? []).map((item) => ({ ...item, month: localizeMonth(item.month) }));
  const subscriptionGrowth = (data?.subscriptionGrowth ?? []).map((item) => ({ ...item, month: localizeMonth(item.month) }));
  const lastUpdated = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(new Date());

  if (isLoading) return <div className="space-y-6" aria-busy="true"><Skeleton className="h-16 w-full" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-72 w-full" /></div>;
  if (error) return <Card role="alert"><CardContent className="p-6 text-sm text-destructive">{t("subscription_dashboard_load_error")}</CardContent></Card>;

  const kpis = [
    [t("active_subscribers"), String(data?.activeSubscribers ?? 0), Users],
    [t("new_subscribers"), `+${data?.newSubscribersThisPeriod ?? 0}`, UserPlus],
    [t("churn_rate"), `${(data?.churnRate ?? 0).toFixed(1)}%`, TrendingDown],
    [t("avg_revenue_per_subscriber"), money(data?.avgRevenuePerSubscriber ?? 0), DollarSign],
    [t("renewals"), String(data?.renewalsThisPeriod ?? 0), RefreshCw],
    [t("renewal_rate"), `${(data?.renewalRate ?? 0).toFixed(0)}%`, Percent],
    [t("cancellations"), String(data?.cancelledThisPeriod ?? 0), XCircle],
    [t("expiring_soon"), String(data?.expiringSoon ?? 0), Clock],
  ] as const;

  return <main className="mx-auto max-w-7xl space-y-6 page-fade-in">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold">{t("subscription_dashboard")}</h1><p className="text-sm text-muted-foreground">{t("subscription_dashboard_subtitle")} · Updated {lastUpdated}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-muted p-1" role="group" aria-label={t("dashboard_period")}>
          {(["month", "quarter", "year"] as Period[]).map(value => <Button key={value} size="sm" variant={period === value ? "default" : "ghost"} aria-pressed={period === value} onClick={() => setPeriod(value)}>{t(`period_${value}`)}</Button>)}
        </div>
        <Button variant="outline" asChild><a href={`/api/subscriptions/dashboard/export?format=csv&period=${period}`} download><Download className="mr-2 h-4 w-4" aria-hidden="true" />CSV</a></Button>
      </div>
    </header>

    {((data?.pendingSubscriberList.length ?? 0) > 0 || (data?.expiringSoonList.length ?? 0) > 0) && <section aria-labelledby="attention-title" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-slate-950 dark:border-amber-800 dark:bg-amber-950 dark:text-slate-50"><h2 id="attention-title" className="mb-4 flex items-center gap-2 text-base font-semibold"><Bell className="h-4 w-4" aria-hidden="true" />Attention required</h2><div className="grid gap-4 lg:grid-cols-2">{(data?.pendingSubscriberList.length ?? 0) > 0 && <div><h3 className="mb-2 text-sm font-medium">Pending subscription payments ({data?.pendingSubscribers})</h3><ul className="space-y-2">{data?.pendingSubscriberList.slice(0, 5).map(item=><li key={item.clientId} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 dark:bg-black/20"><div><Link href={`/customers/${item.clientId}`} className="text-sm font-medium underline-offset-4 hover:underline">{item.clientName}</Link><p className="text-xs opacity-70">{item.planName}</p></div><b className="text-sm">{money(item.balance)}</b></li>)}</ul></div>}{(data?.expiringSoonList.length ?? 0) > 0 && <div><h3 className="mb-2 text-sm font-medium">{t("expiring_soon")} ({data?.expiringSoon})</h3><ul className="space-y-2">{data?.expiringSoonList.slice(0,5).map(item=><li key={`${item.clientId}-${item.planName}`} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 dark:bg-black/20"><div><Link href={`/customers/${item.clientId}`} className="text-sm font-medium underline-offset-4 hover:underline">{item.clientName}</Link><p className="text-xs opacity-70">{item.planName} · {t("expires_in_days", { count:item.daysUntilExpiry })}</p></div><Button size="sm" className="bg-green-700 text-white hover:bg-green-800" asChild><a href={item.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp<span className="sr-only"> — {item.clientName}</span></a></Button></li>)}</ul></div>}</div></section>}

    <section aria-label="Subscription finances" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Collected this period" value={money(data?.collectedRevenueThisPeriod ?? 0)} detail={`${period} cash received`} emphasis />
      <MetricCard label={t("mrr")} value={money(data?.mrr ?? 0)} detail={t("monthly_recurring_revenue")} />
      <MetricCard label="Outstanding" value={money(data?.outstandingBalance ?? 0)} detail={`${data?.pendingSubscribers ?? 0} pending subscribers`} tone="warning" />
      <MetricCard label="Advance credit held" value={money(data?.advanceCredit ?? 0)} detail="Available for future renewals" />
    </section>

    <section aria-label={t("subscription_kpis")}><h2 className="mb-3 text-base font-semibold">Retention and subscriber health</h2><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.filter((_, i) => [0,2,5,7].includes(i)).map(([label, value, Icon]) => <Card key={label}><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p></div><Icon className="h-4 w-4 text-primary" aria-hidden="true" /></div></CardContent></Card>)}
    </div>
    </section>

    <section className="grid gap-6 lg:grid-cols-2" aria-label={t("subscription_charts")}>
      <ChartCard title={t("mrr_trend")}><ResponsiveContainer width="100%" height={220}><AreaChart data={mrrTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(value: number) => money(value)} /><Area type="monotone" dataKey="mrr" stroke="#1E63F0" fill="#1E63F0" fillOpacity={0.15} /></AreaChart></ResponsiveContainer></ChartCard>
      <ChartCard title={t("plan_distribution")}><ResponsiveContainer width="100%" height={220}><BarChart data={data?.planDistribution ?? []} layout="vertical" margin={{ left: 12, right: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} fontSize={10} /><YAxis type="category" dataKey="planName" width={90} fontSize={11} /><Tooltip /><Bar dataKey="count" name={t("active_subscribers")} fill="#1E63F0" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title={t("subscription_growth")}><ResponsiveContainer width="100%" height={220}><BarChart data={subscriptionGrowth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="new" name={t("new_subscribers")} fill="#16A34A" /><Bar dataKey="cancelled" name={t("cancellations")} fill="#DC2626" /></BarChart></ResponsiveContainer></ChartCard>
      <Card><CardHeader><CardTitle className="text-sm">{t("revenue_by_plan")}</CardTitle></CardHeader><CardContent className="space-y-4">{(data?.revenueByPlan ?? []).map((plan, i) => <div key={plan.planId}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="font-medium">{plan.planName}</span><span className="text-muted-foreground">{money(plan.monthlyRevenue)} · {plan.subscriberCount}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(100, plan.pctOfTotal)}%`, backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }} /></div></div>)}</CardContent></Card>
    </section>

    <Card><CardHeader><CardTitle className="text-sm">{t("top_subscribers")}</CardTitle></CardHeader><CardContent><ol className="space-y-2">{(data?.topSubscribers ?? []).map((subscriber, i) => <li key={`${subscriber.clientId}-${subscriber.planName}`} className="flex items-center gap-3 border-b py-2 last:border-0"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span><div className="min-w-0 flex-1"><Link href={`/customers/${subscriber.clientId}`} className="block truncate text-sm font-medium underline-offset-4 hover:underline">{subscriber.clientName}</Link><p className="text-xs text-muted-foreground">{subscriber.planName}</p></div><div className="text-right"><p className="text-sm font-bold text-primary">{money(subscriber.totalSpend)}</p><p className="text-xs text-muted-foreground">{subscriber.utilizationPct.toFixed(0)}% {t("utilization")}</p></div></li>)}</ol></CardContent></Card>
    <NotificationCenter />
  </main>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
}

function MetricCard({ label, value, detail, emphasis = false, tone }: { label:string; value:string; detail:string; emphasis?:boolean; tone?:"warning" }) {
  return <Card className={emphasis ? "border-primary bg-primary text-primary-foreground" : ""}><CardContent className="p-5"><p className={`text-xs ${emphasis ? "opacity-75" : "text-muted-foreground"}`}>{label}</p><p className={`mt-2 text-2xl font-black tabular-nums ${tone === "warning" ? "text-amber-700 dark:text-amber-400" : ""}`}>{value}</p><p className={`mt-2 text-xs ${emphasis ? "opacity-75" : "text-muted-foreground"}`}>{detail}</p></CardContent></Card>;
}

function NotificationCenter() {
  const { t } = useTranslation();
  const { data = [] } = useQuery<Array<{ id: number; clientName: string; planName: string; trigger: string; whatsappUrl: string }>>({
    queryKey: ["subscription-notifications-due"],
    queryFn: async () => {
      const response = await fetch("/api/subscriptions/notifications/due", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load notifications");
      return response.json();
    },
    refetchInterval: 30 * 60 * 1000,
  });
  const markSent = async (id: number) => {
    await apiRequest("PATCH", `/api/subscriptions/notifications/${id}/sent`);
    queryClient.invalidateQueries({ queryKey: ["subscription-notifications-due"] });
  };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4 text-primary" aria-hidden="true" />{t("notifications_to_send")} ({data.length})</CardTitle></CardHeader><CardContent>{data.length === 0 ? <p className="text-sm text-muted-foreground">{t("no_pending_notifications")}</p> : <ul className="space-y-2">{data.map(item => <li key={item.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.clientName}</p><p className="text-xs text-muted-foreground">{item.planName} · {t(`notification_${item.trigger}`)}</p></div><Button size="sm" className="bg-green-600 text-white hover:bg-green-700" asChild><a href={item.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => void markSent(item.id)}>WhatsApp<span className="sr-only"> — {item.clientName}</span></a></Button></li>)}</ul>}</CardContent></Card>;
}
