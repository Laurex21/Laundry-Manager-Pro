import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Copy, Loader2, Pencil, RefreshCw, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Unable to complete order correction");
  return body;
}

export function OrderCorrectionActions({ order, isManager }: { order: any; isManager: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyReason, setCopyReason] = useState("");

  const {
    data: eligibility,
    error: eligibilityError,
    isError: eligibilityIsError,
    isLoading: eligibilityIsLoading,
    refetch: refetchEligibility,
  } = useQuery<any>({
    queryKey: ["/api/orders", order.id, "correction-eligibility"],
    queryFn: async () => readJson(await fetch(`/api/orders/${order.id}/correction-eligibility`, { credentials: "include" })),
    enabled: isManager,
    retry: false,
  });

  const copyMutation = useMutation({
    mutationFn: async () => readJson(await fetch(`/api/orders/${order.id}/corrected-copy`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: copyReason.trim() }),
    })),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", order.id] });
      setCopyOpen(false);
      toast({ title: t("corrected_order_created") });
      navigate(`/orders/${result.orderId}`);
    },
    onError: (error: Error) => toast({ title: t("order_correction_failed"), description: error.message, variant: "destructive" }),
  });

  if (!isManager) {
    return (
      <p className="max-w-md text-xs text-muted-foreground" role="note" data-testid="order-correction-role-restricted">
        <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />
        {t("order_correction_manager_only")}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" data-testid="order-correction-actions">
        {eligibilityIsLoading && (
          <p className="flex items-center text-xs text-muted-foreground" role="status" data-testid="order-correction-loading">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            {t("checking_order_correction")}
          </p>
        )}
        {eligibilityIsError && (
          <div className="flex max-w-xl flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive" role="alert" data-testid="order-correction-error">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("order_correction_check_failed", { message: eligibilityError instanceof Error ? eligibilityError.message : t("unknown_error") })}</span>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => refetchEligibility()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              {t("retry")}
            </Button>
          </div>
        )}
        {eligibility?.canEdit && (
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/orders?correct=${order.id}`)} data-testid="button-correct-order">
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("correct_order")}
          </Button>
        )}
        {!eligibility?.canEdit && eligibility?.canCreateCorrectedCopy && (
          <Button type="button" variant="outline" size="sm" onClick={() => { setCopyReason(""); setCopyOpen(true); }} data-testid="button-create-corrected-copy">
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("create_corrected_order")}
          </Button>
        )}
        {eligibility?.reason === "financial_impact" && (
          <p className="max-w-md text-xs text-muted-foreground" role="note">
            <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {t("paid_order_correction_locked")}
          </p>
        )}
      </div>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("create_corrected_order")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("corrected_copy_explanation")}</p>
            <div className="space-y-2">
              <Label htmlFor="corrected-copy-reason">{t("correction_reason")}</Label>
              <Textarea id="corrected-copy-reason" value={copyReason} onChange={(event) => setCopyReason(event.target.value)} minLength={5} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCopyOpen(false)}>{t("cancel")}</Button>
            <Button type="button" onClick={() => copyMutation.mutate()} disabled={copyReason.trim().length < 5 || copyMutation.isPending}>
              {copyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("create_corrected_order")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
