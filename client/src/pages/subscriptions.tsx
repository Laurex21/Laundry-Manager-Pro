import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { Check, Crown, Sparkles, CreditCard, Info } from "lucide-react";
import { PAYMENT_METHODS, PAYMENT_REGIONS } from "@/lib/payment-methods";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";
import type { Plan, SubscriptionWithPlan } from "@shared/schema";

function dateLocaleFor(language: string) {
  if (language.startsWith("fr")) return fr;
  if (language.startsWith("pt")) return pt;
  return enUS;
}

export default function Subscriptions() {
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const [payDialog, setPayDialog] = useState<Plan | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({ queryKey: ["/api/plans"] });
  const { data: currentSub } = useQuery<SubscriptionWithPlan | null>({ queryKey: ["/api/subscriptions/current"] });

  const activePlanId = currentSub?.planId;

  if (plansLoading) {
    return <div className="space-y-8"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96 rounded-xl" />)}</div></div>;
  }

  return (
    <div className="space-y-8 page-fade-in">
      <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="text-subscriptions-title">{t("subscription")}</h1>

      {currentSub && (
        <Card className="shadow-sm border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20" data-testid="card-current-subscription">
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-primary" />
                <div>
                  <h3 className="font-bold text-lg">{t("plan_name", { name: currentSub.plan.name })}</h3>
                  <p className="text-sm text-muted-foreground">{t("current_plan")}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="default" className="bg-green-600">{t("active")}</Badge>
                {currentSub.endDate && <span className="text-muted-foreground">{t("valid_until")}: {format(new Date(currentSub.endDate), "MMM d, yyyy", { locale: dateLocaleFor(i18n.language) })}</span>}
                <span>{t("orders_this_month")}: {currentSub.ordersUsed} / {currentSub.plan.maxOrders ?? "∞"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans?.map((plan) => {
          const isActive = plan.id === activePlanId;
          const isBusiness = plan.slug === "business";
          const features = (plan.features as string[]) || [];

          return (
            <Card key={plan.id} className={`shadow-sm relative overflow-hidden transition-all ${isActive ? "ring-2 ring-green-500" : ""} ${isBusiness ? "border-primary shadow-md" : ""}`} data-testid={`card-plan-${plan.slug}`}>
              {isBusiness && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> {t("most_popular")}
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold font-display">{symbol}{Number(plan.price).toLocaleString()}</span>
                  <span className="text-muted-foreground text-sm"> {t("per_month")}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
                  <div>{t("orders")}: {plan.maxOrders ? t("orders_per_month", { count: plan.maxOrders }) : t("unlimited")}</div>
                  <div>{t("users")}: {plan.maxUsers ?? t("unlimited")}</div>
                </div>
                <Button className="w-full" disabled={isActive} variant={isBusiness ? "default" : "outline"}
                  onClick={() => !isActive && setPayDialog(plan)} data-testid={`button-select-plan-${plan.slug}`}>
                  {isActive ? t("current_plan") : t("upgrade_to_plan", { name: plan.name })}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PaymentDialog plan={payDialog} onClose={() => setPayDialog(null)} />
    </div>
  );
}

function PaymentDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState("simulate");

  const mutation = useMutation({
    mutationFn: (data: { planId: number; method: string }) => apiRequest("POST", "/api/subscriptions/pay", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onClose();
    },
  });

  if (!plan) return null;

  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("upgrade_to_plan", { name: plan.name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
            <span className="font-medium">{t("plan_name", { name: plan.name })}</span>
            <span className="font-bold text-lg">{symbol}{Number(plan.price).toLocaleString()}{t("per_month_short")}</span>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">{t("payment_method")}</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger data-testid="select-payment-method"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="simulate">{t("simulate_payment_demo")}</SelectItem>
                {PAYMENT_REGIONS.map(region => (
                  <div key={region}>
                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{region}</div>
                    {PAYMENT_METHODS.filter(m => m.region === region).map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {method === "simulate" && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-700 dark:text-blue-400">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{t("demo_payment_notice")}</span>
            </div>
          )}

          <Button className="w-full" onClick={() => mutation.mutate({ planId: plan.id, method })} disabled={mutation.isPending} data-testid="button-confirm-payment">
            {mutation.isPending ? t("processing") : t("confirm_payment")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
