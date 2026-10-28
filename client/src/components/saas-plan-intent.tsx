import { useTranslation } from "react-i18next";
import { SAAS_PLANS, saasMonthly, saasQuotas, type SaasSelection } from "@shared/saas-plans";

export function SaasPlanIntent({ selection }: { selection: SaasSelection | null }) {
  const { i18n } = useTranslation();
  if (!selection) return null;
  const fr = i18n.language.startsWith("fr");
  const custom = selection.plan === "business" && (selection.extraSites > 0 || selection.extraStaff > 0);
  const name = custom ? (fr ? "Personnalisé · Business" : "Custom · Business") : SAAS_PLANS[selection.plan].name;
  const quota = saasQuotas(selection);
  return <aside className="my-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm" data-testid="selected-plan-intent">
    <p className="font-semibold">{fr ? "Votre choix : " : "Your choice: "}{name} · {saasMonthly(selection).toLocaleString(i18n.language)} FCFA{fr ? "/mois" : "/month"}</p>
    {custom && <p className="mt-1">{quota.sites} {fr ? "boutiques" : "sites"} · {quota.staff} {fr ? "places employés + propriétaire" : "staff places + owner"}</p>}
    <p className="mt-1">{fr ? "Choix conservé pour Abonnement ; aucun paiement ni changement automatique. À confirmer après connexion." : "Saved for the Subscription page; no automatic payment or plan change. Confirm after signing in."}</p>
  </aside>;
}
