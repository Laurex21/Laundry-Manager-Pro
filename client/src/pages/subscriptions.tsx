import CollectionPilot from "./collection-pilot";
import SaasSubscriptions from "./saas-subscriptions";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SaasCustomPlan } from "@/components/saas-custom-plan";
import { SAAS_PLANS } from "@shared/saas-plans";
import type { SubscriptionWithPlan } from "@shared/schema";

export default function Subscriptions() {
  const config = useQuery<{ enabled: boolean; collectionPilot?: boolean }>({ queryKey: ["/api/saas/config"] });
  if (config.isLoading) return <Skeleton className="h-48 w-full" />;
  if (config.isError || !config.data?.enabled) return <DisabledSubscriptions configUnavailable={config.isError} onRetry={() => void config.refetch()} />;
  if (config.data.collectionPilot) return <CollectionPilot />;
  return <SaasSubscriptions />;
}

function DisabledSubscriptions({ configUnavailable, onRetry }: { configUnavailable: boolean; onRetry: () => void }) {
  const { t, i18n } = useTranslation();
  const current = useQuery<SubscriptionWithPlan | null>({ queryKey: ["/api/subscriptions/current"] });
  return <div className="space-y-6" data-testid="subscription-disabled">
    <header>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">{t("administration")}</p>
      <h1 className="text-2xl font-bold sm:text-3xl">{t("subscription")}</h1>
      <p className="mt-2 text-muted-foreground">{t("billing_catalogue_intro")}</p>
    </header>
    <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100">
      {t(configUnavailable ? "billing_config_unavailable" : "billing_disabled_notice")}
      {configUnavailable && <Button variant="outline" className="ml-2" onClick={onRetry}>{t("retry")}</Button>}
    </div>
    <Card data-testid="card-current-subscription">
      <CardHeader><CardTitle>{t("current_plan")}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {current.isLoading ? <Skeleton className="h-6 w-40" /> : current.isError ? <p role="alert">{t("billing_current_unavailable")}</p> : current.data ? <>
          <p className="font-semibold">{current.data.plan.name}</p>
          {current.data.endDate && <p>{t("valid_until")}: {new Date(current.data.endDate).toLocaleDateString(i18n.language)}</p>}
        </> : <p>{t("billing_no_current")}</p>}
        <p className="text-sm text-muted-foreground">{t("billing_existing_unchanged")}</p>
      </CardContent>
    </Card>
    <h2 className="text-xl font-semibold">{t("billing_new_plans")}</h2>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Object.values(SAAS_PLANS).map(plan => <Card key={plan.slug} data-testid={`card-plan-${plan.slug}`}>
        <CardHeader><CardTitle>{plan.name}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-2xl font-bold">{plan.priceXaf.toLocaleString(i18n.language)} FCFA <span className="text-sm font-normal">{t("per_month")}</span></p>
          <p>{t("billing_sites", { count: plan.sites })}</p>
          <p>{t("billing_staff", { count: plan.staff })}</p>
          <p>{t("billing_unlimited_orders")}</p>
          <p className="text-sm text-muted-foreground">{t("billing_preview_only")}</p>
        </CardContent>
      </Card>)}
      <SaasCustomPlan previewOnly />
    </div>
  </div>;
}
