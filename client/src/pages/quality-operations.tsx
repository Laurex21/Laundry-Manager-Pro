import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronRight, Clock3, FileText, RotateCcw, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBusinessDateTime } from "@/lib/date-time";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";

const STATUSES = ["all", "pending_review", "approved", "in_rework", "quality_check", "rejected", "resolved"] as const;

export default function QualityOperations({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { currentSite } = useAuth();
  const currencySymbol = useCurrency((state) => state.getSymbol());
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const { data = [], isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/garment-returns", currentSite?.id ?? "all", status],
    queryFn: async () => {
      const suffix = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      const response = await fetch(`/api/garment-returns${suffix}`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load garment returns");
      return response.json();
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: summary } = useQuery<any>({ queryKey: ["/api/garment-returns/summary", currentSite?.id ?? "all"], queryFn: async () => {
    const response = await fetch("/api/garment-returns/summary", { credentials: "include" });
    if (!response.ok) throw new Error("Unable to load quality summary");
    return response.json();
  }});

  return <div className="space-y-4 page-fade-in">
    {!embedded && <div className="flex items-start justify-between gap-3">
      <div><h1 className="text-lg font-semibold text-foreground">{t("quality_operations")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("quality_operations_subtitle")}</p></div>
      <Link href="/pilotage?view=daily"><span className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-xs font-medium hover:bg-muted"><FileText className="h-4 w-4" aria-hidden="true" />{t("daily_reports")}</span></Link>
    </div>}

    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("quality_operations_filter")}>
      {STATUSES.map((value) => <button
        key={value}
        type="button"
        onClick={() => setStatus(value)}
        aria-pressed={status === value}
        className={`min-h-11 shrink-0 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${status === value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
      >
        {value === "all" ? t("quality_operations_all") : t(`customer_return_status_${value}`)}
      </button>)}
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="quality-management-summary">
      <QualityMetric icon={<RotateCcw />} label={t("quality_open_cases", "Dossiers ouverts")} value={summary?.openCases ?? 0} />
      <QualityMetric icon={<Clock3 />} label={t("quality_resolution_time", "Délai moyen de résolution")} value={summary?.averageResolutionHours == null ? "—" : `${Number(summary.averageResolutionHours).toFixed(1)} h`} />
      <QualityMetric icon={<Wallet />} label={t("quality_estimated_cost", "Coût estimé")} value={`${Number(summary?.estimatedCost || 0).toLocaleString()} ${currencySymbol}`} />
      <QualityMetric icon={<AlertTriangle />} label={t("quality_overdue_actions", "Actions en retard")} value={summary?.overdueActions ?? 0} danger={Number(summary?.overdueActions || 0) > 0} />
    </div>

    {isLoading ? <div className="space-y-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : null}
    {isError ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{t("customer_returns_load_failed")}</p> : null}
    {!isLoading && !isError && data.length === 0 ? <Card><CardContent className="flex min-h-40 flex-col items-center justify-center text-center">
      <RotateCcw className="mb-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{t("quality_operations_empty")}</p>
    </CardContent></Card> : null}

    <div className="grid gap-2 lg:grid-cols-2">
      {data.map((item) => <Link key={item.returnCase.id} href={`/orders/${item.order.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Card className="h-full transition-colors hover:border-primary/40">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{item.garment.quantity}× {item.garment.itemName}</p>
                <Badge variant={item.returnCase.status === "pending_review" ? "destructive" : "secondary"}>{t(`customer_return_status_${item.returnCase.status}`)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.customer.name} · #{item.order.id}</p>
              <p className="mt-2 line-clamp-2 text-sm">{item.returnCase.customerComment}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatBusinessDateTime(item.returnCase.returnedAt)}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
              <span className="hidden sm:inline">{t("quality_operations_view_order")}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </CardContent>
        </Card>
      </Link>)}
    </div>
  </div>;
}

function QualityMetric({ icon, label, value, danger = false }: { icon: React.ReactNode; label: string; value: React.ReactNode; danger?: boolean }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${danger ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}`}>{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className={`text-xl font-bold ${danger ? "text-red-700" : "text-[#082D5B]"}`}>{value}</p></div></CardContent></Card>;
}
