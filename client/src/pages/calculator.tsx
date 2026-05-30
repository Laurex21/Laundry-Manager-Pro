import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronRight, ChevronLeft, CheckCircle2, Loader2,
  Download, MessageCircle, Zap, Shield, Globe, Clock,
  TrendingUp, AlertTriangle, ArrowRight, Star, Lock,
} from "lucide-react";

// ─── Country data (kept from original) ────────────────────────────────────────
const COUNTRY_META: Record<string, { label: string; currency: string; dialCode: string; dialCodeNumeric: string; cityPlaceholder: string }> = {
  cameroun:     { label:"Cameroun",         currency:"FCFA", dialCode:"+237", dialCodeNumeric:"237", cityPlaceholder:"ex: Douala, Yaoundé..." },
  senegal:      { label:"Sénégal",          currency:"FCFA", dialCode:"+221", dialCodeNumeric:"221", cityPlaceholder:"ex: Dakar, Thiès..." },
  cote_divoire: { label:"Côte d'Ivoire",    currency:"FCFA", dialCode:"+225", dialCodeNumeric:"225", cityPlaceholder:"ex: Abidjan, Bouaké..." },
  mali:         { label:"Mali",             currency:"FCFA", dialCode:"+223", dialCodeNumeric:"223", cityPlaceholder:"ex: Bamako, Sikasso..." },
  burkina_faso: { label:"Burkina Faso",     currency:"FCFA", dialCode:"+226", dialCodeNumeric:"226", cityPlaceholder:"ex: Ouagadougou..." },
  guinee:       { label:"Guinée",           currency:"GNF",  dialCode:"+224", dialCodeNumeric:"224", cityPlaceholder:"ex: Conakry..." },
  rdc:          { label:"RD Congo",         currency:"USD",  dialCode:"+243", dialCodeNumeric:"243", cityPlaceholder:"ex: Kinshasa..." },
  gabon:        { label:"Gabon",            currency:"FCFA", dialCode:"+241", dialCodeNumeric:"241", cityPlaceholder:"ex: Libreville..." },
  congo:        { label:"Congo-Brazzaville",currency:"FCFA", dialCode:"+242", dialCodeNumeric:"242", cityPlaceholder:"ex: Brazzaville..." },
  togo:         { label:"Togo",             currency:"FCFA", dialCode:"+228", dialCodeNumeric:"228", cityPlaceholder:"ex: Lomé..." },
  benin:        { label:"Bénin",            currency:"FCFA", dialCode:"+229", dialCodeNumeric:"229", cityPlaceholder:"ex: Cotonou..." },
  tchad:        { label:"Tchad",            currency:"FCFA", dialCode:"+235", dialCodeNumeric:"235", cityPlaceholder:"ex: N'Djamena..." },
  centrafrique: { label:"Centrafrique",     currency:"FCFA", dialCode:"+236", dialCodeNumeric:"236", cityPlaceholder:"ex: Bangui..." },
  niger:        { label:"Niger",            currency:"FCFA", dialCode:"+227", dialCodeNumeric:"227", cityPlaceholder:"ex: Niamey..." },
  maroc:        { label:"Maroc",            currency:"MAD",  dialCode:"+212", dialCodeNumeric:"212", cityPlaceholder:"ex: Casablanca, Rabat..." },
  tunisie:      { label:"Tunisie",          currency:"TND",  dialCode:"+216", dialCodeNumeric:"216", cityPlaceholder:"ex: Tunis, Sfax..." },
  algerie:      { label:"Algérie",          currency:"DZD",  dialCode:"+213", dialCodeNumeric:"213", cityPlaceholder:"ex: Alger, Oran..." },
  france:       { label:"France",           currency:"EUR",  dialCode:"+33",  dialCodeNumeric:"33",  cityPlaceholder:"ex: Paris, Lyon..." },
  belgique:     { label:"Belgique",         currency:"EUR",  dialCode:"+32",  dialCodeNumeric:"32",  cityPlaceholder:"ex: Bruxelles, Liège..." },
  suisse:       { label:"Suisse",           currency:"CHF",  dialCode:"+41",  dialCodeNumeric:"41",  cityPlaceholder:"ex: Genève, Zurich..." },
};

const COUNTRY_GROUPS = [
  { label:"Afrique Centrale",   keys:["cameroun","gabon","congo","rdc","tchad","centrafrique"] },
  { label:"Afrique de l'Ouest", keys:["senegal","cote_divoire","mali","burkina_faso","guinee","togo","benin","niger"] },
  { label:"Afrique du Nord",    keys:["maroc","tunisie","algerie"] },
  { label:"Europe",             keys:["france","belgique","suisse"] },
];

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "hero"|"project"|"contact"|"type"|"config"|"objective"|"analyzing"|"results";

interface CalcForm {
  country: string; city: string; budget: string; experience: string;
  fullName: string; whatsapp: string; email: string; whatsappOptIn: boolean;
  pressingType: string; pressingSize: string; services: string[]; objective: string;
}

const EMPTY_FORM: CalcForm = {
  country:"", city:"", budget:"", experience:"",
  fullName:"", whatsapp:"", email:"", whatsappOptIn:true,
  pressingType:"", pressingSize:"", services:[], objective:"",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number, curr = "FCFA") => `${Math.round(n ?? 0).toLocaleString("fr-FR")} ${curr}`;
const fmtRange = (r: { min?: number; max?: number } | undefined, curr = "FCFA") =>
  r ? `${Math.round(r.min ?? 0).toLocaleString("fr-FR")} – ${Math.round(r.max ?? 0).toLocaleString("fr-FR")} ${curr}` : "—";

function tierStyle(id: string) {
  if (id === "minimum") return { border:"border-emerald-200", bg:"bg-emerald-50", badge:"bg-emerald-100 text-emerald-700", score:"text-emerald-600", bar:"#10b981" };
  if (id === "standard") return { border:"border-blue-300", bg:"bg-blue-50", badge:"bg-blue-100 text-blue-700", score:"text-blue-600", bar:"#3b82f6" };
  return { border:"border-purple-300", bg:"bg-purple-50", badge:"bg-purple-100 text-purple-700", score:"text-purple-600", bar:"#9333ea" };
}

function riskBadge(level: string) {
  if (level === "Faible") return "bg-emerald-100 text-emerald-700";
  if (level === "Moyen")  return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

// ─── PDF export ───────────────────────────────────────────────────────────────
function openPDF(form: CalcForm, report: any) {
  const curr = report.currency ?? "FCFA";
  const tiers: any[] = report.tiers ?? [];
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Rapport Lancement Pressing — ${form.fullName}</title>
<style>
  body{font-family:Arial,sans-serif;color:#1e293b;padding:32px;max-width:820px;margin:auto;font-size:13px}
  .header{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;padding:24px;border-radius:10px;margin-bottom:18px}
  .logo{font-weight:bold;font-size:17px;margin-bottom:6px}.h1{font-size:22px;font-weight:bold;margin:0 0 4px}.sub{opacity:.8;font-size:12px}
  h2{font-size:14px;color:#2563eb;border-bottom:2px solid #dbeafe;padding-bottom:4px;margin:16px 0 8px}
  .tier{border-radius:8px;padding:14px;margin-bottom:12px}
  .t-min{background:#ecfdf5;border:1px solid #a7f3d0}.t-std{background:#eff6ff;border:1px solid #bfdbfe}.t-prem{background:#faf5ff;border:1px solid #e9d5ff}
  .tier-name{font-size:15px;font-weight:bold;margin-bottom:4px}.tier-budget{font-size:20px;font-weight:bold;margin-bottom:8px}
  .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px}
  .info-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px}
  .info-label{font-size:10px;color:#64748b;text-transform:uppercase;margin-bottom:2px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .metric{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center}
  .cta{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center;margin-top:14px}
  .footer{text-align:center;color:#94a3b8;font-size:11px;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px}
  ul{margin:4px 0;padding-left:16px}li{font-size:12px;margin-bottom:3px}
</style></head><body>
<div class="header">
  <div class="logo">👕 Xpress Clean</div>
  <div class="h1">Rapport Lancement Pressing</div>
  <div class="sub">Analyse IA personnalisée — ${new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</div>
</div>
<div class="info-grid">
  <div class="info-item"><div class="info-label">Nom</div>${form.fullName}</div>
  <div class="info-item"><div class="info-label">Ville / Pays</div>${form.city}, ${COUNTRY_META[form.country]?.label ?? form.country}</div>
  <div class="info-item"><div class="info-label">Type</div>${form.pressingType}</div>
</div>
${report.summary ? `<p style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:13px;margin-bottom:16px">${report.summary}</p>` : ""}
<h2>3 Scénarios de Budget</h2>
${tiers.map(t=>`
<div class="tier ${t.id==="minimum"?"t-min":t.id==="standard"?"t-std":"t-prem"}">
  <div class="tier-name">${t.emoji??""} ${t.label}</div>
  <div class="tier-budget">${fmtRange(t.totalBudget, curr)}</div>
  <div class="grid3">
    <div class="metric"><div class="info-label">Charges/mois</div>${fmtRange(t.monthlyCharges, curr)}</div>
    <div class="metric"><div class="info-label">Revenus/mois</div>${fmtRange(t.monthlyRevenue, curr)}</div>
    <div class="metric"><div class="info-label">Bénéfice/mois</div>${fmtRange(t.monthlyProfit, curr)}</div>
  </div>
  <p style="font-size:11px;color:#64748b;margin:6px 0 0">ROI : ${t.roiMonths?.min??""}-${t.roiMonths?.max??""} mois · Risque : ${t.riskLevel??""} · Score faisabilité : ${t.feasibilityScore??""}/100</p>
</div>`).join("")}
${report.marketAnalysis ? `<h2>Analyse de Marché</h2>
<div class="row"><span>Niveau de demande</span><span>${report.marketAnalysis.demandLevel??""}</span></div>
<div class="row"><span>Fourchette de prix locale</span><span>${report.marketAnalysis.averagePriceRange??""}</span></div>
<p style="font-size:12px;margin-top:6px">${report.marketAnalysis.opportunity??""}</p>` : ""}
${report.recommendations?.length ? `<h2>Recommandations</h2><ul>${report.recommendations.map((r:string)=>`<li>${r}</li>`).join("")}</ul>` : ""}
${report.nextSteps?.length ? `<h2>Prochaines Étapes</h2><ul>${report.nextSteps.map((s:string)=>`<li>${s}</li>`).join("")}</ul>` : ""}
<div class="cta"><strong>Pilotez votre pressing avec Xpress Clean</strong><br><span style="font-size:12px;color:#1e40af">Gestion commandes · Clients · Paiements · Statistiques</span></div>
<div class="footer"><em>${report.disclaimer??""}</em><br>© ${new Date().getFullYear()} Xpress Clean — Rapport confidentiel</div>
</body></html>`;
  const w = window.open("","_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400); }
}

// ─── UI sub-components ────────────────────────────────────────────────────────
function StepProgress({ current, total=5 }: { current:number; total?:number }) {
  const steps = ["Projet","Contact","Type","Config","Objectif"];
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>Étape {current}/{total}</span>
        <span>{Math.round(current/total*100)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 mb-2">
        <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width:`${current/total*100}%` }} />
      </div>
      <div className="flex justify-between">
        {steps.map((s,i)=>(
          <span key={s} className={`text-[10px] font-medium ${i+1<=current?"text-primary":"text-muted-foreground/50"}`}>{s}</span>
        ))}
      </div>
    </div>
  );
}

function Card({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-2xl p-6 shadow-sm ${className}`}>{children}</div>;
}

function NavRow({ onBack, onNext, nextLabel="Étape suivante", disabled=false }:
  { onBack?:()=>void; onNext:()=>void; nextLabel?:string; disabled?:boolean }) {
  return (
    <div className="flex gap-3 mt-4">
      {onBack && <Button variant="outline" onClick={onBack} className="flex-1"><ChevronLeft className="w-4 h-4 mr-1"/>Précédent</Button>}
      <Button onClick={onNext} disabled={disabled}
        className={`${onBack?"flex-[2]":"w-full"} shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
        {nextLabel} <ChevronRight className="w-4 h-4 ml-1"/>
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CalculatorPage() {
  const [, setLocation] = useLocation();
  const [stage,   setStage  ] = useState<Stage>("hero");
  const [form,    setForm   ] = useState<CalcForm>(EMPTY_FORM);
  const [leadId,  setLeadId ] = useState<number|null>(null);
  const [report,  setReport ] = useState<any>(null);
  const [error,   setError  ] = useState<string|null>(null);
  const [saving,  setSaving ] = useState(false);
  const [unlocked,setUnlocked] = useState(false);
  const [unlockEmail, setUnlockEmail] = useState("");
  const [analysisStep, setAnalysisStep] = useState(0);
  const animDone = useRef(false);
  const apiDone  = useRef<any>(null);

  const meta = COUNTRY_META[form.country];

  function setF<K extends keyof CalcForm>(k: K, v: CalcForm[K]) { setForm(f=>({...f,[k]:v})); }

  function toggleService(s: string) {
    setF("services", form.services.includes(s)
      ? form.services.filter(x=>x!==s)
      : [...form.services, s]);
  }

  function goStage(s: Stage) { setStage(s); window.scrollTo(0,0); }

  // ── AI analysis animation ──────────────────────────────────────────────────
  const ANALYSIS_STEPS = [
    `Identification du marché local à ${form.city || "votre ville"}...`,
    "Évaluation des équipements disponibles dans votre pays...",
    "Analyse des coûts immobiliers et loyers commerciaux...",
    "Calcul des charges opérationnelles mensuelles...",
    "Génération de 3 scénarios d'investissement personnalisés...",
    "Finalisation de votre rapport professionnel...",
  ];

  useEffect(() => {
    if (stage !== "analyzing") return;
    animDone.current = false;
    apiDone.current  = null;
    setAnalysisStep(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    ANALYSIS_STEPS.forEach((_, i) => {
      timers.push(setTimeout(()=>setAnalysisStep(i+1), i * 1300 + 800));
    });
    timers.push(setTimeout(()=>{
      animDone.current = true;
      if (apiDone.current) {
        setReport(apiDone.current);
        goStage("results");
      }
    }, ANALYSIS_STEPS.length * 1300 + 800));

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  async function runAnalysis() {
    try {
      const res = await fetch(`/api/calculator/generate-report/${leadId}`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          services:    form.services,
          objective:   form.objective,
          budget:      form.budget,
          experience:  form.experience,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Erreur de génération");
      if (animDone.current) {
        setReport(data.report);
        goStage("results");
      } else {
        apiDone.current = data.report;
      }
    } catch (e: any) {
      setError(e.message);
      goStage("results");
    }
  }

  async function saveLead(): Promise<boolean> {
    setSaving(true);
    try {
      const nameParts = form.fullName.trim().split(" ");
      const firstName = nameParts[0];
      const lastName  = nameParts.slice(1).join(" ");
      const dialNum   = meta?.dialCodeNumeric ?? "";
      const phone     = dialNum + form.whatsapp.replace(/^0/,"");

      const res = await fetch("/api/calculator/save-lead", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          firstName, lastName, phone,
          email: form.email || null,
          whatsappOptIn: form.whatsappOptIn,
          country: form.country, city: form.city,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setLeadId(d.leadId);
      if (form.email) setUnlocked(true);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function updateLead() {
    if (!leadId) return;
    await fetch(`/api/calculator/update-lead/${leadId}`, {
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ pressingType: form.pressingType, dailyCapacity: form.pressingSize, completedPage: 3 }),
    }).catch(()=>{});
  }

  // ─── HERO ──────────────────────────────────────────────────────────────────
  if (stage === "hero") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col">
        {/* Animated grid overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage:"linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)", backgroundSize:"40px 40px" }} />
        <div className="relative max-w-2xl mx-auto px-4 py-16 flex-1 flex flex-col items-center justify-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5"/> Propulsé par Intelligence Artificielle Gemini
          </div>
          {/* Title */}
          <h1 className="text-3xl md:text-5xl font-display font-bold leading-tight mb-4">
            Calculez votre Budget<br/>
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Lancement Pressing
            </span>
          </h1>
          <p className="text-slate-300 text-base md:text-lg max-w-xl mb-8 leading-relaxed">
            Notre IA analyse les coûts locaux, les équipements, les loyers et le marché afin de générer
            une estimation réaliste adaptée à votre pays.
          </p>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10 w-full max-w-lg">
            {[
              { icon:<Globe className="w-4 h-4"/>, val:"20+ pays", sub:"couverts" },
              { icon:<Zap className="w-4 h-4"/>,  val:"IA Gemini", sub:"en temps réel" },
              { icon:<TrendingUp className="w-4 h-4"/>, val:"3 scénarios", sub:"de budget" },
              { icon:<Clock className="w-4 h-4"/>, val:"< 60 sec", sub:"résultat" },
            ].map(s=>(
              <div key={s.val} className="bg-white/10 border border-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
                <div className="flex justify-center mb-1 text-blue-300">{s.icon}</div>
                <div className="font-bold text-white text-sm">{s.val}</div>
                <div className="text-slate-400 text-xs">{s.sub}</div>
              </div>
            ))}
          </div>
          <Button size="lg" onClick={()=>goStage("project")}
            className="h-14 px-10 text-lg font-bold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 border-0 shadow-2xl shadow-blue-500/30 hover:-translate-y-1 transition-all">
            Calculer Mon Budget <ChevronRight className="w-5 h-5 ml-1"/>
          </Button>
          <div className="flex items-center gap-6 mt-6 text-slate-400 text-xs">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3"/>Données protégées</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3"/>100% gratuit</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Sans engagement</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 1 — Project ──────────────────────────────────────────────────────
  const canProject = !!(form.country && form.city && form.budget && form.experience);
  if (stage === "project") return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <StepProgress current={1}/>
        <h2 className="text-xl font-bold mb-5">Votre projet</h2>
        <Card className="space-y-5">
          {/* Country */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Pays *</label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.country} onChange={e=>{ setF("country",e.target.value); setF("city",""); }}>
              <option value="">Sélectionner...</option>
              {COUNTRY_GROUPS.map(g=>(
                <optgroup key={g.label} label={g.label}>
                  {g.keys.map(k=>COUNTRY_META[k] && <option key={k} value={k}>{COUNTRY_META[k].label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          {/* City */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ville *</label>
            <Input placeholder={meta?.cityPlaceholder ?? "Votre ville..."} value={form.city}
              disabled={!form.country} onChange={e=>setF("city",e.target.value)}/>
          </div>
          {/* Budget */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Budget disponible *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "< 500 000 FCFA","500 000 – 2 000 000 FCFA","2 000 000 – 10 000 000 FCFA",
                "10 000 000 – 30 000 000 FCFA","› 30 000 000 FCFA","Je n'ai pas encore de budget",
              ].map(b=>(
                <button key={b} type="button" onClick={()=>setF("budget",b)}
                  className={`p-3 rounded-xl border-2 text-sm text-left transition-all ${form.budget===b?"border-primary bg-primary/5 text-primary":"border-border hover:border-primary/40"}`}>
                  {b}
                </button>
              ))}
            </div>
          </div>
          {/* Experience */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Niveau d'expérience *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["debutant","🌱 Débutant","Aucune expérience"],
                ["notions","📚 Quelques notions","J'ai observé ou étudié"],
                ["experimente","💼 Expérimenté","J'ai déjà travaillé dans le secteur"],
                ["professionnel","🏆 Professionnel","Pressing actif ou en gestion"],
              ].map(([v,title,sub])=>(
                <button key={v} type="button" onClick={()=>setF("experience",v)}
                  className={`p-3 rounded-xl border-2 text-sm text-left transition-all ${form.experience===v?"border-primary bg-primary/5":"border-border hover:border-primary/40"}`}>
                  <div className="font-medium">{title}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>
        <NavRow onBack={()=>goStage("hero")} onNext={()=>goStage("contact")} disabled={!canProject}/>
      </div>
    </div>
  );

  // ─── STEP 2 — Contact ──────────────────────────────────────────────────────
  const canContact = !!(form.fullName && form.whatsapp);
  if (stage === "contact") return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <StepProgress current={2}/>
        <h2 className="text-xl font-bold mb-5">Vos coordonnées</h2>
        <Card className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nom complet *</label>
            <Input placeholder="Jean Dupont" value={form.fullName} onChange={e=>setF("fullName",e.target.value)}/>
          </div>
          {/* WhatsApp */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Numéro WhatsApp *{" "}
              <span className="text-xs text-muted-foreground font-normal">Pour recevoir votre rapport</span>
            </label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 bg-muted border border-border rounded-lg text-sm font-semibold text-muted-foreground min-w-[60px] justify-center">
                {meta?.dialCode ?? "—"}
              </div>
              <Input type="tel" placeholder="6XX XXX XXX" value={form.whatsapp}
                disabled={!form.country}
                onChange={e=>setF("whatsapp",e.target.value.replace(/\D/g,""))}/>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <div onClick={()=>setF("whatsappOptIn",!form.whatsappOptIn)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${form.whatsappOptIn?"bg-green-500 border-green-500":"border-muted-foreground"}`}>
                {form.whatsappOptIn && <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
              </div>
              <span className="text-sm">Envoyer le rapport sur ce WhatsApp</span>
            </label>
          </div>
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Email{" "}
              <span className="text-xs text-muted-foreground font-normal">(optionnel — débloque le rapport complet)</span>
            </label>
            <Input type="email" placeholder="vous@exemple.com" value={form.email}
              onChange={e=>setF("email",e.target.value)}/>
            {!form.email && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Lock className="w-3 h-3"/>Sans email, les scénarios 2 et 3 seront partiellement masqués.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">🔒 Données protégées — jamais revendues.</p>
        </Card>
        <NavRow onBack={()=>goStage("project")} onNext={async()=>{ const ok=await saveLead(); if(ok)goStage("type"); }} nextLabel={saving?"Enregistrement...":"Continuer"} disabled={!canContact||saving}/>
      </div>
    </div>
  );

  // ─── STEP 3 — Pressing type ────────────────────────────────────────────────
  if (stage === "type") return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <StepProgress current={3}/>
        <h2 className="text-xl font-bold mb-2">Type de pressing</h2>
        <p className="text-muted-foreground text-sm mb-5">Sélectionnez le format qui correspond à votre vision</p>
        <div className="space-y-3">
          {[
            { v:"standard",   em:"🏠", title:"Pressing Standard",       sub:"Clientèle résidentielle et bureaux",          hint:"Format le plus courant" },
            { v:"premium",    em:"💎", title:"Pressing Premium",         sub:"Vêtements luxe, service haut de gamme",       hint:"Marges élevées" },
            { v:"industriel", em:"🏭", title:"Blanchisserie Industrielle",sub:"Hôtels, hôpitaux, grandes entreprises",      hint:"Gros volumes" },
            { v:"laverie",    em:"🪙", title:"Laverie Automatique",      sub:"Service libre-service, peu de personnel",     hint:"Fonctionnement H24" },
            { v:"mobile",     em:"🚗", title:"Pressing Mobile",          sub:"Service à domicile et livraison",             hint:"Faible investissement" },
          ].map(opt=>(
            <button key={opt.v} type="button" onClick={()=>{ setF("pressingType",opt.v); goStage("config"); }}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all hover:border-primary hover:shadow-md active:scale-[0.99] ${form.pressingType===opt.v?"border-primary bg-primary/5":"border-border bg-card"}`}>
              <div className="flex items-center gap-4">
                <span className="text-3xl">{opt.em}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{opt.title}</span>
                    <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-lg font-medium">{opt.hint}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{opt.sub}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">Appuyez pour sélectionner et continuer automatiquement</p>
        <Button variant="ghost" onClick={()=>goStage("contact")} className="w-full mt-2 text-muted-foreground"><ChevronLeft className="w-4 h-4 mr-1"/>Retour</Button>
      </div>
    </div>
  );

  // ─── STEP 4 — Size + Services ──────────────────────────────────────────────
  const canConfig = !!(form.pressingSize && form.services.length > 0);
  if (stage === "config") return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <StepProgress current={4}/>
        <h2 className="text-xl font-bold mb-5">Configuration du pressing</h2>
        <div className="space-y-5">
          {/* Size */}
          <Card>
            <h3 className="font-bold text-sm mb-3">Taille du projet *</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["petit","🪴 Petit","< 50m²","Démarrage minimal"],
                ["moyen","🏬 Moyen","50-150m²","Format recommandé"],
                ["grand","🏢 Grand","150m²+","Pleine capacité"],
              ].map(([v,em,sz,sub])=>(
                <button key={v} type="button" onClick={()=>setF("pressingSize",v)}
                  className={`p-3 rounded-xl border-2 text-sm text-center transition-all ${form.pressingSize===v?"border-primary bg-primary/5 text-primary":"border-border hover:border-primary/40"}`}>
                  <div className="font-bold">{em}</div>
                  <div className="text-xs font-semibold mt-0.5">{sz}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </button>
              ))}
            </div>
          </Card>
          {/* Services */}
          <Card>
            <h3 className="font-bold text-sm mb-3">Services proposés * <span className="font-normal text-muted-foreground">(plusieurs possibles)</span></h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                ["lavage","👕 Lavage"],["repassage","👔 Repassage"],
                ["sec","🧴 Nettoyage à sec"],["livraison","🚗 Livraison"],
                ["couettes","🛏️ Couettes"],["tapis","🪷 Tapis"],
              ].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>toggleService(v)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${form.services.includes(v)?"border-primary bg-primary/5 text-primary":"border-border hover:border-primary/40"}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${form.services.includes(v)?"bg-primary border-primary":"border-muted-foreground"}`}>
                    {form.services.includes(v)&&<div className="w-2 h-2 rounded-sm bg-white"/>}
                  </div>
                  {l}
                </button>
              ))}
            </div>
          </Card>
        </div>
        <NavRow onBack={()=>goStage("type")} onNext={async()=>{ await updateLead(); goStage("objective"); }} disabled={!canConfig}/>
      </div>
    </div>
  );

  // ─── STEP 5 — Objective ────────────────────────────────────────────────────
  if (stage === "objective") return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <StepProgress current={5}/>
        <h2 className="text-xl font-bold mb-2">Votre objectif principal</h2>
        <p className="text-muted-foreground text-sm mb-5">L'IA adapte ses recommandations à votre vision</p>
        <div className="space-y-3">
          {[
            { v:"complementaire", em:"💰", title:"Revenu complémentaire",    sub:"Activité secondaire en plus d'un emploi" },
            { v:"principale",     em:"🎯", title:"Activité principale",       sub:"Mon pressing sera ma source de revenus principale" },
            { v:"expansion",      em:"📈", title:"Expansion",                 sub:"J'ai déjà une activité et je veux ouvrir un pressing" },
            { v:"franchise",      em:"🏢", title:"Franchise / Multi-sites",   sub:"Développer un réseau ou une marque" },
          ].map(opt=>(
            <button key={opt.v} type="button"
              onClick={()=>{
                setF("objective",opt.v);
                goStage("analyzing");
                setTimeout(()=>runAnalysis(),200);
              }}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all hover:border-primary hover:shadow-md active:scale-[0.99] ${form.objective===opt.v?"border-primary bg-primary/5":"border-border bg-card"}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{opt.em}</span>
                <div>
                  <div className="font-bold">{opt.title}</div>
                  <p className="text-sm text-muted-foreground">{opt.sub}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">Appuyez pour lancer l'analyse IA</p>
        <Button variant="ghost" onClick={()=>goStage("config")} className="w-full mt-2 text-muted-foreground"><ChevronLeft className="w-4 h-4 mr-1"/>Retour</Button>
      </div>
    </div>
  );

  // ─── ANALYZING ─────────────────────────────────────────────────────────────
  if (stage === "analyzing") return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        {/* Animated ring */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping"/>
          <div className="relative w-24 h-24 rounded-full bg-primary/5 border-4 border-primary/20 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin"/>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">L'IA analyse votre marché...</h2>
        <p className="text-muted-foreground text-sm mb-8">Recherche des données actuelles pour {form.city}</p>
        <div className="space-y-3 text-left max-w-sm mx-auto">
          {ANALYSIS_STEPS.map((msg,i)=>(
            <div key={i} className={`flex items-center gap-3 text-sm transition-all duration-300 ${i<analysisStep?"text-emerald-600":i===analysisStep?"text-foreground font-medium":"text-muted-foreground/40"}`}>
              {i<analysisStep
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0"/>
                : i===analysisStep
                  ? <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0"/>
                  : <div className="w-4 h-4 rounded-full border border-muted-foreground/30 flex-shrink-0"/>}
              <span>{msg}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-6">Cela peut prendre 20 à 40 secondes...</p>
      </div>
    </div>
  );

  // ─── RESULTS ───────────────────────────────────────────────────────────────
  const tiers: any[] = report?.tiers ?? [];
  const currency = report?.currency ?? meta?.currency ?? "FCFA";
  const unlockable = form.email || unlocked;

  // Budget comparison chart data
  const chartData = tiers.map(t=>({
    name: t.label?.replace("Pressing ","")?.replace("Blanchisserie ","") ?? t.id,
    budget: Math.round((t.totalBudget?.min + t.totalBudget?.max) / 2),
    profit: Math.round((t.monthlyProfit?.min + t.monthlyProfit?.max) / 2),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-10 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-3 text-sm font-semibold bg-white/20 border border-white/20 px-4 py-1.5 rounded-full">
            <CheckCircle2 className="w-4 h-4"/> Analyse IA complète — {form.city}
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold mb-1">
            {form.fullName ? `Votre rapport, ${form.fullName.split(" ")[0]}` : "Résultats de votre simulation"}
          </h1>
          <p className="text-blue-200 text-sm">
            {report?.summary ?? `Simulation personnalisée pour un pressing ${form.pressingType} à ${form.city}`}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-2 text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5"/>{error}
          </div>
        )}

        {/* 3 Tier cards */}
        <div>
          <h2 className="font-bold text-lg mb-4">📊 3 Scénarios de Budget</h2>
          <div className="space-y-4">
            {tiers.length === 0 && <div className="text-center text-muted-foreground py-8">Rapport en cours de chargement...</div>}
            {tiers.map((tier, idx)=>{
              const st = tierStyle(tier.id);
              const isBlurred = idx > 0 && !unlockable;
              return (
                <div key={tier.id} className={`relative rounded-2xl border-2 ${st.border} ${st.bg} p-5 transition-all`}>
                  {/* Recommended badge */}
                  {tier.id === "standard" && (
                    <div className="absolute -top-3 left-5 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">⭐ Recommandé</div>
                  )}
                  {/* Blur overlay */}
                  {isBlurred && (
                    <div className="absolute inset-0 rounded-2xl bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-3">
                      <Lock className="w-6 h-6 text-muted-foreground"/>
                      <p className="text-sm font-medium text-foreground text-center px-4">
                        Débloquez ce scénario en fournissant votre email
                      </p>
                      <div className="flex gap-2 w-full max-w-xs px-4">
                        <Input placeholder="votre@email.com" value={unlockEmail}
                          onChange={e=>setUnlockEmail(e.target.value)} className="flex-1 text-sm"/>
                        <Button size="sm" onClick={()=>{ if(unlockEmail){ setF("email",unlockEmail); setUnlocked(true); } }}>
                          Débloquer
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Tier content */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{tier.emoji}</span>
                        <span className="font-bold text-base">{tier.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{tier.tagline}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Faisabilité</div>
                      <div className={`text-xl font-bold ${st.score}`}>{tier.feasibilityScore}/100</div>
                    </div>
                  </div>
                  {/* Budget total */}
                  <div className="bg-white/60 rounded-xl p-3 mb-3 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Budget total estimé</div>
                    <div className="text-2xl font-bold text-foreground">{fmtRange(tier.totalBudget, currency)}</div>
                  </div>
                  {/* Monthly metrics */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label:"Charges/mois",  val:tier.monthlyCharges, color:"text-red-600" },
                      { label:"Revenus/mois",  val:tier.monthlyRevenue, color:"text-blue-600" },
                      { label:"Bénéfice/mois", val:tier.monthlyProfit,  color:"text-emerald-600" },
                    ].map(m=>(
                      <div key={m.label} className="bg-white/50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-muted-foreground">{m.label}</div>
                        <div className={`text-xs font-bold ${m.color}`}>{fmtRange(m.val, currency)}</div>
                      </div>
                    ))}
                  </div>
                  {/* ROI + risk */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">ROI estimé : <strong>{tier.roiMonths?.min}–{tier.roiMonths?.max} mois</strong></span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${riskBadge(tier.riskLevel)}`}>
                      Risque {tier.riskLevel}
                    </span>
                  </div>
                  {/* Suitable for */}
                  {tier.suitableFor && (
                    <p className="text-xs text-muted-foreground mt-2 border-t border-border/50 pt-2">
                      👤 {tier.suitableFor}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Budget comparison chart */}
        {chartData.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-base mb-4">💰 Comparaison des budgets</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top:5, right:5, left:5, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" tick={{ fontSize:10 }}/>
                <YAxis tick={{ fontSize:10 }} tickFormatter={v=>`${Math.round(v/1000)}k`}/>
                <Tooltip formatter={(v:number)=>[`${Math.round(v).toLocaleString("fr-FR")} ${currency}`,""]}/>
                <Bar dataKey="budget" name="Budget total" radius={[4,4,0,0]}>
                  {chartData.map((_,i)=>(<Cell key={i} fill={["#10b981","#3b82f6","#9333ea"][i]}/>))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Market analysis */}
        {report?.marketAnalysis && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-base mb-3">🌍 Analyse de marché — {form.city}</h2>
            <div className="space-y-2 text-sm">
              {[
                ["Niveau de demande", report.marketAnalysis.demandLevel],
                ["Fourchette de prix locale", report.marketAnalysis.averagePriceRange],
              ].filter(([,v])=>v).map(([k,v])=>(
                <div key={k} className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
              {report.marketAnalysis.opportunity && (
                <p className="text-muted-foreground text-sm pt-1">{report.marketAnalysis.opportunity}</p>
              )}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {report?.recommendations?.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-base mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-primary"/>Recommandations IA</h2>
            <div className="space-y-2">
              {report.recommendations.map((r:string, i:number)=>(
                <div key={i} className="flex gap-2.5 text-sm">
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</div>
                  <p className="text-foreground leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risks */}
        {report?.risks?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h2 className="font-bold text-base mb-3 flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-4 h-4"/>Points de vigilance
            </h2>
            <ul className="space-y-1.5">
              {report.risks.map((r:string, i:number)=>(
                <li key={i} className="text-sm text-amber-800 flex gap-2">
                  <span className="flex-shrink-0">⚠️</span>{r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PDF */}
        <Button variant="outline" size="lg" className="w-full h-12 font-semibold border-2 hover:bg-primary/5"
          onClick={()=>openPDF(form, report)}>
          <Download className="w-4 h-4 mr-2"/>Télécharger le rapport PDF complet
        </Button>

        {/* Upsells */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-center">🚀 Passez à l'étape suivante</h2>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="text-2xl mb-2">🎓</div>
            <h3 className="font-bold text-base mb-1">Formation Lancement Pressing</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Apprenez à ouvrir et gérer un pressing rentable avec nos experts du secteur.
              Programme complet de 8 semaines.
            </p>
            <Button className="w-full hover:-translate-y-0.5 transition-all shadow-md shadow-primary/20"
              onClick={()=>alert("Programme de formation — à venir")}>
              Recevoir le programme <ArrowRight className="w-4 h-4 ml-1"/>
            </Button>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="text-2xl mb-2">👨‍💼</div>
            <h3 className="font-bold text-base mb-1">Consultation Expert Premium</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Parlez directement à un expert qui analysera votre projet et vous guidera pas à pas.
            </p>
            <Button variant="outline" className="w-full border-2 hover:bg-primary/5 hover:-translate-y-0.5 transition-all"
              onClick={()=>window.open(`https://wa.me/?text=Bonjour, j'ai simulé mon budget pressing sur Xpress Clean pour ${form.city} et j'aimerais une consultation expert.`, "_blank")}>
              <MessageCircle className="w-4 h-4 mr-2"/>Parler à un expert
            </Button>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-900 text-white rounded-2xl p-6 shadow-lg">
            <div className="text-2xl mb-3">💻</div>
            <h3 className="font-bold text-xl mb-2">Gérez votre pressing avec Xpress Clean</h3>
            <p className="text-blue-100 text-sm mb-5">
              Une fois ouvert, pilotez votre pressing comme un pro — commandes, clients, paiements, analyses en temps réel.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {["Suivi commandes","Gestion clients","Paiements","Statistiques","Multi-sites","Rentabilité"].map(f=>(
                <div key={f} className="flex items-center gap-1.5 text-xs text-blue-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-300 flex-shrink-0"/>{f}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button className="bg-white text-primary hover:bg-blue-50 font-semibold w-full" onClick={()=>setLocation("/auth")}>
                Essayer gratuitement
              </Button>
              <Button variant="outline" className="border-white/40 text-white hover:bg-white/10 w-full"
                onClick={()=>window.open("https://wa.me/?text=Bonjour, je souhaite une démo de Xpress Clean pour mon pressing.", "_blank")}>
                Demander une démo
              </Button>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        {report?.disclaimer && (
          <p className="text-xs text-muted-foreground text-center italic px-4">{report.disclaimer}</p>
        )}

        <div className="flex gap-3">
          <button onClick={()=>goStage("objective")} className="flex-1 text-sm text-muted-foreground hover:text-foreground text-center py-3 transition-colors">
            ← Modifier mes données
          </button>
          <button onClick={()=>setLocation("/auth")} className="flex-1 text-sm text-muted-foreground hover:text-foreground text-center py-3 transition-colors">
            Retour à l'accueil →
          </button>
        </div>
      </div>
    </div>
  );
}
