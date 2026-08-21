import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Props = { report: any; onClose: () => void };

export function DailySiteReportForm({ report, onClose }: Props) {
  const { t } = useTranslation(); const { toast } = useToast(); const queryClient = useQueryClient();
  const [content, setContent] = useState({ summary: report.summary ?? "", difficulties: report.difficulties ?? "", needs: report.needs ?? "", handover: report.handover ?? "" });
  const save = useMutation({ mutationFn: async (submit: boolean) => {
    const saved = await fetch(`/api/daily-site-reports/${report.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
    if (!saved.ok) throw new Error(await saved.text());
    if (!submit) return saved.json();
    const submitted = await fetch(`/api/daily-site-reports/${report.id}/submit`, { method: "POST", credentials: "include" });
    if (!submitted.ok) throw new Error(await submitted.text()); return submitted.json();
  }, onSuccess: (_, submitted) => { queryClient.invalidateQueries({ queryKey: ["/api/daily-site-reports"] }); toast({ title: t(submitted ? "daily_report_submitted" : "daily_report_saved") }); onClose(); }, onError: () => toast({ title: t("daily_report_save_failed"), variant: "destructive" }) });
  const update = (field: keyof typeof content, value: string) => setContent((current) => ({ ...current, [field]: value }));
  const submitReport = () => { if (window.confirm(t("daily_report_submit_confirm"))) save.mutate(true); };

  return <Card><CardHeader><CardTitle className="text-base">{t("daily_report_edit_title", { date: report.reportDate })}</CardTitle><p className="text-xs text-muted-foreground">{t("daily_report_optional")}</p></CardHeader><CardContent>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(false); }}>
      {(["summary", "difficulties", "needs", "handover"] as const).map((field) => <div key={field} className="space-y-1.5">
        <Label htmlFor={`report-${field}`}>{t(`daily_report_${field}`)}</Label>
        <Textarea id={`report-${field}`} value={content[field]} onChange={(event) => update(field, event.target.value)} maxLength={4000} rows={3} aria-describedby={`report-${field}-help`} />
        <p id={`report-${field}-help`} className="text-xs text-muted-foreground">{t("daily_report_field_optional")}</p>
      </div>)}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>{t("cancel")}</Button>
        <Button type="submit" variant="outline" disabled={save.isPending}>{t("daily_report_save_draft")}</Button>
        <Button type="button" onClick={submitReport} disabled={save.isPending}>{t("daily_report_submit")}</Button>
      </div>
    </form>
  </CardContent></Card>;
}
