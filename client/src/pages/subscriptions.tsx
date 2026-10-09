import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { Check, Crown, Sparkles, CreditCard, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";
import type { Plan, SubscriptionWithPlan } from "@shared/schema";

type SandboxTest = { enabled: boolean; checkouts: Array<{ checkoutId: string; planId: number; amountXaf: number; status: string; redirectUrl: string | null; createdAt: string }> };
type TrialNoticeV4 = { enabled: boolean; notice: { kind: "trial_reminder" | "trial_expired"; remainingMs: number } | null };

function dateLocaleFor(language: string) {
  if (language.startsWith("fr")) return fr;
  if (language.startsWith("pt")) return pt;
  return enUS;
}

export default function Subscriptions() {
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const [planDialog, setPlanDialog] = useState<Plan | null>(null);
  const [trialNotice, setTrialNotice] = useState<TrialNoticeV4["notice"]>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/saas-v4/trial-notice/claim", { method: "POST", credentials: "include" })
      .then((response) => response.ok ? response.json() as Promise<TrialNoticeV4> : null)
      .then((data) => { if (!cancelled && data?.enabled) setTrialNotice(data.notice); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({ queryKey: ["/api/plans"] });
  const { data: currentSub } = useQuery<SubscriptionWithPlan | null>({ queryKey: ["/api/subscriptions/current"] });
  const sandboxTest = useQuery<SandboxTest>({
    queryKey: ["/api/subscriptions/sandbox-test"],
    queryFn: async () => {
      const response = await fetch("/api/subscriptions/sandbox-test", { credentials: "include" });
      if (response.status === 403) return { enabled: false, checkouts: [] };
      if (!response.ok) throw new Error("Sandbox status unavailable");
      return response.json();
    },
  });

  const activePlanId = currentSub?.planId;

  if (plansLoading) {
    return <div className="space-y-8"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96 rounded-xl" />)}</div></div>;
  }

  return (
    <div className="space-y-8 page-fade-in" data-testid="current-subscription-redesign">
      <div className="rounded-2xl border border-primary/10 bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("administration")}</p>
        <h1 className="mt-1 text-2xl font-display font-bold text-[#082D5B] sm:text-3xl" data-testid="text-subscriptions-title">{t("subscription")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{i18n.language.startsWith("fr") ? "Consultez votre forfait XpressPro actuel et comparez les offres disponibles." : i18n.language.startsWith("pt") ? "Consulte o seu plano XpressPro atual e compare as ofertas disponíveis." : "Review your current XpressPro plan and compare available offers."}</p>
      </div>
      <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">{t("plans_free_period_notice")}</p>

      {trialNotice && <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20" role="status">
        <CardContent className="p-5 text-sm">
          <p className="font-semibold">{trialNotice.kind === "trial_expired"
            ? (i18n.language.startsWith("fr") ? "Votre essai Pro est terminé" : "Your Pro trial has ended")
            : (i18n.language.startsWith("fr") ? "Votre essai Pro se termine bientôt" : "Your Pro trial ends soon")}</p>
          <p>{trialNotice.kind === "trial_expired"
            ? (i18n.language.startsWith("fr") ? "Votre organisation est passée à Starter gratuit. Vos données sont conservées." : "Your organisation has moved to free Starter. Your data is preserved.")
            : (i18n.language.startsWith("fr")
              ? `Il reste ${Math.ceil(trialNotice.remainingMs / 3_600_000)} heures. Choisissez une formule ci-dessous si vous souhaitez conserver Pro.`
              : `${Math.ceil(trialNotice.remainingMs / 3_600_000)} hours remain. Choose a plan below to keep Pro.`)}</p>
        </CardContent>
      </Card>}

      {sandboxTest.data?.enabled && <Card className="border-cyan-200 bg-cyan-50/50">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold">{i18n.language.startsWith("fr") ? "Test de paiement PawaPay Sandbox" : "PawaPay Sandbox payment test"}</h2>
              <p className="text-sm text-muted-foreground">{i18n.language.startsWith("fr") ? "Choisissez une formule ci-dessous, puis lancez un test de 1 000 FCFA. Aucune formule ne sera activée par ce paiement." : "Choose a plan below, then run a 1,000 FCFA test. This payment will not activate a plan."}</p></div>
            <Button type="button" variant="outline" onClick={() => sandboxTest.refetch()}>{i18n.language.startsWith("fr") ? "Actualiser" : "Refresh"}</Button>
          </div>
          {sandboxTest.data.checkouts.map((checkout) => <div key={checkout.checkoutId} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
            <span>{plans?.find((plan) => plan.id === checkout.planId)?.name || "Plan"} · <strong>{checkout.status}</strong> · 1 000 FCFA</span>
            {checkout.redirectUrl && <a href={checkout.redirectUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-700 underline">{i18n.language.startsWith("fr") ? "Ouvrir le test" : "Open test"}</a>}
          </div>)}
        </CardContent>
      </Card>}

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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
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
                  <p className="text-xs text-muted-foreground">{t("future_plan_price")}</p>
                  <span className="text-3xl font-bold font-display">{Number(plan.price).toLocaleString(i18n.language, { maximumFractionDigits: 0 })} {symbol}</span>
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
                  onClick={() => !isActive && setPlanDialog(plan)} data-testid={`button-select-plan-${plan.slug}`}>
                  {isActive ? t("current_plan") : t("choose_plan", { name: plan.name })}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PlanActivationDialog plan={planDialog} sandboxEnabled={!!sandboxTest.data?.enabled} onClose={() => setPlanDialog(null)} />
    </div>
  );
}

function PlanActivationDialog({ plan, sandboxEnabled, onClose }: { plan: Plan | null; sandboxEnabled: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (planId: number) => apiRequest("POST", "/api/subscriptions/activate", { planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onClose();
    },
  });
  const sandboxMutation = useMutation({
    mutationFn: async (planId: number) => {
      const response = await apiRequest("POST", "/api/subscriptions/sandbox-test", { planId });
      return response.json() as Promise<{ checkoutId: string; redirectUrl: string }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/sandbox-test"] }),
  });

  if (!plan) return null;

  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("choose_plan", { name: plan.name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
            <span className="font-medium">{t("plan_name", { name: plan.name })}</span>
            <span className="font-bold text-lg">{symbol}{Number(plan.price).toLocaleString()}{t("per_month_short")}</span>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{t("plans_free_period_notice")}</span>
          </div>
          {mutation.error && <p role="alert" className="text-sm text-red-700">{t("plan_activation_failed")}</p>}
          <Button className="w-full" onClick={() => mutation.mutate(plan.id)} disabled={mutation.isPending} data-testid="button-confirm-plan-activation">
            {mutation.isPending ? t("processing") : t("activate_plan")}
          </Button>
          {sandboxEnabled && <div className="space-y-2 border-t pt-4">
            <p className="text-sm text-muted-foreground">{i18n.language.startsWith("fr") ? "Test Sandbox : 1 000 FCFA fictifs. Ne change pas votre formule." : "Sandbox test: 1,000 test FCFA. Does not change your plan."}</p>
            <Button type="button" variant="outline" className="w-full" disabled={sandboxMutation.isPending} onClick={() => sandboxMutation.mutate(plan.id)}>
              {sandboxMutation.isPending ? t("processing") : (i18n.language.startsWith("fr") ? "Tester le paiement PawaPay" : "Test PawaPay payment")}
            </Button>
            {sandboxMutation.error && <p role="alert" className="text-sm text-red-700">{sandboxMutation.error.message}</p>}
            {sandboxMutation.data?.redirectUrl && <a href={sandboxMutation.data.redirectUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-sm font-medium text-cyan-700 underline">{i18n.language.startsWith("fr") ? "Ouvrir le Checkout Sandbox" : "Open Sandbox Checkout"}</a>}
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
