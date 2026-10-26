import { Link } from "wouter";
import { BUSINESS_LAUNCH_CUTOFF } from "@shared/saas-business-launch";
import { SAAS_PLANS } from "@shared/saas-plans";

export function SaasTrialBanner({ endsAt, days, language }: { endsAt: string; days: number; language: string }) {
  const fr = language.startsWith("fr");
  const date = new Date(Date.parse(endsAt) - (endsAt === BUSINESS_LAUNCH_CUTOFF ? 1 : 0)).toLocaleString(language, {
    timeZone: "Africa/Douala", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const price = (amount: number) => `${amount.toLocaleString(fr ? "fr-FR" : "en-GB")} FCFA`;
  return <aside aria-label={fr ? "Fin de votre essai Business" : "Your Business trial is ending"}
    className="mx-4 my-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 sm:p-5" data-testid="saas-trial-banner">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold leading-snug sm:text-lg">{fr ? "Gardez vos outils avancés après votre essai Business" : "Keep your advanced tools after your Business trial"}</h2>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold">{fr ? `${days} ${days === 1 ? "jour restant" : "jours restants"}` : `${days} ${days === 1 ? "day left" : "days left"}`}</span>
        </div>
        <p className="text-sm leading-relaxed">{fr ? "Votre essai se termine le " : "Your trial ends on "}<strong>{date}</strong>.</p>
        <p className="max-w-4xl text-sm leading-relaxed">{fr
          ? "Choisissez Pro ou Business pour continuer à profiter de la gestion d’équipe, de Pilotage, des analyses et des abonnements clients."
          : "Choose Pro or Business to keep team management, business insights, analytics and customer memberships."}</p>
        <p className="text-sm font-semibold">Pro {fr ? "dès " : "from "}{price(SAAS_PLANS.pro.priceXaf)}{fr ? "/mois" : "/month"} · Business {price(SAAS_PLANS.business.priceXaf)}{fr ? "/mois" : "/month"}</p>
      </div>
      <Link href="/subscriptions" className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-blue-700 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto">
        {fr ? "Choisir mon abonnement" : "Choose my subscription"}
      </Link>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-blue-900/80">{fr
      ? "Sans abonnement confirmé, votre compte passera sur Starter gratuit. Vos données seront conservées."
      : "Without a confirmed subscription, your account will move to free Starter. Your data will be preserved."}</p>
  </aside>;
}
