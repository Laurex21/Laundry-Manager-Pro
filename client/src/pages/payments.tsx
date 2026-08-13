import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrders } from "@/hooks/use-orders";
import { usePaymentsByOrder, useCreatePayment } from "@/hooks/use-payments";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { PAYMENT_METHODS, PAYMENT_REGIONS, getMethodDef } from "@/lib/payment-methods";
import { generatePaymentReceipt, generateThermalPaymentReceipt } from "@/lib/receipt";
import { DEFAULT_SETTINGS } from "@/lib/receipt-settings";
import { orderDisplayId } from "@/lib/order-display";
import { paymentDateWithRegistrationTime } from "@/lib/payment-date";
import {
  CreditCard,
  CheckCircle2,
  Download,
  Printer,
  Banknote,
  Calendar,
  ClipboardList,
  ArrowRight,
  Search,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";

function dateLocaleFor(language: string) {
  if (language.startsWith("fr")) return fr;
  if (language.startsWith("pt")) return pt;
  return enUS;
}

function todayInputDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const NON_PAYABLE_ORDER_STATUSES = new Set(["cancelled", "cancellation_requested"]);

export default function Payments() {
  const { data: allOrders, isLoading: ordersLoading } = useOrders();
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { data: settings } = useQuery<any>({ queryKey: ["/api/settings"] });

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(todayInputDate);
  const [reference, setReference] = useState("");
  const [creditToApply, setCreditToApply] = useState("0");
  const [showSurplusConfirmation, setShowSurplusConfirmation] = useState(false);
  const paymentSubmissionLock = useRef(false);
  const [successPayment, setSuccessPayment] = useState<{
    orderId: number;
    paymentId?: number;
    amount: string;
    method: string;
    date: string;
    customerName: string;
    totalAmount: string;
    newStatus: string;
    creditApplied?: string;
    creditAdded?: string;
    creditBalance?: string;
    amountReceived?: string;
    changeReturned?: string;
  } | null>(null);

  const { data: orderPayments } = usePaymentsByOrder(selectedOrderId || 0);
  const { mutate: createPayment, isPending } = useCreatePayment();

  const unpaidOrders = useMemo(() => {
    if (!allOrders) return [];
    const q = orderSearch.trim().toLowerCase();
    return allOrders
      .filter((o: any) => o.paymentStatus !== "paid" && !NON_PAYABLE_ORDER_STATUSES.has(o.status))
      .filter((o: any) => {
        if (!q) return true;
        return (
          o.id.toString().includes(q) ||
          (o.customer?.name || "").toLowerCase().includes(q) ||
          (o.customer?.phone || "").toLowerCase().includes(q)
        );
      });
  }, [allOrders, orderSearch]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId || !allOrders) return null;
    return allOrders.find((o: any) => o.id === selectedOrderId) || null;
  }, [selectedOrderId, allOrders]);
  const selectedCustomerId = (selectedOrder as any)?.customer?.id ?? (selectedOrder as any)?.customerId ?? 0;
  const { data: creditData } = useQuery<any>({
    queryKey: ["/api/customers", selectedCustomerId, "credit"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${selectedCustomerId}/credit`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load customer credit");
      return res.json();
    },
    enabled: !!selectedCustomerId,
  });

  const totalPaid = useMemo(() => {
    if (!orderPayments) return 0;
    return orderPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  }, [orderPayments]);

  const totalAmount = selectedOrder ? Number(selectedOrder.totalAmount) : 0;
  const remainingBalance = Math.max(0, totalAmount - totalPaid);
  const availableCredit = Number(creditData?.creditBalance ?? (selectedOrder as any)?.customer?.creditBalance ?? 0);
  const maxCreditApplicable = Math.min(availableCredit, remainingBalance);
  const appliedCredit = Math.min(Math.max(Number(creditToApply) || 0, 0), maxCreditApplicable);
  const remainingAfterCredit = Math.max(0, remainingBalance - appliedCredit);
  const amountReceived = Math.max(0, Number(amount) || 0);
  const surplus = Math.max(0, amountReceived - remainingAfterCredit);

  const handleSelectOrder = useCallback((orderId: number) => {
    setSelectedOrderId(orderId);
    setAmount("");
    setCreditToApply("0");
    setPaymentDate(todayInputDate());
    setSuccessPayment(null);
  }, []);

  const amountError = useMemo(() => {
    const val = Number(amount);
    if (amount && val <= 0) return t("amount_gt_zero");
    return null;
  }, [amount, t]);

  function recordPayment(disposition: "return" | "credit") {
    if (!selectedOrderId || !selectedOrder || NON_PAYABLE_ORDER_STATUSES.has(selectedOrder.status) || amountError || !paymentDate) return;
    if (amountReceived <= 0 && appliedCredit <= 0) return;
    if (paymentSubmissionLock.current || isPending) return;
    paymentSubmissionLock.current = true;

    const paidAmount = Math.min(amountReceived, remainingAfterCredit);
    const newTotalPaid = totalPaid + paidAmount + appliedCredit;
    const newStatus = newTotalPaid >= totalAmount ? "paid" : "partial";
    const idempotencyKey = `payment-${selectedOrderId}-${crypto.randomUUID()}`;

    createPayment(
      {
        orderId: selectedOrderId,
        amount: amount || "0",
        method,
        date: paymentDateWithRegistrationTime(paymentDate),
        reference: reference || undefined,
        creditToApply: appliedCredit.toFixed(2),
        surplusDisposition: disposition,
        idempotencyKey,
      },
      {
        onSuccess: (createdPayment: any) => {
          paymentSubmissionLock.current = false;
          setSuccessPayment({
            orderId: selectedOrderId,
            paymentId: createdPayment?.id,
            amount: createdPayment?.cashApplied ?? paidAmount.toFixed(2),
            method,
            date: createdPayment?.date || new Date().toISOString(),
            customerName: (selectedOrder as any)?.customer?.name || t("order_number", { id: orderDisplayId(selectedOrder as any) || selectedOrderId }),
            totalAmount: totalAmount.toFixed(2),
            newStatus,
            creditApplied: createdPayment?.creditApplied,
            creditAdded: createdPayment?.creditAdded,
            creditBalance: createdPayment?.creditBalance,
            amountReceived: createdPayment?.amountReceived,
            changeReturned: createdPayment?.changeReturned,
          });
          setAmount("");
          setCreditToApply("0");
          setPaymentDate(todayInputDate());
          setReference("");
          setSelectedOrderId(null);
        },
        onError: () => {
          paymentSubmissionLock.current = false;
          if (surplus > 0) setShowSurplusConfirmation(true);
        },
      }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (surplus > 0) {
      setShowSurplusConfirmation(true);
      return;
    }
    recordPayment("return");
  }

  const [receiptLoading, setReceiptLoading] = useState(false);

  async function handleReceipt(action: "download" | "thermal") {
    if (!successPayment) return;
    setReceiptLoading(true);
    try {
      let orderDetails: any = null;
      try {
        const res = await fetch(`/api/orders/${successPayment.orderId}`, { credentials: "include" });
        if (res.ok) orderDetails = await res.json();
      } catch {
        // proceed with available data
      }

      const items = orderDetails?.items || [];
      const garments = orderDetails?.garmentItems || [];
      const customer = orderDetails?.customer || {};
      const pickupDate = orderDetails?.pickupDate || "";
      const entryDate = orderDetails?.entryDate || successPayment.date;
      const displayOrderId = orderDisplayId(orderDetails) || successPayment.orderId;

      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...(settings || {}),
        receiptLanguage: settings?.receiptLanguage || i18n.language,
      };
      const allPayments = orderDetails?.payments || [];
      const currentPayment = successPayment.paymentId
        ? allPayments.find((p: any) => p.id === successPayment.paymentId)
        : null;
      const discount = Number(orderDetails?.discount || 0);
      const pickupCost = Number(orderDetails?.pickupCost || 0);

      const paymentReceiptData = {
        amount: successPayment.amount,
        method: successPayment.method,
        date: successPayment.date,
        newStatus: successPayment.newStatus,
        agentName: currentPayment?.collectedByEmployee?.name,
        creditApplied: successPayment.creditApplied,
        creditAdded: successPayment.creditAdded,
        creditBalance: successPayment.creditBalance,
        amountReceived: successPayment.amountReceived,
        changeReturned: successPayment.changeReturned,
      };

      if (action === "thermal") {
        generateThermalPaymentReceipt(
          displayOrderId,
          customer,
          items,
          garments,
          paymentReceiptData,
          allPayments,
          entryDate,
          discount,
          symbol,
          mergedSettings,
          pickupCost
        );
      } else {
        await generatePaymentReceipt(
          displayOrderId,
          customer,
          items,
          garments,
          paymentReceiptData,
          allPayments,
          entryDate,
          pickupDate,
          discount,
          symbol,
          mergedSettings,
          pickupCost,
          "download"
        );
      }
    } finally {
      setReceiptLoading(false);
    }
  }

  const presets = useMemo(() => {
    if (remainingAfterCredit <= 0) return [];
    return [
      { label: "25%", value: (remainingAfterCredit * 0.25).toFixed(2) },
      { label: "50%", value: (remainingAfterCredit * 0.5).toFixed(2) },
      { label: "75%", value: (remainingAfterCredit * 0.75).toFixed(2) },
      { label: t("pay_full_balance"), value: remainingAfterCredit.toFixed(2) },
    ];
  }, [remainingAfterCredit, t]);

  return (
    <div className="space-y-6 page-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold leading-tight">{t("payments")}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("payments_subtitle")}</p>
      </div>

      {successPayment && (
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg border border-green-200 dark:border-green-900/40 bg-green-50/60 dark:bg-green-950/10"
          data-testid="payment-success-card"
        >
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-green-900 dark:text-green-300 text-sm leading-snug">
              {t("payment_recorded_success")}
            </p>
            <p className="text-green-700 dark:text-green-400 text-xs mt-0.5">
              {symbol}{successPayment.amount} {t("paid_for_order")} #{successPayment.orderId} {t("via")} {successPayment.method}.{" "}
              <Badge
                variant="outline"
                className={
                  successPayment.newStatus === "paid"
                    ? "border-green-400 text-green-700 dark:border-green-700 dark:text-green-400 text-[10px] py-0"
                    : "border-yellow-400 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400 text-[10px] py-0"
                }
              >
                {successPayment.newStatus === "paid" ? t("fully_paid") : t("partially_paid")}
              </Badge>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleReceipt("download")}
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20"
              disabled={receiptLoading}
              data-testid="button-download-receipt"
            >
              <Download className="w-3.5 h-3.5" />
              {receiptLoading ? t("preparing") : t("download_receipt")}
            </Button>
            <Button
              onClick={() => handleReceipt("thermal")}
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20"
              disabled={receiptLoading}
              data-testid="button-print-thermal-receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              {receiptLoading ? t("preparing") : t("print_thermal_receipt")}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Payment form - 2/3 */}
        <div className="lg:col-span-2 border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">{t("register_payment")}</span>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-5">
            {/* Order selector - shown when no order selected */}
            {!selectedOrder && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t("select_order")}
                </label>
                <p className="text-sm text-muted-foreground">
                  {ordersLoading
                    ? t("loading_orders")
                    : unpaidOrders.length === 0
                    ? t("no_unpaid_orders")
                    : t("select_order_from_queue")}
                </p>
              </div>
            )}

            {selectedOrder && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/40 border border-border">
                <div>
                  <p className="text-sm font-semibold">
                    {t("order_number", { id: orderDisplayId(selectedOrder) })}
                    {(selectedOrder as any)?.customer?.name && (
                      <span className="font-normal text-muted-foreground"> - {(selectedOrder as any).customer.name}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("status")}: <span>{selectedOrder.paymentStatus === "partial" ? t("partial") : selectedOrder.paymentStatus === "unpaid" ? t("unpaid") : t("paid")}</span>
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  onClick={() => { setSelectedOrderId(null); setAmount(""); setCreditToApply("0"); }}
                >
                  {t("change")}
                </button>
              </div>
            )}

            {selectedOrder && (
              <>
                <div className="grid grid-cols-3 gap-px bg-border rounded-md overflow-hidden border border-border">
                  <div className="bg-background px-3 py-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("order_total")}</p>
                    <p className="font-mono font-bold text-base mt-0.5" data-testid="text-order-total">
                      {symbol}{totalAmount.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-background px-3 py-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("amount_paid")}</p>
                    <p className="font-mono font-bold text-base mt-0.5 text-green-600 dark:text-green-400" data-testid="text-amount-paid">
                      {symbol}{totalPaid.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-background px-3 py-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("remaining")}</p>
                    <p className="font-mono font-bold text-base mt-0.5 text-orange-600 dark:text-orange-400" data-testid="text-remaining-balance">
                      {symbol}{remainingBalance.toFixed(2)}
                    </p>
                  </div>
                </div>

                {availableCredit > 0 && (
                  <div
                    className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                    role="status"
                    aria-live="polite"
                    data-testid="customer-credit-panel"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-emerald-600" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{t("credit_available")}</p>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">
                            {symbol}{availableCredit.toFixed(2)} {t("on_account")}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCreditToApply(maxCreditApplicable.toFixed(2))}
                        data-testid="button-use-max-credit"
                      >
                        {t("use_all")}
                      </Button>
                    </div>
                    <div className="mt-3">
                      <label className="text-xs font-medium text-emerald-800 dark:text-emerald-300">{t("credit_to_apply")}</label>
                      <Input
                        type="number"
                        min="0"
                        max={maxCreditApplicable}
                        step="0.01"
                        value={creditToApply}
                        onChange={(event) => setCreditToApply(event.target.value)}
                        className="mt-1 bg-background"
                        data-testid="input-credit-to-apply"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("amount")}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex flex-1 rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
                      <span className="flex items-center px-3 bg-muted text-muted-foreground text-sm font-medium border-r border-input whitespace-nowrap select-none">
                        {symbol}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={remainingAfterCredit.toFixed(2)}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono flex-1 ${amountError ? "border-destructive" : ""}`}
                        data-testid="input-amount"
                      />
                    </div>
                  </div>
                  {remainingBalance > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {presets.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setAmount(p.value)}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                            amount === p.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {amountError && <p className="text-xs text-destructive">{amountError}</p>}
                </div>

                {appliedCredit > 0 && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span>{t("credit_applied")}</span><strong>-{symbol}{appliedCredit.toFixed(2)}</strong></div>
                    <div className="flex justify-between"><span>{t("remaining_to_pay")}</span><strong>{symbol}{remainingAfterCredit.toFixed(2)}</strong></div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("payment_method")}
                    </label>
                    <Select value={method} onValueChange={(v) => { setMethod(v); setReference(""); }}>
                      <SelectTrigger data-testid="select-payment-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {PAYMENT_REGIONS.map((region) => (
                          <div key={region}>
                            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {region}
                            </div>
                            {PAYMENT_METHODS.filter((m) => m.region === region).map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("payment_date")}
                    </label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                      data-testid="input-payment-date"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("payment_date_hint")}
                    </p>
                  </div>

                </div>

                {/* Reference - conditional */}
                {getMethodDef(method).requiresReference && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("transaction_reference")}
                    </label>
                    <Input
                      placeholder={t("reference_placeholder")}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      data-testid="input-reference"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("ref_from_method", { method: getMethodDef(method).label })}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending || (amountReceived <= 0 && appliedCredit <= 0) || !paymentDate || !!amountError}
                  data-testid="button-submit-payment"
                >
                  {isPending
                    ? t("saving")
                    : `${t("record_payment_of")} ${symbol}${(Math.min(amountReceived, remainingAfterCredit) + appliedCredit).toFixed(2)}`}
                </Button>

                <AlertDialog open={showSurplusConfirmation} onOpenChange={setShowSurplusConfirmation}>
                  <AlertDialogContent
                    className="w-[calc(100%_-_2rem)] max-w-xl overflow-hidden"
                    data-testid="payment-surplus-dialog"
                  >
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("overpayment_detected")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("overpayment_credit_question", {
                          surplus: `${symbol}${surplus.toFixed(2)}`,
                          customer: (selectedOrder as any)?.customer?.name || t("customer"),
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="min-w-0 rounded-md border bg-muted/40 p-3 text-sm" aria-live="polite">
                      <div className="flex justify-between gap-4">
                        <span>{t("amount_due")}</span>
                        <strong>{symbol}{remainingAfterCredit.toFixed(2)}</strong>
                      </div>
                      <div className="mt-1 flex justify-between gap-4">
                        <span>{t("amount_received")}</span>
                        <strong>{symbol}{amountReceived.toFixed(2)}</strong>
                      </div>
                      <div className="mt-1 flex justify-between gap-4 text-emerald-700 dark:text-emerald-300">
                        <span>{t("credit_to_add")}</span>
                        <strong>{symbol}{surplus.toFixed(2)}</strong>
                      </div>
                    </div>
                    <AlertDialogFooter className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 sm:space-x-0">
                      <AlertDialogCancel
                        className="mt-0 h-auto min-h-10 whitespace-normal px-3 py-2 text-center leading-tight"
                        disabled={isPending}
                        data-testid="button-correct-payment-amount"
                      >
                        {t("correct_payment_amount")}
                      </AlertDialogCancel>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-h-10 whitespace-normal px-3 py-2 text-center leading-tight"
                        disabled={isPending}
                        onClick={() => {
                          setShowSurplusConfirmation(false);
                          recordPayment("return");
                        }}
                        data-testid="button-return-surplus"
                      >
                        {t("return_change")}
                      </Button>
                      <AlertDialogAction
                        className="h-auto min-h-10 whitespace-normal px-3 py-2 text-center leading-tight"
                        disabled={isPending}
                        onClick={() => {
                          recordPayment("credit");
                        }}
                        data-testid="button-credit-surplus"
                      >
                        {t("credit_to_account")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {orderPayments && orderPayments.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("payment_history_title")}
                    </p>
                    {orderPayments.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Banknote className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{p.method}</span>
                          {p.reference && (
                            <span className="text-muted-foreground/60">
                              {t("ref_label")} {p.reference}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-medium text-green-600 dark:text-green-400">
                            {symbol}{Number(p.amount).toFixed(2)}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(p.date), "MMM d", { locale: dateLocaleFor(i18n.language) })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </form>
        </div>

        {/* Unpaid queue - 1/3 */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <ClipboardList className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">{t("unpaid_queue")}</span>
            {unpaidOrders.length > 0 && (
              <span className="ml-auto text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {unpaidOrders.length}
              </span>
            )}
          </div>
          <div className="p-3 border-b border-border bg-background">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder={t("search_order_placeholder")}
                className="h-8 pl-8 text-sm"
                data-testid="input-payment-order-search"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[480px]">
            {ordersLoading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-4 py-3 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-24 animate-pulse" />
                    <div className="h-3 bg-muted rounded w-16 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : unpaidOrders.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">{t("no_unpaid_orders")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {unpaidOrders.map((order: any) => (
                  <button
                    key={order.id}
                    type="button"
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors group ${
                      selectedOrderId === order.id
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "hover:bg-muted/40"
                    }`}
                    onClick={() => handleSelectOrder(order.id)}
                    data-testid={`order-option-${order.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        #{orderDisplayId(order)}
                        {order.customer?.name && (
                          <span className="font-normal text-muted-foreground"> - {order.customer.name}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-1.5 ${
                            order.paymentStatus === "partial"
                              ? "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400"
                              : "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                          }`}
                        >
                          {order.paymentStatus === "partial" ? t("partial") : t("unpaid")}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {symbol}{Number(order.totalAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
