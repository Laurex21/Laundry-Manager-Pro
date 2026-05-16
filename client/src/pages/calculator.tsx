import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Link2, ArrowLeft, ArrowRight, Loader2, Calculator, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type ContactZone = "africa" | "maghreb" | "europe";

const COUNTRIES = [
  { value: "cameroun",     label: "Cameroun",         zone: "africa" as ContactZone,   dialCode: "+237" },
  { value: "senegal",      label: "Sénégal",           zone: "africa" as ContactZone,   dialCode: "+221" },
  { value: "cote_divoire", label: "Côte d'Ivoire",     zone: "africa" as ContactZone,   dialCode: "+225" },
  { value: "mali",         label: "Mali",              zone: "africa" as ContactZone,   dialCode: "+223" },
  { value: "burkina_faso", label: "Burkina Faso",      zone: "africa" as ContactZone,   dialCode: "+226" },
  { value: "guinee",       label: "Guinée",            zone: "africa" as ContactZone,   dialCode: "+224" },
  { value: "rdc",          label: "RD Congo",          zone: "africa" as ContactZone,   dialCode: "+243" },
  { value: "gabon",        label: "Gabon",             zone: "africa" as ContactZone,   dialCode: "+241" },
  { value: "congo",        label: "Congo-Brazzaville", zone: "africa" as ContactZone,   dialCode: "+242" },
  { value: "togo",         label: "Togo",              zone: "africa" as ContactZone,   dialCode: "+228" },
  { value: "benin",        label: "Bénin",             zone: "africa" as ContactZone,   dialCode: "+229" },
  { value: "maroc",        label: "Maroc",             zone: "maghreb" as ContactZone,  dialCode: "+212" },
  { value: "tunisie",      label: "Tunisie",           zone: "maghreb" as ContactZone,  dialCode: "+216" },
  { value: "algerie",      label: "Algérie",           zone: "maghreb" as ContactZone,  dialCode: "+213" },
  { value: "france",       label: "France",            zone: "europe" as ContactZone,   dialCode: "+33"  },
  { value: "belgique",     label: "Belgique",          zone: "europe" as ContactZone,   dialCode: "+32"  },
  { value: "suisse",       label: "Suisse",            zone: "europe" as ContactZone,   dialCode: "+41"  },
];

const CITY_PLACEHOLDERS: Record<string, string> = {
  cameroun: "ex: Douala, Yaoundé, Bafoussam...", senegal: "ex: Dakar, Thiès, Saint-Louis...",
  cote_divoire: "ex: Abidjan, Bouaké, Yamoussoukro...", mali: "ex: Bamako, Sikasso, Ségou...",
  burkina_faso: "ex: Ouagadougou, Bobo-Dioulasso...", guinee: "ex: Conakry, Kankan, Labé...",
  rdc: "ex: Kinshasa, Lubumbashi, Goma...", gabon: "ex: Libreville, Port-Gentil...",
  congo: "ex: Brazzaville, Pointe-Noire...", togo: "ex: Lomé, Kpalimé, Sokodé...",
  benin: "ex: Cotonou, Porto-Novo, Parakou...", maroc: "ex: Casablanca, Rabat, Marrakech...",
  tunisie: "ex: Tunis, Sfax, Sousse...", algerie: "ex: Alger, Oran, Constantine...",
  france: "ex: Paris, Lyon, Marseille, Bordeaux...", belgique: "ex: Bruxelles, Liège, Anvers...",
  suisse: "ex: Genève, Lausanne, Zurich...",
};

const WA_SVG = (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

function fmt(n: number, currency: string) {
  if (!n && n !== 0) return "—";
  return n.toLocaleString("fr-FR") + " " + currency;
}

function BudgetBar({ label, min, max, currency, color }: { label: string; min: number; max: number; currency: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-muted-foreground shrink-0">{label}</div>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: "100%" }} />
      </div>
      <div className="text-xs font-medium text-right shrink-0 w-36">
        {fmt(min, currency)} – {fmt(max, currency)}
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"quick" | "details" | "capture" | "report">("quick");

  const [form, setForm] = useState({
    country: "", city: "", pressingType: "", dailyCapacity: "",
    hasLocalAlready: "", localSurface: "", reliableWater: "", reliablePower: "",
    plannedEmployees: "", availableCapital: "", businessGoal: "",
    firstName: "", whatsapp: "", phone: "", email: "",
  });

  const [quickResult, setQuickResult] = useState<any>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [whatsappLocal, setWhatsappLocal] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const contactZone: ContactZone = quickResult?.contactZone ?? (COUNTRIES.find(c => c.value === form.country)?.zone ?? "africa");
  const dialCode = quickResult?.dialCode ?? (COUNTRIES.find(c => c.value === form.country)?.dialCode ?? "+237");
  const currency = quickResult?.currency ?? "FCFA";
  const countryLabel = COUNTRIES.find(c => c.value === form.country)?.label ?? form.country;

  const loadingMessages = [
    `Recherche des prix équipements à ${form.city || "votre ville"}...`,
    `Analyse des loyers commerciaux dans cette zone...`,
    `Vérification des tarifs eau et électricité...`,
    `Calcul des démarches administratives pour ${countryLabel}...`,
    `Analyse du marché pressing local...`,
    `Calcul de votre seuil de rentabilité...`,
    `Rédaction de vos recommandations...`,
    `Finalisation de votre rapport...`,
  ];

  const quickMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/calculator/quick-estimate", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setQuickResult(data);
      setStep("details");
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de calculer l'estimation", variant: "destructive" }),
  });

  const aiMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/calculator/ai-report", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setAiResult(data);
      setStep("report");
    },
    onError: (err: any) => toast({ title: "Erreur", description: err.message ?? "Erreur lors de la génération du rapport", variant: "destructive" }),
  });

  useEffect(() => {
    if (!aiMutation.isPending) return;
    const iv = setInterval(() => setLoadingMsgIdx(i => (i + 1) % loadingMessages.length), 3000);
    return () => clearInterval(iv);
  }, [aiMutation.isPending]);

  function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.country || !form.city || !form.pressingType || !form.dailyCapacity) {
      toast({ title: "Champs manquants", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    quickMutation.mutate({ country: form.country, city: form.city, pressingType: form.pressingType, dailyCapacity: form.dailyCapacity });
  }

  function handleCaptureSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hasContact = form.whatsapp || form.phone || form.email;
    if (!hasContact || !form.firstName) {
      toast({ title: "Champs manquants", description: "Prénom et un contact sont requis", variant: "destructive" });
      return;
    }
    aiMutation.mutate({
      ...form,
      localSurface: form.localSurface ? parseInt(form.localSurface) : undefined,
      plannedEmployees: form.plannedEmployees ? parseInt(form.plannedEmployees) : undefined,
    });
  }

  function copyLink() {
    if (aiResult?.reportUrl) {
      navigator.clipboard.writeText(aiResult.reportUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  const stepNum = { quick: 1, details: 2, capture: 3, report: 4 }[step];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-border px-4 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">PressFlow</span>
        </a>
        <a href="/auth">
          <Button size="sm" variant="outline" data-testid="link-login">Connexion</Button>
        </a>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        {step !== "report" && (
          <div className="text-center mb-8">
            <span className="inline-block bg-primary/10 text-primary text-sm px-4 py-1.5 rounded-full font-medium mb-3">
              Outil gratuit · Résultat par WhatsApp en 2 minutes
            </span>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Calculateur de démarrage pressing
            </h1>
            <p className="text-muted-foreground">
              Combien coûte l'ouverture d'un pressing dans votre pays ?
            </p>
          </div>
        )}

        {/* Step indicator */}
        {step !== "report" && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  stepNum >= n ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                )}>
                  {stepNum > n ? <CheckCircle2 className="w-4 h-4" /> : n}
                </div>
                {n < 3 && <div className={cn("w-12 h-0.5 transition-colors", stepNum > n ? "bg-primary" : "bg-muted")} />}
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 1: Quick Estimate ── */}
        {step === "quick" && (
          <form onSubmit={handleQuickSubmit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-border p-6 space-y-5">
            <h2 className="font-semibold text-lg">Votre projet en 4 questions</h2>

            <div>
              <Label>Pays *</Label>
              <Select value={form.country} onValueChange={v => setForm(f => ({ ...f, country: v, city: "" }))}>
                <SelectTrigger className="mt-1" data-testid="select-country">
                  <SelectValue placeholder="Choisissez votre pays" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Afrique subsaharienne</div>
                  {COUNTRIES.filter(c => c.zone === "africa").map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1">Maghreb</div>
                  {COUNTRIES.filter(c => c.zone === "maghreb").map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1">Europe</div>
                  {COUNTRIES.filter(c => c.zone === "europe").map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ville *</Label>
              <Input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder={form.country ? CITY_PLACEHOLDERS[form.country] : "ex: Douala, Dakar, Paris..."}
                className="mt-1"
                data-testid="input-city"
              />
            </div>

            <div>
              <Label>Type de pressing *</Label>
              <Select value={form.pressingType} onValueChange={v => setForm(f => ({ ...f, pressingType: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-pressing-type">
                  <SelectValue placeholder="Choisissez un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quartier">
                    <div>
                      <div className="font-medium">Pressing de quartier</div>
                      <div className="text-xs text-muted-foreground">Petite clientèle locale, moins de 50 kg/jour</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="semi_pro">
                    <div>
                      <div className="font-medium">Semi-professionnel</div>
                      <div className="text-xs text-muted-foreground">50 à 150 kg/jour, clientèle établie</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="industriel">
                    <div>
                      <div className="font-medium">Industriel</div>
                      <div className="text-xs text-muted-foreground">+150 kg/jour, hôtels, hôpitaux</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Capacité journalière visée *</Label>
              <Select value={form.dailyCapacity} onValueChange={v => setForm(f => ({ ...f, dailyCapacity: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-daily-capacity">
                  <SelectValue placeholder="Choisissez une capacité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="less_50">Moins de 50 kg/jour</SelectItem>
                  <SelectItem value="50_150">50 à 150 kg/jour</SelectItem>
                  <SelectItem value="more_150">Plus de 150 kg/jour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={quickMutation.isPending} data-testid="button-quick-estimate">
              {quickMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calcul en cours...</> : "Voir mon estimation →"}
            </Button>
          </form>
        )}

        {/* ── STEP 2: Details + Quick Result ── */}
        {step === "details" && quickResult && (
          <div className="space-y-5">
            {/* Quick result card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">Estimation rapide</h2>
                <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Instantanée</span>
              </div>

              <div className="text-center py-4 bg-gradient-to-br from-primary/5 to-blue-50 dark:to-slate-800 rounded-xl mb-5">
                <p className="text-sm text-muted-foreground mb-1">Budget de démarrage estimé</p>
                <p className="text-3xl font-bold text-primary">
                  {fmt(quickResult.minBudget, currency)} – {fmt(quickResult.maxBudget, currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Fourchette indicative · Rapport IA détaillé disponible</p>
              </div>

              <div className="space-y-2 mb-5">
                <BudgetBar label="Équipements" min={quickResult.breakdownSummary.equipment.min} max={quickResult.breakdownSummary.equipment.max} currency={currency} color="bg-primary" />
                <BudgetBar label="Aménagement" min={quickResult.breakdownSummary.setup.min} max={quickResult.breakdownSummary.setup.max} currency={currency} color="bg-blue-400" />
                <BudgetBar label="Fonds roulement" min={quickResult.breakdownSummary.workingCapital.min} max={quickResult.breakdownSummary.workingCapital.max} currency={currency} color="bg-sky-400" />
                <BudgetBar label="Administratif" min={quickResult.breakdownSummary.administrative.min} max={quickResult.breakdownSummary.administrative.max} currency={currency} color="bg-indigo-300" />
              </div>

              <div className="grid grid-cols-3 gap-3 text-center border-t border-border pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Charges/mois</p>
                  <p className="text-sm font-semibold">{fmt(quickResult.monthlyCharges.min, currency)}</p>
                  <p className="text-xs text-muted-foreground">minimum</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Seuil rentabilité</p>
                  <p className="text-sm font-semibold">{quickResult.breakEvenKgPerMonth.min}–{quickResult.breakEvenKgPerMonth.max} kg</p>
                  <p className="text-xs text-muted-foreground">par mois</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ROI estimé</p>
                  <p className="text-sm font-semibold">{quickResult.estimatedRoiMonths.min}–{quickResult.estimatedRoiMonths.max}</p>
                  <p className="text-xs text-muted-foreground">mois</p>
                </div>
              </div>
            </div>

            {/* Details form */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-border p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-lg">Affinez votre rapport</h2>
                <p className="text-sm text-muted-foreground">Ces informations permettent à notre IA de personnaliser votre analyse</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Avez-vous un local ?</Label>
                  <Select value={form.hasLocalAlready} onValueChange={v => setForm(f => ({ ...f, hasLocalAlready: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-has-local"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Oui, disponible</SelectItem>
                      <SelectItem value="searching">En négociation</SelectItem>
                      <SelectItem value="no">À trouver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Surface (m²)</Label>
                  <Input type="number" value={form.localSurface} onChange={e => setForm(f => ({ ...f, localSurface: e.target.value }))} placeholder="ex: 80" className="mt-1" data-testid="input-surface" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Eau fiable ?</Label>
                  <Select value={form.reliableWater} onValueChange={v => setForm(f => ({ ...f, reliableWater: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-water"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Oui, stable</SelectItem>
                      <SelectItem value="sometimes">Parfois</SelectItem>
                      <SelectItem value="no">Souvent coupures</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Électricité stable ?</Label>
                  <Select value={form.reliablePower} onValueChange={v => setForm(f => ({ ...f, reliablePower: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-power"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Oui, stable</SelectItem>
                      <SelectItem value="sometimes">Coupures fréquentes</SelectItem>
                      <SelectItem value="no">Très instable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Employés prévus</Label>
                  <Input type="number" value={form.plannedEmployees} onChange={e => setForm(f => ({ ...f, plannedEmployees: e.target.value }))} placeholder="ex: 2" className="mt-1" data-testid="input-employees" />
                </div>
                <div>
                  <Label>Capital disponible</Label>
                  <Select value={form.availableCapital} onValueChange={v => setForm(f => ({ ...f, availableCapital: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-capital"><SelectValue placeholder="Fourchette" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="less_5m">Moins de 5M FCFA</SelectItem>
                      <SelectItem value="5_10m">5M – 10M FCFA</SelectItem>
                      <SelectItem value="10_20m">10M – 20M FCFA</SelectItem>
                      <SelectItem value="more_20m">Plus de 20M FCFA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Objectif business</Label>
                <Select value={form.businessGoal} onValueChange={v => setForm(f => ({ ...f, businessGoal: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-goal"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Activité principale</SelectItem>
                    <SelectItem value="secondary">Activité complémentaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep("quick")} className="flex-1" data-testid="button-back-quick">
                  <ArrowLeft className="w-4 h-4 mr-2" />Retour
                </Button>
                <Button type="button" onClick={() => setStep("capture")} className="flex-1" data-testid="button-next-capture">
                  Obtenir le rapport IA <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Contact Capture ── */}
        {step === "capture" && (
          <form onSubmit={handleCaptureSubmit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-border p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-lg">Recevez votre rapport personnalisé</h2>
              <p className="text-sm text-muted-foreground">Notre IA va analyser les données actuelles du marché à {form.city}</p>
            </div>

            <div>
              <Label>Votre prénom *</Label>
              <Input
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                placeholder="ex: Kofi"
                className="mt-1"
                data-testid="input-firstname"
              />
            </div>

            {/* Africa zone: WhatsApp required, email optional */}
            {contactZone === "africa" && (
              <>
                <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    {WA_SVG}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-400">Rapport envoyé sur WhatsApp en 2 minutes</p>
                    <p className="text-xs text-green-700 dark:text-green-500">Recevez votre rapport directement dans vos messages WhatsApp</p>
                  </div>
                </div>

                <div>
                  <Label>Numéro WhatsApp *<span className="ml-2 text-xs text-muted-foreground font-normal">Votre rapport sera envoyé ici</span></Label>
                  <div className="flex gap-2 mt-1">
                    <div className="flex items-center px-3 bg-muted border border-border rounded-lg text-sm font-medium text-muted-foreground flex-shrink-0">
                      {dialCode}
                    </div>
                    <Input
                      type="tel"
                      value={whatsappLocal}
                      onChange={e => {
                        setWhatsappLocal(e.target.value);
                        setForm(f => ({ ...f, whatsapp: dialCode + e.target.value.replace(/\s/g, "") }));
                      }}
                      placeholder="6XX XXX XXX"
                      className="flex-1"
                      data-testid="input-whatsapp"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    Ce numéro doit être actif sur WhatsApp
                  </p>
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    Email
                    <span className="text-xs font-normal bg-muted text-muted-foreground px-1.5 py-0.5 rounded">optionnel</span>
                  </Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="votre@email.com" className="mt-1" data-testid="input-email" />
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  🔒 Numéro protégé. Jamais partagé. Répondez STOP pour vous désinscrire.
                </p>
              </>
            )}

            {/* Maghreb zone: user chooses WhatsApp or Email */}
            {contactZone === "maghreb" && (
              <>
                <div>
                  <Label>Comment recevoir votre rapport ?</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {([{ value: "whatsapp", icon: "💬", label: "WhatsApp" }, { value: "email", icon: "📧", label: "Email" }] as const).map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setPreferredChannel(opt.value)}
                        data-testid={`button-channel-${opt.value}`}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                          preferredChannel === opt.value
                            ? opt.value === "whatsapp" ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground"
                        )}
                      >
                        <span className="text-2xl">{opt.icon}</span>
                        <span className="text-sm font-semibold">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {preferredChannel === "whatsapp" ? (
                  <div>
                    <Label>Numéro WhatsApp *</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="flex items-center px-3 bg-muted border border-border rounded-lg text-sm text-muted-foreground">{dialCode}</div>
                      <Input type="tel" value={whatsappLocal} onChange={e => { setWhatsappLocal(e.target.value); setForm(f => ({ ...f, whatsapp: dialCode + e.target.value.replace(/\s/g, ""), email: "" })); }} placeholder="6XX XXX XXX" className="flex-1" data-testid="input-whatsapp" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value, whatsapp: "" }))} className="mt-1" data-testid="input-email" />
                  </div>
                )}

                <div>
                  <Label className="flex items-center gap-2">
                    {preferredChannel === "whatsapp" ? "Email" : "WhatsApp"}
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">optionnel</span>
                  </Label>
                  {preferredChannel === "whatsapp" ? (
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1" placeholder="votre@email.com" data-testid="input-email-optional" />
                  ) : (
                    <div className="flex gap-2 mt-1">
                      <div className="flex items-center px-3 bg-muted border border-border rounded-lg text-sm text-muted-foreground">{dialCode}</div>
                      <Input type="tel" value={whatsappLocal} onChange={e => { setWhatsappLocal(e.target.value); setForm(f => ({ ...f, whatsapp: dialCode + e.target.value.replace(/\s/g, "") })); }} placeholder="6XX XXX XXX" className="flex-1" data-testid="input-whatsapp-optional" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  🔒 Données protégées. Jamais partagées. Désinscription en 1 clic.
                </p>
              </>
            )}

            {/* Europe zone: email required, WhatsApp optional */}
            {contactZone === "europe" && (
              <>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1" required data-testid="input-email" />
                  <p className="text-xs text-muted-foreground mt-1">Votre rapport sera envoyé à cette adresse</p>
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    WhatsApp
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">optionnel</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mb-1">Recevez aussi des conseils personnalisés par WhatsApp</p>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-muted border border-border rounded-lg text-sm text-muted-foreground">{dialCode}</div>
                    <Input type="tel" value={whatsappLocal} onChange={e => { setWhatsappLocal(e.target.value); setForm(f => ({ ...f, whatsapp: dialCode + e.target.value.replace(/\s/g, "") })); }} placeholder="6XX XXX" className="flex-1" data-testid="input-whatsapp" />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  🔒 Données protégées conformément au RGPD. Désinscription en 1 clic.
                </p>
              </>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep("details")} className="flex-1" data-testid="button-back-details">
                <ArrowLeft className="w-4 h-4 mr-2" />Retour
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={aiMutation.isPending || !form.firstName || (contactZone === "africa" && !form.whatsapp) || (contactZone === "europe" && !form.email)}
                data-testid="button-generate-report"
              >
                {aiMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération...</>
                ) : (
                  "Générer mon rapport IA →"
                )}
              </Button>
            </div>

            {/* Loading overlay */}
            {aiMutation.isPending && (
              <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
                  <p className="text-sm text-primary font-medium animate-pulse">{loadingMessages[loadingMsgIdx]}</p>
                </div>
                <div className="mt-3 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: `${((loadingMsgIdx + 1) / loadingMessages.length) * 100}%`, transition: "width 3s ease" }} />
                </div>
              </div>
            )}
          </form>
        )}

        {/* ── STEP 4: Report ── */}
        {step === "report" && aiResult && (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-1">Votre rapport est prêt 🎉</h1>
              <p className="text-muted-foreground text-sm">{form.city}, {countryLabel}</p>
            </div>

            {/* WhatsApp sent confirmation */}
            {aiResult.whatsappSent && (
              <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-400">Rapport envoyé sur WhatsApp ✓</p>
                  <p className="text-xs text-green-700 dark:text-green-500">Vérifiez vos messages. Vous recevrez des conseils personnalisés dans les prochains jours.</p>
                </div>
              </div>
            )}

            {/* Click-to-chat fallback */}
            {aiResult.clickToChatUrl && (
              <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">{WA_SVG}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Recevoir ce rapport sur WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Cliquez pour nous contacter et recevoir votre rapport</p>
                </div>
                <a href={aiResult.clickToChatUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white flex-shrink-0" data-testid="button-whatsapp-chat">Ouvrir WhatsApp</Button>
                </a>
              </div>
            )}

            {/* Shareable link */}
            {aiResult.reportUrl && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-3">
                <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground flex-1 truncate">{aiResult.reportUrl}</span>
                <Button size="sm" variant="outline" onClick={copyLink} data-testid="button-copy-link">
                  {copiedLink ? "Copié !" : "Copier le lien"}
                </Button>
              </div>
            )}

            <ReportContent report={aiResult.report} currency={currency} />

            {/* CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <a href="/auth">
                <Button className="w-full" size="lg" data-testid="button-cta-trial">
                  Essai gratuit PressFlow 14 jours →
                </Button>
              </a>
              <a href="https://wa.me/237699000000" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full border-green-500 text-green-700 hover:bg-green-50" size="lg" data-testid="button-cta-training">
                  <div className="w-4 h-4 mr-2 flex-shrink-0 bg-green-500 rounded-full flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  Formation pressing
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReportContent({ report, currency }: { report: any; currency: string }) {
  if (!report) return null;
  const fmtN = (n: number) => n?.toLocaleString("fr-FR") ?? "—";

  return (
    <div className="space-y-4">
      {/* Summary */}
      {report.summary && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5">
          <h3 className="font-semibold mb-2">Résumé</h3>
          <p className="text-sm text-muted-foreground">{report.summary}</p>
        </div>
      )}

      {/* Budget total */}
      {report.totalBudget && (
        <div className="bg-gradient-to-br from-primary/5 to-blue-50 dark:to-slate-800 rounded-2xl border border-primary/20 p-5">
          <h3 className="font-semibold mb-1">Budget total de démarrage</h3>
          <p className="text-3xl font-bold text-primary">
            {fmtN(report.totalBudget.min)} – {fmtN(report.totalBudget.max)} {report.totalBudget.currency}
          </p>
        </div>
      )}

      {/* Equipment breakdown */}
      {report.breakdown?.equipment && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5">
          <h3 className="font-semibold mb-3">Équipements</h3>
          <div className="space-y-2">
            {report.breakdown.equipment.items?.map((item: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-2 text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                <div>
                  <span className="font-medium">{item.name}</span>
                  {item.quantity > 1 && <span className="text-muted-foreground"> ×{item.quantity}</span>}
                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                </div>
                <span className="text-right shrink-0 text-muted-foreground">
                  {fmtN(item.unitCost?.min)} – {fmtN(item.unitCost?.max)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex justify-between font-semibold text-sm">
            <span>Total équipements</span>
            <span>{fmtN(report.breakdown.equipment.total?.min)} – {fmtN(report.breakdown.equipment.total?.max)}</span>
          </div>
        </div>
      )}

      {/* Monthly charges */}
      {report.monthlyCharges && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5">
          <h3 className="font-semibold mb-3">Charges mensuelles</h3>
          <div className="space-y-2">
            {report.monthlyCharges.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.category}</span>
                <span>{fmtN(item.min)} – {fmtN(item.max)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex justify-between font-semibold text-sm">
            <span>Total mensuel</span>
            <span>{fmtN(report.monthlyCharges.total?.min)} – {fmtN(report.monthlyCharges.total?.max)}</span>
          </div>
        </div>
      )}

      {/* Profitability */}
      {report.profitability && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Rentabilité estimée
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Seuil de rentabilité</p>
              <p className="text-lg font-bold">{fmtN(report.profitability.breakEvenKgPerMonth)} kg</p>
              <p className="text-xs text-muted-foreground">par mois</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">ROI estimé</p>
              <p className="text-lg font-bold">{report.profitability.estimatedRoiMonths?.min}–{report.profitability.estimatedRoiMonths?.max} mois</p>
              <p className="text-xs text-muted-foreground">retour investissement</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Revenu mensuel estimé</p>
              <p className="text-lg font-bold text-green-600">{fmtN(report.profitability.estimatedMonthlyRevenue?.min)}</p>
              <p className="text-xs text-muted-foreground">minimum</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Marge estimée</p>
              <p className="text-lg font-bold">{report.profitability.estimatedMarginPct?.min}–{report.profitability.estimatedMarginPct?.max}%</p>
              <p className="text-xs text-muted-foreground">bénéfice net</p>
            </div>
          </div>
        </div>
      )}

      {/* Local insights */}
      {report.localInsights && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5">
          <h3 className="font-semibold mb-3">Contexte local</h3>
          {report.localInsights.marketContext && (
            <p className="text-sm text-muted-foreground mb-3">{report.localInsights.marketContext}</p>
          )}
          {report.localInsights.administrativeRequirements?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Démarches administratives</p>
              <ul className="space-y-1">
                {report.localInsights.administrativeRequirements.map((req: string, i: number) => (
                  <li key={i} className="text-sm flex gap-2"><span className="text-primary">✓</span>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Risks */}
      {report.risks?.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Risques à anticiper
          </h3>
          <ul className="space-y-2">
            {report.risks.map((r: string, i: number) => (
              <li key={i} className="text-sm flex gap-2 text-muted-foreground"><span className="text-amber-500 flex-shrink-0">⚠</span>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations?.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5">
          <h3 className="font-semibold mb-3">Recommandations</h3>
          <ul className="space-y-2">
            {report.recommendations.map((r: string, i: number) => (
              <li key={i} className="text-sm flex gap-2"><span className="text-primary">→</span>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps */}
      {report.nextSteps?.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5">
          <h3 className="font-semibold mb-3">Prochaines étapes</h3>
          <ol className="space-y-2">
            {report.nextSteps.map((s: string, i: number) => (
              <li key={i} className="text-sm flex gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Disclaimer */}
      {report.disclaimer && (
        <p className="text-xs text-muted-foreground text-center italic px-4">{report.disclaimer}</p>
      )}
    </div>
  );
}
