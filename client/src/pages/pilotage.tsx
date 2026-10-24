import { Overview360, type OverviewData } from "@/components/pilotage/overview-360";
import { useCurrency } from "@/hooks/use-currency";
import { apiRequest } from "@/lib/queryClient";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { BarChart3, CheckCircle2, ClipboardList, FileText, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

const Reports = lazy(() => import("@/pages/reports"));
const QualityOperations = lazy(() => import("@/pages/quality-operations"));
const DailySiteReports = lazy(() => import("@/pages/daily-site-reports"));

type PilotageView = "overview" | "reports" | "quality" | "daily";

type DailySummary = {
  date: string;
  ordersCount: number;
  recentOrders: { id: number; orderNumber?: number; customer_name: string; status: string; total_amount: string }[];
  newCustomersCount: number;
  newCustomers: { id: number; name: string }[];
  collections: number;
  expenses: number;
};

function Overview({ onSelect }: { onSelect: (view: PilotageView) => void }) {
  const { t, i18n } = useTranslation();
  const { currentSite, canAccess } = useAuth();
  const symbol = useCurrency(state => state.getSymbol());
  const managerView = canAccess("reports");
  const { data, isLoading, isError, refetch } = useQuery<DailySummary>({
    queryKey: ["/api/pilotage/today", currentSite?.id ?? "all"],
    queryFn: async () => {
      const response = await fetch("/api/pilotage/today", { credentials: "include", headers: { "X-Client-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone } });
      if (!response.ok) throw new Error("Daily summary unavailable");
      return response.json();
    },
    staleTime: 0, refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const riskQuery = useQuery<{churn:{atRiskCount:number;insufficientHistoryCount:number}}>({
    queryKey: ["/api/analytics/customer-behavior", "month", currentSite?.id ?? "all"],
    queryFn: () => apiRequest("GET", "/api/analytics/customer-behavior?period=month").then(r=>r.json()),
    enabled: canAccess("analytics"), staleTime: 0, refetchInterval: 60_000, refetchOnWindowFocus: true,
  });
  const returnsQuery = useQuery<any[]>({ queryKey: ["/api/garment-returns", currentSite?.id ?? "all"], queryFn: () => apiRequest("GET", `/api/garment-returns${currentSite?.id ? `?siteId=${currentSite.id}` : ""}`).then(r=>r.json()), staleTime: 0, refetchInterval: 60_000 });
  const reportsQuery = useQuery<any[]>({ queryKey: ["/api/daily-site-reports", currentSite?.id ?? "all"], queryFn: () => apiRequest("GET", "/api/daily-site-reports").then(response => response.json()), staleTime: 0, refetchInterval: 60_000, refetchOnWindowFocus: true, enabled: managerView });
  const returns = returnsQuery.data || [];
  const reports = reportsQuery.data || [];
  const openReturns = returns.filter((item) => !["rejected", "resolved"].includes(item.returnCase.status)).length;
  const reportsToReview = managerView ? reports.filter((item) => item.report.status === "submitted").length : 0;
  const money = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(value) + " " + symbol;
  const overview = useQuery<OverviewData>({
    queryKey: ["/api/pilotage/overview", currentSite?.id ?? "all"],
    queryFn: () => apiRequest("GET", "/api/pilotage/overview").then(response=>response.json()),
    staleTime: 0, refetchInterval: 60_000, refetchOnWindowFocus: true,
  });
  if (isLoading || overview.isLoading) return <div className="space-y-3"><Skeleton className="h-28"/><Skeleton className="h-64"/></div>;
  if (isError || !data || overview.isError || !overview.data) return <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"><p>{t("pilotage_today_error")}</p><button className="min-h-11 underline" onClick={()=>{overview.refetch(); refetch();}}>{t("decision_retry")}</button></div>;
  return <Overview360 showRisk={canAccess("analytics")} risk={riskQuery.data?.churn} riskError={riskQuery.isError} data={overview.data} today={data} money={money} openReturns={openReturns} reportsToReview={reportsToReview} partialError={returnsQuery.isError || (managerView && reportsQuery.isError)} onSelect={onSelect}/>;

}

export default function Pilotage() {
  const { t } = useTranslation(); const { canAccess, user } = useAuth(); const [, setLocation] = useLocation();
  const basicSaas = (user as any)?.saas?.plan === "starter";
  const requested = new URLSearchParams(useSearch()).get("view") as PilotageView | null;
  const allowed: PilotageView[] = [...(!basicSaas ? ["overview" as const] : []), ...(canAccess("reports") ? ["reports" as const] : []), "quality", "daily"];
  const active = requested && allowed.includes(requested) ? requested : basicSaas ? "quality" : "overview";
  const tabs = [
    ...(!basicSaas ? [{ value: "overview" as const, label: t("pilotage_overview"), icon: ClipboardList }] : []),
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
