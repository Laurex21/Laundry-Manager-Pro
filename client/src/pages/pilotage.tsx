import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { BarChart3, CheckCircle2, ClipboardList, FileText, RotateCcw, ShoppingBag, Users, Wallet, ReceiptText } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

const Reports = lazy(() => import("@/pages/reports"));
const QualityOperations = lazy(() => import("@/pages/quality-operations"));
const DailySiteReports = lazy(() => import("@/pages/daily-site-reports"));

type PilotageView = "overview" | "reports" | "quality" | "daily";

type DailySummary = {
  date: string;
  ordersCount: number;
  recentOrders: { id: number; customer_name: string; status: string; total_amount: string }[];
  newCustomersCount: number;
  newCustomers: { id: number; name: string }[];
  collections: number;
  expenses: number;
};

function Overview({ onSelect }: { onSelect: (view: PilotageView) => void }) {
  const { t, i18n } = useTranslation();
  const { currentSite, canAccess } = useAuth();
  const managerView = canAccess("reports");
  const { data, isLoading, isError } = useQuery<DailySummary>({
    queryKey: ["/api/pilotage/today", currentSite?.id ?? "all"],
    queryFn: async () => {
      const response = await fetch("/api/pilotage/today", { credentials: "include", headers: { "X-Client-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone } });
      if (!response.ok) throw new Error("Daily summary unavailable");
      return response.json();
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: returns = [] } = useQuery<any[]>({ queryKey: ["/api/garment-returns", currentSite?.id ?? "all"], refetchInterval: 60_000 });
  const { data: reports = [] } = useQuery<any[]>({ queryKey: ["/api/daily-site-reports", currentSite?.id ?? "all"], queryFn: () => fetch("/api/daily-site-reports", { credentials: "include" }).then((response) => response.ok ? response.json() : []), refetchOnWindowFocus: true, enabled: managerView });
  const openReturns = returns.filter((item) => !["rejected", "resolved"].includes(item.returnCase.status)).length;
  const reportsToReview = managerView ? reports.filter((item) => item.report.status === "submitted").length : 0;
  const money = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(value) + " FCFA";
  const metrics = [
    { label: t("pilotage_today_orders"), value: data?.ordersCount ?? 0, icon: ShoppingBag, href: "/orders" },
    { label: t("pilotage_today_customers"), value: data?.newCustomersCount ?? 0, icon: Users, href: "/customers" },
    { label: t("pilotage_today_collections"), value: money(data?.collections ?? 0), icon: Wallet, href: "/payments" },
    { label: t("pilotage_today_expenses"), value: money(data?.expenses ?? 0), icon: ReceiptText, href: "/expenses" },
  ];

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-28"/><Skeleton className="h-64"/></div>;
  if (isError || !data) return <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{t("pilotage_today_error")}</p>;

  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold">{t("pilotage_today_title")}</h2><p className="text-sm text-muted-foreground">{data.date} · {currentSite?.name ?? t("pilotage_all_sites")}</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon, href }) => <Link key={label} href={href} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="mb-4 h-5 w-5 text-primary" aria-hidden="true"/><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></Link>)}</div>
    <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
      <Card><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{t("pilotage_today_recent_orders")}</h3><Link href="/orders" className="text-sm text-primary hover:underline">{t("pilotage_view_all")}</Link></div>{data.recentOrders.length ? <ul className="mt-4 divide-y">{data.recentOrders.map((order) => <li key={order.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="truncate">{order.customer_name}</span><span className="shrink-0 text-muted-foreground">#{order.id} · {order.status}</span></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">{t("pilotage_today_no_orders")}</p>}</CardContent></Card>
      <div className="space-y-3"><Card><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{t("pilotage_today_customers")}</h3><Link href="/customers" className="text-sm text-primary hover:underline">{t("pilotage_view_all")}</Link></div>{data.newCustomers.length ? <ul className="mt-3 space-y-2 text-sm">{data.newCustomers.map((customer) => <li key={customer.id}>{customer.name}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">{t("pilotage_today_no_customers")}</p>}</CardContent></Card>
      {(openReturns + reportsToReview) > 0 && <Card><CardContent className="p-5"><h3 className="font-semibold">{t("pilotage_attention")}</h3>{openReturns > 0 && <button type="button" onClick={() => onSelect("quality")} className="mt-3 block text-sm text-primary hover:underline">{openReturns} {t("pilotage_open_returns")}</button>}{reportsToReview > 0 && <button type="button" onClick={() => onSelect("daily")} className="mt-2 block text-sm text-primary hover:underline">{reportsToReview} {t("pilotage_reports_to_review")}</button>}</CardContent></Card>}</div>
    </div>
    <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 className="font-semibold">{t("pilotage_today_balance")}</h3><p className="text-xs text-muted-foreground">{t("pilotage_today_balance_note")}</p></div><p className="text-2xl font-semibold tabular-nums">{money(data.collections - data.expenses)}</p></CardContent></Card>
  </div>;
}

export default function Pilotage() {
  const { t } = useTranslation(); const { canAccess } = useAuth(); const [, setLocation] = useLocation();
  const requested = new URLSearchParams(useSearch()).get("view") as PilotageView | null;
  const allowed: PilotageView[] = ["overview", ...(canAccess("reports") ? ["reports" as const] : []), "quality", "daily"];
  const active = requested && allowed.includes(requested) ? requested : "overview";
  const tabs = [
    { value: "overview" as const, label: t("pilotage_overview"), icon: ClipboardList },
    ...(canAccess("reports") ? [{ value: "reports" as const, label: t("reports"), icon: BarChart3 }] : []),
    { value: "quality" as const, label: t("quality_operations"), icon: RotateCcw },
    { value: "daily" as const, label: t("daily_reports"), icon: FileText },
  ];
  const select = (view: PilotageView) => setLocation(`/pilotage?view=${view}`);
  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    select(tabs[next].value); requestAnimationFrame(() => document.getElementById(`pilotage-tab-${tabs[next].value}`)?.focus());
  };

  return <div className="space-y-5 page-fade-in" data-testid="pilotage-page-redesign"><header className="rounded-2xl border border-[#082D5B]/10 bg-card p-4 shadow-sm sm:p-6"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><CheckCircle2 className="h-4 w-4" aria-hidden="true"/>{t("management", "Gestion")}</div><h1 className="text-2xl font-display font-bold text-[#082D5B] sm:text-3xl">{t("pilotage")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("pilotage_subtitle")}</p></header>
    <div role="tablist" aria-label={t("pilotage_sections")} className="flex gap-1 overflow-x-auto rounded-xl border border-primary/10 bg-card p-1.5 shadow-sm">
      {tabs.map(({ value, label, icon: Icon }, index) => <button id={`pilotage-tab-${value}`} key={value} type="button" role="tab" aria-selected={active === value} aria-controls="pilotage-panel" tabIndex={active === value ? 0 : -1} onClick={() => select(value)} onKeyDown={(event) => onTabKeyDown(event, index)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"}`}><Icon className="h-4 w-4" aria-hidden="true"/>{label}</button>)}
    </div>
    <main id="pilotage-panel" role="tabpanel" aria-labelledby={`pilotage-tab-${active}`} tabIndex={0} className="focus:outline-none">
      <Suspense fallback={<div className="space-y-3"><Skeleton className="h-32"/><Skeleton className="h-48"/></div>}>
        {active === "overview" && <Overview onSelect={select} />}
        {active === "reports" && <Reports embedded />}
        {active === "quality" && <QualityOperations embedded />}
        {active === "daily" && <DailySiteReports embedded />}
      </Suspense>
    </main>
  </div>;
}
