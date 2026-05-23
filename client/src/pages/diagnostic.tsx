import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shirt, ChevronRight, ChevronLeft, CheckCircle2, Download, MessageCircle, Star, Award, TrendingUp, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

// ─── Questions ────────────────────────────────────────────────────────────────
const QUESTIONS = [
  // BLOC 1
  { bloc: "Expertise & Décision Textile", q: "Analysez-vous les textiles avant traitement ?", opts: ["Jamais", "Parfois", "Toujours"] },
  { bloc: "Expertise & Décision Textile", q: "Lisez-vous les étiquettes d'entretien ?", opts: ["Non", "Occasionnellement", "Toujours"] },
  { bloc: "Expertise & Décision Textile", q: "Le traitement varie-t-il selon le type de textile ?", opts: ["Non", "Partiellement", "Systématiquement"] },
  { bloc: "Expertise & Décision Textile", q: "Refusez-vous certains articles trop risqués ?", opts: ["Jamais", "Rarement", "Oui, selon les risques"] },
  // BLOC 2
  { bloc: "Traitement des Taches", q: "Disposez-vous d'une méthode de détachage ?", opts: ["Non", "Méthode basique", "Méthode structurée"] },
  { bloc: "Traitement des Taches", q: "Votre équipe connaît-elle les familles de taches ?", opts: ["Non", "Partiellement", "Oui"] },
  { bloc: "Traitement des Taches", q: "Disposez-vous de protocoles écrits de traitement ?", opts: ["Non", "En cours", "Oui, formalisés"] },
  { bloc: "Traitement des Taches", q: "Les traitements effectués sont-ils traçables ?", opts: ["Non", "Parfois", "Toujours"] },
  // BLOC 3
  { bloc: "Organisation & Flux", q: "Séparez-vous le linge propre du linge sale ?", opts: ["Non", "Parfois", "Toujours"] },
  { bloc: "Organisation & Flux", q: "Vos flux de travail sont-ils organisés ?", opts: ["Non", "Partiellement", "Oui, optimisés"] },
  { bloc: "Organisation & Flux", q: "Assurez-vous un suivi individuel du linge ?", opts: ["Non", "Manuel uniquement", "Système dédié"] },
  { bloc: "Organisation & Flux", q: "Disposez-vous de zones de travail distinctes ?", opts: ["Non", "Partiel", "Bien séparées"] },
  // BLOC 4
  { bloc: "Gestion du Risque", q: "Avez-vous une procédure en cas de litige client ?", opts: ["Aucune", "Informelle", "Formalisée"] },
  { bloc: "Gestion du Risque", q: "Évaluez-vous les risques avant traitement ?", opts: ["Non", "Rarement", "Systématiquement"] },
  { bloc: "Gestion du Risque", q: "Êtes-vous protégé en cas de dommage textile ?", opts: ["Non", "Partiellement", "Totalement"] },
  { bloc: "Gestion du Risque", q: "Avez-vous un protocole de gestion des erreurs textiles ?", opts: ["Non", "Cas par cas", "Protocole défini"] },
  // BLOC 5
  { bloc: "Professionnalisation", q: "Appliquez-vous des standards qualité formalisés ?", opts: ["Aucun", "Standards informels", "Standards formalisés"] },
  { bloc: "Professionnalisation", q: "Quel est votre niveau d'expertise technique ?", opts: ["Basique", "Intermédiaire", "Avancé"] },
  { bloc: "Professionnalisation", q: "Votre pressing a-t-il une image professionnelle ?", opts: ["Absente", "En développement", "Bien établie"] },
  { bloc: "Professionnalisation", q: "Votre activité est-elle structurée et organisée ?", opts: ["Peu organisée", "Partiellement", "Très bien organisée"] },
];

const COUNTRIES = [
  "Cameroun", "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Niger", "Guinée",
  "Bénin", "Togo", "Congo", "RD Congo", "Gabon", "Tchad", "Centrafrique",
  "Madagascar", "Maroc", "Tunisie", "Algérie", "France", "Belgique", "Suisse", "Autre",
];

const ACTIVITY_TYPES = [
  { value: "lavoir",        label: "Lavoir" },
  { value: "blanchisserie", label: "Blanchisserie" },
  { value: "pressing",      label: "Pressing" },
  { value: "unknown",       label: "Je ne sais pas encore" },
];

const OBJECTIVES = [
  "Augmenter mes revenus",
  "Réduire les pertes",
  "Professionnaliser mon activité",
  "Former mon personnel",
  "Attirer une clientèle premium",
  "Ouvrir un pressing moderne",
];

function getLevel(score: number) {
  if (score >= 51) return { label: "Pressing Professionnel", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", badge: "🏆" };
  if (score >= 36) return { label: "Blanchisserie", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", badge: "⭐" };
  return { label: "Lavoir", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", badge: "🌱" };
}

function getRiskIndex(score: number) {
  if (score >= 51) return { label: "Faible", color: "text-emerald-600", bg: "bg-emerald-100" };
  if (score >= 36) return { label: "Moyen", color: "text-yellow-600", bg: "bg-yellow-100" };
  if (score >= 25) return { label: "Élevé", color: "text-orange-600", bg: "bg-orange-100" };
  return { label: "Critique", color: "text-red-600", bg: "bg-red-100" };
}

function getPotential(score: number) {
  if (score >= 51) return "Niveau expert — maintenir et optimiser";
  if (score >= 36) return "Bon potentiel de montée en gamme";
  return "Très fort potentiel de progression";
}

function getRecommendations(score: number): string[] {
  if (score >= 51) return [
    "Mettre en place un système de gestion digitale",
    "Développer une offre premium pour les textiles luxe",
    "Former votre équipe aux nouvelles normes du secteur",
    "Envisager la certification ou l'obtention d'un label qualité",
  ];
  if (score >= 36) return [
    "Formaliser vos protocoles de traitement par écrit",
    "Investir dans un logiciel de suivi du linge",
    "Renforcer la formation de votre équipe sur les taches complexes",
    "Mettre en place une procédure de litige client claire",
  ];
  return [
    "Commencer par lire les étiquettes d'entretien systématiquement",
    "Séparer physiquement le linge propre du linge sale",
    "Créer une fiche simple de réception du linge client",
    "Suivre une formation de base en blanchisserie professionnelle",
  ];
}

function getStrengths(answers: number[]): string[] {
  const strengths: string[] = [];
  const bloc1 = answers.slice(0, 4).reduce((a, b) => a + b, 0);
  const bloc2 = answers.slice(4, 8).reduce((a, b) => a + b, 0);
  const bloc3 = answers.slice(8, 12).reduce((a, b) => a + b, 0);
  const bloc4 = answers.slice(12, 16).reduce((a, b) => a + b, 0);
  const bloc5 = answers.slice(16, 20).reduce((a, b) => a + b, 0);
  if (bloc1 >= 10) strengths.push("Excellente expertise textile");
  if (bloc2 >= 10) strengths.push("Maîtrise du traitement des taches");
  if (bloc3 >= 10) strengths.push("Organisation et flux optimisés");
  if (bloc4 >= 10) strengths.push("Gestion du risque maîtrisée");
  if (bloc5 >= 10) strengths.push("Haut niveau de professionnalisation");
  return strengths.length ? strengths : ["Bonne volonté d'amélioration identifiée"];
}

function getWeaknesses(answers: number[]): string[] {
  const weaknesses: string[] = [];
  const bloc1 = answers.slice(0, 4).reduce((a, b) => a + b, 0);
  const bloc2 = answers.slice(4, 8).reduce((a, b) => a + b, 0);
  const bloc3 = answers.slice(8, 12).reduce((a, b) => a + b, 0);
  const bloc4 = answers.slice(12, 16).reduce((a, b) => a + b, 0);
  const bloc5 = answers.slice(16, 20).reduce((a, b) => a + b, 0);
  if (bloc1 < 8) weaknesses.push("Analyse textile avant traitement insuffisante");
  if (bloc2 < 8) weaknesses.push("Protocoles de détachage à structurer");
  if (bloc3 < 8) weaknesses.push("Organisation des flux à améliorer");
  if (bloc4 < 8) weaknesses.push("Gestion du risque client à renforcer");
  if (bloc5 < 8) weaknesses.push("Niveau de professionnalisation à développer");
  return weaknesses.length ? weaknesses : ["Peu de faiblesses majeures détectées"];
}

// ─── PDF generator ────────────────────────────────────────────────────────────
function openPDF(form: any, score: number, answers: number[]) {
  const level = getLevel(score);
  const risk = getRiskIndex(score);
  const recs = getRecommendations(score);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Diagnostic Pressing — ${form.fullName || "XpressClean"}</title>
<style>
  body{font-family:Arial,sans-serif;color:#1e293b;padding:40px;max-width:800px;margin:auto}
  .header{background:linear-gradient(135deg,#2563eb,#1e40af);color:white;padding:32px;border-radius:12px;margin-bottom:24px}
  .logo{font-size:22px;font-weight:bold;margin-bottom:12px}
  h1{font-size:26px;margin:0 0 6px}
  .sub{font-size:14px;opacity:.85}
  .score-box{display:flex;align-items:center;gap:24px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:20px}
  .score-num{font-size:56px;font-weight:bold;color:#2563eb;line-height:1}
  .level{font-size:20px;font-weight:bold;margin-bottom:4px}
  .section{margin-bottom:20px}
  h2{font-size:16px;color:#2563eb;border-bottom:2px solid #dbeafe;padding-bottom:6px;margin-bottom:12px}
  ul{margin:0;padding-left:20px}
  li{margin-bottom:6px;font-size:14px}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
  .info-item{background:#f8fafc;padding:12px;border-radius:8px;font-size:13px}
  .info-label{color:#64748b;font-size:11px;text-transform:uppercase;margin-bottom:2px}
  .cta{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin-top:20px;text-align:center}
  .footer{text-align:center;color:#94a3b8;font-size:12px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px}
</style></head><body>
<div class="header">
  <div class="logo"><img src="/xpressclean-logo.png" alt="XpressClean" style="height:36px;object-fit:contain;"/></div>
  <h1>Diagnostic Professionnel de Pressing</h1>
  <div class="sub">Rapport personnalisé — ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
</div>
<div class="info-grid">
  <div class="info-item"><div class="info-label">Nom</div>${form.fullName || "—"}</div>
  <div class="info-item"><div class="info-label">Établissement</div>${form.businessName || "—"}</div>
  <div class="info-item"><div class="info-label">Pays / Ville</div>${form.country || "—"} ${form.city ? "· " + form.city : ""}</div>
  <div class="info-item"><div class="info-label">Activité</div>${form.activityType || "—"}</div>
</div>
<div class="score-box">
  <div><div class="score-num">${score}<span style="font-size:24px">/60</span></div></div>
  <div>
    <div class="level">${level.badge} Niveau ${level.label}</div>
    <div style="font-size:13px;color:#64748b;margin-bottom:8px">${getPotential(score)}</div>
    <span class="badge" style="background:#fee2e2;color:#dc2626">Risque textile : ${risk.label}</span>
  </div>
</div>
<div class="section">
  <h2>Recommandations prioritaires</h2>
  <ul>${recs.map(r => `<li>${r}</li>`).join("")}</ul>
</div>
<div class="section">
  <h2>Points forts identifiés</h2>
  <ul>${getStrengths(answers).map(s => `<li>✅ ${s}</li>`).join("")}</ul>
</div>
<div class="section">
  <h2>Axes d'amélioration</h2>
  <ul>${getWeaknesses(answers).map(w => `<li>⚠️ ${w}</li>`).join("")}</ul>
</div>
<div class="cta">
  <strong>Prêt à passer au niveau supérieur ?</strong><br>
  <span style="font-size:13px;color:#1e40af">Digitalisez votre pressing avec XpressClean — gestion des commandes, clients, paiements et statistiques en temps réel.</span>
</div>
<div class="footer">© ${new Date().getFullYear()} XpressClean — Tous droits réservés. Ce rapport est confidentiel.</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center gap-2 mb-4 text-primary font-semibold text-sm bg-blue-50 border border-blue-100 px-4 py-1.5 rounded-full">
        <Shirt className="w-4 h-4" /> XpressClean Diagnostic
      </div>
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight mb-3">{title}</h1>
      {subtitle && <p className="text-muted-foreground text-base max-w-lg mx-auto">{subtitle}</p>}
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>Question {current} sur {total}</span>
        <span>{pct}% complété</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Circular Score Gauge ────────────────────────────────────────────────────
function ScoreGauge({ score, max = 60 }: { score: number; max?: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / max);
  const level = getLevel(score);
  return (
    <div className="relative w-44 h-44 mx-auto mb-2">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={score >= 51 ? "#10b981" : score >= 36 ? "#3b82f6" : "#f97316"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-foreground">{score}</span>
        <span className="text-sm text-muted-foreground">/ {max}</span>
        <span className="text-lg">{level.badge}</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type Phase = "lead" | "intro" | "questions" | "results";

interface LeadForm {
  fullName: string; phone: string; email: string;
  country: string; city: string; businessName: string;
  yearCreated: string; employees: string;
  activityType: string; objectives: string[];
}

const EMPTY_FORM: LeadForm = {
  fullName: "", phone: "", email: "",
  country: "", city: "", businessName: "",
  yearCreated: "", employees: "",
  activityType: "", objectives: [],
};

export default function DiagnosticPage() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("lead");
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);

  const totalScore = answers.reduce((a, b) => a + b, 0);
  const level = getLevel(totalScore);
  const risk = getRiskIndex(totalScore);

  function toggleObjective(obj: string) {
    setForm(f => ({
      ...f,
      objectives: f.objectives.includes(obj)
        ? f.objectives.filter(o => o !== obj)
        : [...f.objectives, obj],
    }));
  }

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/diagnostic/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.id) setLeadId(data.id);
    } catch { /* continue even if save fails */ }
    setSaving(false);
    setPhase("intro");
    window.scrollTo(0, 0);
  }

  function startQuestions() {
    setPhase("questions");
    setCurrentQ(0);
    setAnswers([]);
    setSelectedOpt(null);
    window.scrollTo(0, 0);
  }

  function confirmAnswer() {
    if (selectedOpt === null) return;
    const score = selectedOpt + 1; // opts are 0-indexed, score 1-3
    const newAnswers = [...answers, score];
    setAnswers(newAnswers);
    setSelectedOpt(null);

    if (currentQ + 1 < QUESTIONS.length) {
      setCurrentQ(currentQ + 1);
      window.scrollTo(0, 0);
    } else {
      // All done — save results and show results page
      const finalScore = newAnswers.reduce((a, b) => a + b, 0);
      const finalLevel = getLevel(finalScore).label;
      const finalRisk = getRiskIndex(finalScore).label;
      if (leadId) {
        fetch(`/api/diagnostic/complete/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: newAnswers, totalScore: finalScore, level: finalLevel, riskIndex: finalRisk }),
        }).catch(() => {});
      }
      setPhase("results");
      window.scrollTo(0, 0);
    }
  }

  function goBack() {
    if (currentQ === 0) { setPhase("intro"); return; }
    setAnswers(a => a.slice(0, -1));
    setCurrentQ(q => q - 1);
    setSelectedOpt(null);
    window.scrollTo(0, 0);
  }

  // ── PHASE: Lead form ────────────────────────────────────────────────────────
  if (phase === "lead") {
    return (
      <PageShell>
        <Header
          title="Découvrez le véritable niveau professionnel de votre pressing"
          subtitle="Recevez un diagnostic détaillé basé sur les standards modernes du secteur."
        />
        <form onSubmit={handleLeadSubmit} className="space-y-6">
          {/* Personal info */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-foreground">Informations personnelles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nom complet *</label>
                <Input placeholder="Jean Dupont" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Téléphone WhatsApp *</label>
                <Input placeholder="+237 6XX XXX XXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" placeholder="vous@exemple.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pays *</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} required
                >
                  <option value="">Sélectionner...</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Ville *</label>
                <Input placeholder="Douala" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} required />
              </div>
            </div>
          </div>

          {/* Business info */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-foreground">Informations business</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Nom du pressing</label>
                <Input placeholder="Mon Pressing" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Année de création</label>
                <Input placeholder="2020" value={form.yearCreated} onChange={e => setForm(f => ({ ...f, yearCreated: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre d'employés</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.employees} onChange={e => setForm(f => ({ ...f, employees: e.target.value }))}
                >
                  <option value="">Sélectionner...</option>
                  {["1 (seul)", "2-3", "4-9", "10-20", "20+"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Activity type */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-foreground">Type d'activité</h2>
            <div className="grid grid-cols-2 gap-3">
              {ACTIVITY_TYPES.map(at => (
                <button
                  key={at.value} type="button"
                  onClick={() => setForm(f => ({ ...f, activityType: at.value }))}
                  className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${form.activityType === at.value ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50"}`}
                >
                  {at.label}
                </button>
              ))}
            </div>
          </div>

          {/* Objectives */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-foreground">Objectif principal <span className="font-normal text-muted-foreground text-sm">(plusieurs possibles)</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OBJECTIVES.map(obj => (
                <button
                  key={obj} type="button"
                  onClick={() => toggleObjective(obj)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${form.objectives.includes(obj) ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50"}`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${form.objectives.includes(obj) ? "bg-primary" : "bg-muted"}`}>
                    {form.objectives.includes(obj) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  {obj}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit" size="lg"
            className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            disabled={saving}
          >
            {saving ? "Enregistrement..." : "Démarrer mon Diagnostic"} <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">Vos données sont confidentielles et sécurisées.</p>
        </form>
      </PageShell>
    );
  }

  // ── PHASE: Intro ────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <PageShell>
        <Header
          title="Votre diagnostic commence maintenant"
          subtitle="Ce diagnostic évalue votre niveau réel d'expertise textile, d'organisation et de professionnalisation."
        />
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm text-center space-y-6 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              { icon: "📋", label: "20 questions", sub: "5 blocs thématiques" },
              { icon: "⏱️", label: "5 minutes", sub: "Durée estimée" },
              { icon: "📊", label: "Score sur 60", sub: "Résultat immédiat" },
              { icon: "🎯", label: "Recommandations", sub: "Personnalisées" },
            ].map(item => (
              <div key={item.label} className="bg-blue-50 rounded-xl p-3">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="font-bold text-foreground text-xs">{item.label}</div>
                <div className="text-muted-foreground text-xs">{item.sub}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm text-left">
            {["Expertise & Décision Textile", "Traitement des Taches", "Organisation & Flux", "Gestion du Risque", "Professionnalisation"].map((bloc, i) => (
              <div key={bloc} className="flex items-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                <span>{bloc}</span>
              </div>
            ))}
          </div>
          <Button size="lg" className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all" onClick={startQuestions}>
            Commencer le Diagnostic <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
        <button onClick={() => setLocation("/auth")} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center">
          ← Retour à l'accueil
        </button>
      </PageShell>
    );
  }

  // ── PHASE: Questions ────────────────────────────────────────────────────────
  if (phase === "questions") {
    const q = QUESTIONS[currentQ];
    const bloc = q.bloc;
    const blocIndex = ["Expertise & Décision Textile", "Traitement des Taches", "Organisation & Flux", "Gestion du Risque", "Professionnalisation"].indexOf(bloc) + 1;
    return (
      <PageShell>
        <ProgressBar current={currentQ + 1} total={QUESTIONS.length} />
        <div className="inline-flex items-center gap-1.5 mb-4 text-xs font-semibold text-primary bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
          Bloc {blocIndex} — {bloc}
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm mb-4">
          <p className="text-lg md:text-xl font-bold text-foreground mb-6 leading-snug">{q.q}</p>
          <div className="space-y-3">
            {q.opts.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOpt(idx)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium text-sm ${selectedOpt === idx ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selectedOpt === idx ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                    {selectedOpt === idx && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  {opt}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={goBack} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
          </Button>
          <Button
            onClick={confirmAnswer}
            disabled={selectedOpt === null}
            className="flex-[2] shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            {currentQ + 1 === QUESTIONS.length ? "Voir mes résultats" : "Question suivante"} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </PageShell>
    );
  }

  // ── PHASE: Results ──────────────────────────────────────────────────────────
  const recs = getRecommendations(totalScore);
  const strengths = getStrengths(answers);
  const weaknesses = getWeaknesses(answers);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      {/* Results hero */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-900 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-4 text-sm font-semibold bg-white/20 border border-white/20 px-4 py-1.5 rounded-full">
            <Award className="w-4 h-4" /> Diagnostic complété
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold mb-2">
            {form.fullName ? `Bravo, ${form.fullName.split(" ")[0]} !` : "Résultats de votre diagnostic"}
          </h1>
          <p className="text-blue-200 text-base mb-8">Voici votre rapport professionnel personnalisé</p>
          <ScoreGauge score={totalScore} />
          <div className={`inline-flex items-center gap-2 mt-4 px-5 py-2 rounded-full text-lg font-bold bg-white/20 border border-white/20`}>
            {level.badge} Niveau {level.label}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm text-center">
            <div className="text-sm text-muted-foreground mb-1">Score obtenu</div>
            <div className="text-3xl font-bold text-foreground">{totalScore}<span className="text-lg text-muted-foreground">/60</span></div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm text-center">
            <div className="text-sm text-muted-foreground mb-1">Indice de risque textile</div>
            <div className={`text-xl font-bold ${risk.color}`}>{risk.label}</div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${risk.bg} ${risk.color} font-medium`}>Niveau de risque</span>
          </div>
        </div>

        {/* Potential */}
        <div className={`${level.bg} ${level.border} border rounded-2xl p-5`}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className={`w-5 h-5 ${level.color}`} />
            <span className="font-bold text-sm">Potentiel de montée en gamme</span>
          </div>
          <p className={`font-semibold text-base ${level.color}`}>{getPotential(totalScore)}</p>
        </div>

        {/* Recommendations */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-base mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Recommandations prioritaires</h2>
          <div className="space-y-3">
            {recs.map((r, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-sm text-foreground leading-relaxed">{r}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & weaknesses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
            <h3 className="font-bold text-sm text-emerald-700 mb-3">✅ Points forts</h3>
            <ul className="space-y-2">
              {strengths.map((s, i) => <li key={i} className="text-sm text-emerald-800">{s}</li>)}
            </ul>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
            <h3 className="font-bold text-sm text-orange-700 mb-3">⚠️ Axes d'amélioration</h3>
            <ul className="space-y-2">
              {weaknesses.map((w, i) => <li key={i} className="text-sm text-orange-800">{w}</li>)}
            </ul>
          </div>
        </div>

        {/* PDF download */}
        <Button
          variant="outline" size="lg"
          className="w-full h-12 font-semibold border-2 hover:bg-primary/5"
          onClick={() => openPDF(form, totalScore, answers)}
        >
          <Download className="w-4 h-4 mr-2" /> Télécharger mon rapport PDF
        </Button>

        {/* CTA cards */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-foreground text-center">Passez à l'action</h2>

          {/* CTA 1 — Formation */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="text-2xl mb-3">🎓</div>
            <h3 className="font-bold text-base mb-1">Passez au niveau supérieur</h3>
            <p className="text-sm text-muted-foreground mb-4">Accédez à notre programme de formation professionnel pour pressing et blanchisserie.</p>
            <Button className="w-full shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all" onClick={() => alert("Programme de formation — à venir")}>
              Recevoir le programme <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* CTA 2 — Accompagnement */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="text-2xl mb-3">🤝</div>
            <h3 className="font-bold text-base mb-1">Besoin d'un accompagnement personnalisé ?</h3>
            <p className="text-sm text-muted-foreground mb-4">Nos experts vous accompagnent pour structurer et développer votre activité.</p>
            <Button variant="outline" className="w-full border-2 hover:bg-primary/5 hover:-translate-y-0.5 transition-all" onClick={() => window.open(`https://wa.me/?text=Bonjour, j'ai obtenu le niveau ${level.label} au diagnostic XpressClean (${totalScore}/60) et je souhaite un accompagnement.`, "_blank")}>
              <MessageCircle className="w-4 h-4 mr-2" /> Parler à un expert
            </Button>
          </div>

          {/* CTA 3 — Produits */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="text-2xl mb-3">🧴</div>
            <h3 className="font-bold text-base mb-1">Équipez votre pressing comme un professionnel</h3>
            <p className="text-sm text-muted-foreground mb-4">Produits, machines et accessoires sélectionnés par nos experts.</p>
            <Button variant="outline" className="w-full border-2 hover:bg-primary/5 hover:-translate-y-0.5 transition-all" onClick={() => alert("Catalogue — à venir")}>
              Voir les solutions <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* CTA 4 — SaaS */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-6 shadow-lg">
            <div className="text-2xl mb-3">💻</div>
            <h3 className="font-bold text-xl mb-2">Digitalisez votre pressing</h3>
            <p className="text-blue-100 text-sm mb-4">Pilotez votre blanchisserie avec notre plateforme moderne de gestion et suivi.</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {["Suivi des commandes", "Gestion clients", "Paiements", "Statistiques", "Rentabilité", "Dashboard intelligent"].map(f => (
                <div key={f} className="flex items-center gap-1.5 text-xs text-blue-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" /> {f}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button className="w-full bg-white text-primary hover:bg-blue-50 font-semibold" onClick={() => setLocation("/auth")}>
                Essayer la plateforme
              </Button>
              <Button variant="outline" className="w-full border-white/40 text-white hover:bg-white/10" onClick={() => window.open("https://wa.me/?text=Bonjour, je souhaite une démo de la plateforme XpressClean.", "_blank")}>
                Demander une démo
              </Button>
            </div>
          </div>
        </div>

        <button onClick={() => setLocation("/auth")} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center py-4">
          ← Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
