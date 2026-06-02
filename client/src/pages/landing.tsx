import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import {
  Shirt, Package, Users, CreditCard, BarChart3, FileText,
  TrendingUp, CheckCircle, Building2, Activity, Layers,
  ChevronRight, Star, Globe, PieChart, Zap, RefreshCw,
  Clock, Package2, ArrowRight, Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "pt", label: "PT" },
];

const FEATURES = [
  { icon: Package, key: "feature_orders", descKey: "feature_orders_desc" },
  { icon: CreditCard, key: "feature_payments", descKey: "feature_payments_desc" },
  { icon: Building2, key: "feature_multisite", descKey: "feature_multisite_desc" },
  { icon: Users, key: "feature_customers", descKey: "feature_customers_desc" },
  { icon: FileText, key: "feature_receipts", descKey: "feature_receipts_desc" },
  { icon: BarChart3, key: "feature_analytics", descKey: "feature_analytics_desc" },
  { icon: TrendingUp, key: "feature_profitability", descKey: "feature_profitability_desc" },
  { icon: Shirt, key: "feature_garments", descKey: "feature_garments_desc" },
  { icon: Activity, key: "feature_history", descKey: "feature_history_desc" },
];

const TESTIMONIALS = [
  { name: "Mamadou Diallo", role: "Gérant, PressNet Dakar", text: "XpressPro a révolutionné la gestion de mon pressing. Je suis passé de 20 à 80 commandes par jour sans embaucher.", avatar: "MD", country: "🇸🇳" },
  { name: "Amina Kouassi", role: "Fondatrice, CleanShine Abidjan", text: "Les reçus automatiques et le suivi multi-agences m'ont fait gagner 3h par jour. C'est indispensable.", avatar: "AK", country: "🇨🇮" },
  { name: "Chidi Okafor", role: "Directeur, FreshPress Lagos", text: "La fonctionnalité de rentabilité m'a aidé à doubler mon bénéfice net en 4 mois. Vraiment excellent.", avatar: "CO", country: "🇳🇬" },
];

// SVG Africa map node positions (cx/cy in a 0-100 normalized space, mapped to SVG viewBox 600x620)
const AFRICA_NODES = [
  { id: "ma", label: "Maroc", x: 168, y: 70, r: 4, highlight: false },
  { id: "eg", label: "Égypte", x: 370, y: 62, r: 4, highlight: false },
  { id: "sn", label: "Sénégal", x: 68, y: 185, r: 7, highlight: true, stat: "50k+ orders" },
  { id: "ci", label: "Côte d'Ivoire", x: 118, y: 258, r: 6, highlight: true, stat: "35k+ clients" },
  { id: "gh", label: "Ghana", x: 155, y: 260, r: 5, highlight: false },
  { id: "ng", label: "Nigeria", x: 215, y: 232, r: 9, highlight: true, stat: "100k+ transactions" },
  { id: "cm", label: "Cameroun", x: 260, y: 258, r: 7, highlight: true, stat: "30k+ garments" },
  { id: "et", label: "Éthiopie", x: 385, y: 178, r: 5, highlight: false },
  { id: "ke", label: "Kenya", x: 400, y: 278, r: 7, highlight: true, stat: "45k+ orders" },
  { id: "cd", label: "RD Congo", x: 295, y: 310, r: 6, highlight: true },
  { id: "tz", label: "Tanzanie", x: 378, y: 330, r: 5, highlight: false },
  { id: "ao", label: "Angola", x: 248, y: 375, r: 5, highlight: false },
  { id: "za", label: "Afrique du Sud", x: 295, y: 495, r: 7, highlight: true, stat: "25k+ clients" },
  { id: "mg", label: "Madagascar", x: 460, y: 365, r: 4, highlight: false },
];

const CONNECTIONS: [string, string][] = [
  ["sn", "ci"], ["ci", "gh"], ["gh", "ng"], ["ng", "cm"],
  ["ng", "cd"], ["cm", "cd"], ["cd", "ke"], ["ke", "tz"],
  ["cd", "ao"], ["ao", "za"], ["tz", "za"],
];

function getNode(id: string) {
  return AFRICA_NODES.find((n) => n.id === id);
}

function AfricaMap() {
  return (
    <div className="relative w-full max-w-[520px] mx-auto">
      <svg viewBox="0 0 520 580" className="w-full h-auto" aria-hidden="true">
        <defs>
          <radialGradient id="bgGrad" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0a0f1e" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowLg">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <circle cx="260" cy="290" r="260" fill="url(#bgGrad)" />

        {/* Grid dots */}
        {Array.from({ length: 20 }, (_, row) =>
          Array.from({ length: 16 }, (_, col) => (
            <circle key={`g${row}-${col}`} cx={col * 34 + 4} cy={row * 31 + 4} r="0.8" fill="#334155" opacity="0.4" />
          ))
        )}

        {/* Connection lines */}
        {CONNECTIONS.map(([a, b]) => {
          const na = getNode(a); const nb = getNode(b);
          if (!na || !nb) return null;
          return (
            <line key={`${a}-${b}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
              stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.25" strokeDasharray="4 4" />
          );
        })}

        {/* Nodes */}
        {AFRICA_NODES.map((node) => (
          <g key={node.id} filter={node.highlight ? "url(#glow)" : undefined}>
            {node.highlight && (
              <>
                <circle cx={node.x} cy={node.y} r={node.r + 8} fill="#3b82f6" opacity="0.08">
                  <animate attributeName="r" values={`${node.r + 4};${node.r + 14};${node.r + 4}`} dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.12;0;0.12" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle cx={node.x} cy={node.y} r={node.r + 3} fill="#3b82f6" opacity="0.15">
                  <animate attributeName="r" values={`${node.r + 2};${node.r + 8};${node.r + 2}`} dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.2;0;0.2" dur="3s" repeatCount="indefinite" />
                </circle>
              </>
            )}
            <circle cx={node.x} cy={node.y} r={node.r} fill={node.highlight ? "#60a5fa" : "#475569"} stroke={node.highlight ? "#93c5fd" : "#64748b"} strokeWidth="1.2" />
            {node.r >= 6 && (
              <text x={node.x} y={node.y - node.r - 5} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="system-ui">{node.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || target === 0) return;
    const duration = 1800;
    const steps = 60;
    const inc = target / steps;
    let current = 0;
    const id = setInterval(() => {
      current = Math.min(current + inc, target);
      setCount(Math.floor(current));
      if (current >= target) clearInterval(id);
    }, duration / steps);
    return () => clearInterval(id);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } } };
const stagger = { visible: { transition: { staggerChildren: 0.09 } } };

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { data: publicStats } = useQuery<{
    totalOrders: number; totalCustomers: number; totalTransactions: number;
    totalLaundries: number; totalGarments: number;
  }>({
    queryKey: ["/api/public/stats"],
    staleTime: 60_000,
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* ── NAVBAR ───────────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shirt className="w-4 h-4 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">XpressPro</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {["landing_nav_features", "landing_nav_tools", "landing_nav_pricing", "landing_nav_about"].map((key) => (
              <a key={key} href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">{t(key)}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-1">
              {LANGUAGES.map((lang) => (
                <button key={lang.code} onClick={() => i18n.changeLanguage(lang.code)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${i18n.language === lang.code ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  {lang.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/auth")} data-testid="nav-login">{t("landing_login")}</Button>
            <Button size="sm" onClick={() => setLocation("/auth")} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="nav-trial">{t("landing_cta_primary")}</Button>
          </div>

          <button className="md:hidden p-2 text-slate-700" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 px-4 pb-4 space-y-2">
            {["landing_nav_features", "landing_nav_tools", "landing_nav_pricing", "landing_nav_about"].map((key) => (
              <a key={key} href="#" className="block py-2 text-sm font-medium text-slate-600">{t(key)}</a>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setLocation("/auth")}>{t("landing_login")}</Button>
              <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLocation("/auth")}>{t("landing_cta_primary")}</Button>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-[#060d1f] pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,#1d4ed860,transparent)]" />
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle, #334155 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center w-full">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8">
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 tracking-[0.15em] uppercase bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                {t("landing_eyebrow")}
              </span>
            </motion.div>

            <motion.div variants={fadeUp} className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight">
                {t("landing_hero_title")}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
                  {t("landing_hero_accent")}
                </span>
              </h1>
              <p className="text-lg text-slate-400 leading-relaxed max-w-xl">{t("landing_hero_subtitle")}</p>
            </motion.div>

            <motion.ul variants={fadeUp} className="space-y-3">
              {["landing_bullet_1", "landing_bullet_2", "landing_bullet_3"].map((key) => (
                <li key={key} className="flex items-center gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  {t(key)}
                </li>
              ))}
            </motion.ul>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setLocation("/auth")}
                className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 h-12 px-6 text-sm font-semibold gap-2"
                data-testid="hero-cta-primary">
                {t("landing_cta_primary")} <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation("/auth")}
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white h-12 px-6 text-sm font-semibold"
                data-testid="hero-cta-secondary">
                {t("landing_cta_secondary")}
              </Button>
            </motion.div>
          </motion.div>

          {/* Dashboard preview mockup */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="hidden lg:block">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/40">
              <div className="bg-slate-800/60 border-b border-slate-700/50 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                </div>
                <div className="flex-1 mx-3 h-5 bg-slate-700/50 rounded-md flex items-center px-3">
                  <span className="text-[10px] text-slate-500">app.xpresspro.com/dashboard</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Today's Orders", val: "24", delta: "+3", color: "text-emerald-400" },
                    { label: "Revenue MTD", val: "142K FCFA", delta: "↑12%", color: "text-blue-400" },
                    { label: "Queue", val: "18", delta: "in process", color: "text-amber-400" },
                    { label: "Avg Turnaround", val: "2.4 days", delta: "▼0.3", color: "text-emerald-400" },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/30">
                      <p className="text-[10px] text-slate-500 font-medium mb-1">{item.label}</p>
                      <p className="text-base font-bold text-white">{item.val}</p>
                      <p className={`text-[10px] mt-0.5 ${item.color}`}>{item.delta}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-700/20">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Order Queue</p>
                  </div>
                  {[
                    { id: "1042", name: "Dupont Jean", items: 4, stage: "Washing", color: "text-blue-400" },
                    { id: "1041", name: "Fatima K.", items: 2, stage: "Ready", color: "text-emerald-400" },
                    { id: "1040", name: "Pierre M.", items: 7, stage: "Ironing", color: "text-amber-400" },
                  ].map((o) => (
                    <div key={o.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-700/20 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-600 font-mono">#{o.id}</span>
                        <span className="text-xs text-slate-300 font-medium">{o.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-600">{o.items} items</span>
                        <span className={`text-[10px] font-semibold ${o.color}`}>{o.stage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-slate-100 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { key: "landing_stats_laundries", value: publicStats?.totalLaundries || 0, suffix: "+" },
              { key: "landing_stats_orders", value: publicStats?.totalOrders || 0, suffix: "+" },
              { key: "landing_stats_customers", value: publicStats?.totalCustomers || 0, suffix: "+" },
              { key: "landing_stats_countries", value: 12, suffix: "" },
            ].map((stat) => (
              <div key={stat.key} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-slate-500 mt-1.5 font-medium">{t(stat.key)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t("landing_eyebrow")}</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">{t("landing_features_title")}</h2>
            <p className="mt-4 text-slate-500 text-lg">{t("landing_features_subtitle")}</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, key, descKey }) => (
              <motion.div key={key} variants={fadeUp}
                className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1.5">{t(`landing_${key}`)}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{t(`landing_${descKey}`)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PRODUCT PREVIEW ──────────────────────────────────────────── */}
      <section className="bg-[#060d1f] py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">{t("landing_preview_title")}</h2>
            <p className="mt-4 text-slate-400 text-lg">{t("landing_preview_subtitle")}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-black/60">
            <div className="bg-slate-800/80 border-b border-slate-700/50 px-5 py-3 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
              </div>
              <div className="flex-1 max-w-xs h-5 bg-slate-700/60 rounded flex items-center px-2">
                <span className="text-[10px] text-slate-500">app.xpresspro.com/analytics</span>
              </div>
            </div>
            <div className="bg-slate-900 p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Revenue", val: "2.4M FCFA", icon: TrendingUp, c: "blue" },
                    { label: "Net Profit", val: "680K", icon: PieChart, c: "emerald" },
                    { label: "Orders", val: "347", icon: Package, c: "violet" },
                  ].map((k) => (
                    <div key={k.label} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/30">
                      <k.icon className={`w-4 h-4 mb-2 text-${k.c}-400`} />
                      <p className="text-lg font-bold text-white">{k.val}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{k.label}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-3">Monthly Revenue</p>
                  <div className="flex items-end gap-1.5 h-20">
                    {[35, 52, 40, 68, 55, 72, 88, 65, 78, 92, 74, 100].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm transition-all"
                        style={{ height: `${h}%`, background: i === 11 ? "rgb(96,165,250)" : "rgb(51,65,85)" }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-800/60 rounded-xl border border-slate-700/30 p-4">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-3">Top Services</p>
                  {[["Wash & Fold", "42%"], ["Dry Cleaning", "33%"], ["Ironing", "25%"]].map(([n, p]) => (
                    <div key={n} className="mb-2 last:mb-0">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>{n}</span><span>{p}</span></div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: p }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-800/60 rounded-xl border border-slate-700/30 p-4">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-2">Break-even</p>
                  <p className="text-xl font-bold text-emerald-400">✓ Profitable</p>
                  <p className="text-[10px] text-slate-500 mt-1">+42% above break-even</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── AFRICA MAP ───────────────────────────────────────────────── */}
      <section className="bg-[#08111f] py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-6">
              <motion.div variants={fadeUp}>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Pan-African</span>
                <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white leading-tight">{t("landing_africa_title")}</h2>
                <p className="mt-4 text-slate-400 text-lg leading-relaxed">{t("landing_africa_subtitle")}</p>
              </motion.div>
              <motion.div variants={stagger} className="space-y-3">
                {[
                  { country: "🇳🇬 Nigeria", stat: "100k+ transactions", highlight: true },
                  { country: "🇸🇳 Sénégal", stat: "50k+ orders managed" },
                  { country: "🇨🇮 Côte d'Ivoire", stat: "35k+ customers served" },
                  { country: "🇨🇲 Cameroun", stat: "30k+ garments processed" },
                  { country: "🇰🇪 Kenya", stat: "45k+ orders managed" },
                ].map((item) => (
                  <motion.div key={item.country} variants={fadeUp}
                    className="flex items-center justify-between bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3">
                    <span className="text-sm font-medium text-slate-300">{item.country}</span>
                    <span className="text-xs text-blue-400 font-semibold">{item.stat}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <AfricaMap />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TOOLS SECTION ────────────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t("landing_tools_title")}</span>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Activity, titleKey: "landing_tool_diagnostic_title", descKey: "landing_tool_diagnostic_desc", btnKey: "landing_tool_diagnostic_btn", href: "/diagnostic", color: "blue" },
              { icon: Zap, titleKey: "landing_tool_calc_title", descKey: "landing_tool_calc_desc", btnKey: "landing_tool_calc_btn", href: "/calculateur", color: "violet" },
              { icon: TrendingUp, titleKey: "landing_tool_profit_title", descKey: "landing_tool_profit_desc", btnKey: "landing_tool_profit_btn", href: "/rentabilite", color: "emerald" },
            ].map((tool) => (
              <motion.div key={tool.href} variants={fadeUp}
                className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <div className={`w-12 h-12 rounded-2xl bg-${tool.color}-50 flex items-center justify-center mb-5`}>
                  <tool.icon className={`w-6 h-6 text-${tool.color}-600`} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">{t(tool.titleKey)}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-5">{t(tool.descKey)}</p>
                <a href={tool.href}>
                  <Button variant="outline" size="sm" className="gap-2 group-hover:border-blue-300 group-hover:text-blue-600 transition-colors" data-testid={`tool-btn-${tool.href.slice(1)}`}>
                    {t(tool.btnKey)} <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">{t("landing_testimonials_title")}</h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t2) => (
              <motion.div key={t2.name} variants={fadeUp}
                className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed mb-5 italic">"{t2.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{t2.avatar}</div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{t2.name} {t2.country}</p>
                    <p className="text-xs text-slate-500">{t2.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-violet-700 py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-6">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-white leading-tight">
              {t("landing_final_title")}
            </motion.h2>
            <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4">
              <Button size="lg" onClick={() => setLocation("/auth")}
                className="bg-white text-blue-700 hover:bg-slate-100 h-12 px-8 font-semibold shadow-lg"
                data-testid="final-cta-trial">
                {t("landing_final_cta")} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation("/auth")}
                className="border-white/40 text-white hover:bg-white/10 h-12 px-8 font-semibold"
                data-testid="final-cta-login">
                {t("landing_login")}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-500 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
              <Shirt className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-bold text-white text-sm">XpressPro</span>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} XpressPro · {t("all_rights_reserved")}</p>
          <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-1">
            {LANGUAGES.map((lang) => (
              <button key={lang.code} onClick={() => i18n.changeLanguage(lang.code)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${i18n.language === lang.code ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
