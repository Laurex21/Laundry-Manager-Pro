import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Calculator, Printer, Link2, ChevronDown, MessageCircle, Users, Download, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PublicLanguageTools } from "@/components/public-language-tools";

const COUNTRY_CURRENCY: Record<string, string> = {
  cameroun: "FCFA", senegal: "FCFA", cote_divoire: "FCFA", mali: "FCFA",
  burkina_faso: "FCFA", guinee: "GNF", rdc: "USD", gabon: "FCFA", congo: "FCFA",
  togo: "FCFA", benin: "FCFA", maroc: "MAD", tunisie: "TND", algerie: "DZD",
  france: "EUR", belgique: "EUR", suisse: "CHF",
};

const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
const WaIcon = ({ className = "w-4 h-4 fill-white" }) => <svg viewBox="0 0 24 24" className={className}><path d={WA_PATH} /></svg>;

function fmt(n: number) { return n?.toLocaleString("fr-FR") ?? "—"; }

function DetailSection({ title, icon, data, currency }: { title: string; icon: string; data: any; currency: string }) {
  if (!data?.total) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm">{icon} {title}</p>
        <p className="text-sm font-bold text-primary">{fmt(data.total.min)} — {fmt(data.total.max)} {currency}</p>
      </div>
      <div className="space-y-2 pl-2">
        {data.items?.map((item: any, i: number) => (
          <div key={i} className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm">{item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name}</p>
              {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
            </div>
            <p className="text-sm font-medium flex-shrink-0 text-right">
              {fmt(item.unitCost?.min ?? item.cost?.min)}<br />
              <span className="text-xs text-muted-foreground">— {fmt(item.unitCost?.max ?? item.cost?.max)} {currency}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfitabilitySection({ data, currency }: { data: any; currency: string }) {
  if (!data) return null;
  const items = [
    { label: "Seuil de rentabilité",   value: `${data.breakEvenKgPerMonth} kg/mois` },
    { label: "Retour investissement",   value: `${data.estimatedRoiMonths?.min} — ${data.estimatedRoiMonths?.max} mois` },
    { label: "CA mensuel potentiel",    value: `${fmt(data.estimatedMonthlyRevenue?.min)} — ${fmt(data.estimatedMonthlyRevenue?.max)} ${currency}`, highlight: "green" },
    { label: "Bénéfice mensuel estimé", value: `${fmt(data.estimatedMonthlyProfit?.min)} — ${fmt(data.estimatedMonthlyProfit?.max)} ${currency}`, highlight: "green" },
    { label: "Marge nette estimée",     value: `${data.estimatedMarginPct?.min} — ${data.estimatedMarginPct?.max}%`, highlight: "blue" },
  ];
  return (
    <div>
      <p className="font-semibold text-sm mb-3">📊 Analyse de rentabilité</p>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div key={i} className={cn("rounded-lg p-3",
            item.highlight === "green" ? "bg-green-50 dark:bg-green-900/20" :
            item.highlight === "blue"  ? "bg-blue-50 dark:bg-blue-900/20" : "bg-muted/50")}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={cn("text-sm font-bold mt-1",
              item.highlight === "green" ? "text-green-700 dark:text-green-400" :
              item.highlight === "blue"  ? "text-blue-700 dark:text-blue-400" : "")}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublicReportPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const leadAccessToken = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token")
    : null;
  const [copied, setCopied] = useState(false);
  const [showDetail, setShowDetail] = useState(true);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/calculator/report", leadId, leadAccessToken],
    queryFn: () => fetch(`/api/calculator/report/${leadId}?token=${encodeURIComponent(leadAccessToken || "")}`).then(r => {
      if (!r.ok) throw new Error("Rapport introuvable");
      return r.json();
    }),
    retry: false,
  });

  const currency = data ? (COUNTRY_CURRENCY[data.country] ?? "FCFA") : "FCFA";
  const report = data?.report;
  const reportCurrency = report?.totalBudget?.currency ?? currency;
  const reportUrl = typeof window !== "undefined" ? window.location.href : "";

  const typeLabels: Record<string, string> = {
    quartier: "pressing de quartier", semi_pro: "pressing semi-professionnel", industriel: "pressing industriel",
  };

  function copyLink() {
    navigator.clipboard.writeText(reportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (isError || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center" data-public-tool-root>
      <PublicLanguageTools />
      <h1 className="text-2xl font-bold">Rapport introuvable</h1>
      <p className="text-muted-foreground">Ce rapport n'existe pas ou a expiré.</p>
      <a href="/calculateur"><Button>Créer mon rapport</Button></a>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800" data-public-tool-root>
      <PublicLanguageTools />
      {/* Nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-border px-4 py-3 flex items-center justify-between print:hidden">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">PressFlow</span>
        </a>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => window.print()} data-testid="button-print">
            <Printer className="w-4 h-4 mr-1" />Imprimer
          </Button>
          <a href="/auth"><Button size="sm" data-testid="link-trial">Essai gratuit 14 jours</Button></a>
        </div>
      </nav>

      {/* Print header */}
      <div className="hidden print:block px-8 py-6 border-b">
        <h1 className="text-2xl font-bold">Rapport PressFlow — Calculateur de démarrage pressing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.city}, {data.countryLabel} · Pour {data.firstName} ·{" "}
          {data.createdAt && new Date(data.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Shareable link */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-border rounded-xl px-4 py-3 mb-5 print:hidden">
          <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 truncate">{reportUrl}</span>
          <Button size="sm" variant="outline" onClick={copyLink} data-testid="button-copy-link">
            {copied ? "Copié !" : "Copier le lien"}
          </Button>
        </div>

        {/* Hero */}
        <div className="bg-gradient-to-br from-primary to-primary/80 text-white rounded-2xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 rounded-2xl" />
          <div className="relative">
            {data.firstName && <p className="text-white/80 text-sm mb-1">Pour {data.firstName} 👋</p>}
            <h1 className="text-xl font-bold mb-1">
              {data.pressingType ? `Estimation — ${typeLabels[data.pressingType] ?? data.pressingType}` : "Rapport de démarrage pressing"}
            </h1>
            <p className="text-white/70 text-sm mb-5">
              📍 {data.city}, {data.countryLabel}
              {data.createdAt && ` · ${new Date(data.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`}
            </p>
            {report?.totalBudget && (
              <>
                <p className="text-xs font-medium text-white/70 uppercase tracking-wide mb-1">Budget de démarrage estimé</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-4xl font-black">{fmt(report.totalBudget.min)}</span>
                  <span className="text-2xl text-white/60">—</span>
                  <span className="text-4xl font-black">{fmt(report.totalBudget.max)}</span>
                  <span className="text-xl text-white/70">{reportCurrency}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {report.breakdown?.equipment?.total && (
                    <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
                      📦 Équipements : {fmt(report.breakdown.equipment.total.min)} — {fmt(report.breakdown.equipment.total.max)} {reportCurrency}
                    </div>
                  )}
                  {report.profitability?.estimatedRoiMonths && (
                    <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
                      📅 Retour invest. : {report.profitability.estimatedRoiMonths.min} — {report.profitability.estimatedRoiMonths.max} mois
                    </div>
                  )}
                  {report.profitability?.estimatedMarginPct && (
                    <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
                      📊 Marge estimée : {report.profitability.estimatedMarginPct.min} — {report.profitability.estimatedMarginPct.max}%
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* CTAs */}
        <div className="grid sm:grid-cols-2 gap-3 mb-6 print:hidden">
          <Button variant="outline" size="lg" className="h-14 gap-3" onClick={() => window.print()} data-testid="button-download">
            <Download className="w-5 h-5" />
            <div className="text-left">
              <div className="font-semibold text-sm">Télécharger le rapport</div>
              <div className="text-xs text-muted-foreground">Format PDF</div>
            </div>
          </Button>
          {data.expertUrl && (
            <a href={data.expertUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => fetch(`/api/calculator/track-expert-contact/${data.leadId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadAccessToken }),
              }).catch(() => {})}>
              <Button size="lg" className="w-full h-14 gap-3 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/25" data-testid="button-expert">
                <WaIcon className="w-5 h-5 fill-white flex-shrink-0" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Parler à un expert</div>
                  <div className="text-xs text-white/80">Réponse WhatsApp rapide</div>
                </div>
              </Button>
            </a>
          )}
        </div>

        {/* Trust signals */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-500" />
            <span>Réponse généralement en moins de 2 heures</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span>+5 ans d'expérience · Plus de 20 entrepreneurs accompagnés</span>
          </div>
        </div>

        {/* Summary */}
        {report?.summary && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5 mb-4">
            <h3 className="font-semibold mb-2">Résumé</h3>
            <p className="text-sm text-muted-foreground">{report.summary}</p>
          </div>
        )}

        {/* Detail accordion */}
        {report && (
          <div className="border border-border rounded-xl overflow-hidden mb-4">
            <button type="button" onClick={() => setShowDetail(!showDetail)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors print:hidden"
              data-testid="button-toggle-detail">
              <span className="font-semibold text-sm">Voir le détail complet de l'estimation</span>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", showDetail && "rotate-180")} />
            </button>
            {showDetail && (
              <div className="px-5 py-5 space-y-5 border-t border-border print:border-t-0">
                <DetailSection title="Équipements" icon="⚙️" data={report?.breakdown?.equipment} currency={reportCurrency} />
                <DetailSection title="Aménagement & Installation" icon="🔨" data={report?.breakdown?.setup} currency={reportCurrency} />
                <DetailSection title="Démarches administratives" icon="📋" data={report?.breakdown?.administrative} currency={reportCurrency} />
                {report?.monthlyCharges?.total && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">📅 Charges mensuelles</p>
                      <p className="text-sm font-bold text-primary">
                        {fmt(report.monthlyCharges.total.min)} — {fmt(report.monthlyCharges.total.max)} {reportCurrency}
                      </p>
                    </div>
                    <div className="space-y-1 pl-2">
                      {report.monthlyCharges.items?.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                          <span className="text-muted-foreground">{item.category}</span>
                          <span>{fmt(item.min)} — {fmt(item.max)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <ProfitabilitySection data={report?.profitability} currency={reportCurrency} />
                {report?.localInsights && (
                  <div>
                    <p className="font-semibold text-sm mb-3">📍 Contexte local — {data.city}, {data.countryLabel}</p>
                    {report.localInsights.marketContext && <p className="text-sm text-muted-foreground mb-3">{report.localInsights.marketContext}</p>}
                    {report.localInsights.administrativeSteps?.length > 0 && (
                      <ul className="space-y-1">
                        {report.localInsights.administrativeSteps.map((s: string, i: number) => (
                          <li key={i} className="text-sm flex gap-2"><span className="text-primary">✓</span>{s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {report?.risks?.length > 0 && (
                  <div>
                    <p className="font-semibold text-sm mb-2">⚠️ Points de vigilance</p>
                    <ul className="space-y-1">
                      {report.risks.map((r: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="flex-shrink-0">•</span><span>{r}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {report?.recommendations?.length > 0 && (
                  <div>
                    <p className="font-semibold text-sm mb-2">✅ Recommandations</p>
                    <ul className="space-y-1">
                      {report.recommendations.map((r: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="flex-shrink-0">•</span><span>{r}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        {report?.disclaimer && (
          <p className="text-xs text-muted-foreground text-center leading-relaxed mb-6">{report.disclaimer}</p>
        )}

        {/* PressFlow CTA */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border border-border rounded-2xl p-6 print:hidden">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-white stroke-2">
                <path d="M2 12 C5 9, 8 15, 12 12 C16 9, 19 15, 22 12" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-base mb-1">Prêt à ouvrir votre pressing ?</h3>
              <p className="text-sm text-muted-foreground mb-3">
                PressFlow vous aide à gérer chaque commande, chaque paiement et votre rentabilité — conçu pour les pressings africains.
              </p>
              <div className="bg-white dark:bg-slate-800 border border-border rounded-xl px-4 py-3 mb-3">
                <p className="text-sm font-semibold text-primary">
                  🎁 30 jours gratuits <span className="text-muted-foreground font-normal">OU</span> vos 50 premières commandes
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sans carte bancaire
                  </span>
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sans engagement
                  </span>
                </div>
              </div>
              <Button asChild>
                <a href="/auth" data-testid="button-trial">Démarrer mon essai gratuit →</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
