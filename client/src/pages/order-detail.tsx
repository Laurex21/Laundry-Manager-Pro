import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useOrder, useUpdateOrderStatus } from "@/hooks/use-orders";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft, CheckCircle2, Clock,
  AlertTriangle, RotateCcw, Download, Printer, XCircle, CalendarCheck, MessageCircle
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
import { format } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { generateDepositReceipt, generateThermalDepositReceipt } from "@/lib/receipt";
import { DEFAULT_SETTINGS } from "@/lib/receipt-settings";
import { orderDisplayId } from "@/lib/order-display";
import { formatBusinessDateTime } from "@/lib/date-time";
import { PRODUCTION_STAGES, isMachineStage, normalizeProductionStatus } from "@shared/production-workflow";

const PIPELINE_STAGES = PRODUCTION_STAGES;

const dateLocaleFor = (language: string) => {
  if (language.startsWith("fr")) return fr;
  if (language.startsWith("pt")) return pt;
  return enUS;
};

function getStageIndex(status: string): number {
  const normalizedStatus = normalizeProductionStatus(status);
  const idx = PIPELINE_STAGES.findIndex(s => s.key === normalizedStatus);
  return idx >= 0 ? idx : 0;
}

function normalizeWhatsAppPhone(phone?: string | null): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("237")) return digits;
  if (digits.startsWith("6")) return `237${digits}`;
  return digits;
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
  const { data: machines } = useQuery<any[]>({ queryKey: ["/api/machines"] });
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
  const [stageMachineId, setStageMachineId] = useState("");
  const [stageWeightKg, setStageWeightKg] = useState("");
  const [stageDurationMinutes, setStageDurationMinutes] = useState("");
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
  const nextPipelineStage = PIPELINE_STAGES[currentStageIndex + 1];
  const activeMachines = machines?.filter((machine: any) => machine.status !== "inactive") ?? [];
  const shouldShowMachineAssignment = !!nextPipelineStage && isMachineStage(nextPipelineStage.key) && activeMachines.length > 0;
  const hasReturnedItems = order.garmentItems?.some((g: any) => g.returnedForTreatment && !g.resolvedAt);
  const totalServicePieces = (order.items || []).reduce((sum: number, item: any) => {
    return sum + Math.max(0, Number(item.quantity) || 0);
  }, 0);
  const totalRegisteredGarments = (order.garmentItems || []).reduce((sum: number, garment: any) => {
    return sum + Math.max(0, Number(garment.quantity) || 0);
  }, 0);
  const totalPaid = (order.payments || []).reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
  const balanceDue = Math.max(0, Number(order.totalAmount) - totalPaid);
  const readyWhatsAppPhone = normalizeWhatsAppPhone(order.customer?.phone);
  const canShowCustomerNotification = !["cancelled", "canceled", "cancellation_requested"].includes(order.status);
  const canNotifyCustomer = canShowCustomerNotification && readyWhatsAppPhone.length >= 8;

  function handleAdvanceStatus() {
    if (!nextPipelineStage) return;
    updateStatus({
      id: orderId,
      status: nextPipelineStage.key,
      machineId: stageMachineId ? Number(stageMachineId) : undefined,
      weightProcessed: stageWeightKg || undefined,
      cycleDurationMinutes: stageDurationMinutes ? Number(stageDurationMinutes) : undefined,
    });
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

  async function handleDownloadReceipt() {
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
      receiptLanguage: settings?.receiptLanguage || i18n.language,
    };
    await generateDepositReceipt(order, symbol, mergedSettings, "download");
  }

  function handlePrintThermalReceipt() {
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
      receiptLanguage: settings?.receiptLanguage || i18n.language,
    };
    generateThermalDepositReceipt(order, symbol, mergedSettings);
  }

  function buildCustomerWhatsAppMessage(): string {
    const firstName = String(order.customer?.name || "").trim().split(/\s+/)[0] || t("customer").toLowerCase();
    const displayId = orderDisplayId(order);
    const businessName = settings?.businessName || "Xpress Pro";
    const total = Number(order.totalAmount) || 0;
    const normalizedStatus = normalizeProductionStatus(order.status);
    const stageLabel = t(`stage_${normalizedStatus}`, String(normalizedStatus));
    const paidText = `${symbol}${totalPaid.toFixed(2)}`;
    const totalText = `${symbol}${total.toFixed(2)}`;
    const balanceText = balanceDue === 0 ? t("fully_paid_label") : `${symbol}${balanceDue.toFixed(2)}`;

    if (i18n.language.startsWith("fr")) {
      const statusLine = normalizedStatus === "ready"
        ? `Votre commande ${businessName} #${displayId} est prête à récupérer.`
        : normalizedStatus === "delivered"
          ? `Votre commande ${businessName} #${displayId} a été livrée.`
          : `Votre commande ${businessName} #${displayId} est actuellement à l'étape : ${stageLabel}.`;
      return [
        `Bonjour ${firstName},`,
        "",
        statusLine,
        `État facture : total ${totalText}, payé ${paidText}, solde ${balanceText}.`,
        "Votre reçu/facture est joint à ce message.",
        "",
        "Merci.",
      ].join("\n");
    }

    if (i18n.language.startsWith("pt")) {
      const statusLine = normalizedStatus === "ready"
        ? `A sua encomenda ${businessName} #${displayId} está pronta para recolha.`
        : normalizedStatus === "delivered"
          ? `A sua encomenda ${businessName} #${displayId} foi entregue.`
          : `A sua encomenda ${businessName} #${displayId} está atualmente na etapa: ${stageLabel}.`;
      return [
        `Olá ${firstName},`,
        "",
        statusLine,
        `Estado da fatura: total ${totalText}, pago ${paidText}, saldo ${balanceText}.`,
        "O recibo/fatura está anexado a esta mensagem.",
        "",
        "Obrigado.",
      ].join("\n");
    }

    const statusLine = normalizedStatus === "ready"
      ? `Your ${businessName} order #${displayId} is ready for pickup.`
      : normalizedStatus === "delivered"
        ? `Your ${businessName} order #${displayId} has been delivered.`
        : `Your ${businessName} order #${displayId} is currently at this stage: ${stageLabel}.`;
    return [
      `Hello ${firstName},`,
      "",
      statusLine,
      `Invoice status: total ${totalText}, paid ${paidText}, balance ${balanceText}.`,
      "Your receipt/invoice is attached to this message.",
      "",
      "Thank you.",
    ].join("\n");
  }

  async function handleNotifyCustomer() {
    if (!readyWhatsAppPhone) {
      toast({ title: t("phone_number"), description: t("customer_phone_missing", "Customer phone number is missing."), variant: "destructive" });
      return;
    }

    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
      receiptLanguage: settings?.receiptLanguage || i18n.language,
    };
    await generateDepositReceipt(order, symbol, mergedSettings, "download");

    const whatsappUrl = `https://wa.me/${readyWhatsAppPhone}?text=${encodeURIComponent(buildCustomerWhatsAppMessage())}`;
    const opened = window.open(whatsappUrl, "_blank");
    if (opened) opened.opener = null;
    if (!opened) {
      toast({ title: "WhatsApp", description: t("popup_blocked", "Allow popups to open WhatsApp.") });
    }
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
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: t("mark_as_delivered"), description: t("order_delivered_on", { date: formatBusinessDateTime(new Date()) }) });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/:id", orderId] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        setDeliverDialogOpen(false);
      }
    } catch { toast({ title: t("error"), variant: "destructive" }); }
  }

  return (
    <div className="space-y-6 page-fade-in">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="icon" data-testid="button-back-orders">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold">{t("order_number", { id: orderDisplayId(order) })}</h1>
          <p className="text-muted-foreground text-sm">
            {order.customer?.name} &bull; {order.entryDate ? formatLocalDate(order.entryDate, "MMM d, yyyy") : t("not_available_short")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={handleDownloadReceipt} data-testid="button-download-deposit-receipt">
            <Download className="w-4 h-4 mr-2" /> {t("download_receipt")}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintThermalReceipt} data-testid="button-print-thermal-receipt">
            <Printer className="w-4 h-4 mr-2" /> {t("print_thermal_receipt")}
          </Button>
          {canShowCustomerNotification && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNotifyCustomer}
              disabled={!canNotifyCustomer}
              title={!canNotifyCustomer ? t("customer_phone_missing", "Customer phone number is missing.") : undefined}
              data-testid="button-notify-customer-whatsapp"
            >
              <MessageCircle className="w-4 h-4 mr-2" /> {t("notify_customer", "Notifier Client")}
            </Button>
          )}
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
          <span>{t("delivered_at")}: <strong>{formatBusinessDateTime(order.deliveredAt)}</strong></span>
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
                <Button size="sm" onClick={() => setDeliverDialogOpen(true)} data-testid="button-mark-delivered">
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
          {shouldShowMachineAssignment && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-3 rounded-lg border bg-muted/20 p-3" data-testid="stage-machine-assignment">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="stage-machine-select">{t("machine_name")}</label>
                <Select value={stageMachineId} onValueChange={setStageMachineId}>
                  <SelectTrigger id="stage-machine-select" className="h-9" data-testid="select-stage-machine">
                    <SelectValue placeholder={t("select_machine", "Select machine")} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMachines.map((machine: any) => (
                      <SelectItem key={machine.id} value={String(machine.id)}>
                        {machine.name} ({machine.capacityKg} kg)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="stage-weight-kg">{t("weight_kg", "Weight (kg)")}</label>
                <Input
                  id="stage-weight-kg"
                  type="number"
                  min="0"
                  step="0.01"
                  value={stageWeightKg}
                  onChange={(event) => setStageWeightKg(event.target.value)}
                  data-testid="input-stage-weight"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="stage-duration-minutes">{t("cycle_minutes", "Cycle min")}</label>
                <Input
                  id="stage-duration-minutes"
                  type="number"
                  min="0"
                  value={stageDurationMinutes}
                  onChange={(event) => setStageDurationMinutes(event.target.value)}
                  data-testid="input-stage-duration"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">{t("services_card_title")}</CardTitle>
              <div className="rounded-md border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground" data-testid="text-order-total-service-pieces">
                {t("total_pieces", "Total pieces")}: <span className="font-mono text-foreground">{totalServicePieces}</span>
              </div>
            </div>
          </CardHeader>
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {t("garment_checklist")}
                {hasReturnedItems && <Badge variant="outline" className="border-orange-300 text-orange-600">{t("returns_pending")}</Badge>}
              </CardTitle>
              <div className="rounded-md border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground" data-testid="text-order-total-registered-garments">
                {t("total_registered_items", "Total registered items")}: <span className="font-mono text-foreground">{totalRegisteredGarments}</span>
              </div>
            </div>
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
                      <span>{g.quantity}x {g.itemName}</span>
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
                  <span className="text-muted-foreground">{entry.changedAt ? formatBusinessDateTime(entry.changedAt) : ""}</span>
                  {entry.notes && <span className="text-muted-foreground italic">- {entry.notes}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(() => {
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
              <div className={`flex justify-between text-base font-bold border-t pt-2 ${balanceDue === 0 ? "text-green-600" : "text-destructive"}`}>
                <span>{t("balance_due")}</span>
                <span className="font-mono">{balanceDue === 0 ? `✓ ${t("fully_paid_label")}` : `${symbol}${balanceDue.toFixed(2)}`}</span>
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
            <p className="text-sm text-muted-foreground">La livraison sera enregistrée automatiquement avec l'heure actuelle du serveur.</p>

            {order.pickupDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <CalendarCheck className="w-4 h-4 flex-shrink-0" />
                <span>{t("expected_by")}: <strong>{formatBusinessDateTime(order.pickupDate)}</strong></span>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeliverDialogOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleMarkDelivered} data-testid="button-confirm-deliver">
                <CalendarCheck className="w-4 h-4 mr-1" /> {t("confirm_delivery")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
