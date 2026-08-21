import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const REASONS = ["poor_washing", "poor_ironing", "poor_packaging", "persistent_stain", "damage", "wrong_item", "other"];
const DECISIONS = ["rewash", "reiron", "repackage", "quality_check", "credit", "refund", "reject"];
const NEXT_STATUS: Record<string, string> = { approved: "in_rework", in_rework: "quality_check", quality_check: "resolved" };

type EvidenceImage = { mimeType: string; dataUrl: string };

async function toEvidenceImage(file: File): Promise<EvidenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ mimeType: file.type, dataUrl: String(reader.result || "") });
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

function ReturnCaseCard({ row, isManager, invalidate }: { row: any; isManager: boolean; invalidate: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [decision, setDecision] = useState("rewash");
  const [notes, setNotes] = useState("");
  const status = row.returnCase.status;
  const nextStatus = NEXT_STATUS[status];
  const mutate = useMutation({
    mutationFn: async ({ endpoint, body }: { endpoint: string; body: any }) => {
      const response = await fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || t("customer_return_update_failed"));
      return result;
    },
    onSuccess: () => { setNotes(""); invalidate(); toast({ title: t("customer_return_updated") }); },
    onError: (error: Error) => toast({ title: t("error"), description: error.message, variant: "destructive" }),
  });
  return (
    <article className="rounded-lg border p-4 space-y-3" data-testid={`customer-return-${row.returnCase.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{row.garment.quantity}× {row.garment.itemName}{row.garment.color ? ` · ${row.garment.color}` : ""}</h3>
          <p className="text-sm text-muted-foreground">{t(`customer_return_reason_${row.returnCase.complaintReason}`)}</p>
        </div>
        <Badge variant="outline">{t(`customer_return_status_${status}`)}</Badge>
      </div>
      <p className="text-sm whitespace-pre-wrap">{row.returnCase.customerComment}</p>
      <p className="text-xs text-muted-foreground">{new Date(row.returnCase.returnedAt).toLocaleString()}</p>
      {row.attachments?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {row.attachments.map((attachment: any, index: number) => (
            <img key={attachment.id} src={attachment.dataUrl} alt={t("return_evidence_alt", { index: index + 1 })} className="h-20 w-20 rounded border object-cover" />
          ))}
        </div>
      )}
      {row.returnCase.decision && <p className="text-sm"><strong>{t("customer_return_decision")}:</strong> {t(`customer_return_decision_${row.returnCase.decision}`)}{row.returnCase.decisionNotes ? ` · ${row.returnCase.decisionNotes}` : ""}</p>}
      {isManager && status === "pending_review" && (
        <fieldset className="space-y-3 rounded-md bg-muted/30 p-3">
          <legend className="px-1 text-sm font-semibold">{t("customer_return_decision")}</legend>
          <div className="space-y-1.5">
            <Label id={`decision-label-${row.returnCase.id}`}>{t("customer_return_action")}</Label>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger aria-labelledby={`decision-label-${row.returnCase.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>{DECISIONS.map((value) => <SelectItem key={value} value={value}>{t(`customer_return_decision_${value}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`decision-notes-${row.returnCase.id}`}>{t("customer_return_decision_notes")}</Label>
            <Textarea id={`decision-notes-${row.returnCase.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          {["credit", "refund"].includes(decision) && <p className="text-xs text-amber-700 dark:text-amber-300">{t("customer_return_financial_notice")}</p>}
          <Button type="button" onClick={() => mutate.mutate({ endpoint: `/api/garment-returns/${row.returnCase.id}/decision`, body: { decision, notes } })} disabled={mutate.isPending}>
            {mutate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{t("customer_return_confirm_decision")}
          </Button>
        </fieldset>
      )}
      {isManager && nextStatus && (
        <fieldset className="space-y-3 rounded-md bg-muted/30 p-3">
          <legend className="px-1 text-sm font-semibold">{t("customer_return_next_step")}</legend>
          <div className="space-y-1.5">
            <Label htmlFor={`transition-notes-${row.returnCase.id}`}>{t("customer_return_transition_notes")}</Label>
            <Textarea id={`transition-notes-${row.returnCase.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} required />
          </div>
          <Button type="button" onClick={() => mutate.mutate({ endpoint: `/api/garment-returns/${row.returnCase.id}/transition`, body: { toStatus: nextStatus, notes } })} disabled={mutate.isPending || notes.trim().length < 2}>
            <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />{t(`customer_return_move_${nextStatus}`)}
          </Button>
        </fieldset>
      )}
    </article>
  );
}

export function PostDeliveryReturnPanel({ orderId, garments, isManager }: { orderId: number; garments: any[]; isManager: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [reason, setReason] = useState("poor_washing");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<EvidenceImage[]>([]);
  const key = ["garment-returns", orderId];
  const query = useQuery<any[]>({
    queryKey: key,
    queryFn: async () => {
      const response = await fetch(`/api/orders/${orderId}/garment-returns`, { credentials: "include" });
      if (!response.ok) throw new Error(t("customer_returns_load_failed"));
      return response.json();
    },
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  const activeGarmentIds = new Set((query.data || []).filter((row) => !["rejected", "resolved"].includes(row.returnCase.status)).map((row) => row.returnCase.garmentItemId));
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/orders/${orderId}/garment-returns`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garmentItemIds: selected, complaintReason: reason, customerComment: comment, images }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || t("customer_return_create_failed"));
      return result;
    },
    onSuccess: () => {
      setSelected([]); setComment(""); setImages([]); setShowForm(false); invalidate();
      toast({ title: t("customer_return_created") });
    },
    onError: (error: Error) => toast({ title: t("error"), description: error.message, variant: "destructive" }),
  });
  const handleImages = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    if (list.length > 3 || list.some((file) => file.size > 500 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      toast({ title: t("customer_return_image_error"), variant: "destructive" }); return;
    }
    setImages(await Promise.all(list.map(toEvidenceImage)));
  };
  return (
    <Card data-testid="post-delivery-return-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base"><RotateCcw className="h-4 w-4" aria-hidden="true" />{t("customer_return_after_delivery")}</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((value) => !value)}>{showForm ? t("cancel") : t("customer_return_register")}</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="space-y-4 rounded-lg border p-4">
            <fieldset className="space-y-2">
              <legend className="font-semibold">{t("customer_return_select_articles")}</legend>
              {garments.map((garment) => {
                const disabled = activeGarmentIds.has(garment.id);
                return <label key={garment.id} className="flex min-h-11 items-center gap-3 rounded-md border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                  <input type="checkbox" className="h-4 w-4" disabled={disabled} checked={selected.includes(garment.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, garment.id] : current.filter((id) => id !== garment.id))} />
                  <span>{garment.quantity}× {garment.itemName}{garment.color ? ` · ${garment.color}` : ""}{disabled ? ` — ${t("customer_return_already_open")}` : ""}</span>
                </label>;
              })}
            </fieldset>
            <div className="space-y-1.5">
              <Label id="customer-return-reason-label">{t("customer_return_reason")}</Label>
              <Select value={reason} onValueChange={setReason}><SelectTrigger aria-labelledby="customer-return-reason-label"><SelectValue /></SelectTrigger><SelectContent>{REASONS.map((value) => <SelectItem key={value} value={value}>{t(`customer_return_reason_${value}`)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-return-comment">{t("customer_return_comment")}</Label>
              <Textarea id="customer-return-comment" aria-describedby="customer-return-comment-help" required minLength={3} value={comment} onChange={(event) => setComment(event.target.value)} />
              <p id="customer-return-comment-help" className="text-xs text-muted-foreground">{t("customer_return_comment_help")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-return-images">{t("customer_return_images")}</Label>
              <Input id="customer-return-images" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleImages(event.target.files)} />
              <p className="text-xs text-muted-foreground"><Camera className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{t("customer_return_images_help")}</p>
            </div>
            <Button type="submit" disabled={selected.length === 0 || comment.trim().length < 3 || mutation.isPending}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{t("customer_return_submit")}</Button>
          </form>
        )}
        {query.isLoading && <p className="text-sm text-muted-foreground" role="status">{t("loading")}</p>}
        {query.isError && <p className="text-sm text-destructive" role="alert">{t("customer_returns_load_failed")}</p>}
        {!query.isLoading && !query.data?.length && <p className="text-sm text-muted-foreground">{t("customer_returns_empty")}</p>}
        <div className="space-y-3">{query.data?.map((row) => <ReturnCaseCard key={row.returnCase.id} row={row} isManager={isManager} invalidate={invalidate} />)}</div>
      </CardContent>
    </Card>
  );
}
