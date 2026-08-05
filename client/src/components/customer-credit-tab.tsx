import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Loader2, Plus, RotateCcw, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { useToast } from "@/hooks/use-toast";

export function CustomerCreditTab({ customerId }: { customerId: number }) {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const { userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [reverseEntry, setReverseEntry] = useState<any | null>(null);
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/customers", customerId, "credit"],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/credit`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load customer credit");
      return response.json();
    },
  });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>;
  const canManageCredit = userRole === "owner" || userRole === "manager";
  const reversedDepositIds = new Set<number>((data?.history || []).map((entry: any) => Number(entry.reversal_of_id)).filter(Boolean));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <CreditMetric label={t("available_credit")} value={`${symbol}${Number(data?.creditBalance ?? 0).toFixed(2)}`} accent />
        <CreditMetric label={t("total_credited")} value={`${symbol}${Number(data?.totalCreditAdded ?? 0).toFixed(2)}`} />
        <CreditMetric label={t("total_used")} value={`${symbol}${Number(data?.totalCreditUsed ?? 0).toFixed(2)}`} />
      </div>

      <Button variant="outline" className="w-full gap-2" onClick={() => setOpen(true)} data-testid="button-add-customer-deposit">
        <Plus className="h-4 w-4" aria-hidden="true" /> {t("add_customer_deposit")}
      </Button>

      <Card>
        <CardContent className="p-0">
          <div className="border-b bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("credit_history")}
          </div>
          {!data?.history?.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t("no_credit_history")}</div>
          ) : data.history.map((entry: any) => (
            <div key={entry.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-0" data-testid={`credit-transaction-${entry.id}`}>
              <div className={`rounded-full p-2 ${entry.type === "credit" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {entry.type === "credit" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t(`credit_reason_${entry.reason}`, { defaultValue: entry.reason })}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString()} · {entry.site_name}
                  {entry.linked_order_id ? ` · #${entry.linked_order_id}` : ""}
                  {entry.created_by_name ? ` · ${entry.created_by_name}` : ""}
                  {entry.payment_method ? ` · ${entry.payment_method}` : ""}
                  {entry.reference ? ` · ${entry.reference}` : ""}
                  {entry.notes ? ` · ${entry.notes}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${entry.type === "credit" ? "text-emerald-600" : "text-amber-600"}`}>
                  {entry.type === "credit" ? "+" : "-"}{symbol}{Number(entry.amount).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">→ {symbol}{Number(entry.balance_after).toFixed(2)}</p>
                {canManageCredit && entry.type === "credit" && entry.reason === "advance_payment" && !reversedDepositIds.has(Number(entry.id)) && (
                  <Button type="button" variant="ghost" size="sm" className="mt-1 h-8 gap-1 text-xs text-destructive" onClick={() => setReverseEntry(entry)}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t("reverse_deposit")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AddCreditDialog open={open} onOpenChange={setOpen} customerId={customerId} customerName={data?.customerName ?? ""} canManageCredit={canManageCredit} />
      <ReverseDepositDialog entry={reverseEntry} onOpenChange={(open) => !open && setReverseEntry(null)} customerId={customerId} />
    </div>
  );
}

function ReverseDepositDialog({ entry, onOpenChange, customerId }: { entry: any | null; onOpenChange: (open: boolean) => void; customerId: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/credit/${entry.id}/reverse`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), idempotencyKey: `deposit-reversal-${entry.id}-${crypto.randomUUID()}` }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || t("deposit_reversal_failed"));
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "credit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/credit-summary"] });
      toast({ title: t("deposit_reversed_success") }); setReason(""); onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: t("deposit_reversal_failed"), description: error.message, variant: "destructive" }),
  });
  return <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{t("reverse_customer_deposit")}</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">{t("reverse_deposit_warning")}</p>
    <div><Label htmlFor="deposit-reversal-reason">{t("reversal_reason")}</Label><Textarea id="deposit-reversal-reason" className="mt-1" value={reason} minLength={5} maxLength={500} onChange={(event) => setReason(event.target.value)} /></div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button><Button variant="destructive" disabled={reason.trim().length < 5 || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{t("confirm_reversal")}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function CreditMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20" : ""}>
      <CardContent className="p-4 text-center">
        {accent && <Wallet className="mx-auto mb-1 h-4 w-4 text-emerald-600" />}
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-bold ${accent ? "text-emerald-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function AddCreditDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  canManageCredit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  customerName: string;
  canManageCredit: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<"manual_credit" | "compensation" | "advance_payment">("advance_payment");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/credit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reason,
          notes,
          paymentMethod: reason === "advance_payment" ? paymentMethod : undefined,
          reference: reason === "advance_payment" ? reference : undefined,
          idempotencyKey: `manual-credit-${customerId}-${crypto.randomUUID()}`,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || t("credit_add_error"));
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "credit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/credit-summary"] });
      toast({ title: t("credit_added_success") });
      setAmount("");
      setNotes("");
      setReason("advance_payment");
      setPaymentMethod("Cash");
      setReference("");
      onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: t("credit_add_error"), description: error.message, variant: "destructive" }),
  });
  const noteRequired = reason === "compensation";
  const valid = Number(amount) > 0 && (!noteRequired || notes.trim().length > 0) && (reason !== "advance_payment" || paymentMethod.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{reason === "advance_payment" ? t("add_deposit_for", { name: customerName }) : t("add_credit_for", { name: customerName })}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label htmlFor="credit-deposit-amount">{t("amount")}</Label><Input id="credit-deposit-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></div>
          {canManageCredit && <div>
            <Label>{t("reason")}</Label>
            <Select value={reason} onValueChange={(value: any) => setReason(value)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual_credit">{t("credit_reason_manual_credit")}</SelectItem>
                <SelectItem value="compensation">{t("credit_reason_compensation")}</SelectItem>
                <SelectItem value="advance_payment">{t("credit_reason_advance_payment")}</SelectItem>
              </SelectContent>
            </Select>
          </div>}
          {reason === "advance_payment" && <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>{t("payment_method")}</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["Cash", "Mobile Money", "Card", "Bank Transfer", "Other"].map((method) => <SelectItem key={method} value={method}>{t(`payment_method_${method.toLowerCase().replaceAll(" ", "_")}`, { defaultValue: method })}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="deposit-reference">{t("reference_optional")}</Label><Input id="deposit-reference" className="mt-1" value={reference} maxLength={255} onChange={(event) => setReference(event.target.value)} /></div>
          </div>}
          <div><Label htmlFor="credit-deposit-notes">{t("note_optional")}{noteRequired ? " *" : ""}</Label><Textarea id="credit-deposit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{reason === "advance_payment" ? t("save_customer_deposit") : t("add_credit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
