import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Calculator, Download, Link2, ChevronDown, MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Country data ───────────────────────────────────────────────────────────
interface CountryMeta { label: string; currency: string; cityPlaceholder: string; dialCode: string; dialCodeNumeric: string; }

const COUNTRY_META: Record<string, CountryMeta> = {
  cameroun:     { label: "Cameroun",         currency: "FCFA", dialCode: "+237", dialCodeNumeric: "237", cityPlaceholder: "ex: Douala, Yaoundé, Bafoussam..." },
  senegal:      { label: "Sénégal",           currency: "FCFA", dialCode: "+221", dialCodeNumeric: "221", cityPlaceholder: "ex: Dakar, Thiès, Saint-Louis..." },
  cote_divoire: { label: "Côte d'Ivoire",     currency: "FCFA", dialCode: "+225", dialCodeNumeric: "225", cityPlaceholder: "ex: Abidjan, Bouaké, Yamoussoukro..." },
  mali:         { label: "Mali",              currency: "FCFA", dialCode: "+223", dialCodeNumeric: "223", cityPlaceholder: "ex: Bamako, Sikasso, Ségou..." },
  burkina_faso: { label: "Burkina Faso",      currency: "FCFA", dialCode: "+226", dialCodeNumeric: "226", cityPlaceholder: "ex: Ouagadougou, Bobo-Dioulasso..." },
  guinee:       { label: "Guinée",            currency: "GNF",  dialCode: "+224", dialCodeNumeric: "224", cityPlaceholder: "ex: Conakry, Kankan, Labé..." },
  rdc:          { label: "RD Congo",          currency: "USD",  dialCode: "+243", dialCodeNumeric: "243", cityPlaceholder: "ex: Kinshasa, Lubumbashi, Goma..." },
  gabon:        { label: "Gabon",             currency: "FCFA", dialCode: "+241", dialCodeNumeric: "241", cityPlaceholder: "ex: Libreville, Port-Gentil..." },
  congo:        { label: "Congo-Brazzaville", currency: "FCFA", dialCode: "+242", dialCodeNumeric: "242", cityPlaceholder: "ex: Brazzaville, Pointe-Noire..." },
  togo:         { label: "Togo",              currency: "FCFA", dialCode: "+228", dialCodeNumeric: "228", cityPlaceholder: "ex: Lomé, Kpalimé, Sokodé..." },
  benin:        { label: "Bénin",             currency: "FCFA", dialCode: "+229", dialCodeNumeric: "229", cityPlaceholder: "ex: Cotonou, Porto-Novo, Parakou..." },
  tchad:        { label: "Tchad",             currency: "FCFA", dialCode: "+235", dialCodeNumeric: "235", cityPlaceholder: "ex: N'Djamena, Moundou..." },
  centrafrique: { label: "Centrafrique",      currency: "FCFA", dialCode: "+236", dialCodeNumeric: "236", cityPlaceholder: "ex: Bangui..." },
  niger:        { label: "Niger",             currency: "FCFA", dialCode: "+227", dialCodeNumeric: "227", cityPlaceholder: "ex: Niamey, Zinder..." },
  maroc:        { label: "Maroc",             currency: "MAD",  dialCode: "+212", dialCodeNumeric: "212", cityPlaceholder: "ex: Casablanca, Rabat, Marrakech..." },
  tunisie:      { label: "Tunisie",           currency: "TND",  dialCode: "+216", dialCodeNumeric: "216", cityPlaceholder: "ex: Tunis, Sfax, Sousse..." },
  algerie:      { label: "Algérie",           currency: "DZD",  dialCode: "+213", dialCodeNumeric: "213", cityPlaceholder: "ex: Alger, Oran, Constantine..." },
  france:       { label: "France",            currency: "EUR",  dialCode: "+33",  dialCodeNumeric: "33",  cityPlaceholder: "ex: Paris, Lyon, Marseille, Bordeaux..." },
  belgique:     { label: "Belgique",          currency: "EUR",  dialCode: "+32",  dialCodeNumeric: "32",  cityPlaceholder: "ex: Bruxelles, Liège, Anvers..." },
  suisse:       { label: "Suisse",            currency: "CHF",  dialCode: "+41",  dialCodeNumeric: "41",  cityPlaceholder: "ex: Genève, Lausanne, Zurich..." },
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

const SESSION_KEY = "pressflow_calc";

type Step = 1 | 2 | 3 | 4;

interface FormState {
  firstName: string; lastName: string;
  country: string; city: string;
  phoneLocal: string; phone: string;
  whatsappOptIn: boolean; email: string;
  referralSource: string;
  pressingType: string; dailyCapacity: string;
}

const EMPTY_FORM: FormState = {
  firstName: "", lastName: "", country: "", city: "",
  phoneLocal: "", phone: "", whatsappOptIn: true, email: "",
  referralSource: "", pressingType: "", dailyCapacity: "",
};

// ─── Progress Bar ───────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: Step }) {
  const labels = ["Vos coordonnées", "Type", "Capacité", "Résultat"];
  return (
    <div className="w-full max-w-lg mx-auto mb-8 print:hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">Étape {step} sur 4</span>
        <span className="text-xs text-muted-foreground">{Math.round((step / 4) * 100)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${(step / 4) * 100}%` }} />
      </div>
      <div className="flex justify-between mt-2">
        {labels.map((label, i) => (
          <span key={i} className={cn("text-[10px] font-medium",
            i + 1 <= step ? "text-primary" : "text-muted-foreground/50")}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Page 1: Contact form ────────────────────────────────────────────────────
function Page1({ form, setForm, onSubmit, isLoading }: {
  form: FormState; setForm: (fn: (f: FormState) => FormState) => void;
  onSubmit: () => void; isLoading: boolean;
}) {
  const meta = COUNTRY_META[form.country];
  const dialCode = meta?.dialCode ?? "+237";
  const canSubmit = !!(form.firstName && form.lastName && form.country && form.city && form.phone);

  return (
    <div className="w-full max-w-lg mx-auto space-y-5">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Parlez-nous de vous</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pour personnaliser votre estimation selon votre marché local
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prénom *</Label>
          <Input value={form.firstName} autoFocus
            onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
            placeholder="Jean" className="mt-1" data-testid="input-firstname" />
        </div>
        <div>
          <Label>Nom *</Label>
          <Input value={form.lastName}
            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
            placeholder="Dupont" className="mt-1" data-testid="input-lastname" />
        </div>
      </div>

      <div>
        <Label>Pays *</Label>
        <Select value={form.country}
          onValueChange={v => setForm(f => ({ ...f, country: v, phoneLocal: "", phone: "", city: "" }))}>
          <SelectTrigger className="mt-1" data-testid="select-country">
            <SelectValue placeholder="Sélectionnez votre pays" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_GROUPS.map(g => (
              <SelectGroup key={g.label}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.keys.map(key => COUNTRY_META[key] && (
                  <SelectItem key={key} value={key}>{COUNTRY_META[key].label}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Ville *</Label>
        <Input value={form.city} disabled={!form.country}
          onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
          placeholder={meta?.cityPlaceholder ?? "Votre ville..."}
          className="mt-1" data-testid="input-city" />
      </div>

      <div>
        <Label>
          Numéro de téléphone *
          <span className="ml-2 text-xs text-muted-foreground font-normal">Pour recevoir votre rapport</span>
        </Label>
        <div className="flex gap-2 mt-1">
          <div className="flex items-center justify-center px-3 min-w-[64px] bg-muted border border-border rounded-lg text-sm font-semibold text-muted-foreground flex-shrink-0">
            {dialCode}
          </div>
          <Input type="tel" value={form.phoneLocal} disabled={!form.country}
            onChange={e => {
              const local = e.target.value.replace(/\D/g, "");
              setForm(f => ({
                ...f, phoneLocal: local,
                phone: (meta?.dialCodeNumeric ?? "") + local,
                ...(f.whatsappOptIn ? { whatsapp: (meta?.dialCodeNumeric ?? "") + local } : {}),
              }));
            }}
            placeholder="6XX XXX XXX" className="flex-1" data-testid="input-phone" />
        </div>

        {/* WhatsApp opt-in */}
        <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
          <div
            data-testid="checkbox-whatsapp"
            onClick={() => setForm(f => ({ ...f, whatsappOptIn: !f.whatsappOptIn }))}
            className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
              form.whatsappOptIn ? "bg-green-500 border-green-500" : "border-muted-foreground bg-background")}>
            {form.whatsappOptIn && (
              <svg viewBox="0 0 12 12" className="w-3 h-3">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <span className="text-sm">Ce numéro est mon WhatsApp — envoyer mon rapport ici</span>
          <WaIcon className="w-4 h-4 fill-green-500 flex-shrink-0" />
        </label>
      </div>

      <div>
        <Label className="flex items-center gap-2">
          Comment avez-vous entendu parler de nous ?
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">optionnel</span>
        </Label>
        <Select value={form.referralSource}
          onValueChange={v => setForm(f => ({ ...f, referralSource: v }))}>
          <SelectTrigger className="mt-1" data-testid="select-referral">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp_social">WhatsApp / Réseaux sociaux</SelectItem>
            <SelectItem value="referral">Recommandation d'un ami</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="other">Autre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        🔒 Vos données sont protégées et ne seront jamais partagées. Répondez STOP pour vous désinscrire.
      </p>

      <Button size="lg" className="w-full" disabled={!canSubmit || isLoading}
        onClick={onSubmit} data-testid="button-submit-page1">
        {isLoading
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
          : "Continuer →"}
      </Button>
    </div>
  );
}

// ─── Page 2: Pressing type ───────────────────────────────────────────────────
function Page2({ form, onSelect }: {
  form: FormState; onSelect: (v: string) => void;
}) {
  const options = [
    { value: "quartier",   emoji: "🏠", title: "Pressing de quartier",   description: "Clientèle locale et résidentielle",      machines: "1 à 2 machines",    budgetHint: "2M – 6M FCFA",   examples: "Particuliers, familles du quartier" },
    { value: "semi_pro",   emoji: "🏢", title: "Semi-professionnel",       description: "Entreprises et particuliers, volume moyen", machines: "2 à 4 machines",  budgetHint: "6M – 20M FCFA",  examples: "PME, restaurants, boutiques" },
    { value: "industriel", emoji: "🏭", title: "Industriel",               description: "Gros volumes, clients institutionnels",    machines: "4 machines et plus", budgetHint: "20M – 60M FCFA", examples: "Hôtels, hôpitaux, blanchisseries" },
  ];
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Votre type de pressing</h2>
        <p className="text-muted-foreground text-sm mt-1">Sélectionnez le format qui correspond à votre projet</p>
      </div>
      <div className="space-y-3">
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onSelect(opt.value)}
            data-testid={`card-type-${opt.value}`}
            className={cn("w-full text-left p-5 rounded-2xl border-2 transition-all duration-150",
              "hover:border-primary hover:shadow-md hover:shadow-primary/10 active:scale-[0.99]",
              form.pressingType === opt.value
                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                : "border-border bg-card")}>
            <div className="flex items-start gap-4">
              <span className="text-3xl flex-shrink-0">{opt.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-base">{opt.title}</p>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg flex-shrink-0">
                    {opt.budgetHint}
                  </span>
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
      <p className="text-center text-xs text-muted-foreground mt-4">Appuyez sur une option pour continuer automatiquement</p>
    </div>
  );
}

// ─── Page 3: Daily capacity ──────────────────────────────────────────────────
function Page3({ form, onSelect }: {
  form: FormState; onSelect: (v: string) => void;
}) {
  const pressingType = form.pressingType;
  const options = [
    { value: "less_50",  emoji: "🌱", title: "Moins de 50 kg / jour", description: "Idéal pour démarrer et tester le marché",  detail: "Environ 6 à 10 clients par jour" },
    { value: "50_150",   emoji: "📈", title: "50 à 150 kg / jour",    description: "Activité soutenue, clientèle mixte",         detail: "Environ 10 à 30 clients par jour" },
    { value: "more_150", emoji: "🏆", title: "Plus de 150 kg / jour", description: "Volume industriel, contrats entreprises",    detail: "Hôtels, hôpitaux, blanchisseries en gros" },
  ];
  const showInconsistencyWarning =
    (pressingType === "quartier" && form.dailyCapacity === "more_150") ||
    (pressingType === "industriel" && form.dailyCapacity === "less_50");

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Capacité journalière cible</h2>
        <p className="text-muted-foreground text-sm mt-1">Combien de kg souhaitez-vous traiter par jour ?</p>
      </div>
      <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 mb-5">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Comment estimer ?</strong> Une famille produit environ 5 à 8 kg de linge par semaine.
          Un pressing de quartier traite en moyenne 20 à 40 kg/jour au démarrage.
          Un hôtel de 50 chambres génère environ 80 à 120 kg/jour.
        </p>
      </div>
      <div className="space-y-3">
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onSelect(opt.value)}
            data-testid={`card-capacity-${opt.value}`}
            className={cn("w-full text-left p-5 rounded-2xl border-2 transition-all duration-150",
              "hover:border-primary hover:shadow-md hover:shadow-primary/10 active:scale-[0.99]",
              form.dailyCapacity === opt.value
                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                : "border-border bg-card")}>
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
      {showInconsistencyWarning && (
        <div className="mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <span className="text-amber-500 flex-shrink-0 mt-0.5">ℹ️</span>
          <p className="text-xs text-amber-800 dark:text-amber-400">
            Cette capacité est inhabituelle pour un {pressingType === "quartier" ? "pressing de quartier" : "pressing industriel"}.
            Vous pouvez continuer ou revenir modifier votre type.
          </p>
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground mt-4">Appuyez sur une option pour lancer le calcul</p>
    </div>
  );
}

// ─── Page 4 loading state ────────────────────────────────────────────────────
function LoadingState({ city, countryLabel, currentMsg }: { city: string; countryLabel: string; currentMsg: number }) {
  const messages = [
    `Recherche des prix d'équipements à ${city}...`,
    "Analyse des loyers commerciaux disponibles...",
    "Vérification des tarifs eau et électricité...",
    `Calcul des démarches administratives pour ${countryLabel}...`,
    "Analyse du marché pressing local...",
    "Calcul de votre seuil de rentabilité...",
    "Rédaction de vos recommandations...",
    "Finalisation de votre rapport...",
  ];
  return (
    <div className="w-full max-w-lg mx-auto text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <h3 className="text-xl font-bold mb-2">L'IA analyse votre marché...</h3>
      <p className="text-sm text-muted-foreground mb-8">Recherche des données actuelles pour {city}</p>
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

// ─── Detail sub-components ───────────────────────────────────────────────────
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
        <p className="font-semibold text-sm">📅 Charges mensuelles</p>
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

function ProfitabilitySection({ data, currency }: { data: any; currency: string }) {
  const fmt = (n: number) => n?.toLocaleString("fr-FR") ?? "—";
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

function LocalInsightsSection({ data, city, countryLabel }: { data: any; city: string; countryLabel: string }) {
  if (!data) return null;
  return (
    <div>
      <p className="font-semibold text-sm mb-3">📍 Contexte local — {city}, {countryLabel}</p>
      {data.marketContext && <p className="text-sm text-muted-foreground mb-3">{data.marketContext}</p>}
      {data.rentContext && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Loyers</p>
          <p className="text-sm">{data.rentContext}</p>
        </div>
      )}
      {data.electricityContext && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Électricité</p>
          <p className="text-sm">{data.electricityContext}</p>
        </div>
      )}
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

// ─── Page 4 result ───────────────────────────────────────────────────────────
function ResultPage({ report, form, result, leadId }: {
  report: any; form: FormState; result: any; leadId: number;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = COUNTRY_META[form.country];
  const countryLabel = meta?.label ?? form.country;
  const currency = report?.totalBudget?.currency ?? meta?.currency ?? "FCFA";
  const fmt = (n: number) => n?.toLocaleString("fr-FR") ?? "—";
  const typeLabels: Record<string, string> = {
    quartier: "pressing de quartier", semi_pro: "pressing semi-professionnel", industriel: "pressing industriel",
  };

  function copyLink() {
    if (result?.reportUrl) {
      navigator.clipboard.writeText(result.reportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* WhatsApp sent confirmation */}
      {result?.whatsappSent && (
        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-400">Rapport envoyé sur WhatsApp ✓</p>
            <p className="text-xs text-green-700 dark:text-green-500">Vérifiez vos messages. Vous recevrez des conseils dans les prochains jours.</p>
          </div>
        </div>
      )}

      {/* Click-to-chat fallback */}
      {result?.clickToChatUrl && (
        <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <WaIcon />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Recevoir ce rapport sur WhatsApp</p>
            <p className="text-xs text-muted-foreground">Cliquez pour nous envoyer un message</p>
          </div>
          <a href={result.clickToChatUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" data-testid="button-wa-chat">Ouvrir</Button>
          </a>
        </div>
      )}

      {/* Hero card */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 rounded-2xl" />
        <div className="relative">
          <p className="text-white/80 text-sm mb-1">Bonjour {form.firstName} 👋</p>
          <h2 className="text-xl font-bold mb-1">Votre estimation pour un {typeLabels[form.pressingType] ?? form.pressingType}</h2>
          <p className="text-white/70 text-sm mb-5">📍 {form.city}, {countryLabel}</p>
          <p className="text-xs font-medium text-white/70 uppercase tracking-wide mb-1">Budget de démarrage estimé</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-4xl font-black">{fmt(report?.totalBudget?.min)}</span>
            <span className="text-2xl text-white/60">—</span>
            <span className="text-4xl font-black">{fmt(report?.totalBudget?.max)}</span>
            <span className="text-xl text-white/70">{currency}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {report?.breakdown?.equipment?.total && (
              <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
                📦 Équipements : {fmt(report.breakdown.equipment.total.min)} — {fmt(report.breakdown.equipment.total.max)} {currency}
              </div>
            )}
            {report?.profitability?.estimatedRoiMonths && (
              <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
                📅 Retour invest. : {report.profitability.estimatedRoiMonths.min} — {report.profitability.estimatedRoiMonths.max} mois
              </div>
            )}
            {report?.profitability?.estimatedMarginPct && (
              <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm">
                📊 Marge estimée : {report.profitability.estimatedMarginPct.min} — {report.profitability.estimatedMarginPct.max}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="grid sm:grid-cols-2 gap-3 print:hidden">
        <Button variant="outline" size="lg" className="h-14 gap-3 text-base"
          onClick={() => window.print()} data-testid="button-print">
          <Download className="w-5 h-5" />
          <div className="text-left">
            <div className="font-semibold text-sm">Télécharger le rapport</div>
            <div className="text-xs text-muted-foreground">Format PDF</div>
          </div>
        </Button>
        <a href={result?.expertUrl ?? "#"} target="_blank" rel="noopener noreferrer"
          onClick={() => fetch(`/api/calculator/track-expert-contact/${leadId}`, { method: "POST" }).catch(() => {})}>
          <Button size="lg" className="w-full h-14 gap-3 text-base bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/25"
            data-testid="button-expert">
            <WaIcon className="w-5 h-5 fill-white flex-shrink-0" />
            <div className="text-left">
              <div className="font-semibold text-sm">Parler à un expert</div>
              <div className="text-xs text-white/80">Réponse WhatsApp rapide</div>
            </div>
          </Button>
        </a>
      </div>

      {/* Trust signals */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground print:hidden">
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

      {/* Detail accordion */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button type="button" onClick={() => setShowDetail(!showDetail)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
          data-testid="button-toggle-detail">
          <span className="font-semibold text-sm">Voir le détail complet de l'estimation</span>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", showDetail && "rotate-180")} />
        </button>
        {showDetail && (
          <div className="px-5 pb-5 space-y-5 border-t border-border">
            <DetailSection title="Équipements" icon="⚙️" data={report?.breakdown?.equipment} currency={currency} />
            <DetailSection title="Aménagement & Installation" icon="🔨" data={report?.breakdown?.setup} currency={currency} />
            <DetailSection title="Démarches administratives" icon="📋" data={report?.breakdown?.administrative} currency={currency} />
            <MonthlyChargesSection data={report?.monthlyCharges} currency={currency} />
            <ProfitabilitySection data={report?.profitability} currency={currency} />
            <LocalInsightsSection data={report?.localInsights} city={form.city} countryLabel={countryLabel} />
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

      {/* PressFlow trial CTA */}
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
              <p className="text-xs text-muted-foreground mt-0.5">selon ce qui dure le plus longtemps</p>
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

      {/* Shareable link + disclaimer */}
      <div className="space-y-3 print:hidden">
        {result?.reportUrl && (
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-4 py-3">
            <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground flex-1 truncate">{result.reportUrl}</span>
            <Button size="sm" variant="outline" onClick={copyLink} data-testid="button-copy-link">
              {copied ? "Copié !" : "Copier"}
            </Button>
          </div>
        )}
        {report?.disclaimer && (
          <p className="text-xs text-muted-foreground text-center leading-relaxed">{report.disclaimer}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main calculator component ───────────────────────────────────────────────
export default function CalculatorPage() {
  const { toast } = useToast();

  const saved = typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
  const initial = saved ? (() => { try { return JSON.parse(saved); } catch { return null; } })() : null;

  const [step, setStep]         = useState<Step>(initial?.step ?? 1);
  const [leadId, setLeadId]     = useState<number | null>(initial?.leadId ?? null);
  const [form, setForm]         = useState<FormState>({ ...EMPTY_FORM, ...initial?.form });
  const [result, setResult]     = useState<any>(initial?.result ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLoadingMsg, setCurrentLoadingMsg] = useState(0);

  const meta = COUNTRY_META[form.country];

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ step, leadId, form, result }));
  }, [step, leadId, form, result]);

  useEffect(() => {
    if (step !== 4 || result) return;
    const iv = setInterval(() => setCurrentLoadingMsg(i => (i + 1) % 8), 3500);
    return () => clearInterval(iv);
  }, [step, result]);

  // Page 1 submit → save lead
  async function handlePage1Submit() {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/calculator/save-lead", {
        firstName: form.firstName, lastName: form.lastName,
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

  // Page 2 select → update lead & auto-advance
  async function handlePage2Select(pressingType: string) {
    setForm(f => ({ ...f, pressingType }));
    if (leadId) {
      apiRequest("PATCH", `/api/calculator/update-lead/${leadId}`, { pressingType, completedPage: 2 }).catch(() => {});
    }
    setStep(3);
  }

  // Page 3 select → update lead & trigger AI generation
  async function handlePage3Select(dailyCapacity: string) {
    setForm(f => ({ ...f, dailyCapacity }));
    if (leadId) {
      try {
        await apiRequest("PATCH", `/api/calculator/update-lead/${leadId}`, { dailyCapacity, completedPage: 3 });
      } catch {}
    }
    setStep(4);
    setCurrentLoadingMsg(0);
    if (!leadId) {
      toast({ title: "Erreur", description: "Session perdue. Veuillez recommencer.", variant: "destructive" });
      return;
    }
    try {
      const res = await apiRequest("POST", `/api/calculator/generate-report/${leadId}`, {});
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message ?? "Erreur lors de la génération", variant: "destructive" });
      setStep(3);
    }
  }

  function handleBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4 && !result) setStep(3);
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
        <a href="/auth">
          <Button size="sm" variant="outline" data-testid="link-login">Connexion</Button>
        </a>
      </nav>

      {/* Print header (hidden on screen) */}
      <div className="hidden print:block px-8 py-6 border-b">
        <h1 className="text-2xl font-bold">Rapport PressFlow — Calculateur de démarrage pressing</h1>
        <p className="text-sm text-muted-foreground mt-1">{form.city} · Généré le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header (steps 1-3 only) */}
        {step <= 3 && (
          <div className="text-center mb-6 print:hidden">
            <span className="inline-block bg-primary/10 text-primary text-sm px-4 py-1.5 rounded-full font-medium mb-3">
              Outil gratuit · Résultat par WhatsApp en 2 minutes
            </span>
            <h1 className="text-3xl font-bold mb-1">Calculateur de démarrage pressing</h1>
            <p className="text-muted-foreground">Combien coûte l'ouverture d'un pressing dans votre pays ?</p>
          </div>
        )}

        <ProgressBar step={step} />

        {/* Back button */}
        {step > 1 && step < 4 && (
          <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 print:hidden">
            ← Retour
          </button>
        )}
        {step === 4 && result && (
          <button onClick={() => { setResult(null); setStep(3); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 print:hidden">
            ← Nouvelle estimation
          </button>
        )}

        {/* Pages */}
        {step === 1 && (
          <Page1 form={form} setForm={setForm} onSubmit={handlePage1Submit} isLoading={isLoading} />
        )}
        {step === 2 && (
          <Page2 form={form} onSelect={handlePage2Select} />
        )}
        {step === 3 && (
          <Page3 form={form} onSelect={handlePage3Select} />
        )}
        {step === 4 && !result && (
          <LoadingState city={form.city} countryLabel={meta?.label ?? form.country} currentMsg={currentLoadingMsg} />
        )}
        {step === 4 && result && (
          <ResultPage report={result.report} form={form} result={result} leadId={leadId!} />
        )}
      </div>
    </div>
  );
}
