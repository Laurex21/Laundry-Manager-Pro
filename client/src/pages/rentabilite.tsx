import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  ChevronRight, ChevronLeft, Shirt, Zap, Droplets, FlaskConical,
  Users, TrendingUp, AlertTriangle, CheckCircle2, Info, Download,
  MessageCircle, ArrowRight, BarChart2, Sparkles, BadgeCheck,
} from "lucide-react";

// ─── Geo presets ─────────────────────────────────────────────────────────────
const GEO: Record<string, { sym: string; kwh: number; waterM3: number; diesel: number; minWage: number; benchLow: number; benchHigh: number }> = {
  "Cameroun":       { sym:"FCFA", kwh:88,   waterM3:450,  diesel:720,  minWage:45000,  benchLow:150,  benchHigh:350  },
  "Côte d'Ivoire":  { sym:"FCFA", kwh:82,   waterM3:380,  diesel:640,  minWage:60000,  benchLow:200,  benchHigh:400  },
  "Sénégal":        { sym:"FCFA", kwh:115,  waterM3:500,  diesel:680,  minWage:58900,  benchLow:200,  benchHigh:450  },
  "Mali":           { sym:"FCFA", kwh:95,   waterM3:420,  diesel:700,  minWage:40000,  benchLow:150,  benchHigh:350  },
  "Burkina Faso":   { sym:"FCFA", kwh:100,  waterM3:400,  diesel:720,  minWage:34664,  benchLow:150,  benchHigh:350  },
  "Niger":          { sym:"FCFA", kwh:110,  waterM3:430,  diesel:700,  minWage:30000,  benchLow:120,  benchHigh:300  },
  "Guinée":         { sym:"GNF",  kwh:1500, waterM3:5000, diesel:12000,minWage:500000, benchLow:2000, benchHigh:5000 },
  "Bénin":          { sym:"FCFA", kwh:90,   waterM3:450,  diesel:700,  minWage:40000,  benchLow:150,  benchHigh:350  },
  "Togo":           { sym:"FCFA", kwh:93,   waterM3:420,  diesel:720,  minWage:35000,  benchLow:150,  benchHigh:350  },
  "Congo":          { sym:"FCFA", kwh:95,   waterM3:500,  diesel:750,  minWage:90000,  benchLow:200,  benchHigh:450  },
  "RD Congo":       { sym:"CDF",  kwh:150,  waterM3:1000, diesel:3500, minWage:500000, benchLow:1000, benchHigh:3000 },
  "Gabon":          { sym:"FCFA", kwh:70,   waterM3:400,  diesel:600,  minWage:150000, benchLow:300,  benchHigh:600  },
  "Tchad":          { sym:"FCFA", kwh:150,  waterM3:600,  diesel:800,  minWage:60000,  benchLow:200,  benchHigh:500  },
  "Centrafrique":   { sym:"FCFA", kwh:200,  waterM3:700,  diesel:900,  minWage:40000,  benchLow:200,  benchHigh:600  },
  "Madagascar":     { sym:"Ar",   kwh:480,  waterM3:2000, diesel:5000, minWage:200000, benchLow:500,  benchHigh:2000 },
  "Maroc":          { sym:"MAD",  kwh:1.2,  waterM3:8,    diesel:14,   minWage:2828,   benchLow:5,    benchHigh:15   },
  "Tunisie":        { sym:"TND",  kwh:0.25, waterM3:1.5,  diesel:2.2,  minWage:450,    benchLow:2,    benchHigh:8    },
  "Algérie":        { sym:"DA",   kwh:4.2,  waterM3:25,   diesel:28,   minWage:20000,  benchLow:80,   benchHigh:250  },
  "France":         { sym:"€",    kwh:0.22, waterM3:4,    diesel:1.85, minWage:1767,   benchLow:3,    benchHigh:8    },
  "Belgique":       { sym:"€",    kwh:0.28, waterM3:5,    diesel:1.80, minWage:1800,   benchLow:3,    benchHigh:9    },
  "Suisse":         { sym:"CHF",  kwh:0.25, waterM3:3,    diesel:2.10, minWage:4000,   benchLow:8,    benchHigh:20   },
  "Autre":          { sym:"USD",  kwh:0.12, waterM3:2,    diesel:1.50, minWage:500,    benchLow:1,    benchHigh:5    },
};

const COUNTRY_CODES: Record<string, string> = {
  "Cameroun":"+237","Côte d'Ivoire":"+225","Sénégal":"+221","Mali":"+223",
  "Burkina Faso":"+226","Niger":"+227","Guinée":"+224","Bénin":"+229","Togo":"+228",
  "Congo":"+242","RD Congo":"+243","Gabon":"+241","Tchad":"+235","Centrafrique":"+236",
  "Madagascar":"+261","Maroc":"+212","Tunisie":"+216","Algérie":"+213",
  "France":"+33","Belgique":"+32","Suisse":"+41","Autre":"+1",
};

const COUNTRIES = Object.keys(GEO);
const PIE_COLORS = ["#3b82f6","#06b6d4","#8b5cf6","#f59e0b","#10b981","#f43f5e"];

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "lead"|"mode"|"step1"|"step2"|"step3"|"step4"|"results";
type Mode  = "smart"|"expert";

interface Lead { name:string; country:string; city:string; phone:string; email:string; }

interface Inputs {
  // step1
  laundryType: string; machineKg: number; loadsPerDay: number; garmentsPerLoad: number;
  kwhPerCycle: number; litersPerCycle: number;
  // step2
  powerSource: string;
  monthlyElecBill: number; monthlyFuelCost: number;
  electricityTariff: number; waterTariff: number;
  // step3
  detergentPkgPrice: number; detergentPkgKg: number;
  monthlyWaterBill: number; otherMonthlySupplies: number;
  detergentGramsPerCycle: number; otherChemicalPerCycle: number;
  // step4
  monthlyRent: number; staffCount: number; avgMonthlySalary: number;
  hoursPerCycle: number; hourlyWage: number;
  monthlyMaintenance: number; machinePrice: number; lifetimeCycles: number;
  desiredMargin: number;
}

interface Results {
  cyclesPerMonth: number;
  elec: number; water: number; detergent: number; labor: number; fixed: number; other: number;
  amort: number; maint: number;
  totalPerCycle: number; costPerKg: number; costPerGarment: number;
  recommendedPrice: number;
  monthlyRevenue: number; monthlyCost: number; monthlyProfit: number; actualMargin: number;
  breakdown: { name:string; value:number; pct:number }[];
}

// ─── Calculation engine ───────────────────────────────────────────────────────
function calculate(inp: Inputs, mode: Mode): Results {
  const cyclesPerMonth = Math.max(inp.loadsPerDay * 26, 1);

  let elec=0, water=0, detergent=0, labor=0, fixed=0, other=0, amort=0, maint=0;

  if (mode === "smart") {
    elec      = inp.monthlyElecBill / cyclesPerMonth;
    water     = inp.monthlyWaterBill / cyclesPerMonth;
    const detPriceKg = inp.detergentPkgKg > 0 ? inp.detergentPkgPrice / inp.detergentPkgKg : 0;
    const detGrams   = inp.machineKg * 10;
    detergent = (detGrams * detPriceKg) / 1000;
    labor     = (inp.staffCount * inp.avgMonthlySalary) / cyclesPerMonth;
    fixed     = inp.monthlyRent / cyclesPerMonth;
    other     = inp.otherMonthlySupplies / cyclesPerMonth;
  } else {
    elec      = inp.kwhPerCycle * inp.electricityTariff;
    water     = (inp.litersPerCycle / 1000) * inp.waterTariff;
    const detPriceKg = inp.detergentPkgKg > 0 ? inp.detergentPkgPrice / inp.detergentPkgKg : 0;
    detergent = (inp.detergentGramsPerCycle * detPriceKg) / 1000;
    labor     = inp.hoursPerCycle * inp.hourlyWage * inp.staffCount;
    fixed     = inp.monthlyRent / cyclesPerMonth;
    maint     = inp.monthlyMaintenance / cyclesPerMonth;
    amort     = inp.lifetimeCycles > 0 ? inp.machinePrice / inp.lifetimeCycles : 0;
    other     = inp.otherChemicalPerCycle;
  }

  const totalPerCycle = elec + water + detergent + labor + fixed + other + amort + maint;
  const costPerKg     = inp.machineKg > 0 ? totalPerCycle / inp.machineKg : 0;
  const costPerGarment= inp.garmentsPerLoad > 0 ? totalPerCycle / inp.garmentsPerLoad : costPerKg / 3;
  const recommendedPrice = inp.desiredMargin < 100 ? totalPerCycle / (1 - inp.desiredMargin / 100) : totalPerCycle * 2;
  const monthlyRevenue   = recommendedPrice * cyclesPerMonth;
  const monthlyCost      = totalPerCycle * cyclesPerMonth;
  const monthlyProfit    = monthlyRevenue - monthlyCost;
  const actualMargin     = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;

  const breakdown = [
    { name:"Électricité",    value:elec,              pct: totalPerCycle>0?elec/totalPerCycle*100:0 },
    { name:"Eau",            value:water,             pct: totalPerCycle>0?water/totalPerCycle*100:0 },
    { name:"Détergent",      value:detergent,         pct: totalPerCycle>0?detergent/totalPerCycle*100:0 },
    { name:"Main-d'œuvre",   value:labor,             pct: totalPerCycle>0?labor/totalPerCycle*100:0 },
    { name:"Loyer & fixes",  value:fixed+maint+amort, pct: totalPerCycle>0?(fixed+maint+amort)/totalPerCycle*100:0 },
    { name:"Autres",         value:other,             pct: totalPerCycle>0?other/totalPerCycle*100:0 },
  ].filter(d => d.value > 0.001);

  return { cyclesPerMonth, elec, water, detergent, labor, fixed, other, amort, maint, totalPerCycle, costPerKg, costPerGarment, recommendedPrice, monthlyRevenue, monthlyCost, monthlyProfit, actualMargin, breakdown };
}

function detectLeaks(inp: Inputs, r: Results) {
  const alerts: { type:"error"|"warning"|"info"; msg:string }[] = [];
  if (r.totalPerCycle === 0) return alerts;
  const elecPct = r.totalPerCycle > 0 ? r.elec / r.totalPerCycle * 100 : 0;
  const detPct  = r.totalPerCycle > 0 ? r.detergent / r.totalPerCycle * 100 : 0;
  const labPct  = r.totalPerCycle > 0 ? r.labor / r.totalPerCycle * 100 : 0;

  if (r.monthlyProfit < 0)      alerts.push({ type:"error",   msg:"⚠️ Vos prix ne couvrent pas vos coûts ! Vous perdez de l'argent chaque mois." });
  if (inp.desiredMargin < 20)   alerts.push({ type:"warning", msg:"Marge cible < 20% — vos prix ne couvriront pas les imprévus et la croissance." });
  if (elecPct > 40)             alerts.push({ type:"warning", msg:`L'électricité pèse ${Math.round(elecPct)}% de vos coûts — étudiez le passage au solaire.` });
  if (detPct > 25)              alerts.push({ type:"warning", msg:`Le détergent représente ${Math.round(detPct)}% de vos coûts — optimisez le dosage.` });
  if (labPct > 55)              alerts.push({ type:"warning", msg:`La main-d'œuvre représente ${Math.round(labPct)}% de vos coûts — évaluez l'organisation.` });
  if (r.actualMargin > 0 && r.actualMargin < 15) alerts.push({ type:"warning", msg:"Marge nette très faible — peu de réserves pour les imprévus." });
  if (alerts.length === 0)      alerts.push({ type:"info",    msg:"Bonne structure de coûts ! Continuez à surveiller vos marges chaque mois." });
  return alerts;
}

// ─── PDF export ───────────────────────────────────────────────────────────────
function openPDF(lead: Lead, inp: Inputs, r: Results, mode: Mode, sym: string) {
  const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} ${sym}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Rapport Rentabilité — ${lead.name}</title>
<style>
  body{font-family:Arial,sans-serif;color:#1e293b;padding:40px;max-width:820px;margin:auto;font-size:13px}
  .header{background:linear-gradient(135deg,#2563eb,#1e40af);color:white;padding:28px;border-radius:12px;margin-bottom:20px}
  .logo{font-weight:bold;font-size:18px;margin-bottom:8px}.title{font-size:22px;font-weight:bold;margin:0 0 4px}.sub{opacity:.8;font-size:12px}
  h2{font-size:14px;color:#2563eb;border-bottom:2px solid #dbeafe;padding-bottom:4px;margin:18px 0 10px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
  .card-label{font-size:10px;color:#64748b;text-transform:uppercase;margin-bottom:4px}
  .card-val{font-size:18px;font-weight:bold;color:#1e293b}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9}
  .profit{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px;text-align:center;margin-bottom:16px}
  .cta{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center;margin-top:16px}
  .footer{text-align:center;color:#94a3b8;font-size:11px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold}
</style></head><body>
<div class="header">
  <div class="logo">👕 CleanEase</div>
  <div class="title">Rapport de Rentabilité</div>
  <div class="sub">Calculateur de rentabilité pressing — ${new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</div>
</div>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:12px">
  <div class="card"><div class="card-label">Nom</div><div style="font-weight:bold">${lead.name}</div></div>
  <div class="card"><div class="card-label">Ville / Pays</div><div style="font-weight:bold">${lead.city}, ${lead.country}</div></div>
  <div class="card"><div class="card-label">Mode</div><div style="font-weight:bold">${mode==="smart"?"Smart Assist":"Expert"}</div></div>
</div>
<h2>Coûts par cycle (${inp.machineKg}kg, ${inp.loadsPerDay} charges/jour)</h2>
<div class="grid">
  <div class="card"><div class="card-label">Coût / cycle</div><div class="card-val">${fmt(r.totalPerCycle)}</div></div>
  <div class="card"><div class="card-label">Coût / kg</div><div class="card-val">${fmt(r.costPerKg)}</div></div>
  <div class="card"><div class="card-label">Coût / vêtement</div><div class="card-val">${fmt(r.costPerGarment)}</div></div>
  <div class="card"><div class="card-label">Prix recommandé</div><div class="card-val" style="color:#2563eb">${fmt(r.recommendedPrice)}</div></div>
</div>
<h2>Projection mensuelle (${r.cyclesPerMonth} cycles)</h2>
<div class="profit">
  <div style="font-size:11px;color:#64748b;margin-bottom:4px">BÉNÉFICE MENSUEL ESTIMÉ</div>
  <div style="font-size:28px;font-weight:bold;color:${r.monthlyProfit>=0?"#10b981":"#ef4444"}">${fmt(r.monthlyProfit)}</div>
  <div style="font-size:11px;color:#64748b">Marge nette : ${r.actualMargin.toFixed(1)}%</div>
</div>
<div class="grid">
  <div class="card"><div class="card-label">Revenus mensuels</div><div class="card-val" style="color:#10b981">${fmt(r.monthlyRevenue)}</div></div>
  <div class="card"><div class="card-label">Coûts mensuels</div><div class="card-val" style="color:#ef4444">${fmt(r.monthlyCost)}</div></div>
  <div class="card"><div class="card-label">Marge souhaitée</div><div class="card-val">${inp.desiredMargin}%</div></div>
  <div class="card"><div class="card-label">Marge réelle</div><div class="card-val">${r.actualMargin.toFixed(1)}%</div></div>
</div>
<h2>Répartition des coûts par cycle</h2>
${r.breakdown.map(b=>`<div class="row"><span>${b.name}</span><span>${fmt(b.value)} <span class="badge" style="background:#eff6ff;color:#2563eb">${b.pct.toFixed(0)}%</span></span></div>`).join("")}
<div class="cta">
  <strong>Optimisez votre pressing avec CleanEase</strong><br>
  <span style="font-size:12px;color:#1e40af">Gestion des commandes, clients, paiements et statistiques en temps réel.</span>
</div>
<div class="footer">© ${new Date().getFullYear()} CleanEase Inc. — Rapport confidentiel généré le ${new Date().toLocaleDateString("fr-FR")}</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      <div className="max-w-2xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}

function TopBadge({ label }: { label: string }) {
  return (
    <div className="text-center mb-6">
      <div className="inline-flex items-center gap-2 text-primary font-semibold text-sm bg-blue-50 border border-blue-100 px-4 py-1.5 rounded-full">
        <BarChart2 className="w-4 h-4" /> {label}
      </div>
    </div>
  );
}

function StepProgress({ current, total=4 }: { current: number; total?: number }) {
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>Étape {current} sur {total}</span>
        <span>{Math.round(current/total*100)}% complété</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width:`${current/total*100}%` }} />
      </div>
      <div className="flex justify-between mt-2">
        {["Activité","Énergie","Fournitures","Charges"].map((s,i) => (
          <span key={s} className={`text-xs ${i+1 <= current ? "text-primary font-semibold" : "text-muted-foreground"}`}>{s}</span>
        ))}
      </div>
    </div>
  );
}

function EstimatedBadge() {
  return <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Estimé</span>;
}

function MetricCard({ label, value, sub, color="text-foreground", icon }: { label:string; value:string; sub?:string; color?:string; icon?:React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel="Étape suivante", disabled=false, step, total=4 }:
  { onBack?:()=>void; onNext:()=>void; nextLabel?:string; disabled?:boolean; step:number; total?:number }) {
  return (
    <div className="flex gap-3 mt-4">
      {onBack && <Button variant="outline" onClick={onBack} className="flex-1"><ChevronLeft className="w-4 h-4 mr-1" />Précédent</Button>}
      <Button onClick={onNext} disabled={disabled} className={`${onBack?"flex-[2]":"w-full"} shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
        {nextLabel} {step < total ? <ChevronRight className="w-4 h-4 ml-1" /> : <Sparkles className="w-4 h-4 ml-1" />}
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const DEFAULTS: Inputs = {
  laundryType:"pressing", machineKg:10, loadsPerDay:5, garmentsPerLoad:30,
  kwhPerCycle:1.5, litersPerCycle:100,
  powerSource:"grid",
  monthlyElecBill:0, monthlyFuelCost:0,
  electricityTariff:88, waterTariff:450,
  detergentPkgPrice:0, detergentPkgKg:1, monthlyWaterBill:0, otherMonthlySupplies:0,
  detergentGramsPerCycle:100, otherChemicalPerCycle:0,
  monthlyRent:0, staffCount:1, avgMonthlySalary:0,
  hoursPerCycle:1, hourlyWage:0, monthlyMaintenance:0, machinePrice:0, lifetimeCycles:5000,
  desiredMargin:35,
};

export default function RentabilitePage() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<Stage>("lead");
  const [mode,  setMode ] = useState<Mode>("smart");
  const [lead,  setLead ] = useState<Lead>({ name:"", country:"", city:"", phone:"", email:"" });
  const [inp,   setInp  ] = useState<Inputs>(DEFAULTS);
  const [leadId,setLeadId] = useState<number|null>(null);
  const [saving,setSaving] = useState(false);
  const [phoneCode, setPhoneCode] = useState("+237");

  // Auto-fill geo presets when country changes
  useEffect(() => {
    if (!lead.country) return;
    const g = GEO[lead.country];
    if (g) {
      setInp(i => ({ ...i, electricityTariff: g.kwh, waterTariff: g.waterM3, avgMonthlySalary: g.minWage }));
      setPhoneCode(COUNTRY_CODES[lead.country] ?? "+1");
    }
  }, [lead.country]);

  function setI<K extends keyof Inputs>(k: K, v: Inputs[K]) { setInp(i => ({ ...i, [k]: v })); }
  function numI(k: keyof Inputs) { return (e: React.ChangeEvent<HTMLInputElement>) => setI(k, Number(e.target.value) as any); }

  const geo = GEO[lead.country] ?? GEO["Autre"];
  const sym = geo.sym;
  const results = calculate(inp, mode);
  const leaks   = detectLeaks(inp, results);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch("/api/v1/leads/rentabilite", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ name:lead.name, country:lead.country, city:lead.city, phone:`${phoneCode} ${lead.phone}`, email:lead.email }),
      });
      const d = await r.json();
      if (d.id) setLeadId(d.id);
    } catch { /* continue */ }
    setSaving(false);
    setStage("mode");
    window.scrollTo(0, 0);
  }

  function goResults() {
    if (leadId) {
      fetch(`/api/v1/leads/rentabilite/${leadId}/complete`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ calculationJson: { inputs: inp, results, mode } }),
      }).catch(()=>{});
    }
    setStage("results");
    window.scrollTo(0, 0);
  }

  function goStep(s: Stage) { setStage(s); window.scrollTo(0, 0); }

  const fmtN = (n: number) => Math.round(n).toLocaleString("fr-FR");
  const fmtV = (n: number) => `${fmtN(n)} ${sym}`;

  // ── LEAD CAPTURE ────────────────────────────────────────────────────────────
  if (stage === "lead") {
    return (
      <PageShell>
        <TopBadge label="Calculateur de rentabilité" />
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
            Calculez la rentabilité réelle de votre pressing
          </h1>
          <p className="text-muted-foreground">
            Obtenez votre rapport personnalisé de coûts, marges et bénéfices — même sans formation comptable.
          </p>
        </div>
        <form onSubmit={submitLead} className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Nom complet *</label>
                <Input placeholder="Jean Dupont" value={lead.name} onChange={e=>setLead(l=>({...l,name:e.target.value}))} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pays *</label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={lead.country} onChange={e=>setLead(l=>({...l,country:e.target.value}))} required>
                  <option value="">Sélectionner...</option>
                  {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ville *</label>
                <Input placeholder="Douala" value={lead.city} onChange={e=>setLead(l=>({...l,city:e.target.value}))} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Téléphone *</label>
                <div className="flex gap-2">
                  <select className="h-10 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-24"
                    value={phoneCode} onChange={e=>setPhoneCode(e.target.value)}>
                    {COUNTRIES.map(c=><option key={c} value={COUNTRY_CODES[c]??"+1"}>{COUNTRY_CODES[c]??"+1"} {c.slice(0,3)}</option>)}
                  </select>
                  <Input className="flex-1" placeholder="6XX XXX XXX" value={lead.phone} onChange={e=>setLead(l=>({...l,phone:e.target.value}))} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email *</label>
                <Input type="email" placeholder="vous@exemple.com" value={lead.email} onChange={e=>setLead(l=>({...l,email:e.target.value}))} required />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
            {[["🔒","Données confidentielles"],["📊","Rapport instantané"],["🚀","100% gratuit"]].map(([ic,tx])=>(
              <div key={tx} className="bg-card border border-border rounded-xl p-3">
                <div className="text-lg mb-1">{ic}</div>{tx}
              </div>
            ))}
          </div>
          <Button type="submit" size="lg" className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all" disabled={saving}>
            {saving ? "Enregistrement..." : "Accéder au Calculateur"} <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </form>
      </PageShell>
    );
  }

  // ── MODE SELECTION ──────────────────────────────────────────────────────────
  if (stage === "mode") {
    return (
      <PageShell>
        <TopBadge label="Calculateur de rentabilité" />
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold mb-2">Choisissez votre mode de calcul</h1>
          <p className="text-muted-foreground text-sm">Bonjour {lead.name.split(" ")[0]} 👋 — choisissez selon votre niveau de données disponibles.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Smart Assist */}
          <button onClick={() => { setMode("smart"); goStep("step1"); }}
            className="bg-card border-2 border-primary rounded-2xl p-6 text-left hover:shadow-lg hover:-translate-y-1 transition-all shadow-md shadow-primary/10">
            <div className="text-3xl mb-3">🤖</div>
            <div className="font-bold text-lg mb-1">Smart Assist</div>
            <div className="text-xs bg-primary text-white px-2 py-0.5 rounded-full inline-block mb-3 font-medium">Recommandé</div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">Questions simples, estimations intelligentes. Parfait si vous n'avez pas toutes vos données techniques.</p>
            <ul className="space-y-1 text-sm">
              {["Questions conversationnelles","Valeurs estimées automatiquement","Idéal pour débutants"].map(f=>(
                <li key={f} className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />{f}</li>
              ))}
            </ul>
          </button>
          {/* Expert */}
          <button onClick={() => { setMode("expert"); goStep("step1"); }}
            className="bg-card border-2 border-border rounded-2xl p-6 text-left hover:border-primary hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-3">🎯</div>
            <div className="font-bold text-lg mb-1">Mode Expert</div>
            <div className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full inline-block mb-3 font-medium">Précision maximale</div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">Entrez vos données exactes (kWh, litres, grammes...) pour un résultat ultra-précis.</p>
            <ul className="space-y-1 text-sm">
              {["Inputs techniques détaillés","Amortissement machine","Confiance haute"].map(f=>(
                <li key={f} className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />{f}</li>
              ))}
            </ul>
          </button>
        </div>
        <button onClick={() => goStep("lead")} className="w-full text-sm text-muted-foreground hover:text-foreground text-center py-2 transition-colors">← Retour</button>
      </PageShell>
    );
  }

  // ── STEP 1 — Business basics ────────────────────────────────────────────────
  if (stage === "step1") {
    return (
      <PageShell>
        <TopBadge label={`Mode ${mode === "smart" ? "Smart Assist 🤖" : "Expert 🎯"}`} />
        <StepProgress current={1} />
        <h2 className="text-xl font-bold mb-4">Votre activité</h2>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          {/* Laundry type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Type de pressing</label>
            <div className="grid grid-cols-3 gap-2">
              {[["traditional","🪣 Traditionnel"],["eco","🌿 Éco"],["industrial","🏭 Industriel"]].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setI("laundryType",v)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${inp.laundryType===v?"border-primary bg-primary/5 text-primary":"border-border hover:border-primary/40"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {/* Machine size */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Capacité de la machine (kg)</label>
            <div className="grid grid-cols-5 gap-2">
              {[5,10,15,20,30].map(kg=>(
                <button key={kg} type="button" onClick={()=>{ setI("machineKg",kg); setI("garmentsPerLoad",kg*3); setI("litersPerCycle",kg*10); setI("kwhPerCycle",kg*0.15); setI("detergentGramsPerCycle",kg*10); }}
                  className={`p-2.5 rounded-xl border-2 text-sm font-bold transition-all ${inp.machineKg===kg?"border-primary bg-primary/5 text-primary":"border-border hover:border-primary/40"}`}>
                  {kg}kg
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" placeholder="Autre (kg)" className="w-32" value={inp.machineKg} onChange={e=>{const v=Number(e.target.value);setI("machineKg",v);setI("garmentsPerLoad",v*3);}} min={1} />
              <span className="text-sm text-muted-foreground">ou saisir une valeur personnalisée</span>
            </div>
          </div>
          {/* Loads per day */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre de charges par jour</label>
            <div className="flex items-center gap-4">
              <Slider value={[inp.loadsPerDay]} onValueChange={([v])=>setI("loadsPerDay",v)} min={1} max={20} step={1} className="flex-1" />
              <div className="w-14 text-center font-bold text-lg text-primary">{inp.loadsPerDay}</div>
            </div>
            <p className="text-xs text-muted-foreground">Soit {inp.loadsPerDay * 26} cycles/mois (26 jours ouvrés)</p>
          </div>
          {/* Garments per load */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Vêtements traités par charge</label>
            <div className="flex items-center gap-2">
              <Input type="number" value={inp.garmentsPerLoad} onChange={numI("garmentsPerLoad")} min={1} className="w-28" />
              <span className="text-sm text-muted-foreground">vêtements (estimé : {inp.machineKg * 3})</span>
            </div>
          </div>
          {/* Expert extras */}
          {mode === "expert" && (
            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Données techniques</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">kWh par cycle <EstimatedBadge /></label>
                  <Input type="number" step="0.1" value={inp.kwhPerCycle} onChange={numI("kwhPerCycle")} />
                  <p className="text-xs text-muted-foreground">Estimé : {(inp.machineKg * 0.15).toFixed(1)} kWh</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Litres d'eau par cycle <EstimatedBadge /></label>
                  <Input type="number" value={inp.litersPerCycle} onChange={numI("litersPerCycle")} />
                  <p className="text-xs text-muted-foreground">Estimé : {inp.machineKg * 10} L</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <NavButtons onBack={()=>goStep("mode")} onNext={()=>goStep("step2")} step={1} />
      </PageShell>
    );
  }

  // ── STEP 2 — Energy ─────────────────────────────────────────────────────────
  if (stage === "step2") {
    return (
      <PageShell>
        <TopBadge label={`Mode ${mode === "smart" ? "Smart Assist 🤖" : "Expert 🎯"}`} />
        <StepProgress current={2} />
        <h2 className="text-xl font-bold mb-4">Énergie & électricité</h2>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          {/* Power source */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Source d'énergie principale</label>
            <div className="grid grid-cols-2 gap-2">
              {[["grid","⚡ Réseau électrique"],["generator","🔧 Groupe électrogène"],["solar","☀️ Énergie solaire"],["mixed","⚡☀️ Mixte"]].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setI("powerSource",v)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${inp.powerSource===v?"border-primary bg-primary/5 text-primary":"border-border hover:border-primary/40"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {mode === "smart" ? (
            <>
              {(inp.powerSource === "grid" || inp.powerSource === "mixed" || inp.powerSource === "solar") && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Facture mensuelle d'électricité ({sym})</label>
                  <Input type="number" placeholder="Ex: 25000" value={inp.monthlyElecBill||""} onChange={numI("monthlyElecBill")} />
                  <p className="text-xs text-muted-foreground">Entrez votre facture mensuelle totale de votre pressing</p>
                </div>
              )}
              {(inp.powerSource === "generator" || inp.powerSource === "mixed") && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Coût mensuel en carburant ({sym})</label>
                  <Input type="number" placeholder="Ex: 15000" value={inp.monthlyFuelCost||""} onChange={numI("monthlyFuelCost")} />
                  <p className="text-xs text-muted-foreground">Prix diesel local estimé : {fmtN(geo.diesel)} {sym}/L</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tarif électricité ({sym}/kWh) <EstimatedBadge /></label>
                  <Input type="number" step="0.01" value={inp.electricityTariff} onChange={numI("electricityTariff")} />
                  <p className="text-xs text-muted-foreground">Tarif local estimé : {geo.kwh} {sym}/kWh</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tarif eau ({sym}/m³) <EstimatedBadge /></label>
                  <Input type="number" step="0.01" value={inp.waterTariff} onChange={numI("waterTariff")} />
                  <p className="text-xs text-muted-foreground">Tarif local estimé : {geo.waterM3} {sym}/m³</p>
                </div>
              </div>
              {inp.powerSource === "generator" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-800">Paramètres groupe électrogène</p>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Consommation carburant par cycle (L)</label>
                    <Input type="number" step="0.1" placeholder="Ex: 0.5" value={inp.monthlyFuelCost||""} onChange={numI("monthlyFuelCost")} />
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Smart assist tip */}
          {mode === "smart" && inp.monthlyElecBill === 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2 text-sm text-blue-800">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Si vous n'avez pas votre facture, estimez environ {fmtN(inp.machineKg * inp.loadsPerDay * 4)} {sym}/mois pour votre machine.</span>
            </div>
          )}
        </div>
        <NavButtons onBack={()=>goStep("step1")} onNext={()=>goStep("step3")} step={2} />
      </PageShell>
    );
  }

  // ── STEP 3 — Supplies ────────────────────────────────────────────────────────
  if (stage === "step3") {
    return (
      <PageShell>
        <TopBadge label={`Mode ${mode === "smart" ? "Smart Assist 🤖" : "Expert 🎯"}`} />
        <StepProgress current={3} />
        <h2 className="text-xl font-bold mb-4">Fournitures & consommables</h2>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          {/* Detergent */}
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" />Détergent</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm">Prix du paquet ({sym})</label>
                <Input type="number" placeholder="Ex: 5000" value={inp.detergentPkgPrice||""} onChange={numI("detergentPkgPrice")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm">Poids du paquet (kg)</label>
                <Input type="number" step="0.1" placeholder="Ex: 2.5" value={inp.detergentPkgKg||""} onChange={numI("detergentPkgKg")} />
              </div>
            </div>
            {inp.detergentPkgPrice > 0 && inp.detergentPkgKg > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                Prix au kg : {fmtN(inp.detergentPkgPrice / inp.detergentPkgKg)} {sym}/kg —
                Coût par cycle estimé : {fmtN(inp.machineKg * 10 * (inp.detergentPkgPrice / inp.detergentPkgKg) / 1000)} {sym}
                <span className="ml-1">(dosage estimé : {inp.machineKg * 10}g)</span>
              </div>
            )}
            {mode === "expert" && (
              <div className="space-y-1.5">
                <label className="text-sm">Dosage exact par cycle (g) <EstimatedBadge /></label>
                <Input type="number" value={inp.detergentGramsPerCycle} onChange={numI("detergentGramsPerCycle")} />
                <p className="text-xs text-muted-foreground">Estimé : {inp.machineKg * 10}g pour {inp.machineKg}kg</p>
              </div>
            )}
          </div>

          {/* Water bill (smart) */}
          {mode === "smart" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2"><Droplets className="w-4 h-4 text-cyan-500" />Facture eau mensuelle ({sym})</label>
              <Input type="number" placeholder="Ex: 8000" value={inp.monthlyWaterBill||""} onChange={numI("monthlyWaterBill")} />
            </div>
          )}

          {/* Other supplies */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Autres fournitures mensuelles ({sym})</label>
            <Input type="number" placeholder="Ex: 3000 (adoucissant, antitaches, emballages...)" value={inp.otherMonthlySupplies||""} onChange={numI("otherMonthlySupplies")} />
            <p className="text-xs text-muted-foreground">Adoucissant, parfum, détachant, sachets plastique, etc.</p>
          </div>

          {mode === "expert" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Autres produits chimiques par cycle ({sym})</label>
              <Input type="number" step="0.5" placeholder="Ex: 50" value={inp.otherChemicalPerCycle||""} onChange={numI("otherChemicalPerCycle")} />
            </div>
          )}
        </div>
        <NavButtons onBack={()=>goStep("step2")} onNext={()=>goStep("step4")} step={3} />
      </PageShell>
    );
  }

  // ── STEP 4 — Fixed costs & margin ────────────────────────────────────────────
  if (stage === "step4") {
    return (
      <PageShell>
        <TopBadge label={`Mode ${mode === "smart" ? "Smart Assist 🤖" : "Expert 🎯"}`} />
        <StepProgress current={4} />
        <h2 className="text-xl font-bold mb-4">Charges fixes & objectif de marge</h2>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          {/* Rent */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Loyer mensuel du local ({sym})</label>
            <Input type="number" placeholder="Ex: 50000" value={inp.monthlyRent||""} onChange={numI("monthlyRent")} />
          </div>
          {/* Staff */}
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Personnel</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm">Nombre d'employés</label>
                <Input type="number" min={0} value={inp.staffCount} onChange={numI("staffCount")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm">Salaire moyen / mois ({sym}) <EstimatedBadge /></label>
                <Input type="number" value={inp.avgMonthlySalary||""} onChange={numI("avgMonthlySalary")} />
                <p className="text-xs text-muted-foreground">SMIG local : {fmtN(geo.minWage)} {sym}</p>
              </div>
            </div>
          </div>

          {/* Expert extras */}
          {mode === "expert" && (
            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Données avancées</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm">Heures de travail / cycle</label>
                  <Input type="number" step="0.25" value={inp.hoursPerCycle} onChange={numI("hoursPerCycle")} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm">Salaire horaire ({sym}/h)</label>
                  <Input type="number" value={inp.hourlyWage||""} onChange={numI("hourlyWage")} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm">Maintenance mensuelle ({sym})</label>
                  <Input type="number" placeholder="Ex: 10000" value={inp.monthlyMaintenance||""} onChange={numI("monthlyMaintenance")} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm">Prix d'achat machine ({sym})</label>
                  <Input type="number" placeholder="Ex: 500000" value={inp.machinePrice||""} onChange={numI("machinePrice")} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm">Durée de vie machine (cycles)</label>
                  <Input type="number" value={inp.lifetimeCycles} onChange={numI("lifetimeCycles")} />
                  <p className="text-xs text-muted-foreground">Amortissement/cycle : {inp.machinePrice > 0 ? fmtN(inp.machinePrice / inp.lifetimeCycles) : "—"} {sym}</p>
                </div>
              </div>
            </div>
          )}

          {/* Margin slider */}
          <div className="border-t border-border pt-4 space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" />Marge bénéficiaire souhaitée</label>
            <div className="flex items-center gap-4">
              <Slider value={[inp.desiredMargin]} onValueChange={([v])=>setI("desiredMargin",v)} min={10} max={70} step={1} className="flex-1" />
              <div className="w-14 text-center font-bold text-xl text-primary">{inp.desiredMargin}%</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              {[[10,25,"text-orange-500","Bas"],[26,45,"text-blue-500","Standard"],[46,70,"text-emerald-500","Élevé"]].map(([lo,hi,cls,lbl])=>(
                <button key={lbl} type="button" onClick={()=>setI("desiredMargin", Math.round(((lo as number)+(hi as number))/2))}
                  className={`p-2 rounded-lg border ${inp.desiredMargin>=(lo as number)&&inp.desiredMargin<=(hi as number)?"border-primary bg-primary/5":"border-border"} ${cls}`}>
                  {lo}–{hi}% <br />{lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
        <NavButtons onBack={()=>goStep("step3")} onNext={goResults} nextLabel="Voir mes résultats" step={4} />
      </PageShell>
    );
  }

  // ── RESULTS ─────────────────────────────────────────────────────────────────
  const r = results;
  const confidence = mode === "expert" ? "Haute" : "Moyenne";
  const barData = [
    { name:"Coûts", value: Math.round(r.monthlyCost), fill:"#ef4444" },
    { name:"Revenus", value: Math.round(r.monthlyRevenue), fill:"#3b82f6" },
    { name:"Bénéfice", value: Math.round(Math.max(r.monthlyProfit, 0)), fill:"#10b981" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-900 text-white py-10 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-4 text-sm font-semibold bg-white/20 border border-white/20 px-4 py-1.5 rounded-full">
            <BadgeCheck className="w-4 h-4" /> Rapport généré — Confiance {confidence}
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold mb-1">Rapport de Rentabilité</h1>
          <p className="text-blue-200 text-sm mb-6">{lead.name} · {lead.city}, {lead.country}</p>
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl text-2xl font-bold ${r.monthlyProfit >= 0 ? "bg-emerald-500/20 border border-emerald-400/30" : "bg-red-500/20 border border-red-400/30"}`}>
            <span>{r.monthlyProfit >= 0 ? "📈" : "📉"}</span>
            <span>{r.monthlyProfit >= 0 ? "+" : ""}{fmtV(r.monthlyProfit)}</span>
            <span className="text-base font-normal opacity-80">/mois</span>
          </div>
          <p className="text-blue-300 text-sm mt-2">Marge nette estimée : {r.actualMargin.toFixed(1)}%</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Coût / cycle" value={fmtV(r.totalPerCycle)} icon={<Zap className="w-3.5 h-3.5" />} />
          <MetricCard label="Coût / kg" value={fmtV(r.costPerKg)} icon={<Shirt className="w-3.5 h-3.5" />} />
          <MetricCard label="Coût / vêtement" value={fmtV(r.costPerGarment)} icon={<Shirt className="w-3.5 h-3.5" />} />
          <MetricCard label="Prix recommandé" value={fmtV(r.recommendedPrice)} color="text-primary" icon={<TrendingUp className="w-3.5 h-3.5" />} sub={`Cycle ${inp.machineKg}kg`} />
        </div>

        {/* Monthly projection */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-base mb-4 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" />Projection mensuelle ({r.cyclesPerMonth} cycles)</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Revenus</div>
              <div className="text-lg font-bold text-blue-600">{fmtV(r.monthlyRevenue)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Charges</div>
              <div className="text-lg font-bold text-red-500">{fmtV(r.monthlyCost)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Bénéfice net</div>
              <div className={`text-lg font-bold ${r.monthlyProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtV(r.monthlyProfit)}</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} margin={{ top:5, right:5, left:5, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize:11 }} />
              <YAxis tick={{ fontSize:10 }} tickFormatter={v=>`${Math.round(v/1000)}k`} />
              <Tooltip formatter={(v:number)=>[`${fmtN(v)} ${sym}`,""]} />
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {barData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost breakdown pie */}
        {r.breakdown.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-base mb-4">Répartition des coûts par cycle</h2>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={r.breakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                    {r.breakdown.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v:number)=>[`${fmtN(v)} ${sym}`,""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 w-full">
                {r.breakdown.map((b,idx) => (
                  <div key={b.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      <span>{b.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{fmtN(b.value)} {sym}</span>
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{b.pct.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Benchmark comparison */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-base mb-3">📊 Comparaison locale — {lead.country}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Votre coût par kg</span>
              <span className="font-bold text-foreground">{fmtV(r.costPerKg)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Fourchette locale estimée</span>
              <span className="text-foreground">{fmtN(geo.benchLow)}–{fmtN(geo.benchHigh)} {sym}/kg</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-muted-foreground">Position</span>
              <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                r.costPerKg < geo.benchLow ? "bg-emerald-100 text-emerald-700" :
                r.costPerKg > geo.benchHigh ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
              }`}>
                {r.costPerKg < geo.benchLow ? "✅ En dessous de la moyenne" :
                 r.costPerKg > geo.benchHigh ? "⚠️ Au-dessus de la moyenne" : "📊 Dans la moyenne"}
              </span>
            </div>
          </div>
        </div>

        {/* Profit leak detection */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-base mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Détection des fuites de rentabilité</h2>
          <div className="space-y-2">
            {leaks.map((lk, i) => (
              <div key={i} className={`flex gap-2.5 p-3 rounded-xl text-sm ${
                lk.type==="error" ? "bg-red-50 border border-red-200 text-red-800" :
                lk.type==="warning" ? "bg-amber-50 border border-amber-200 text-amber-800" :
                "bg-emerald-50 border border-emerald-200 text-emerald-800"
              }`}>
                {lk.type==="error" ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> :
                 lk.type==="warning" ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> :
                 <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                {lk.msg}
              </div>
            ))}
          </div>
        </div>

        {/* PDF export */}
        <Button variant="outline" size="lg" className="w-full h-12 font-semibold border-2 hover:bg-primary/5" onClick={() => openPDF(lead, inp, r, mode, sym)}>
          <Download className="w-4 h-4 mr-2" /> Télécharger mon rapport PDF
        </Button>

        {/* CTA cards */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-center">Passez à l'action</h2>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="text-2xl mb-2">📚</div>
            <h3 className="font-bold text-base mb-1">Optimisez vos coûts avec notre formation</h3>
            <p className="text-sm text-muted-foreground mb-3">Apprenez à réduire vos charges de 20–35% grâce aux bonnes pratiques professionnelles.</p>
            <Button className="w-full hover:-translate-y-0.5 transition-all shadow-md shadow-primary/20" onClick={() => alert("Programme de formation — à venir")}>
              Recevoir le programme <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="text-2xl mb-2">🤝</div>
            <h3 className="font-bold text-base mb-1">Un expert analyse votre résultat</h3>
            <p className="text-sm text-muted-foreground mb-3">Obtenez des recommandations personnalisées pour améliorer votre rentabilité.</p>
            <Button variant="outline" className="w-full border-2 hover:bg-primary/5 hover:-translate-y-0.5 transition-all"
              onClick={() => window.open(`https://wa.me/?text=Bonjour, j'ai calculé ma rentabilité sur CleanEase (bénéfice estimé : ${fmtN(r.monthlyProfit)} ${sym}/mois) et j'aimerais un accompagnement expert.`, "_blank")}>
              <MessageCircle className="w-4 h-4 mr-2" /> Parler à un expert
            </Button>
          </div>

          {/* CleanEase SaaS CTA */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-900 text-white rounded-2xl p-6 shadow-lg">
            <div className="text-2xl mb-3">💻</div>
            <h3 className="font-bold text-xl mb-2">Pilotez votre pressing avec CleanEase</h3>
            <p className="text-blue-100 text-sm mb-5">Suivez votre rentabilité en temps réel — commandes, paiements, statistiques et bien plus.</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {["Suivi des commandes","Gestion clients","Tableau de bord","Statistiques","Facturation","Multi-sites"].map(f=>(
                <div key={f} className="flex items-center gap-1.5 text-xs text-blue-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" /> {f}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button className="bg-white text-primary hover:bg-blue-50 font-semibold w-full" onClick={() => setLocation("/auth")}>
                Essayer gratuitement
              </Button>
              <Button variant="outline" className="border-white/40 text-white hover:bg-white/10 w-full"
                onClick={() => window.open("https://wa.me/?text=Bonjour, je voudrais une démo de CleanEase.", "_blank")}>
                Demander une démo
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => goStep("step4")} className="flex-1 text-sm text-muted-foreground hover:text-foreground text-center py-3 transition-colors">
            ← Modifier mes données
          </button>
          <button onClick={() => setLocation("/auth")} className="flex-1 text-sm text-muted-foreground hover:text-foreground text-center py-3 transition-colors">
            Retour à l'accueil →
          </button>
        </div>
      </div>
    </div>
  );
}
