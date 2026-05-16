import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Calculator, Printer, Link2 } from "lucide-react";
import { ReportContent } from "./calculator";
import { useState } from "react";

const COUNTRY_CURRENCY: Record<string, string> = {
  cameroun: "FCFA", senegal: "FCFA", cote_divoire: "FCFA", mali: "FCFA",
  burkina_faso: "FCFA", guinee: "GNF", rdc: "USD", gabon: "FCFA", congo: "FCFA",
  togo: "FCFA", benin: "FCFA", maroc: "MAD", tunisie: "TND", algerie: "DZD",
  france: "EUR", belgique: "EUR", suisse: "CHF",
};

export default function PublicReportPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/calculator/report", leadId],
    queryFn: () => fetch(`/api/calculator/report/${leadId}`).then(r => {
      if (!r.ok) throw new Error("Rapport introuvable");
      return r.json();
    }),
    retry: false,
  });

  const currency = data ? (COUNTRY_CURRENCY[data.country] ?? "FCFA") : "FCFA";
  const reportUrl = typeof window !== "undefined" ? window.location.href : "";

  function copyLink() {
    navigator.clipboard.writeText(reportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">Rapport introuvable</h1>
        <p className="text-muted-foreground">Ce rapport n'existe pas ou a expiré.</p>
        <a href="/calculateur">
          <Button>Créer mon rapport</Button>
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Top nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-border px-4 py-3 flex items-center justify-between print:hidden">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">PressFlow</span>
        </a>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => window.print()} data-testid="button-print">
            <Printer className="w-4 h-4 mr-1" />
            Imprimer
          </Button>
          <a href="/auth">
            <Button size="sm" data-testid="link-trial">Essai gratuit 14 jours</Button>
          </a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">
            Rapport de démarrage pressing
          </h1>
          <p className="text-muted-foreground mt-1">
            {data.city} · {data.report?.totalBudget?.currency ?? currency}
            {data.firstName && ` · Pour ${data.firstName}`}
          </p>
          {data.createdAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Généré le {new Date(data.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Shareable link */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-border rounded-xl px-4 py-3 mb-5 print:hidden">
          <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 truncate">{reportUrl}</span>
          <Button size="sm" variant="outline" onClick={copyLink} data-testid="button-copy-link">
            {copied ? "Copié !" : "Copier le lien"}
          </Button>
        </div>

        <ReportContent report={data.report} currency={currency} />

        {/* Bottom CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8 mt-4 border-t border-border print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5 text-center">
            <p className="font-semibold mb-1">Gérez votre pressing avec PressFlow</p>
            <p className="text-xs text-muted-foreground mb-3">Logiciel tout-en-un : commandes, clients, paiements, rapports</p>
            <a href="/auth">
              <Button className="w-full" data-testid="button-cta-trial">Essai gratuit 14 jours →</Button>
            </a>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5 text-center">
            <p className="font-semibold mb-1">Formation démarrage pressing</p>
            <p className="text-xs text-muted-foreground mb-3">Accompagnement personnalisé pour ouvrir votre pressing</p>
            <a href="https://wa.me/237699000000" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full border-green-500 text-green-700 hover:bg-green-50" data-testid="button-cta-training">
                Nous contacter sur WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
