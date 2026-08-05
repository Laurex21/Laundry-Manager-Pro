import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Loader2, Plus, Wallet } from "lucide-react";
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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <CreditMetric label={t("available_credit")} value={`${symbol}${Number(data?.creditBalance ?? 0).toFixed(2)}`} accent />
        <CreditMetric label={t("total_credited")} value={`${symbol}${Number(data?.totalCreditAdded ?? 0).toFixed(2)}`} />
        <CreditMetric label={t("total_used")} value={`${symbol}${Number(data?.totalCreditUsed ?? 0).toFixed(2)}`} />
      </div>

      {canManageCredit && (
        <Button variant="outline" className="w-full gap-2" onClick={() => setOpen(true)} data-testid="button-add-customer-credit">
          <Plus className="h-4 w-4" /> {t("add_manual_credit")}
        </Button>
      )}

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
                  {entry.notes ? ` · ${entry.notes}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${entry.type === "credit" ? "text-emerald-600" : "text-amber-600"}`}>
                  {entry.type === "credit" ? "+" : "-"}{symbol}{Number(entry.amount).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">→ {symbol}{Number(entry.balance_after).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AddCreditDialog open={open} onOpenChange={setOpen} customerId={customerId} customerName={data?.customerName ?? ""} />
    </div>
  );
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  customerName: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<"manual_credit" | "compensation" | "advance_payment">("manual_credit");
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
      setReason("manual_credit");
      onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: t("credit_add_error"), description: error.message, variant: "destructive" }),
  });
  const noteRequired = reason === "compensation";
  const valid = Number(amount) > 0 && (!noteRequired || notes.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("add_credit_for", { name: customerName })}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>{t("amount")}</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></div>
          <div>
            <Label>{t("reason")}</Label>
            <Select value={reason} onValueChange={(value: any) => setReason(value)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual_credit">{t("credit_reason_manual_credit")}</SelectItem>
                <SelectItem value="compensation">{t("credit_reason_compensation")}</SelectItem>
                <SelectItem value="advance_payment">{t("credit_reason_advance_payment")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("note_optional")}{noteRequired ? " *" : ""}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("add_credit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
