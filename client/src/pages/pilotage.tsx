import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { BarChart3, CheckCircle2, ClipboardList, FileText, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

const Reports = lazy(() => import("@/pages/reports"));
const QualityOperations = lazy(() => import("@/pages/quality-operations"));
const DailySiteReports = lazy(() => import("@/pages/daily-site-reports"));

type PilotageView = "overview" | "reports" | "quality" | "daily";

function Overview({ onSelect }: { onSelect: (view: PilotageView) => void }) {
  const { t } = useTranslation();
  const { currentSite, canAccess } = useAuth();
  const managerView = canAccess("reports");
  const { data: returns = [] } = useQuery<any[]>({ queryKey: ["/api/garment-returns", currentSite?.id ?? "all"], refetchInterval: 60_000 });
  const { data: reports = [] } = useQuery<any[]>({ queryKey: ["/api/daily-site-reports", currentSite?.id ?? "all"], queryFn: () => fetch("/api/daily-site-reports", { credentials: "include" }).then((response) => response.ok ? response.json() : []), refetchOnWindowFocus: true, enabled: managerView });
  const openReturns = returns.filter((item) => !["rejected", "resolved"].includes(item.returnCase.status)).length;
  const reportsToReview = managerView ? reports.filter((item) => item.report.status === "submitted").length : 0;
  const attention = openReturns + reportsToReview;
  const cards = [
    ...(managerView ? [{ view: "reports" as const, icon: BarChart3, label: t("reports"), value: null, detail: t("reports_subtitle") }] : []),
    { view: "quality" as const, icon: RotateCcw, label: t("pilotage_open_returns"), value: openReturns, detail: t("quality_operations_subtitle") },
    { view: "daily" as const, icon: FileText, label: managerView ? t("pilotage_reports_to_review") : t("daily_reports"), value: managerView ? reportsToReview : null, detail: t("daily_reports_subtitle") },
  ];

  return <div className="space-y-4">
    <section aria-labelledby="pilotage-attention-title" className="rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ClipboardList className="h-5 w-5" aria-hidden="true" /></div><div><h2 id="pilotage-attention-title" className="text-sm font-semibold">{t("pilotage_attention")}</h2><p className="text-2xl font-bold tabular-nums">{attention}</p></div></div>
      <p className="mt-3 text-sm text-muted-foreground">{attention === 0 ? t("pilotage_no_attention") : t("pilotage_attention_detail", { count: attention })}</p>
    </section>
    <div className="grid gap-3 md:grid-cols-3">{cards.map(({ view, icon: Icon, label, value, detail }) => <button key={view} type="button" onClick={() => onSelect(view)} className="min-h-36 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"><CardContent className="flex h-full flex-col p-4"><div className="flex items-start justify-between gap-3"><Icon className="h-5 w-5 text-primary" aria-hidden="true" />{value !== null && <span className="text-2xl font-bold tabular-nums">{value}</span>}</div><h3 className="mt-4 text-sm font-semibold">{label}</h3><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p></CardContent></Card>
    </button>)}</div>
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

  return <div className="space-y-4 page-fade-in"><header><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true"/><h1 className="text-lg font-semibold">{t("pilotage")}</h1></div><p className="mt-1 text-sm text-muted-foreground">{t("pilotage_subtitle")}</p></header>
    <div role="tablist" aria-label={t("pilotage_sections")} className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1">
      {tabs.map(({ value, label, icon: Icon }, index) => <button id={`pilotage-tab-${value}`} key={value} type="button" role="tab" aria-selected={active === value} aria-controls="pilotage-panel" tabIndex={active === value ? 0 : -1} onClick={() => select(value)} onKeyDown={(event) => onTabKeyDown(event, index)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4" aria-hidden="true"/>{label}</button>)}
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
