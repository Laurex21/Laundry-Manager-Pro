import { useState } from "react";
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
type PaidPilotV4 = { enabled: false } | { enabled: true; providerEnvironment: "sandbox" | "production"; plans: Record<"starter" | "pro" | "business", { monthlyXaf: number; includedSites: number; includedStaff: number }>; entitlement: {
  planSlug: "starter" | "pro" | "business"; state: string;
  trialEndsAt: string | null; cycleEndsAt: string | null;
} };

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
  const paidPilot = useQuery<PaidPilotV4>({ queryKey: ["/api/subscriptions/v4/paid-pilot"] });

  const activePlanId = currentSub?.planId;

  if (plansLoading || paidPilot.isLoading) {
    return <div className="space-y-8"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96 rounded-xl" />)}</div></div>;
  }

  if (paidPilot.data?.enabled) return <PaidPilotSubscriptionsV4 entitlement={paidPilot.data.entitlement} plans={paidPilot.data.plans} providerEnvironment={paidPilot.data.providerEnvironment} />;

  return (
    <div className="space-y-8 page-fade-in" data-testid="current-subscription-redesign">
      <div className="rounded-2xl border border-primary/10 bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("administration")}</p>
        <h1 className="mt-1 text-2xl font-display font-bold text-[#082D5B] sm:text-3xl" data-testid="text-subscriptions-title">{t("subscription")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{i18n.language.startsWith("fr") ? "Consultez votre forfait XpressPro actuel et comparez les offres disponibles." : i18n.language.startsWith("pt") ? "Consulte o seu plano XpressPro atual e compare as ofertas disponíveis." : "Review your current XpressPro plan and compare available offers."}</p>
      </div>
      <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">{t("plans_free_period_notice")}</p>

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

function PaidPilotSubscriptionsV4({ entitlement, plans, providerEnvironment }: {
  entitlement: Extract<PaidPilotV4, { enabled: true }>["entitlement"];
  plans: Extract<PaidPilotV4, { enabled: true }>["plans"];
  providerEnvironment: "sandbox" | "production";
}) {
  const queryClient = useQueryClient();
  const [checkoutId, setCheckoutId] = useState(() => sessionStorage.getItem("saas-v4-pending-checkout"));
  const createCheckout = useMutation({
    mutationFn: async (targetPlanSlug: "pro" | "business") => {
      const response = await apiRequest("POST", "/api/subscriptions/v4/paid-checkouts", { targetPlanSlug });
      return response.json() as Promise<{ checkoutId: string; redirectUrl: string }>;
    },
    onSuccess: ({ checkoutId: id, redirectUrl }) => {
      sessionStorage.setItem("saas-v4-pending-checkout", id);
      setCheckoutId(id);
      window.location.assign(redirectUrl);
    },
  });
  const refreshCheckout = useMutation({
    mutationFn: async () => {
      if (!checkoutId) throw new Error("No pending checkout");
      const response = await apiRequest("POST", `/api/subscriptions/v4/paid-checkouts/${checkoutId}/refresh`);
      return response.json() as Promise<{ status: string }>;
    },
    onSuccess: ({ status }) => {
      if (status === "activated" || status === "already_activated" || status === "failed") {
        sessionStorage.removeItem("saas-v4-pending-checkout");
        setCheckoutId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/v4/paid-pilot"] });
    },
  });
  const currentPlan = entitlement.state === "active" && entitlement.cycleEndsAt &&
    new Date(entitlement.cycleEndsAt).getTime() > Date.now() ? entitlement.planSlug :
    entitlement.state === "trialing" && entitlement.trialEndsAt &&
    new Date(entitlement.trialEndsAt).getTime() > Date.now() ? "pro" : "starter";
  return <div className="space-y-6 page-fade-in">
    <h1 className="text-2xl font-bold">Abonnement XPress Pro</h1>
    {providerEnvironment === "sandbox" && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900">Environnement de test PawaPay Sandbox : paiements fictifs, aucune recette réelle.</p>}
    <Card><CardContent className="p-5 space-y-2">
      <p className="font-semibold">Formule actuelle : {currentPlan === "starter" ? "Starter" : currentPlan === "pro" ? "Pro" : "Business"}</p>
      {entitlement.state === "trialing" && entitlement.trialEndsAt && <p className="text-sm">Essai Pro jusqu’au {new Date(entitlement.trialEndsAt).toLocaleDateString("fr-CM")}</p>}
      {entitlement.state === "active" && entitlement.cycleEndsAt && <p className="text-sm">Cycle en cours jusqu’au {new Date(entitlement.cycleEndsAt).toLocaleDateString("fr-CM")}</p>}
    </CardContent></Card>
    <p className="text-sm text-muted-foreground">Un changement de formule payante prend effet immédiatement après confirmation du paiement. Le prix intégral est facturé, un nouveau mois commence et le reliquat de l’ancienne formule n’est pas crédité.</p>
    <div className="grid gap-4 md:grid-cols-3">
      {([ ["starter", "Starter"], ["pro", "Pro"], ["business", "Business"] ] as const).map(([slug, label]) =>
        <Card key={slug}><CardContent className="p-5 space-y-3">
          <h2 className="text-lg font-bold">{label}</h2>
          <p className="text-2xl font-bold">{plans[slug].monthlyXaf.toLocaleString("fr-CM")} FCFA <span className="text-sm font-normal">/ mois</span></p>
          <p className="text-sm">{plans[slug].includedSites} boutique{plans[slug].includedSites > 1 ? "s" : ""} · {slug === "starter" ? "propriétaire seul" : `${plans[slug].includedStaff} employés actifs`} · commandes illimitées</p>
          {slug === "starter" ? <p className="text-sm text-muted-foreground">Disponible à la fin du cycle payé</p> :
            <Button className="w-full" disabled={!!checkoutId || createCheckout.isPending || currentPlan === slug}
              onClick={() => createCheckout.mutate(slug)}>{currentPlan === slug ? "Formule actuelle" : providerEnvironment === "sandbox" ? `Tester ${label}` : `Payer ${label}`}</Button>}
        </CardContent></Card>) }
    </div>
    {checkoutId && <Card><CardContent className="p-5 space-y-2">
      <p className="text-sm">Paiement en attente de vérification</p>
      <Button onClick={() => refreshCheckout.mutate()} disabled={refreshCheckout.isPending}>Vérifier le paiement</Button>
      {refreshCheckout.data && <p className="text-sm">Statut : {refreshCheckout.data.status}</p>}
      {refreshCheckout.error && <p role="alert" className="text-sm text-red-700">Vérification indisponible. Réessayez plus tard.</p>}
    </CardContent></Card>}
    {createCheckout.error && <p role="alert" className="text-sm text-red-700">Impossible de démarrer ce paiement. Vérifiez le statut avant de réessayer.</p>}
  </div>;
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
