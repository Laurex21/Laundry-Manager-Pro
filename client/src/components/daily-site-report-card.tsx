import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export function DailySiteReportCard({ item, onEdit }: { item: any; onEdit: (report: any) => void }) {
  const { t } = useTranslation(); const { userRole } = useAuth(); const queryClient = useQueryClient(); const [comment, setComment] = useState("");
  const report = item.report; const metrics = report.metricsSnapshot ?? {}; const canManage = userRole === "owner" || userRole === "manager";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/daily-site-reports"] });
  const addComment = useMutation({ mutationFn: async () => { const response = await fetch(`/api/daily-site-reports/${report.id}/comments`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment }) }); if (!response.ok) throw new Error(); return response.json(); }, onSuccess: () => { setComment(""); refresh(); } });
  const acknowledge = useMutation({ mutationFn: async () => { const response = await fetch(`/api/daily-site-reports/${report.id}/acknowledge`, { method: "POST", credentials: "include" }); if (!response.ok) throw new Error(); return response.json(); }, onSuccess: refresh });
  const metricKeys = ["ordersCreated", "ordersDelivered", "pendingOrders", "paymentsCollected", "expensesRecorded", "outstandingBalance", "returnsCreated", "returnsOpen", "returnsDecided"];

  return <Card><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-sm">{item.site.name} · {report.reportDate}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{t("daily_report_version", { version: report.version })}</p></div><Badge variant={report.status === "draft" ? "outline" : "secondary"}>{t(`daily_report_status_${report.status}`)}</Badge></div></CardHeader><CardContent className="space-y-4">
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={t("daily_report_metrics")}>
      {metricKeys.map((key) => <div key={key} className="rounded-md bg-muted/40 p-2"><dt className="text-[11px] text-muted-foreground">{t(`daily_report_metric_${key}`)}</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{Number(metrics[key] ?? 0).toLocaleString()}</dd></div>)}
    </dl>
    {(["summary", "difficulties", "needs", "handover"] as const).map((field) => report[field] ? <section key={field}><h3 className="text-xs font-semibold">{t(`daily_report_${field}`)}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{report[field]}</p></section> : null)}
    {canManage && item.orderCorrections?.length ? <section data-testid="daily-report-order-corrections"><h3 className="text-xs font-semibold">{t("daily_report_order_modifications")}</h3><div className="mt-2 space-y-3">{item.orderCorrections.map((entry: any) => {
      const before = entry.beforeSnapshot || {}; const after = entry.afterSnapshot || {};
      const beforeOrder = before.order || {}; const afterOrder = after.order || {};
      return <div key={entry.id} className="rounded-md border p-3 text-xs"><div className="flex items-center justify-between gap-2"><strong>#{entry.orderId}</strong><span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span></div><p className="mt-2"><strong>{t("correction_reason")}:</strong> {entry.reason}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded bg-muted/40 p-2"><strong>{t("daily_report_original_order")}</strong><p>{t("total")}: {Number(beforeOrder.total_amount || 0).toLocaleString()}</p><p>{t("discount")}: {Number(beforeOrder.discount_amount || beforeOrder.discount || 0).toLocaleString()}</p><p>{t("services")}: {(before.items || []).length} · {t("garments")}: {(before.garments || []).length}</p></div><div className="rounded bg-primary/5 p-2"><strong>{t("daily_report_corrected_order")}</strong><p>{t("total")}: {Number(afterOrder.total_amount || 0).toLocaleString()}</p><p>{t("discount")}: {Number(afterOrder.discount_amount || afterOrder.discount || 0).toLocaleString()}</p><p>{t("services")}: {(after.items || []).length} · {t("garments")}: {(after.garments || []).length}</p></div></div></div>;
    })}</div></section> : null}
    {item.comments?.length ? <section><h3 className="text-xs font-semibold">{t("daily_report_comments")}</h3><ul className="mt-2 space-y-2">{item.comments.map((entry: any) => <li key={entry.id} className="rounded-md border p-2 text-sm">{entry.comment}</li>)}</ul></section> : null}
    <div className="flex flex-wrap gap-2">{report.status === "draft" && <Button size="sm" variant="outline" onClick={() => onEdit(report)}>{t("edit")}</Button>}{canManage && report.status === "submitted" && <Button size="sm" variant="outline" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>{t("daily_report_acknowledge")}</Button>}</div>
    {report.status !== "draft" && <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (comment.trim().length >= 2) addComment.mutate(); }}><div className="min-w-0 flex-1"><Label htmlFor={`daily-report-comment-${report.id}`} className="sr-only">{t("daily_report_comment")}</Label><Input id={`daily-report-comment-${report.id}`} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t("daily_report_comment")} /></div><Button type="submit" size="sm" disabled={comment.trim().length < 2 || addComment.isPending}>{t("send")}</Button></form>}
  </CardContent></Card>;
}
