import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { hasSaasFeature, type SaasPlan } from "@shared/saas-plans";

/** Shared by public pricing and the account: describe the server's actual tiers. */
export function SaasPlanDetails({ plan }: { plan: SaasPlan }) {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const text = (a: string, b: string) => fr ? a : b;
  const included = [
    text("Commandes illimitées et suivi des statuts", "Unlimited orders and status tracking"),
    text("Fiches clients et historique des commandes", "Customer records and order history"),
    text("Encaissements, acomptes et soldes à payer", "Payments, deposits and outstanding balances"),
    text("Factures et reçus en HTML, PDF et image HD", "Invoices and receipts in HTML, PDF and HD image"),
    text("Gestion des services, des dépenses et du stock", "Service, expense and stock management"),
    text("Tableau de bord de l’activité", "Activity dashboard"),
  ];
  if (hasSaasFeature(plan, "team")) included.push(text("Équipe : rôles, permissions et suivi des présences", "Team roles, permissions and attendance tracking"));
  if (hasSaasFeature(plan, "reports")) included.push(text("Pilotage, rapports et analyses des clients à risque", "Management overview, reports and at-risk customer analysis"));
  if (hasSaasFeature(plan, "machines")) included.push(text("Machines et cycles de production", "Machines and production cycles"));
  if (hasSaasFeature(plan, "memberships")) included.push(text("Gestion des abonnements clients et de la fidélité", "Customer subscription and loyalty management"));
  if (hasSaasFeature(plan, "receiptCustomization")) included.push(text("Personnalisation des reçus : logo, couleurs et mentions", "Receipt customization: logo, colours and notes"));
  if (hasSaasFeature(plan, "multiSite")) included.push(text("Gestion multi-boutique et vue consolidée de l’activité", "Multi-site management and consolidated activity overview"));
  return <div className="space-y-4" data-testid={`saas-plan-details-${plan}`}>
    <p className="text-sm leading-6 text-slate-600">{plan === "starter"
      ? text("Pour gérer seul les opérations essentielles de votre pressing.", "For owners managing their laundry’s daily operations on their own.")
      : plan === "pro"
        ? text("Les fonctions de Starter, avec une équipe et des outils de gestion avancés.", "Starter features, plus a team and advanced management tools.")
        : text("Les fonctions de Pro, pour piloter plusieurs boutiques et une équipe plus grande.", "Pro features, for managing multiple sites and a larger team.")}</p>
    <ul className="space-y-2 text-sm leading-6">{included.map(label => <li key={label} className="flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" /><span>{label}</span></li>)}</ul>
    <p className="border-t pt-3 text-sm leading-6 text-slate-600">{plan === "starter"
      ? text("Propriétaire seul, sans accès employé. Reçus au modèle standard. Équipe, Pilotage, analyses avancées, machines et gestion des abonnements clients : à partir de Pro. Plusieurs boutiques : Business.", "Owner only, without staff access. Standard receipt template. Team, management overview, advanced analytics, machines and customer subscription management require Pro or higher. Multiple sites require Business.")
      : plan === "pro"
        ? text("Personnel supplémentaire : 2 000 FCFA/mois par place. Une seule boutique exploitable ; Business est nécessaire pour plusieurs boutiques.", "Additional staff: 2,000 FCFA/month per place. One operating site; Business is required for multiple sites.")
        : text("Boutique supplémentaire : 5 000 FCFA/mois, avec 2 places employés incluses. Place employé supplémentaire : 2 000 FCFA/mois. Configurez ces options dans Personnalisé.", "Additional site: 5,000 FCFA/month, including 2 staff places. Additional staff place: 2,000 FCFA/month. Configure these options in Custom.")}</p>
  </div>;
}
