import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DailySiteReportForm } from "@/components/daily-site-report-form";
import { DailySiteReportCard } from "@/components/daily-site-report-card";
import { useAuth } from "@/hooks/use-auth";

export default function DailySiteReports({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation(); const { currentSite, allSites, isOwner } = useAuth();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [siteId, setSiteId] = useState(String(currentSite?.id ?? allSites[0]?.id ?? ""));
  const [editing, setEditing] = useState<any>(null);
  const querySuffix = siteId ? `?siteId=${siteId}` : "";
  const { data = [], isLoading, isError } = useQuery<any[]>({ queryKey: ["/api/daily-site-reports", siteId], queryFn: async () => { const response = await fetch(`/api/daily-site-reports${querySuffix}`, { credentials: "include" }); if (!response.ok) throw new Error(); return response.json(); }, refetchOnWindowFocus: true });
  const create = useMutation({ mutationFn: async () => { const response = await fetch("/api/daily-site-reports/draft", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId: Number(siteId), reportDate: date }) }); if (!response.ok) throw new Error(); return response.json(); }, onSuccess: setEditing });

  return <div className="space-y-4 page-fade-in">{!embedded && <div><h1 className="text-lg font-semibold">{t("daily_reports")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("daily_reports_subtitle")}</p></div>}
    <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end"><div className="space-y-1.5"><Label htmlFor="daily-report-date">{t("date")}</Label><Input id="daily-report-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>{isOwner && allSites.length > 1 && <div className="space-y-1.5"><Label htmlFor="daily-report-site">{t("site")}</Label><Select value={siteId} onValueChange={setSiteId}><SelectTrigger id="daily-report-site" className="min-w-48"><SelectValue /></SelectTrigger><SelectContent>{allSites.map((site: any) => <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>)}</SelectContent></Select></div>}<Button className="min-h-11" onClick={() => create.mutate()} disabled={!siteId || !date || create.isPending}>{t("daily_report_create")}</Button><p className="text-xs text-muted-foreground sm:ml-auto">{t("daily_report_optional")}</p></CardContent></Card>
    {editing && <DailySiteReportForm report={editing} onClose={() => setEditing(null)} />}
    {isLoading && <div className="space-y-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>}
    {isError && <p role="alert" className="text-sm text-destructive">{t("daily_reports_load_failed")}</p>}
    {!isLoading && !isError && data.length === 0 && <Card><CardContent className="flex min-h-40 flex-col items-center justify-center text-center"><FileText className="mb-3 h-7 w-7 text-muted-foreground" aria-hidden="true"/><p className="text-sm text-muted-foreground">{t("daily_reports_empty")}</p></CardContent></Card>}
    <div className="grid gap-3 xl:grid-cols-2">{data.map((item) => <DailySiteReportCard key={item.report.id} item={item} onEdit={setEditing} />)}</div>
  </div>;
}
