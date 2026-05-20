import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Calculator, Download, Link2, ChevronDown, MessageCircle, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Country data ────────────────────────────────────────────────────────────
interface CountryMeta { label: string; currency: string; cityPlaceholder: string; dialCode: string; dialCodeNumeric: string; }
const COUNTRY_META: Record<string, CountryMeta> = {
  cameroun:     { label: "Cameroun",         currency: "FCFA", dialCode: "+237", dialCodeNumeric: "237", cityPlaceholder: "ex: Douala, Yaoundé..." },
  senegal:      { label: "Sénégal",           currency: "FCFA", dialCode: "+221", dialCodeNumeric: "221", cityPlaceholder: "ex: Dakar, Thiès..." },
  cote_divoire: { label: "Côte d'Ivoire",     currency: "FCFA", dialCode: "+225", dialCodeNumeric: "225", cityPlaceholder: "ex: Abidjan, Bouaké..." },
  mali:         { label: "Mali",              currency: "FCFA", dialCode: "+223", dialCodeNumeric: "223", cityPlaceholder: "ex: Bamako, Sikasso..." },
  burkina_faso: { label: "Burkina Faso",      currency: "FCFA", dialCode: "+226", dialCodeNumeric: "226", cityPlaceholder: "ex: Ouagadougou..." },
  guinee:       { label: "Guinée",            currency: "GNF",  dialCode: "+224", dialCodeNumeric: "224", cityPlaceholder: "ex: Conakry, Kankan..." },
  rdc:          { label: "RD Congo",          currency: "USD",  dialCode: "+243", dialCodeNumeric: "243", cityPlaceholder: "ex: Kinshasa, Goma..." },
  gabon:        { label: "Gabon",             currency: "FCFA", dialCode: "+241", dialCodeNumeric: "241", cityPlaceholder: "ex: Libreville..." },
  congo:        { label: "Congo-Brazzaville", currency: "FCFA", dialCode: "+242", dialCodeNumeric: "242", cityPlaceholder: "ex: Brazzaville..." },
  togo:         { label: "Togo",              currency: "FCFA", dialCode: "+228", dialCodeNumeric: "228", cityPlaceholder: "ex: Lomé, Kpalimé..." },
  benin:        { label: "Bénin",             currency: "FCFA", dialCode: "+229", dialCodeNumeric: "229", cityPlaceholder: "ex: Cotonou, Porto-Novo..." },
  tchad:        { label: "Tchad",             currency: "FCFA", dialCode: "+235", dialCodeNumeric: "235", cityPlaceholder: "ex: N'Djamena..." },
  centrafrique: { label: "Centrafrique",      currency: "FCFA", dialCode: "+236", dialCodeNumeric: "236", cityPlaceholder: "ex: Bangui..." },
  niger:        { label: "Niger",             currency: "FCFA", dialCode: "+227", dialCodeNumeric: "227", cityPlaceholder: "ex: Niamey..." },
  maroc:        { label: "Maroc",             currency: "MAD",  dialCode: "+212", dialCodeNumeric: "212", cityPlaceholder: "ex: Casablanca, Rabat..." },
  tunisie:      { label: "Tunisie",           currency: "TND",  dialCode: "+216", dialCodeNumeric: "216", cityPlaceholder: "ex: Tunis, Sfax..." },
  algerie:      { label: "Algérie",           currency: "DZD",  dialCode: "+213", dialCodeNumeric: "213", cityPlaceholder: "ex: Alger, Oran..." },
  france:       { label: "France",            currency: "EUR",  dialCode: "+33",  dialCodeNumeric: "33",  cityPlaceholder: "ex: Paris, Lyon..." },
  belgique:     { label: "Belgique",          currency: "EUR",  dialCode: "+32",  dialCodeNumeric: "32",  cityPlaceholder: "ex: Bruxelles, Liège..." },
  suisse:       { label: "Suisse",            currency: "CHF",  dialCode: "+41",  dialCodeNumeric: "41",  cityPlaceholder: "ex: Genève, Lausanne..." },
};
const COUNTRY_GROUPS = [
  { label: "Afrique Centrale",   keys: ["cameroun","gabon","congo","rdc","tchad","centrafrique"] },
  { label: "Afrique de l'Ouest", keys: ["senegal","cote_divoire","mali","burkina_faso","guinee","togo","benin","niger"] },
  { label: "Afrique du Nord",    keys: ["maroc","tunisie","algerie"] },
  { label: "Europe",             keys: ["france","belgique","suisse"] },
];

const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
const WaIcon = ({ className = "w-4 h-4 fill-white" }) => (
  <svg viewBox="0 0 24 24" className={className}><path d={WA_PATH} /></svg>
);

const SESSION_KEY = "pressflow_calc_v2";
type Step = 1 | 2 | 3 | 4 | 5 | 6;

// ─── Types ───────────────────────────────────────────────────────────────────
interface CostInputs {
  water: string; electricity: string; detergent: string;
  salaries: string; rent: string; other: string;
  volumeKgMonth: string; pricePerKg: string;
  machineCount: string; cyclesPerDay: string; employeeCount: string;
  packagingCost: string; maintenanceCost: string; fuelCost: string;
}
interface ProfCalc {
  totalCosts: number; revenue: number; profit: number; margin: number; costPerKg: number;
  healthScore: number; confidenceScore: number;
  breakdown: { water: number; electricity: number; detergent: number; salaries: number; rent: number; other: number; };
}
interface FormState {
  firstName: string; lastName: string; businessName: string;
  country: string; city: string; phoneLocal: string; phone: string;
  whatsappOptIn: boolean; email: string; referralSource: string;
  calculationLevel: string;
  costInputs: CostInputs;
  pressingType: string; dailyCapacity: string;
  profCalc: ProfCalc | null;
}

const EMPTY_COSTS: CostInputs = {
  water: "", electricity: "", detergent: "", salaries: "", rent: "", other: "",
  volumeKgMonth: "", pricePerKg: "",
  machineCount: "", cyclesPerDay: "", employeeCount: "", packagingCost: "", maintenanceCost: "", fuelCost: "",
};
const EMPTY_FORM: FormState = {
  firstName: "", lastName: "", businessName: "", country: "", city: "",
  phoneLocal: "", phone: "", whatsappOptIn: true, email: "", referralSource: "",
  calculationLevel: "", costInputs: EMPTY_COSTS,
  pressingType: "", dailyCapacity: "", profCalc: null,
};

// ─── Calculation engine ───────────────────────────────────────────────────────
function computeProfitability(inputs: CostInputs, level: string): ProfCalc {
  const n = (v: string) => parseFloat(v) || 0;
  const water = n(inputs.water), elec = n(inputs.electricity), det = n(inputs.detergent);
  const sal = n(inputs.salaries), rent = n(inputs.rent), other = n(inputs.other);
  const pkg = n(inputs.packagingCost), maint = n(inputs.maintenanceCost), fuel = n(inputs.fuelCost);
  const totalCosts = water + elec + det + sal + rent + other + pkg + maint + fuel;
  const volume = n(inputs.volumeKgMonth), price = n(inputs.pricePerKg);
  const revenue = volume * price;
  const profit = revenue - totalCosts;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const costPerKg = volume > 0 ? totalCosts / volume : 0;

  let score = 0;
  if (margin >= 30) score += 40; else if (margin >= 20) score += 30; else if (margin >= 10) score += 20; else if (margin > 0) score += 10;
  if (totalCosts > 0) {
    const sR = sal / totalCosts, eR = elec / totalCosts;
    score += sR <= 0.45 ? 15 : sR <= 0.60 ? 7 : 0;
    score += eR <= 0.20 ? 15 : eR <= 0.30 ? 7 : 0;
  }
  if (revenue > 0 && totalCosts > 0) {
    const cov = revenue / totalCosts;
    score += cov >= 1.5 ? 30 : cov >= 1.2 ? 20 : cov >= 1.0 ? 10 : 0;
  }
  const confMap: Record<string, number> = { simple: 55, smart: 78, advanced: 95 };
  return {
    totalCosts, revenue, profit, margin, costPerKg,
    healthScore: Math.min(100, score),
    confidenceScore: confMap[level] ?? 55,
    breakdown: { water, electricity: elec, detergent: det, salaries: sal, rent, other: other + pkg + maint + fuel },
  };
}

function getSmartRecommendations(calc: ProfCalc): string[] {
  const { margin, breakdown, totalCosts, revenue } = calc;
  if (!totalCosts || !revenue) return [];
  const recs: string[] = [];
  if (margin < 0) recs.push("⚠️ Déficit détecté — revoyez vos tarifs ou réduisez les charges urgentes.");
  else if (margin < 15) recs.push("📈 Marge faible. +10-15% sur vos tarifs peut redresser la rentabilité.");
  else if (margin >= 30) recs.push("🎉 Excellente rentabilité ! Pensez à réinvestir pour augmenter la capacité.");
  const eR = breakdown.electricity / totalCosts;
  if (eR > 0.25) recs.push(`⚡ Électricité = ${Math.round(eR * 100)}% des charges. Optimisez les cycles ou investissez dans le solaire.`);
  const sR = breakdown.salaries / totalCosts;
  if (sR > 0.5) recs.push(`👥 Masse salariale = ${Math.round(sR * 100)}% des charges. Automatisez ou optimisez les plannings.`);
  const rR = breakdown.rent / totalCosts;
  if (rR > 0.3) recs.push(`🏢 Loyer = ${Math.round(rR * 100)}% des charges. Renégociez ou augmentez le volume traité.`);
  if (margin > 0) recs.push("✅ Utilisez PressFlow pour suivre votre rentabilité en temps réel.");
  return recs;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: Step }) {
  const labels = ["Coordonnées", "Niveau", "Coûts", "Type", "Capacité", "Résultat"];
  const total = 6;
  return (
    <div className="w-full max-w-lg mx-auto mb-8 print:hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">Étape {step} sur {total}</span>
        <span className="text-xs text-muted-foreground">{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(step / total) * 100}%` }} />
      </div>
      <div className="hidden sm:flex justify-between mt-2">
        {labels.map((lbl, i) => (
          <span key={i} className={cn("text-[10px] font-medium", i + 1 <= step ? "text-primary" : "text-muted-foreground/40")}>{lbl}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Page 1: Contact ──────────────────────────────────────────────────────────
function Page1({ form, setForm, onSubmit, isLoading }: {
  form: FormState; setForm: (fn: (f: FormState) => FormState) => void;
  onSubmit: () => void; isLoading: boolean;
}) {
  const meta = COUNTRY_META[form.country];
  const dialCode = meta?.dialCode ?? "+237";
  const canSubmit = !!(form.firstName && form.country && form.city && form.phone);
  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Parlez-nous de vous</h1>
        <p className="text-muted-foreground text-sm mt-1">Personnalisation selon votre marché local</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prénom *</Label>
          <Input value={form.firstName} autoFocus onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Jean" className="mt-1" data-testid="input-firstname" />
        </div>
        <div>
          <Label>Nom</Label>
          <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Dupont" className="mt-1" data-testid="input-lastname" />
        </div>
      </div>
      <div>
        <Label>Nom de votre pressing <span className="text-muted-foreground font-normal text-xs">(optionnel)</span></Label>
        <Input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="ex: Pressing Express Douala" className="mt-1" data-testid="input-business-name" />
      </div>
      <div>
        <Label>Pays *</Label>
        <Select value={form.country} onValueChange={v => setForm(f => ({ ...f, country: v, phoneLocal: "", phone: "", city: "" }))}>
          <SelectTrigger className="mt-1" data-testid="select-country"><SelectValue placeholder="Sélectionnez votre pays" /></SelectTrigger>
          <SelectContent>
            {COUNTRY_GROUPS.map(g => (
              <SelectGroup key={g.label}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.keys.map(key => COUNTRY_META[key] && <SelectItem key={key} value={key}>{COUNTRY_META[key].label}</SelectItem>)}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Ville *</Label>
        <Input value={form.city} disabled={!form.country} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder={meta?.cityPlaceholder ?? "Votre ville..."} className="mt-1" data-testid="input-city" />
      </div>
      <div>
        <Label>Téléphone * <span className="text-xs text-muted-foreground font-normal">— pour recevoir votre rapport</span></Label>
        <div className="flex gap-2 mt-1">
          <div className="flex items-center justify-center px-3 min-w-[64px] bg-muted border border-border rounded-lg text-sm font-semibold text-muted-foreground flex-shrink-0">{dialCode}</div>
          <Input type="tel" value={form.phoneLocal} disabled={!form.country}
            onChange={e => {
              const local = e.target.value.replace(/\D/g, "");
              setForm(f => ({ ...f, phoneLocal: local, phone: (meta?.dialCodeNumeric ?? "") + local }));
            }}
            placeholder="6XX XXX XXX" className="flex-1" data-testid="input-phone" />
        </div>
        <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
          <div data-testid="checkbox-whatsapp" onClick={() => setForm(f => ({ ...f, whatsappOptIn: !f.whatsappOptIn }))}
            className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
              form.whatsappOptIn ? "bg-green-500 border-green-500" : "border-muted-foreground bg-background")}>
            {form.whatsappOptIn && <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
          </div>
          <span className="text-sm">Ce numéro est mon WhatsApp — envoyer mon rapport ici</span>
          <WaIcon className="w-4 h-4 fill-green-500 flex-shrink-0" />
        </label>
      </div>
      <div>
        <Label>Email <span className="text-muted-foreground font-normal text-xs">(optionnel)</span></Label>
        <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="vous@example.com" className="mt-1" data-testid="input-email" />
      </div>
      <div>
        <Label>Comment nous avez-vous trouvés ? <span className="text-muted-foreground font-normal text-xs">(optionnel)</span></Label>
        <Select value={form.referralSource} onValueChange={v => setForm(f => ({ ...f, referralSource: v }))}>
          <SelectTrigger className="mt-1" data-testid="select-referral"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp_social">WhatsApp / Réseaux sociaux</SelectItem>
            <SelectItem value="referral">Recommandation d'un ami</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="other">Autre</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground text-center">🔒 Vos données sont protégées et ne seront jamais partagées.</p>
      <Button size="lg" className="w-full" disabled={!canSubmit || isLoading} onClick={onSubmit} data-testid="button-submit-page1">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</> : "Continuer →"}
      </Button>
    </div>
  );
}

// ─── Page 2: Calculation level ────────────────────────────────────────────────
function Page2Level({ onSelect }: { onSelect: (level: string) => void }) {
  const levels = [
    {
      id: "simple", emoji: "🧮", title: "Rapide", subtitle: "Pour débutants",
      confidence: 55, color: "hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20",
      selectedColor: "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      questions: ["Eau, électricité, détergents", "Salaires & loyer", "Volume & prix de vente"],
      time: "2 min",
    },
    {
      id: "smart", emoji: "🤖", title: "Précis", subtitle: "Recommandé",
      confidence: 78, color: "hover:border-primary hover:bg-primary/5",
      selectedColor: "border-primary bg-primary/5",
      badge: "bg-primary/10 text-primary",
      questions: ["Toutes les charges simples", "Machines & cycles", "Personnel & emballages"],
      time: "4 min",
      recommended: true,
    },
    {
      id: "advanced", emoji: "📊", title: "Expert", subtitle: "Analyse complète",
      confidence: 95, color: "hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20",
      selectedColor: "border-purple-500 bg-purple-50 dark:bg-purple-900/20",
      badge: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      questions: ["Toutes les charges", "Carburant & maintenance", "Amortissements"],
      time: "6 min",
    },
  ];
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Choisissez votre niveau d'analyse</h2>
        <p className="text-muted-foreground text-sm mt-1">Plus d'infos = résultats plus précis</p>
      </div>
      <div className="space-y-3">
        {levels.map(lv => (
          <button key={lv.id} type="button" onClick={() => onSelect(lv.id)} data-testid={`card-level-${lv.id}`}
            className={cn("w-full text-left p-5 rounded-2xl border-2 transition-all duration-150 active:scale-[0.99]",
              "border-border bg-card", lv.color)}>
            <div className="flex items-start gap-4">
              <span className="text-3xl flex-shrink-0">{lv.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-base">{lv.title}</p>
                  {lv.recommended && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">⭐ Recommandé</span>}
                  <span className="ml-auto text-xs text-muted-foreground">~{lv.time}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{lv.subtitle}</p>
                <div className="flex flex-wrap gap-1.5">
                  {lv.questions.map((q, i) => (
                    <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{q}</span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className={cn("text-xs font-bold px-2 py-1 rounded-lg", lv.badge)}>
                  {lv.confidence}% précis
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-4">Appuyez pour continuer automatiquement</p>
    </div>
  );
}

// ─── Page 3: Cost inputs ───────────────────────────────────────────────────────
function NumInput({ label, value, onChange, unit, hint, testId }: {
  label: string; value: string; onChange: (v: string) => void; unit: string; hint?: string; testId?: string;
}) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      <div className="relative mt-1">
        <Input type="number" min="0" value={value} onChange={e => onChange(e.target.value)}
          placeholder="0" className="pr-16" data-testid={testId} />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">{unit}</span>
      </div>
    </div>
  );
}

function Page3Costs({ form, setForm, onNext }: {
  form: FormState;
  setForm: (fn: (f: FormState) => FormState) => void;
  onNext: () => void;
}) {
  const level = form.calculationLevel;
  const meta = COUNTRY_META[form.country];
  const currency = meta?.currency ?? "FCFA";
  const ci = form.costInputs;
  const set = (field: keyof CostInputs, v: string) =>
    setForm(f => ({ ...f, costInputs: { ...f.costInputs, [field]: v } }));

  const calc = computeProfitability(ci, level);
  const hasData = calc.totalCosts > 0 || calc.revenue > 0;

  const getScoreColor = (s: number) => s >= 70 ? "text-green-600" : s >= 50 ? "text-amber-600" : "text-red-600";
  const getMarginColor = (m: number) => m >= 25 ? "text-green-600" : m >= 10 ? "text-amber-600" : "text-red-600";

  const canNext = !!(ci.water || ci.electricity || ci.salaries) && !!(ci.volumeKgMonth) && !!(ci.pricePerKg);

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold">Vos charges mensuelles</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {level === "simple" ? "7 questions essentielles" : level === "smart" ? "12 questions pour plus de précision" : "15 questions — analyse complète"}
        </p>
      </div>

      {/* Live preview */}
      {hasData && (
        <div className="sticky top-2 z-10 bg-white dark:bg-slate-900 border border-border rounded-2xl p-4 shadow-lg shadow-black/5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Aperçu en temps réel</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Revenus/mois</p>
              <p className="font-bold text-sm">{Math.round(calc.revenue).toLocaleString("fr-FR")} {currency}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Charges/mois</p>
              <p className="font-bold text-sm">{Math.round(calc.totalCosts).toLocaleString("fr-FR")} {currency}</p>
            </div>
            <div className={cn("rounded-xl p-3", calc.profit >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
              <p className="text-xs text-muted-foreground">Bénéfice/mois</p>
              <p className={cn("font-bold text-sm", calc.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                {calc.profit >= 0 ? "+" : ""}{Math.round(calc.profit).toLocaleString("fr-FR")} {currency}
              </p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Marge nette</p>
              <p className={cn("font-bold text-sm", getMarginColor(calc.margin))}>
                {calc.margin.toFixed(1)}%
              </p>
            </div>
          </div>
          {calc.totalCosts > 0 && calc.revenue > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Score santé :</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-300",
                  calc.healthScore >= 70 ? "bg-green-500" : calc.healthScore >= 50 ? "bg-amber-500" : "bg-red-500")}
                  style={{ width: `${calc.healthScore}%` }} />
              </div>
              <span className={cn("text-xs font-bold", getScoreColor(calc.healthScore))}>{calc.healthScore}/100</span>
            </div>
          )}
        </div>
      )}

      {/* Charges Section */}
      <div className="space-y-4">
        <p className="font-semibold text-sm border-b border-border pb-2">💸 Charges mensuelles</p>
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="Eau" value={ci.water} onChange={v => set("water", v)} unit={currency} hint="Facture eau mensuelle" testId="input-water" />
          <NumInput label="Électricité" value={ci.electricity} onChange={v => set("electricity", v)} unit={currency} hint="Facture électricité" testId="input-electricity" />
          <NumInput label="Détergents & produits" value={ci.detergent} onChange={v => set("detergent", v)} unit={currency} hint="Lessive, assouplissant..." testId="input-detergent" />
          <NumInput label="Loyer" value={ci.rent} onChange={v => set("rent", v)} unit={currency} hint="Loyer mensuel local" testId="input-rent" />
        </div>
        <NumInput label="Salaires (total)" value={ci.salaries} onChange={v => set("salaries", v)} unit={currency} hint="Total masse salariale mensuelle" testId="input-salaries" />
        <NumInput label="Autres charges" value={ci.other} onChange={v => set("other", v)} unit={currency} hint="Internet, fournitures, divers..." testId="input-other" />
      </div>

      {/* Smart / Advanced extras */}
      {(level === "smart" || level === "advanced") && (
        <div className="space-y-4">
          <p className="font-semibold text-sm border-b border-border pb-2">⚙️ Opérations (précision +)</p>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Nombre de machines" value={ci.machineCount} onChange={v => set("machineCount", v)} unit="unités" testId="input-machines" />
            <NumInput label="Cycles / jour / machine" value={ci.cyclesPerDay} onChange={v => set("cyclesPerDay", v)} unit="cycles" testId="input-cycles" />
            <NumInput label="Nombre d'employés" value={ci.employeeCount} onChange={v => set("employeeCount", v)} unit="pers." testId="input-employees" />
            <NumInput label="Emballages / livraison" value={ci.packagingCost} onChange={v => set("packagingCost", v)} unit={currency} testId="input-packaging" />
          </div>
          <NumInput label="Maintenance machines" value={ci.maintenanceCost} onChange={v => set("maintenanceCost", v)} unit={currency} hint="Entretien et réparations mensuelles estimées" testId="input-maintenance" />
        </div>
      )}

      {level === "advanced" && (
        <div className="space-y-4">
          <p className="font-semibold text-sm border-b border-border pb-2">🚚 Logistique & amortissement</p>
          <NumInput label="Carburant / transport" value={ci.fuelCost} onChange={v => set("fuelCost", v)} unit={currency} hint="Livraisons, déplacements..." testId="input-fuel" />
        </div>
      )}

      {/* Production & Revenue */}
      <div className="space-y-4">
        <p className="font-semibold text-sm border-b border-border pb-2">📈 Production & revenus</p>
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="Volume traité / mois *" value={ci.volumeKgMonth} onChange={v => set("volumeKgMonth", v)} unit="kg/mois" hint="Total kg traités" testId="input-volume" />
          <NumInput label="Prix de vente moyen *" value={ci.pricePerKg} onChange={v => set("pricePerKg", v)} unit={`${currency}/kg`} hint="Tarif moyen au kg" testId="input-price" />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">* Champs obligatoires pour le calcul</p>

      <Button size="lg" className="w-full" disabled={!canNext} onClick={onNext} data-testid="button-next-page3">
        Calculer ma rentabilité →
      </Button>
    </div>
  );
}

// ─── Page 4: Pressing type ────────────────────────────────────────────────────
function Page4Type({ form, onSelect }: { form: FormState; onSelect: (v: string) => void }) {
  const options = [
    { value: "quartier", emoji: "🏠", title: "Pressing de quartier", description: "Clientèle locale et résidentielle", machines: "1 à 2 machines", budgetHint: "2M – 6M FCFA", examples: "Particuliers, familles" },
    { value: "semi_pro", emoji: "🏢", title: "Semi-professionnel", description: "Entreprises et particuliers, volume moyen", machines: "2 à 4 machines", budgetHint: "6M – 20M FCFA", examples: "PME, restaurants, boutiques" },
    { value: "industriel", emoji: "🏭", title: "Industriel", description: "Gros volumes, clients institutionnels", machines: "4 machines et plus", budgetHint: "20M – 60M FCFA", examples: "Hôtels, hôpitaux" },
  ];
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Votre type de pressing</h2>
        <p className="text-muted-foreground text-sm mt-1">Pour affiner votre estimation de démarrage IA</p>
      </div>
      <div className="space-y-3">
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onSelect(opt.value)} data-testid={`card-type-${opt.value}`}
            className={cn("w-full text-left p-5 rounded-2xl border-2 transition-all duration-150",
              "hover:border-primary hover:shadow-md hover:shadow-primary/10 active:scale-[0.99]",
              form.pressingType === opt.value ? "border-primary bg-primary/5" : "border-border bg-card")}>
            <div className="flex items-start gap-4">
              <span className="text-3xl flex-shrink-0">{opt.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-base">{opt.title}</p>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg flex-shrink-0">{opt.budgetHint}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{opt.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{opt.machines}</span>
                  <span className="text-xs text-muted-foreground">{opt.examples}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-4">Appuyez pour continuer automatiquement</p>
    </div>
  );
}

// ─── Page 5: Capacity ─────────────────────────────────────────────────────────
function Page5Capacity({ form, onSelect }: { form: FormState; onSelect: (v: string) => void }) {
  const options = [
    { value: "less_50", emoji: "🌱", title: "Moins de 50 kg / jour", description: "Idéal pour démarrer et tester le marché", detail: "~6 à 10 clients/jour" },
    { value: "50_150", emoji: "📈", title: "50 à 150 kg / jour", description: "Activité soutenue, clientèle mixte", detail: "~10 à 30 clients/jour" },
    { value: "more_150", emoji: "🏆", title: "Plus de 150 kg / jour", description: "Volume industriel, contrats entreprises", detail: "Hôtels, hôpitaux, blanchisseries" },
  ];
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Capacité journalière cible</h2>
        <p className="text-muted-foreground text-sm mt-1">Combien de kg souhaitez-vous traiter par jour ?</p>
      </div>
      <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 mb-5">
        <p className="text-xs text-muted-foreground">💡 Une famille produit ~5-8 kg/semaine. Un hôtel de 50 chambres génère ~80-120 kg/jour.</p>
      </div>
      <div className="space-y-3">
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onSelect(opt.value)} data-testid={`card-capacity-${opt.value}`}
            className={cn("w-full text-left p-5 rounded-2xl border-2 transition-all duration-150",
              "hover:border-primary hover:shadow-md hover:shadow-primary/10 active:scale-[0.99]",
              form.dailyCapacity === opt.value ? "border-primary bg-primary/5" : "border-border bg-card")}>
            <div className="flex items-start gap-4">
              <span className="text-3xl flex-shrink-0">{opt.emoji}</span>
              <div>
                <p className="font-bold text-base">{opt.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{opt.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{opt.detail}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-4">Appuyez pour lancer l'analyse IA</p>
    </div>
  );
}

// ─── Loading state ────────────────────────────────────────────────────────────
function LoadingState({ city, countryLabel, currentMsg }: { city: string; countryLabel: string; currentMsg: number }) {
  const messages = [
    "Calcul de votre rentabilité...",
    `Recherche des prix d'équipements à ${city}...`,
    "Analyse des loyers commerciaux...",
    "Vérification tarifs eau et électricité...",
    `Données administratives — ${countryLabel}...`,
    "Analyse du marché pressing local...",
    "Calcul du seuil de rentabilité...",
    "Rédaction de vos recommandations...",
    "Finalisation du rapport...",
  ];
  return (
    <div className="w-full max-w-lg mx-auto text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <h3 className="text-xl font-bold mb-2">L'IA analyse votre marché...</h3>
      <p className="text-sm text-muted-foreground mb-8">Recherche de données actuelles pour {city}</p>
      <div className="space-y-2 text-left max-w-sm mx-auto">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex items-center gap-3 text-sm transition-all duration-300",
            i < currentMsg ? "text-green-600 dark:text-green-400" : "",
            i === currentMsg ? "text-foreground font-medium" : "",
            i > currentMsg ? "text-muted-foreground/40" : "")}>
            {i < currentMsg
              ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              : i === currentMsg
                ? <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                : <div className="w-4 h-4 rounded-full border border-muted-foreground/30 flex-shrink-0" />}
            <span>{msg}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-6">Cela peut prendre 20 à 40 secondes...</p>
    </div>
  );
}

// ─── Health Score Circle ───────────────────────────────────────────────────────
function HealthScoreCircle({ score }: { score: number }) {
  const r = 42, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 85 ? "#16a34a" : score >= 70 ? "#2563eb" : score >= 50 ? "#d97706" : "#dc2626";
  const label = score >= 85 ? "Excellent" : score >= 70 ? "Bon" : score >= 50 ? "À optimiser" : "Risqué";
  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" className="text-muted stroke-[10]" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black leading-none">{score}</span>
        <span className="text-[11px] font-semibold mt-0.5" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

// ─── Cost breakdown bars ───────────────────────────────────────────────────────
function CostBreakdownBars({ breakdown, totalCosts, currency }: {
  breakdown: ProfCalc['breakdown']; totalCosts: number; currency: string;
}) {
  const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
  const items = [
    { name: "Salaires", value: breakdown.salaries, cls: "bg-red-500" },
    { name: "Électricité", value: breakdown.electricity, cls: "bg-amber-500" },
    { name: "Loyer", value: breakdown.rent, cls: "bg-orange-500" },
    { name: "Détergents", value: breakdown.detergent, cls: "bg-purple-500" },
    { name: "Eau", value: breakdown.water, cls: "bg-blue-500" },
    { name: "Autres", value: breakdown.other, cls: "bg-slate-400" },
  ].filter(i => i.value > 0).sort((a, b) => b.value - a.value);

  if (!items.length) return null;
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const pct = totalCosts > 0 ? (item.value / totalCosts) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20 text-right flex-shrink-0">{item.name}</span>
            <div className="flex-1 h-3.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-700", item.cls)} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 w-24 justify-end">
              <span className="text-xs font-bold">{pct.toFixed(0)}%</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">({fmt(item.value)} {currency})</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail sub-components (AI report) ───────────────────────────────────────
function DetailSection({ title, icon, data, currency }: { title: string; icon: string; data: any; currency: string }) {
  const fmt = (n: number) => n?.toLocaleString("fr-FR") ?? "—";
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

function MonthlyChargesSection({ data, currency }: { data: any; currency: string }) {
  const fmt = (n: number) => n?.toLocaleString("fr-FR") ?? "—";
  if (!data?.total) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm">📅 Charges mensuelles estimées (IA)</p>
        <p className="text-sm font-bold text-primary">{fmt(data.total.min)} — {fmt(data.total.max)} {currency}</p>
      </div>
      <div className="space-y-1 pl-2">
        {data.items?.map((item: any, i: number) => (
          <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
            <span className="text-muted-foreground">{item.category}</span>
            <span>{fmt(item.min)} — {fmt(item.max)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfitabilityAiSection({ data, currency }: { data: any; currency: string }) {
  const fmt = (n: number) => n?.toLocaleString("fr-FR") ?? "—";
  if (!data) return null;
  const items = [
    { label: "Seuil de rentabilité", value: `${data.breakEvenKgPerMonth} kg/mois` },
    { label: "Retour investissement", value: `${data.estimatedRoiMonths?.min}–${data.estimatedRoiMonths?.max} mois` },
    { label: "CA mensuel potentiel", value: `${fmt(data.estimatedMonthlyRevenue?.min)}–${fmt(data.estimatedMonthlyRevenue?.max)} ${currency}`, hl: "green" },
    { label: "Bénéfice mensuel estimé", value: `${fmt(data.estimatedMonthlyProfit?.min)}–${fmt(data.estimatedMonthlyProfit?.max)} ${currency}`, hl: "green" },
    { label: "Marge nette estimée", value: `${data.estimatedMarginPct?.min}–${data.estimatedMarginPct?.max}%`, hl: "blue" },
  ];
  return (
    <div>
      <p className="font-semibold text-sm mb-3">📊 Projections IA</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div key={i} className={cn("rounded-lg p-3",
            item.hl === "green" ? "bg-green-50 dark:bg-green-900/20" :
            item.hl === "blue" ? "bg-blue-50 dark:bg-blue-900/20" : "bg-muted/50")}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={cn("text-sm font-bold mt-0.5",
              item.hl === "green" ? "text-green-700 dark:text-green-400" :
              item.hl === "blue" ? "text-blue-700 dark:text-blue-400" : "")}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LocalInsightsSection({ data, city, countryLabel }: { data: any; city: string; countryLabel: string }) {
  if (!data) return null;
  return (
    <div>
      <p className="font-semibold text-sm mb-3">📍 Contexte local — {city}, {countryLabel}</p>
      {data.marketContext && <p className="text-sm text-muted-foreground mb-3">{data.marketContext}</p>}
      {data.rentContext && <div className="mb-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Loyers</p><p className="text-sm">{data.rentContext}</p></div>}
      {data.electricityContext && <div className="mb-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Électricité</p><p className="text-sm">{data.electricityContext}</p></div>}
      {data.administrativeSteps?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Démarches administratives</p>
          <ul className="space-y-1">
            {data.administrativeSteps.map((s: string, i: number) => (
              <li key={i} className="text-sm flex gap-2"><span className="text-primary">✓</span>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Result page ──────────────────────────────────────────────────────────────
function ResultPage({ report, form, result, leadId, profCalc }: {
  report: any; form: FormState; result: any; leadId: number; profCalc: ProfCalc | null;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = COUNTRY_META[form.country];
  const countryLabel = meta?.label ?? form.country;
  const currency = report?.totalBudget?.currency ?? meta?.currency ?? "FCFA";
  const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
  const recommendations = profCalc ? getSmartRecommendations(profCalc) : [];

  const scoreColor = (s: number) => s >= 85 ? "text-green-600" : s >= 70 ? "text-blue-600" : s >= 50 ? "text-amber-600" : "text-red-600";
  const scoreLabel = (s: number) => s >= 85 ? "Excellent" : s >= 70 ? "Bon" : s >= 50 ? "À optimiser" : "Risqué";

  const levelLabel: Record<string, string> = { simple: "Rapide (55%)", smart: "Précis (78%)", advanced: "Expert (95%)" };

  function copyLink() {
    if (result?.reportUrl) { navigator.clipboard.writeText(result.reportUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* WhatsApp confirmation */}
      {result?.whatsappSent && (
        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-400">Rapport envoyé sur WhatsApp ✓</p>
            <p className="text-xs text-green-700 dark:text-green-500">Vérifiez vos messages. Vous recevrez des conseils dans les prochains jours.</p>
          </div>
        </div>
      )}
      {result?.clickToChatUrl && (
        <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"><WaIcon /></div>
          <div className="flex-1">
            <p className="text-sm font-medium">Recevoir ce rapport sur WhatsApp</p>
            <p className="text-xs text-muted-foreground">Cliquez pour nous envoyer un message</p>
          </div>
          <a href={result.clickToChatUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" data-testid="button-wa-chat">Ouvrir</Button>
          </a>
        </div>
      )}

      {/* ── Profitability Dashboard ── */}
      {profCalc && profCalc.totalCosts > 0 && (
        <>
          {/* Health Score Hero */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <HealthScoreCircle score={profCalc.healthScore} />
                <p className="text-xs text-center text-muted-foreground mt-2">Score santé</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-bold text-lg">Votre pressing{form.businessName ? ` — ${form.businessName}` : ""}</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Revenus/mois</p>
                    <p className="font-bold text-sm text-green-600">{fmt(profCalc.revenue)} {currency}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Charges/mois</p>
                    <p className="font-bold text-sm">{fmt(profCalc.totalCosts)} {currency}</p>
                  </div>
                  <div className={cn("rounded-xl p-3", profCalc.profit >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
                    <p className="text-xs text-muted-foreground">Bénéfice/mois</p>
                    <div className="flex items-center gap-1">
                      {profCalc.profit >= 0
                        ? <TrendingUp className="w-3 h-3 text-green-600" />
                        : <TrendingDown className="w-3 h-3 text-red-600" />}
                      <p className={cn("font-bold text-sm", profCalc.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                        {profCalc.profit >= 0 ? "+" : ""}{fmt(profCalc.profit)} {currency}
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Marge nette</p>
                    <p className={cn("font-bold text-sm", scoreColor(profCalc.margin >= 30 ? 85 : profCalc.margin >= 20 ? 70 : profCalc.margin >= 10 ? 50 : 0))}>
                      {profCalc.margin.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">Précision :</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${profCalc.confidenceScore}%` }} />
                  </div>
                  <span className="text-xs font-bold text-primary">{profCalc.confidenceScore}%</span>
                  <span className="text-xs text-muted-foreground">— {levelLabel[form.calculationLevel] ?? ""}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="font-semibold text-sm mb-4">💸 Répartition de vos charges</p>
            <CostBreakdownBars breakdown={profCalc.breakdown} totalCosts={profCalc.totalCosts} currency={currency} />
            {profCalc.costPerKg > 0 && (
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Coût de revient au kg</span>
                <span className="font-bold text-sm">{fmt(profCalc.costPerKg)} {currency}/kg</span>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="font-semibold text-sm mb-3">🎯 Recommandations personnalisées</p>
              <ul className="space-y-2">
                {recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed">{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 text-muted-foreground/50">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-medium whitespace-nowrap">Estimation de démarrage (IA)</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </>
      )}

      {/* AI Startup Budget hero */}
      {report?.totalBudget && (
        <div className="bg-gradient-to-br from-primary to-primary/80 text-white rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 rounded-2xl" />
          <div className="relative">
            <p className="text-white/80 text-sm mb-1">Bonjour {form.firstName} 👋</p>
            <h2 className="text-xl font-bold mb-1">Budget de démarrage estimé (IA)</h2>
            <p className="text-white/70 text-sm mb-4">📍 {form.city}, {countryLabel}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-black">{report.totalBudget.min?.toLocaleString("fr-FR")}</span>
              <span className="text-xl text-white/60">—</span>
              <span className="text-3xl font-black">{report.totalBudget.max?.toLocaleString("fr-FR")}</span>
              <span className="text-lg text-white/70">{currency}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {report.breakdown?.equipment?.total && (
                <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">📦 Équipements : {report.breakdown.equipment.total.min?.toLocaleString("fr-FR")}–{report.breakdown.equipment.total.max?.toLocaleString("fr-FR")} {currency}</div>
              )}
              {report.profitability?.estimatedRoiMonths && (
                <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">📅 ROI : {report.profitability.estimatedRoiMonths.min}–{report.profitability.estimatedRoiMonths.max} mois</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="grid sm:grid-cols-2 gap-3 print:hidden">
        <Button variant="outline" size="lg" className="h-14 gap-3 text-base" onClick={() => window.print()} data-testid="button-print">
          <Download className="w-5 h-5" />
          <div className="text-left"><div className="font-semibold text-sm">Télécharger le rapport</div><div className="text-xs text-muted-foreground">Format PDF</div></div>
        </Button>
        <a href={result?.expertUrl ?? "#"} target="_blank" rel="noopener noreferrer"
          onClick={() => fetch(`/api/calculator/track-expert-contact/${leadId}`, { method: "POST" }).catch(() => {})}>
          <Button size="lg" className="w-full h-14 gap-3 text-base bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/25" data-testid="button-expert">
            <WaIcon className="w-5 h-5 fill-white flex-shrink-0" />
            <div className="text-left"><div className="font-semibold text-sm">Parler à un expert</div><div className="text-xs text-white/80">Réponse WhatsApp rapide</div></div>
          </Button>
        </a>
      </div>

      {/* Trust signals */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground print:hidden">
        <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-500" /><span>Réponse généralement en moins de 2 heures</span></div>
        <div className="hidden sm:block w-px h-4 bg-border" />
        <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><span>+5 ans d'expérience · Plus de 20 entrepreneurs accompagnés</span></div>
      </div>

      {/* AI Detail accordion */}
      {report && (
        <div className="border border-border rounded-xl overflow-hidden">
          <button type="button" onClick={() => setShowDetail(!showDetail)} data-testid="button-toggle-detail"
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
            <span className="font-semibold text-sm">Voir le détail complet de l'estimation IA</span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", showDetail && "rotate-180")} />
          </button>
          {showDetail && (
            <div className="px-5 pb-5 space-y-5 border-t border-border">
              <DetailSection title="Équipements" icon="⚙️" data={report.breakdown?.equipment} currency={currency} />
              <DetailSection title="Aménagement & Installation" icon="🔨" data={report.breakdown?.setup} currency={currency} />
              <DetailSection title="Démarches administratives" icon="📋" data={report.breakdown?.administrative} currency={currency} />
              <MonthlyChargesSection data={report.monthlyCharges} currency={currency} />
              <ProfitabilityAiSection data={report.profitability} currency={currency} />
              <LocalInsightsSection data={report.localInsights} city={form.city} countryLabel={countryLabel} />
              {report.risks?.length > 0 && (
                <div>
                  <p className="font-semibold text-sm mb-2">⚠️ Points de vigilance</p>
                  <ul className="space-y-1">{report.risks.map((r: string, i: number) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span>•</span><span>{r}</span></li>)}</ul>
                </div>
              )}
              {report.recommendations?.length > 0 && (
                <div>
                  <p className="font-semibold text-sm mb-2">✅ Recommandations IA</p>
                  <ul className="space-y-1">{report.recommendations.map((r: string, i: number) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span>•</span><span>{r}</span></li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PressFlow CTA */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border border-border rounded-2xl p-6 print:hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-white stroke-2"><path d="M2 12 C5 9, 8 15, 12 12 C16 9, 19 15, 22 12" strokeLinecap="round" /></svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-base mb-1">Suivez votre rentabilité en temps réel</h3>
            <p className="text-sm text-muted-foreground mb-3">PressFlow vous aide à gérer chaque commande, paiement et votre rentabilité — conçu pour les pressings africains.</p>
            <div className="bg-white dark:bg-slate-800 border border-border rounded-xl px-4 py-3 mb-3">
              <p className="text-sm font-semibold text-primary">🎁 30 jours gratuits <span className="text-muted-foreground font-normal">OU</span> vos 50 premières commandes</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> Sans carte bancaire</span>
                <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> Sans engagement</span>
              </div>
            </div>
            <Button asChild><a href="/auth" data-testid="button-trial">Démarrer mon essai gratuit →</a></Button>
          </div>
        </div>
      </div>

      {/* Share link */}
      <div className="space-y-3 print:hidden">
        {result?.reportUrl && (
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-4 py-3">
            <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground flex-1 truncate">{result.reportUrl}</span>
            <Button size="sm" variant="outline" onClick={copyLink} data-testid="button-copy-link">{copied ? "Copié !" : "Copier"}</Button>
          </div>
        )}
        {report?.disclaimer && <p className="text-xs text-muted-foreground text-center leading-relaxed">{report.disclaimer}</p>}
      </div>
    </div>
  );
}

// ─── Main calculator component ────────────────────────────────────────────────
export default function CalculatorPage() {
  const { toast } = useToast();
  const saved = typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
  const initial = saved ? (() => { try { return JSON.parse(saved); } catch { return null; } })() : null;

  const [step, setStep]           = useState<Step>(initial?.step ?? 1);
  const [leadId, setLeadId]       = useState<number | null>(initial?.leadId ?? null);
  const [form, setForm]           = useState<FormState>({ ...EMPTY_FORM, ...initial?.form });
  const [result, setResult]       = useState<any>(initial?.result ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);

  const meta = COUNTRY_META[form.country];

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ step, leadId, form, result }));
  }, [step, leadId, form, result]);

  useEffect(() => {
    if (step !== 6 || result) return;
    const iv = setInterval(() => setLoadingMsg(i => (i + 1) % 9), 3500);
    return () => clearInterval(iv);
  }, [step, result]);

  async function handlePage1Submit() {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/calculator/save-lead", {
        firstName: form.firstName, lastName: form.lastName || null,
        businessName: form.businessName || null,
        phone: form.phone, whatsappOptIn: form.whatsappOptIn,
        email: form.email || null, country: form.country, city: form.city,
        referralSource: form.referralSource || null,
      });
      const data = await res.json();
      setLeadId(data.leadId);
      setStep(2);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message ?? "Erreur réseau", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  function handlePage2Select(level: string) {
    setForm(f => ({ ...f, calculationLevel: level }));
    setStep(3);
  }

  function handlePage3Next() {
    const profCalc = computeProfitability(form.costInputs, form.calculationLevel);
    setForm(f => ({ ...f, profCalc }));
    if (leadId) {
      apiRequest("PATCH", `/api/calculator/update-lead/${leadId}`, {
        calculationLevel: form.calculationLevel,
        profitabilityInputs: JSON.stringify({ inputs: form.costInputs, results: profCalc }),
        healthScore: profCalc.healthScore,
        confidenceScore: profCalc.confidenceScore,
        completedPage: 2,
      }).catch(() => {});
    }
    setStep(4);
  }

  function handlePage4Select(pressingType: string) {
    setForm(f => ({ ...f, pressingType }));
    if (leadId) apiRequest("PATCH", `/api/calculator/update-lead/${leadId}`, { pressingType, completedPage: 3 }).catch(() => {});
    setStep(5);
  }

  async function handlePage5Select(dailyCapacity: string) {
    setForm(f => ({ ...f, dailyCapacity }));
    if (!leadId) {
      toast({ title: "Erreur", description: "Session perdue. Veuillez recommencer.", variant: "destructive" });
      return;
    }
    setStep(6);
    setLoadingMsg(0);
    try {
      await apiRequest("PATCH", `/api/calculator/update-lead/${leadId}`, { dailyCapacity, completedPage: 4 });
      const res = await apiRequest("POST", `/api/calculator/generate-report/${leadId}`, {});
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message ?? "Erreur lors de la génération", variant: "destructive" });
      setStep(5);
    }
  }

  function handleBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
    else if (step === 5) setStep(4);
    else if (step === 6 && !result) setStep(5);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-border px-4 py-3 flex items-center justify-between print:hidden">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">PressFlow</span>
        </a>
        <a href="/auth"><Button size="sm" variant="outline" data-testid="link-login">Connexion</Button></a>
      </nav>

      {/* Print header */}
      <div className="hidden print:block px-8 py-6 border-b">
        <h1 className="text-2xl font-bold">Rapport PressFlow — Calculateur de rentabilité pressing</h1>
        <p className="text-sm text-muted-foreground mt-1">{form.city} · Généré le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {step <= 5 && (
          <div className="text-center mb-6 print:hidden">
            <span className="inline-block bg-primary/10 text-primary text-sm px-4 py-1.5 rounded-full font-medium mb-3">
              Outil gratuit · Résultat personnalisé en 2 minutes
            </span>
            {step === 1 && <><h1 className="text-2xl sm:text-3xl font-bold mb-1">Calculateur de rentabilité pressing</h1><p className="text-muted-foreground">Calculez la rentabilité de votre pressing en quelques minutes</p></>}
            {step === 2 && <><h1 className="text-2xl sm:text-3xl font-bold mb-1">Calculateur de rentabilité</h1><p className="text-muted-foreground">Choisissez votre niveau d'analyse</p></>}
          </div>
        )}

        <ProgressBar step={step} />

        {step > 1 && step < 6 && !result && (
          <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 print:hidden">← Retour</button>
        )}
        {step === 6 && result && (
          <button onClick={() => { setResult(null); setForm(f => ({ ...f, ...EMPTY_FORM })); setStep(1); sessionStorage.removeItem(SESSION_KEY); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 print:hidden">
            ← Nouvelle analyse
          </button>
        )}

        {step === 1 && <Page1 form={form} setForm={setForm} onSubmit={handlePage1Submit} isLoading={isLoading} />}
        {step === 2 && <Page2Level onSelect={handlePage2Select} />}
        {step === 3 && <Page3Costs form={form} setForm={setForm} onNext={handlePage3Next} />}
        {step === 4 && <Page4Type form={form} onSelect={handlePage4Select} />}
        {step === 5 && <Page5Capacity form={form} onSelect={handlePage5Select} />}
        {step === 6 && !result && <LoadingState city={form.city} countryLabel={meta?.label ?? form.country} currentMsg={loadingMsg} />}
        {step === 6 && result && (
          <ResultPage report={result.report} form={form} result={result} leadId={leadId!} profCalc={form.profCalc} />
        )}
      </div>
    </div>
  );
}
