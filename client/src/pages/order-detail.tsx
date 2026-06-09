import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useOrder, useUpdateOrderStatus } from "@/hooks/use-orders";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft, CheckCircle2, Clock, Droplets, Wind, Shirt, Sparkles, Package, Truck,
  AlertTriangle, RotateCcw, Download, XCircle, CalendarCheck, Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { generateDepositReceipt, printDepositReceipt } from "@/lib/receipt";
import { DEFAULT_SETTINGS } from "@/lib/receipt-settings";

const PIPELINE_STAGES = [
  { key: "received", icon: Package, color: "text-yellow-600" },
  { key: "washing", icon: Droplets, color: "text-blue-600" },
  { key: "stain_treatment", icon: Sparkles, color: "text-amber-600" },
  { key: "drying", icon: Wind, color: "text-cyan-600" },
  { key: "ironing", icon: Shirt, color: "text-violet-600" },
  { key: "ready", icon: CheckCircle2, color: "text-indigo-600" },
  { key: "delivered", icon: Truck, color: "text-green-600" },
];

const dateLocaleFor = (language: string) => {
  if (language.startsWith("fr")) return fr;
  if (language.startsWith("pt")) return pt;
  return enUS;
};

function getStageIndex(status: string): number {
  const idx = PIPELINE_STAGES.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const orderId = Number(params?.id);
  const { data: order, isLoading } = useOrder(orderId);
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { toast } = useToast();
  const { data: settings } = useQuery<any>({ queryKey: ["/api/settings"] });
  const { isOwner, userRole } = useAuth();
  const isManager = userRole === "manager" || isOwner;

  const [returnGarmentId, setReturnGarmentId] = useState<number | null>(null);
  const [returnStage, setReturnStage] = useState("washing");
  const [returnNotes, setReturnNotes] = useState("");

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
  const [deliverDate, setDeliverDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnedDeliveryConfirmOpen, setReturnedDeliveryConfirmOpen] = useState(false);
  const formatLocalDate = (date: Date | string, pattern: string) =>
    format(new Date(date), pattern, { locale: dateLocaleFor(i18n.language) });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">{t("loading_order")}</div>;
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground mb-4">{t("order_not_found")}</p>
        <Link href="/orders"><Button variant="outline">{t("back_to_orders")}</Button></Link>
      </div>
    );
  }

  const currentStageIndex = getStageIndex(order.status);
  const hasReturnedItems = order.garmentItems?.some((g: any) => g.returnedForTreatment && !g.resolvedAt);

  function handleAdvanceStatus() {
    const nextStage = PIPELINE_STAGES[currentStageIndex + 1];
    if (!nextStage) return;
    updateStatus({ id: orderId, status: nextStage.key });
  }

  function handleSetStatus(status: string) {
    updateStatus({ id: orderId, status });
  }

  async function handleMarkReturned() {
    if (!returnGarmentId) return;
    try {
      const res = await fetch(`/api/garment-items/${returnGarmentId}/return`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnStage, returnNotes }),
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: t("garment_flagged"), description: t("garment_flagged_desc") });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", orderId] });
        setReturnGarmentId(null);
        setReturnNotes("");
      }
    } catch {
      toast({ title: t("error"), description: t("failed_flag_garment"), variant: "destructive" });
    }
  }

  async function handleResolveReturn(garmentId: number) {
    try {
      const res = await fetch(`/api/garment-items/${garmentId}/resolve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: t("resolved"), description: t("garment_return_resolved") });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", orderId] });
      }
    } catch {
      toast({ title: t("error"), description: t("failed_resolve"), variant: "destructive" });
    }
  }

  function handleDownloadReceipt() {
    const mergedSettings = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    receiptLanguage: settings?.receiptLanguage || i18n.language,
    };
    generateDepositReceipt(order, symbol, mergedSettings);
  }

  function handlePrintReceipt(size: "57mm" | "80mm") {
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
      receiptLanguage: settings?.receiptLanguage || i18n.language,
    };
    printDepositReceipt(order, symbol, mergedSettings, size);
  }

  async function handleRequestCancellation() {
    if (!cancelReason.trim()) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/request-cancellation`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }), credentials: "include",
      });
      if (res.ok) {
        toast({ title: t("cancellation_requested"), description: t("cancellation_request_sent") });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", orderId] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        setCancelDialogOpen(false); setCancelReason("");
      }
    } catch { toast({ title: t("error"), variant: "destructive" }); }
  }

  async function handleApproveCancellation() {
    try {
      const res = await fetch(`/api/orders/${orderId}/approve-cancellation`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      });
      if (res.ok) {
        toast({ title: t("approve_cancellation"), description: t("order_cancelled_desc") });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", orderId] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      }
    } catch { toast({ title: t("error"), variant: "destructive" }); }
  }

  async function handleRejectCancellation() {
    try {
      const res = await fetch(`/api/orders/${orderId}/reject-cancellation`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectionNote }), credentials: "include",
      });
      if (res.ok) {
        toast({ title: t("reject_cancellation"), description: t("cancellation_rejected_desc") });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", orderId] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        setRejectDialogOpen(false); setRejectionNote("");
      }
    } catch { toast({ title: t("error"), variant: "destructive" }); }
  }

  async function handleMarkDelivered() {
    try {
      const res = await fetch(`/api/orders/${orderId}/deliver`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveredAt: deliverDate }), credentials: "include",
      });
      if (res.ok) {
        toast({ title: t("mark_as_delivered"), description: t("order_delivered_on", { date: deliverDate }) });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", orderId] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        setDeliverDialogOpen(false);
      }
    } catch { toast({ title: t("error"), variant: "destructive" }); }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="icon" data-testid="button-back-orders">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold">{t("order_number", { id: order.id })}</h1>
          <p className="text-muted-foreground text-sm">
            {order.customer?.name} &bull; {order.entryDate ? formatLocalDate(order.entryDate, "MMM d, yyyy") : t("not_available_short")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadReceipt} data-testid="button-download-deposit-receipt">
            <Download className="w-4 h-4 mr-2" /> {t("receipt")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-print-receipt">
                <Printer className="w-4 h-4 mr-2" /> {t("print")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlePrintReceipt("57mm")}>{t("print_size_57")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrintReceipt("80mm")}>{t("print_size_80")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <StatusBadge status={order.status} />
          <StatusBadge status={order.paymentStatus} />
        </div>
      </div>

      {order.status === "cancellation_requested" && (
        <Card className="border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/10" data-testid="cancellation-requested-alert">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <p className="font-semibold text-red-800 dark:text-red-300">{t("cancellation_requested")}</p>
              {order.cancellationReason && <p className="text-sm text-red-700 dark:text-red-400">{t("cancellation_reason")}: {order.cancellationReason}</p>}
            </div>
            {isManager && (
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleApproveCancellation}>{t("approve")}</Button>
                <Button size="sm" variant="outline" onClick={() => setRejectDialogOpen(true)}>{t("reject")}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {order.status === "delivered" && order.deliveredAt && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-400 text-sm">
          <CalendarCheck className="w-4 h-4 flex-shrink-0" />
          <span>{t("delivered_at")}: <strong>{formatLocalDate(order.deliveredAt, "MMM d, yyyy")}</strong></span>
        </div>
      )}

      {hasReturnedItems && (
        <Card className="border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/10" data-testid="returned-items-alert">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <div>
              <p className="font-semibold text-orange-800 dark:text-orange-300">{t("incomplete_order")}</p>
              <p className="text-sm text-orange-700 dark:text-orange-400">{t("returned_garments_alert")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden" data-testid="pipeline-stepper">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("order_pipeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, i) => {
              const isPast = i < currentStageIndex;
              const isCurrent = i === currentStageIndex;
              const Icon = stage.icon;
              return (
                <div key={stage.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                        isPast ? "bg-green-100 border-green-500 text-green-600 dark:bg-green-900/30" :
                        isCurrent ? "bg-primary/10 border-primary text-primary ring-4 ring-primary/20" :
                        "bg-muted border-border text-muted-foreground"
                      )}
                    >
                      {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium text-center leading-tight",
                      isCurrent ? "text-primary font-bold" : isPast ? "text-green-600" : "text-muted-foreground"
                    )}>
                      {t("stage_" + stage.key)}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{t("current_stage")}</span>
                    )}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className={cn(
                      "h-0.5 flex-1 min-w-[20px] mx-1",
                      i < currentStageIndex ? "bg-green-500" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
            {order.status === "cancellation_requested" && isManager ? (
              <>
                <Button size="sm" variant="destructive" onClick={handleApproveCancellation} disabled={isUpdating} data-testid="button-approve-cancellation">
                  <XCircle className="w-4 h-4 mr-1" /> {t("approve_cancellation")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejectDialogOpen(true)} data-testid="button-reject-cancellation">
                  {t("reject_cancellation")}
                </Button>
              </>
            ) : order.status === "ready" ? (
              <>
                <Button size="sm" onClick={() => hasReturnedItems ? setReturnedDeliveryConfirmOpen(true) : setDeliverDialogOpen(true)} data-testid="button-mark-delivered">
                  <CalendarCheck className="w-4 h-4 mr-1" /> {t("mark_as_delivered")}
                </Button>
              </>
            ) : order.status !== "delivered" && order.status !== "cancelled" && order.status !== "cancellation_requested" ? (
              <>
                {currentStageIndex < PIPELINE_STAGES.length - 1 && (
                  <Button size="sm" onClick={handleAdvanceStatus} disabled={isUpdating} data-testid="button-advance-status">
                    {t("advance_to", { stage: t("stage_" + PIPELINE_STAGES[currentStageIndex + 1]?.key) })}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setCancelDialogOpen(true)} data-testid="button-request-cancellation">
                  <XCircle className="w-4 h-4 mr-1" /> {t("request_cancellation")}
                </Button>
              </>
            ) : null}
            {order.status !== "delivered" && order.status !== "cancelled" && (
              <Select onValueChange={handleSetStatus}>
                <SelectTrigger className="w-[170px] h-9" data-testid="select-set-status">
                  <SelectValue placeholder={t("jump_to_stage")} />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map(s => (
                    <SelectItem key={s.key} value={s.key}>{t("stage_" + s.key)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("services_card_title")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg text-sm">
                  <div>
                    <span className="font-medium">{item.service?.name}</span>
                    <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                  </div>
                  <span className="font-mono font-semibold">{symbol}{(Number(item.priceAtOrder) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              {Number(order.discount) > 0 && (
                <div className="flex justify-between items-center p-2 text-sm text-red-600">
                  <span>{t("discount")}</span>
                  <span className="font-mono">-{symbol}{Number(order.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg font-bold">
                <span>{t("total")}</span>
                <span className="font-mono text-primary">{symbol}{Number(order.totalAmount).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {t("garment_checklist")}
              {hasReturnedItems && <Badge variant="outline" className="border-orange-300 text-orange-600">{t("returns_pending")}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order.garmentItems?.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{t("no_garment_items")}</p>
            ) : (
              <div className="space-y-2">
                {order.garmentItems?.map((g: any) => (
                  <div key={g.id} className={cn(
                    "flex items-center justify-between p-2 rounded-lg text-sm",
                    g.returnedForTreatment && !g.resolvedAt ? "bg-orange-50 dark:bg-orange-950/10 border border-orange-200" : "bg-muted/30"
                  )} data-testid={`garment-item-${g.id}`}>
                    <div className="flex items-center gap-2">
                      <span>
                        {g.quantity}x {g.itemName}
                        {g.details && <span className="block text-xs text-muted-foreground mt-0.5">{g.details}</span>}
                      </span>
                      {g.returnedForTreatment && !g.resolvedAt && (
                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">
                          <RotateCcw className="w-3 h-3 mr-1" /> {t("returned_label")} {g.returnStage}
                        </Badge>
                      )}
                      {g.resolvedAt && (
                        <Badge variant="outline" className="text-[10px] border-green-300 text-green-600">{t("resolved")}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {g.returnedForTreatment && !g.resolvedAt ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleResolveReturn(g.id)} data-testid={`button-resolve-${g.id}`}>
                          {t("resolve_return")}
                        </Button>
                      ) : !g.resolvedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-orange-600"
                          onClick={() => setReturnGarmentId(g.id)}
                          data-testid={`button-return-${g.id}`}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> {t("return_label")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {returnGarmentId && (
              <div className="mt-4 p-3 border rounded-lg bg-muted/20 space-y-3" data-testid="return-form">
                <p className="text-sm font-medium">{t("flag_for_return")}</p>
                <Select value={returnStage} onValueChange={setReturnStage}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="washing">{t("rewash")}</SelectItem>
                    <SelectItem value="stain_treatment">{t("stage_stain_treatment")}</SelectItem>
                    <SelectItem value="ironing">{t("reironing")}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={t("notes_optional")}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  data-testid="input-return-notes"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleMarkReturned} data-testid="button-confirm-return">{t("confirm_return")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setReturnGarmentId(null)}>{t("cancel")}</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {order.statusHistory && order.statusHistory.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("status_history_title")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.statusHistory.map((entry: any) => (
                <div key={entry.id} className="flex items-center gap-3 text-sm p-2 bg-muted/20 rounded">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <StatusBadge status={entry.status} />
                  <span className="text-muted-foreground">{entry.changedAt ? formatLocalDate(entry.changedAt, "MMM d, yyyy h:mm a") : ""}</span>
                  {entry.notes && <span className="text-muted-foreground italic">- {entry.notes}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(() => {
        const totalPaid = (order.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        const balance = Math.max(0, Number(order.totalAmount) - totalPaid);
        const pickupCost = Number(order.pickupCost || 0);
        const discount = Number(order.discount || 0);
        const originalSubtotal = Number(order.originalPrice || 0) || (Number(order.totalAmount) + discount - pickupCost);
        return (
          <Card className="border-primary/20 bg-primary/2">
            <CardHeader className="pb-3"><CardTitle className="text-base">{t("balance_due")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {originalSubtotal > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t("subtotal")}</span>
                  <span className="font-mono">{symbol}{originalSubtotal.toFixed(2)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t("discount")}</span>
                  <span className="font-mono text-destructive">-{symbol}{discount.toFixed(2)}</span>
                </div>
              )}
              {pickupCost > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t("transport")}</span>
                  <span className="font-mono text-blue-600">+{symbol}{pickupCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>{t("total")}</span>
                <span className="font-mono">{symbol}{Number(order.totalAmount).toFixed(2)}</span>
              </div>
              {totalPaid > 0 && (
                <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
                  <span>{t("advance_payment_made")}</span>
                  <span className="font-mono font-semibold">-{symbol}{totalPaid.toFixed(2)}</span>
                </div>
              )}
              <div className={`flex justify-between text-base font-bold border-t pt-2 ${balance === 0 ? "text-green-600" : "text-destructive"}`}>
                <span>{t("balance_due")}</span>
                <span className="font-mono">{balance === 0 ? `✓ ${t("fully_paid_label")}` : `${symbol}${balance.toFixed(2)}`}</span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("payment_history_title")}</CardTitle></CardHeader>
        <CardContent>
          {order.payments?.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t("no_payments_recorded")}</p>
          ) : (
            <div className="space-y-2">
              {order.payments?.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.method}</span>
                    {p.isAdvance && (
                      <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                        {t("advance_badge")}
                      </span>
                    )}
                    {p.reference && <span className="text-xs text-muted-foreground">{t("ref_label")} {p.reference}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-green-600">{symbol}{Number(p.amount).toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">{p.date ? formatLocalDate(p.date, "MMM d") : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("request_cancellation")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">{t("cancellation_review_note")}</p>
            <Textarea
              placeholder={t("cancellation_reason_placeholder")}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              data-testid="textarea-cancel-reason"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>{t("cancel")}</Button>
              <Button variant="destructive" onClick={handleRequestCancellation} disabled={!cancelReason.trim()} data-testid="button-submit-cancellation">
                {t("submit_request")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("reject_cancellation")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">{t("rejection_review_note")}</p>
            <Textarea
              placeholder={t("rejection_note_placeholder")}
              value={rejectionNote}
              onChange={e => setRejectionNote(e.target.value)}
              rows={3}
              data-testid="textarea-rejection-note"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleRejectCancellation} data-testid="button-submit-rejection">{t("reject_cancellation")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deliverDialogOpen} onOpenChange={setDeliverDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("mark_as_delivered")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">{t("select_actual_delivery_date")}</p>

            {order.pickupDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <CalendarCheck className="w-4 h-4 flex-shrink-0" />
                <span>{t("expected_by")}: <strong>{formatLocalDate(order.pickupDate, "MMM d, yyyy")}</strong></span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("delivered_at")}</label>
              <Input
                type="date"
                value={deliverDate}
                onChange={e => setDeliverDate(e.target.value)}
                data-testid="input-deliver-date"
              />
            </div>

            {(() => {
              if (!order.pickupDate) return null;
              const delivered = new Date(deliverDate);
              const pickup = new Date(order.pickupDate);
              delivered.setHours(0, 0, 0, 0);
              pickup.setHours(0, 0, 0, 0);
              const isOnTime = delivered <= pickup;
              return (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isOnTime ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"}`} data-testid="indicator-punctuality">
                  {isOnTime ? t("on_time") : t("late_delivery")}
                </div>
              );
            })()}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeliverDialogOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleMarkDelivered} data-testid="button-confirm-deliver">
                <CalendarCheck className="w-4 h-4 mr-1" /> {t("confirm_delivery")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={returnedDeliveryConfirmOpen} onOpenChange={setReturnedDeliveryConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              {t("returned_items_warning")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {t("returned_items_delivery_confirm")}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReturnedDeliveryConfirmOpen(false)}>{t("cancel")}</Button>
              <Button
                onClick={() => {
                  setReturnedDeliveryConfirmOpen(false);
                  setDeliverDialogOpen(true);
                }}
                data-testid="button-confirm-returned-delivery-warning"
              >
                {t("continue_delivery")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
