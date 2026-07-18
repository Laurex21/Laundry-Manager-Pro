import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BarChart3, Building2, Calculator, Check, CheckCircle2,
  ClipboardCheck, CreditCard, Droplets, FileText, Globe2, GraduationCap,
  Layers3, Menu, Package, Play, School, Settings, Shirt, Sparkles,
  TrendingUp, Truck, UserRound, Wallet, Wind, X, XCircle,
} from "lucide-react";

type PublicStats = { totalOrders: number; totalCustomers: number; totalLaundries: number };
type MapStats = {
  countries: Array<{ country: string; lat: number; lng: number; activeSites: number; totalOrders: number; totalClients: number }>;
  totals: { activeSites: number; totalOrders: number; totalClients: number; totalUsers: number };
  hasRealData: boolean;
};

const NAVY = "#0D1B4B";
const BLUE = "#1E63F0";

const LANDING_FR: Record<string, string> = {
  skip:"Aller au contenu",main_nav:"Navigation principale",menu:"Ouvrir le menu",contact:"Contact",start_free:"Essai gratuit",hero_badge:"Conçu pour les pressings africains",hero_title:"Gérez un pressing plus rentable.",hero_sub:"Commandes, clients, paiements, traçabilité des vêtements, coûts de production, rentabilité et performances depuis une seule plateforme intelligente conçue pour l'Afrique.",start_trial:"Démarrer gratuitement — 30 jours",calculate_profit:"Calculer mon profit →",calculate_profit_plain:"Calculer mon profit",hero_trust:"Sans carte bancaire · Sans engagement · Résiliation à tout moment",receipt_generated:"Reçu généré automatiquement",profit_up:"+23% bénéfice ce mois",proof:"Preuves d'utilisation",trusted_across_africa:"Des pressings à travers l'Afrique et au-delà font confiance à XpressPro.",active_laundries:"Pressings actifs",orders_processed:"Commandes traitées",customers_registered:"Clients enregistrés",countries:"Pays couverts",
  problem_eyebrow:"Le problème quotidien",problem_title:"Vous reconnaissez-vous dans ces situations ?",problem_solution:"XpressPro résout chacun de ces problèmes — dès le premier jour d'utilisation.",pain_garments:"Vêtements égarés",pain_garments_desc:"Aucune trace du dépôt. Impossible de retrouver les habits du client sans fouiller vos carnets.",pain_payments:"Paiements oubliés",pain_payments_desc:"Des clients repartent sans payer. Vous le découvrez seulement en fin de journée.",pain_notebooks:"Carnets illisibles",pain_notebooks_desc:"Ratures, pages arrachées, carnets perdus. Vos commandes disparaissent avec eux.",pain_profit:"Rentabilité inconnue",pain_profit_desc:"Vous travaillez dur mais ne savez pas si votre pressing gagne ou perd de l'argent.",pain_customers:"Clients insatisfaits",pain_customers_desc:"« Mon linge est prêt ? » Vous cherchez dans vos papiers pendant cinq minutes.",pain_data:"Aucun pilotage",pain_data_desc:"Impossible de savoir quels services rapportent le plus ou quels jours sont les plus chargés.",
  workflow_eyebrow:"Comment ça marche",workflow_title:"Du dépôt à la livraison — chaque étape est tracée",workflow_sub:"Votre équipe sait toujours où en est chaque commande. Vos clients aussi.",client:"Client",order:"Commande",sorting:"Tri",washing:"Lavage",drying:"Séchage",ironing:"Repassage",packing:"Emballage",ready:"Prêt",delivery:"Livraison",reports:"Rapports",
  tools_eyebrow:"Outils gratuits",tools_title:"Commencez à piloter votre pressing — même sans compte",tools_sub:"Des outils professionnels gratuits conçus pour les entrepreneurs du pressing africain.",most_used:"Le plus utilisé",diagnostic:"Diagnostic Professionnel",diagnostic_desc:"Identifiez les axes d'amélioration de votre pressing en quelques minutes.",startup_calc:"Calculateur de Démarrage",startup_calc_desc:"Estimez votre budget total pour ouvrir un pressing selon votre ville et capacité.",profit_calc:"Calculateur de Rentabilité",profit_calc_desc:"En 4 étapes, calculez votre seuil de rentabilité, votre bénéfice réel et recevez un rapport personnalisé sur WhatsApp.",health_score:"Score de Santé",health_score_desc:"10 questions pour évaluer la performance opérationnelle et financière de votre pressing.",audit:"Audit Professionnel",audit_desc:"Un rapport complet de votre activité avec des recommandations concrètes.",no_signup:"Sans inscription",whatsapp_report:"Rapport WhatsApp",
  product_eyebrow:"La plateforme complète",product_title:"Tout ce dont votre pressing a besoin — en un seul endroit",product_note:"Toutes les fonctionnalités incluses dès le plan Starter.",pillar_run:"Gérer votre pressing",pillar_grow:"Développer votre activité",pillar_learn:"Apprendre et progresser",
  run_1:"Gestion des commandes",run_2:"Profils clients & historique",run_3:"Paiements Mobile Money et espèces",run_4:"Reçus automatiques",run_5:"Traçabilité des vêtements",run_6:"Employés & machines",grow_1:"Coûts de production & rentabilité",grow_2:"Tableau de bord financier",grow_3:"Rapports & exports",grow_4:"KPIs & alertes intelligentes",grow_5:"Multi-sites & dashboard HQ",grow_6:"Analyses clients",learn_1:"Programmes de formation pressing",learn_2:"Guides opérationnels",learn_3:"Recommandations IA",learn_4:"Calculateurs gratuits",learn_5:"Consulting & accompagnement",learn_6:"Communauté d'entrepreneurs",
  dashboard_eyebrow:"Intelligence opérationnelle",dashboard_title:"Votre pressing, piloté par les données",dashboard_sub:"Sachez exactement ce que vous gagnez — aujourd'hui, cette semaine, ce mois.",live_control:"Contrôle opérationnel en direct",live:"En direct",orders_today:"Commandes aujourd'hui",revenue_today:"CA du jour (FCFA)",cost_kg:"Coût/kg (FCFA)",profit:"Bénéfice",revenue_7_days:"Revenus — 7 derniers jours",break_even:"Seuil de rentabilité atteint",
  demo_eyebrow:"Voir XpressPro en action",demo_title:"3 minutes pour comprendre XpressPro",demo_sub:"Découvrez comment créer une commande, suivre le traitement, encaisser un paiement et consulter votre rentabilité — en temps réel.",demo_soon:"Démo vidéo disponible bientôt",demo_wait:"En attendant, démarrez votre essai gratuit →",demo_1:"Créer une commande en 30 secondes",demo_2:"Suivre le pipeline de traitement",demo_3:"Enregistrer un paiement Mobile Money",demo_4:"Consulter le tableau de bord financier",demo_question:"Vous préférez essayer vous-même ?",start_free_arrow:"Démarrer l'essai gratuit →",
  comparison_eyebrow:"La différence XpressPro",comparison_title:"Avant et après XpressPro",without:"Sans XpressPro",with:"Avec XpressPro",before_notebook:"Carnet papier perdu",after_notebook:"Commandes digitales, toujours disponibles",before_receipts:"Reçus manuels",after_receipts:"Reçus automatiques en 3 secondes",before_profitability:"Rentabilité inconnue",after_profitability:"Seuil de rentabilité en temps réel",before_garments:"Vêtements égarés",after_garments:"Traçabilité de chaque article",before_analytics:"Aucune analyse",after_analytics:"Intelligence opérationnelle complète",before_multisite:"Gestion multi-sites difficile",after_multisite:"Dashboard HQ unifié",before_balances:"Paiements oubliés",after_balances:"Soldes clients toujours à jour",
  testimonials_eyebrow:"Ils nous font confiance",testimonials_title:"Ce que disent les gérants de pressing",testimonials_placeholder:"[REMPLACER PAR DE VRAIS TÉMOIGNAGES AVANT PUBLICATION]",
  map_eyebrow:"Présent à travers l'Afrique",map_title:"XpressPro est actif dans votre pays",map_sub:"Conçu pour les réalités africaines : Mobile Money, langues locales, devises régionales.",map_label:"Carte de présence XpressPro en Afrique",available_africa:"Disponible en Afrique",available_15:"Disponible dans 15+ pays africains",sites:"sites",orders:"commandes",cash:"Espèces",bank:"Virement bancaire",
  pricing_eyebrow:"Tarification",pricing_title:"Un plan pour chaque pressing",pricing_sub:"Toutes les fonctionnalités incluses dès le plan Starter. Seules les limites évoluent.",most_popular:"Le plus populaire",pricing_trial:"30 jours gratuits OU vos 50 premières commandes — selon ce qui dure le plus longtemps. Sans carte bancaire.",price_discover:"Gratuit",price_starter:"3 900 FCFA/mois",price_professional:"12 900 FCFA/mois",price_business:"24 900 FCFA/mois",price_enterprise:"49 900 FCFA/mois",limit_discover:"50 commandes à vie",limit_starter:"100 commandes/mois",limit_professional:"600 commandes/mois",limit_business:"3 000 commandes/mois",limit_enterprise:"Commandes illimitées",capacity_discover:"1 site · 1 utilisateur",capacity_starter:"1 site · 1 utilisateur",capacity_professional:"1 site · 3 utilisateurs",capacity_business:"3 sites · 20 utilisateurs",capacity_enterprise:"Sites & utilisateurs illimités",cta_discover:"Démarrer gratuitement",cta_starter:"Choisir Starter",cta_professional:"Choisir Professional",cta_business:"Choisir Business",cta_enterprise:"Contacter l'équipe",
  final_title:"Prêt à transformer votre pressing ?",final_sub:"XpressPro vous aide à gérer chaque commande, chaque paiement et votre rentabilité — conçu pour l'Afrique.",final_offer:"30 jours gratuits OU vos 50 premières commandes",final_offer_sub:"Selon ce qui dure le plus longtemps — puis à partir de 3 900 FCFA/mois",no_card:"Sans carte bancaire",no_commitment:"Sans engagement",cancel_anytime:"Résiliation à tout moment",create_account:"Créer mon compte gratuit →",already:"Déjà inscrit ? Se connecter →",questions:"Des questions ? Contactez-nous sur WhatsApp →",
  footer_tagline:"La plateforme professionnelle de gestion de pressing conçue pour l'Afrique.",footer_product:"Produit",footer_resources:"Ressources",footer_company:"Entreprise",footer_social:"Réseaux sociaux",footer_product_1:"Fonctionnalités",footer_product_2:"Tarifs",footer_product_3:"Calculateur de rentabilité",footer_product_4:"Diagnostic professionnel",footer_product_5:"Outils gratuits",footer_resources_1:"Documentation",footer_resources_2:"Guide de démarrage",footer_resources_3:"Formation pressing",footer_resources_4:"Blog / Articles",footer_resources_5:"Communauté",footer_company_1:"À propos",footer_company_2:"Conditions d'utilisation",footer_company_3:"Politique de confidentialité",footer_company_4:"Contact",footer_company_5:"General Advance Services",footer_social_1:"TikTok",footer_social_2:"LinkedIn",footer_social_3:"WhatsApp",footer_social_4:"Facebook",
};

const LANDING_EN: Record<string, string> = {
  ...LANDING_FR, skip:"Skip to content",main_nav:"Main navigation",menu:"Open menu",contact:"Contact",start_free:"Free trial",hero_badge:"Built for African laundry businesses",hero_title:"Run a more profitable laundry business.",hero_sub:"Orders, customers, payments, garment tracking, production costs, profitability and business performance from one intelligent platform built for Africa.",start_trial:"Start Free Trial — 30 days",calculate_profit:"Calculate My Profit →",calculate_profit_plain:"Calculate My Profit",hero_trust:"No credit card · No commitment · Cancel anytime",receipt_generated:"Receipt generated automatically",profit_up:"+23% profit this month",proof:"Usage proof",trusted_across_africa:"Laundry businesses across Africa and beyond trust XpressPro.",active_laundries:"Active laundries",orders_processed:"Orders processed",customers_registered:"Customers served",countries:"Countries",
  problem_eyebrow:"The daily reality",problem_title:"Do these sound familiar?",problem_solution:"XpressPro solves every one of these — from day one.",pain_garments:"Lost garments",pain_garments_desc:"No reliable intake trail. Finding a customer's clothes means searching through notebooks.",pain_payments:"Forgotten payments",pain_payments_desc:"Customers leave without paying and you only notice at the end of the day.",pain_notebooks:"Paper notebooks",pain_notebooks_desc:"Crossed-out lines, missing pages and lost books take orders with them.",pain_profit:"Unknown profitability",pain_profit_desc:"You work hard without knowing whether the laundry is making or losing money.",pain_customers:"Unhappy customers",pain_customers_desc:"Customers ask if laundry is ready while your team searches through paper.",pain_data:"No business data",pain_data_desc:"You cannot see which services earn most or which days carry the heaviest load.",
  workflow_eyebrow:"How it works",workflow_title:"From drop-off to delivery — every step is tracked",workflow_sub:"Your team always knows where every order stands. So do your customers.",client:"Customer",order:"Order",sorting:"Sorting",washing:"Washing",drying:"Drying",ironing:"Ironing",packing:"Packing",ready:"Ready",delivery:"Delivery",reports:"Reports",
  tools_eyebrow:"Free tools",tools_title:"Start managing your laundry — even without an account",tools_sub:"Professional free tools built for African laundry entrepreneurs.",most_used:"Most used",diagnostic:"Professional Diagnostic",diagnostic_desc:"Identify improvement opportunities in your laundry in minutes.",startup_calc:"Startup Calculator",startup_calc_desc:"Estimate the total budget to open a laundry for your city and capacity.",profit_calc:"Profitability Calculator",profit_calc_desc:"In four steps, calculate break-even, real profit and receive a personalized WhatsApp report.",health_score:"Health Score",health_score_desc:"Ten questions to assess operational and financial performance.",audit:"Professional Audit",audit_desc:"A complete business report with practical recommendations.",no_signup:"No signup",whatsapp_report:"WhatsApp report",
  product_eyebrow:"The complete platform",product_title:"Everything your laundry needs — in one place",product_note:"All features included from the Starter plan.",pillar_run:"Run your laundry",pillar_grow:"Grow your business",pillar_learn:"Learn and improve",
  dashboard_eyebrow:"Operational intelligence",dashboard_title:"Your laundry, powered by data",dashboard_sub:"Know exactly what you earn — today, this week, this month.",live_control:"Live operations control",live:"Live",orders_today:"Orders today",revenue_today:"Revenue today (FCFA)",cost_kg:"Cost/kg (FCFA)",profit:"Profit",revenue_7_days:"Revenue — last 7 days",break_even:"Break-even reached",
  demo_eyebrow:"See XpressPro in action",demo_title:"Understand XpressPro in 3 minutes",demo_sub:"See how to create an order, track production, collect payment and check profitability in real time.",demo_soon:"Video demo coming soon",demo_wait:"In the meantime, start your free trial →",demo_1:"Create an order in 30 seconds",demo_2:"Track the production pipeline",demo_3:"Record a Mobile Money payment",demo_4:"Check the financial dashboard",demo_question:"Prefer to try it yourself?",start_free_arrow:"Start free trial →",
  comparison_eyebrow:"The XpressPro difference",comparison_title:"Before and after XpressPro",without:"Without XpressPro",with:"With XpressPro",testimonials_eyebrow:"They trust us",testimonials_title:"What laundry owners say",testimonials_placeholder:"[REPLACE WITH REAL TESTIMONIALS BEFORE PUBLISHING]",map_eyebrow:"Present across Africa",map_title:"XpressPro is active in your country",map_sub:"Built for African realities: Mobile Money, local languages and regional currencies.",map_label:"Map of XpressPro presence in Africa",available_africa:"Available across Africa",available_15:"Available in 15+ African countries",sites:"sites",orders:"orders",cash:"Cash",bank:"Bank transfer",
  pricing_eyebrow:"Pricing",pricing_title:"A plan for every laundry",pricing_sub:"All features included from Starter. Only the limits change.",most_popular:"Most popular",pricing_trial:"30 days free OR your first 50 orders — whichever lasts longer. No credit card.",price_discover:"Free",limit_discover:"50 lifetime orders",limit_starter:"100 orders/month",limit_professional:"600 orders/month",limit_business:"3,000 orders/month",limit_enterprise:"Unlimited orders",capacity_discover:"1 site · 1 user",capacity_starter:"1 site · 1 user",capacity_professional:"1 site · 3 users",capacity_business:"3 sites · 20 users",capacity_enterprise:"Unlimited sites & users",cta_discover:"Start free",cta_starter:"Choose Starter",cta_professional:"Choose Professional",cta_business:"Choose Business",cta_enterprise:"Contact the team",
  final_title:"Ready to transform your laundry business?",final_sub:"XpressPro helps you manage every order, every payment and profitability — built for Africa.",final_offer:"30 days free OR your first 50 orders",final_offer_sub:"Whichever lasts longer — then from 3,900 FCFA/month",no_card:"No credit card",no_commitment:"No commitment",cancel_anytime:"Cancel anytime",create_account:"Create my free account →",already:"Already have an account? Sign in →",questions:"Questions? Contact us on WhatsApp →",footer_tagline:"The professional laundry management platform built for Africa.",footer_product:"Product",footer_resources:"Resources",footer_company:"Company",footer_social:"Social media",
};

function useLandingReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(".landing-reveal");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

function useLandingMeta() {
  useEffect(() => {
    document.title = "XpressPro — The Operating System for Laundry Businesses in Africa";
    const values: Record<string, string> = {
      description: "Manage orders, customers, payments, garment tracking, profitability and business performance from one intelligent platform built for Africa. Free 30-day trial.",
      "og:title": "XpressPro — Gestion de pressing pour l'Afrique",
      "og:description": "Commandes, clients, paiements, rentabilité depuis une plateforme conçue pour l'Afrique. Essai gratuit 30 jours.",
      "og:type": "website",
      "theme-color": NAVY,
    };
    Object.entries(values).forEach(([name, content]) => {
      const property = name.startsWith("og:");
      let meta = document.head.querySelector<HTMLMetaElement>(`meta[${property ? "property" : "name"}="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(property ? "property" : "name", name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    });
  }, []);
}

function DashboardMockup({ detailed = false }: { detailed?: boolean }) {
  const { t } = useTranslation();
  const bars = [34, 58, 43, 72, 66, 88, 78];
  return (
    <div className="rounded-2xl border border-white/15 bg-[#101f50] p-4 shadow-2xl sm:p-6">
      <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-300">XpressPro HQ</p><p className="text-sm text-slate-300">{t("landing_v3.live_control")}</p></div>
        <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-300">● {t("landing_v3.live")}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [t("landing_v3.orders_today"), "24", "text-blue-300"],
          [t("landing_v3.revenue_today"), "186 400", "text-emerald-300"],
          [t("landing_v3.cost_kg"), "412", "text-amber-300"],
          [t("landing_v3.profit"), "+23%", "text-emerald-300"],
        ].map(([label, value, color]) => <div key={label} className="landing-card rounded-xl bg-white/7 p-3"><p className="text-[11px] text-slate-400">{label}</p><p className={`mt-1 text-xl font-bold ${color}`}>{value}</p></div>)}
      </div>
      <div className={`mt-4 grid gap-4 ${detailed ? "lg:grid-cols-[1.4fr_.8fr]" : ""}`}>
        <div className="rounded-xl bg-white/7 p-4">
          <div className="mb-4 flex justify-between text-xs text-slate-300"><span>{t("landing_v3.revenue_7_days")}</span><span className="text-emerald-300">+12.4%</span></div>
          <div className="flex h-28 items-end gap-2">{bars.map((height, i) => <div key={i} className="flex-1 rounded-t bg-blue-500/80" style={{ height: `${height}%` }} />)}</div>
        </div>
        {detailed && <div className="flex flex-col items-center justify-center rounded-xl bg-white/7 p-4"><div className="grid h-28 w-28 place-items-center rounded-full" style={{ background: "conic-gradient(#34d399 74%, rgba(255,255,255,.1) 0)" }}><div className="grid h-20 w-20 place-items-center rounded-full bg-[#101f50] text-xl font-bold text-white">74%</div></div><p className="mt-3 text-xs text-slate-300">{t("landing_v3.break_even")}</p></div>}
      </div>
      {detailed && <div className="mt-4 grid gap-2 sm:grid-cols-3">{[["#128", t("landing_v3.washing")], ["#129", t("landing_v3.drying")], ["#130", t("landing_v3.ready")]].map(([id, status], i) => <div key={id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm text-white"><span>{id}</span><span className={i === 2 ? "text-emerald-300" : "text-blue-300"}>{status}</span></div>)}</div>}
    </div>
  );
}

function AfricaMap({ data }: { data?: MapStats }) {
  const { t } = useTranslation();
  const dots = data?.hasRealData ? data.countries : [];
  const project = (lat: number, lng: number) => [((lng + 18) / 70) * 470 + 65, ((37 - lat) / 72) * 540 + 40];
  return <div>
    <svg viewBox="0 0 600 650" className="mx-auto w-full max-w-xl" role="img" aria-label={t("landing_v3.map_label")}>
      <path d="M232 38L174 83l-60 91-25 105 45 85 47 29 22 104 76 111 61-44 42-116 86-123-25-99-66-74-28-93z" fill="#152b68" stroke="#31569d" strokeWidth="3" />
      {(dots.length ? dots : [{ country: "", lat: 4, lng: 12, activeSites: 0, totalOrders: 0, totalClients: 0 }, { country: "", lat: -1, lng: 36, activeSites: 0, totalOrders: 0, totalClients: 0 }, { country: "", lat: 6, lng: -5, activeSites: 0, totalOrders: 0, totalClients: 0 }]).map((dot, i) => {
        const [x, y] = project(dot.lat, dot.lng); const radius = data?.hasRealData ? Math.min(13, 4 + Math.log10(Math.max(1, dot.totalOrders)) * 2) : 5;
        return <g key={`${dot.country}-${i}`}><circle cx={x} cy={y} r={radius + 8} fill="#3b82f6" opacity=".12" /><circle cx={x} cy={y} r={radius} fill="#60a5fa"><title>{data?.hasRealData ? `${dot.country}: ${dot.activeSites} ${t("landing_v3.sites")}, ${dot.totalOrders} ${t("landing_v3.orders")}` : t("landing_v3.available_africa")}</title></circle></g>;
      })}
    </svg>
    {!data?.hasRealData && <p className="text-center text-sm font-semibold text-blue-200">{t("landing_v3.available_15")}</p>}
  </div>;
}

function demoEmbedUrl(language: string) {
  const lang = language.split("-")[0];
  const configured = (lang === "fr" ? import.meta.env.VITE_DEMO_VIDEO_URL_FR : import.meta.env.VITE_DEMO_VIDEO_URL_EN)
    || import.meta.env.VITE_DEMO_VIDEO_URL || import.meta.env.VITE_DEMO_VIDEO_URL_FR || import.meta.env.VITE_DEMO_VIDEO_URL_EN;
  if (!configured) return "";
  try {
    const url = new URL(String(configured).trim());
    const host = url.hostname.replace(/^www\./, "");
    const id = host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0]
      : url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/") ? url.pathname.split("/").filter(Boolean)[1]
      : url.searchParams.get("v");
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&autoplay=1` : "";
  } catch { return ""; }
}

function LazyDemoVideo({ language }: { language: string }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const url = demoEmbedUrl(language);
  if (playing && url) return <iframe className="h-full w-full" src={url} title="Démo XpressPro" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
  return <div className="grid h-full place-items-center text-white"><div><button type="button" disabled={!url} onClick={() => setPlaying(true)} className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-white bg-blue-600 disabled:cursor-default" aria-label={url ? "Lire la démo XpressPro" : t("landing_v3.demo_soon")}><Play className="ml-1 h-7 w-7 fill-white" /></button><p className="mt-5 font-bold">{url ? "Lire la démo XpressPro" : t("landing_v3.demo_soon")}</p>{!url && <Link href="/auth?tab=register" className="mt-2 inline-block text-sm text-blue-300 underline">{t("landing_v3.demo_wait")}</Link>}</div></div>;
}

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  if (!i18n.exists("landing_v3.hero_title", { lng: "fr" })) {
    i18n.addResourceBundle("fr", "translation", { landing_v3: LANDING_FR }, true, true);
    i18n.addResourceBundle("en", "translation", { landing_v3: LANDING_EN }, true, true);
  }
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useLandingReveal(); useLandingMeta();
  useEffect(() => { const fn = () => setScrolled(window.scrollY > 20); window.addEventListener("scroll", fn, { passive: true }); return () => window.removeEventListener("scroll", fn); }, []);
  const { data: stats } = useQuery<PublicStats>({ queryKey: ["/api/public/stats"], staleTime: 60_000 });
  // The documented map endpoint is not present in this repository yet. Keep the
  // honest no-statistics fallback instead of emitting a production 404.
  const { data: mapStats } = useQuery<MapStats>({ queryKey: ["/api/public/map-stats"], retry: false, staleTime: 60_000, enabled: false });
  const metrics = useMemo(() => [
    [stats?.totalLaundries, t("landing_v3.active_laundries")], [stats?.totalOrders, t("landing_v3.orders_processed")],
    [stats?.totalCustomers, t("landing_v3.customers_registered")], [mapStats?.countries?.length, t("landing_v3.countries")],
  ].filter(([value]) => Number(value) > 0), [stats, mapStats, t]);
  const pains = ["garments", "payments", "notebooks", "profit", "customers", "data"];
  const workflow = [[UserRound,"client"],[FileText,"order"],[Layers3,"sorting"],[Droplets,"washing"],[Wind,"drying"],[Shirt,"ironing"],[Package,"packing"],[CheckCircle2,"ready"],[Truck,"delivery"],[BarChart3,"reports"]] as const;
  const pillars = [[Settings,"run","border-blue-500"],[TrendingUp,"grow","border-emerald-500"],[School,"learn","border-violet-500"]] as const;
  const comparisons = ["notebook","receipts","profitability","garments","analytics","multisite","balances"];
  const plans = ["discover","starter","professional","business","enterprise"];

  return <div className="min-h-screen overflow-x-hidden bg-white text-slate-950">
    <style>{`.landing-reveal{opacity:0;transform:translateY(24px);transition:opacity .4s ease,transform .4s ease}.landing-reveal.is-visible{opacity:1;transform:none}.landing-card{transition:transform .2s ease,box-shadow .2s ease}.landing-card:hover{transform:translateY(-2px)}@media(prefers-reduced-motion:reduce){.landing-reveal,.landing-card{opacity:1;transform:none;transition:none!important}}`}</style>
    <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-20 rounded bg-white px-4 py-2 font-semibold text-blue-700 focus:translate-y-0">{t("landing_v3.skip")}</a>
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors ${scrolled ? "border-b bg-white/95 text-slate-900 shadow-sm backdrop-blur" : "bg-transparent text-white"}`}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4" aria-label={t("landing_v3.main_nav")}>
        <Link href="/" className="flex items-center gap-2 font-bold"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white"><Shirt className="h-5 w-5" /></span>XpressPro</Link>
        <div className="hidden items-center gap-6 md:flex">{[["features","landing_nav_features"],["tools","landing_nav_tools"],["pricing","landing_nav_pricing"],["contact","landing_v3.contact"]].map(([id,key]) => <a key={id} href={`#${id}`} className="text-sm font-medium hover:text-blue-400">{t(key)}</a>)}</div>
        <div className="hidden items-center gap-2 md:flex"><button className="min-h-11 rounded-lg px-3 text-sm font-bold" onClick={() => i18n.changeLanguage(i18n.language.startsWith("fr") ? "en" : "fr")}>{i18n.language.startsWith("fr") ? "EN" : "FR"}</button><Link href="/auth" className="min-h-11 rounded-lg px-4 py-3 text-sm font-semibold">{t("landing_login")}</Link><Link href="/auth?tab=register" className="min-h-11 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white">{t("landing_v3.start_free")}</Link></div>
        <button className="grid min-h-11 min-w-11 place-items-center md:hidden" aria-label={t("landing_v3.menu")} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
      </nav>
      {menu && <div className="border-t bg-white p-4 text-slate-900 md:hidden">{[["features","landing_nav_features"],["tools","landing_nav_tools"],["pricing","landing_nav_pricing"],["contact","landing_v3.contact"]].map(([id,key]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)} className="block min-h-11 py-3 font-medium">{t(key)}</a>)}</div>}
    </header>

    <main id="main-content">
      <section className="relative min-h-[90vh] overflow-hidden bg-[#0D1B4B] pb-24 pt-28 text-white">
        <div className="absolute -right-40 top-10 h-[520px] w-[520px] rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 lg:grid-cols-[1.1fr_.9fr]">
          <div className="landing-reveal"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm"><span className="h-2 w-2 rounded-full bg-emerald-400" />{t("landing_v3.hero_badge")}</span><h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.04] tracking-tight sm:text-6xl">{t("landing_v3.hero_title")}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100">{t("landing_v3.hero_sub")}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/auth?tab=register" className="min-h-12 rounded-xl bg-blue-600 px-6 py-3 text-center font-bold text-white hover:bg-blue-500">{t("landing_v3.start_trial")}</Link><Link href="/rentabilite" className="min-h-12 rounded-xl border border-white/35 px-6 py-3 text-center font-bold hover:bg-white/10">{t("landing_v3.calculate_profit")}</Link></div><p className="mt-4 text-sm text-blue-200">{t("landing_v3.hero_trust")}</p></div>
          <div className="landing-reveal relative"><DashboardMockup /><div className="absolute -right-2 -top-5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xl">✓ {t("landing_v3.receipt_generated")}</div><div className="absolute -bottom-5 -left-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-xl">↗ {t("landing_v3.profit_up")}</div></div>
        </div>
        <svg className="absolute bottom-0 h-14 w-full" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30C340 90 890-10 1440 40V80H0Z" fill="white" /></svg>
      </section>

      <section className="border-y bg-white py-10" aria-label={t("landing_v3.proof")}><div className="mx-auto max-w-6xl px-4">{metrics.length ? <div className="grid grid-cols-2 gap-6 md:grid-cols-4">{metrics.map(([value,label]) => <div key={String(label)} className="text-center"><p className="text-3xl font-black text-[#0D1B4B]">{Number(value).toLocaleString(i18n.language)}+</p><p className="text-sm text-slate-600">{label}</p></div>)}</div> : <p className="text-center font-medium text-slate-600">{t("landing_v3.trusted_across_africa")}</p>}</div></section>

      <section className="py-24"><div className="mx-auto max-w-6xl px-4"><SectionHead eyebrow={t("landing_v3.problem_eyebrow")} title={t("landing_v3.problem_title")} /><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{pains.map(key => <article key={key} className="landing-card rounded-xl border border-red-100 bg-red-50 p-6"><XCircle className="h-6 w-6 text-red-500" /><h3 className="mt-4 font-bold">{t(`landing_v3.pain_${key}`)}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t(`landing_v3.pain_${key}_desc`)}</p></article>)}</div><div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center font-semibold text-emerald-800">✓ {t("landing_v3.problem_solution")}</div></div></section>

      <section className="bg-slate-50 py-24"><div className="mx-auto max-w-7xl px-4"><SectionHead eyebrow={t("landing_v3.workflow_eyebrow")} title={t("landing_v3.workflow_title")} /><ol className="mt-14 grid gap-0 md:grid-cols-10">{workflow.map(([Icon,key],i) => <li key={key} className="relative flex gap-4 pb-6 md:block md:text-center"><div className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full ${key === "ready" ? "bg-emerald-500" : "bg-blue-600"} text-white`}><Icon className="h-5 w-5" /></div>{i < workflow.length - 1 && <span className="absolute left-[21px] top-11 h-full w-px bg-blue-200 md:left-1/2 md:top-[21px] md:h-px md:w-full" />}<div className="pt-2 md:pt-3"><span className="text-xs font-bold text-slate-400">{i+1}</span><p className="text-sm font-semibold">{t(`landing_v3.${key}`)}</p></div></li>)}</ol><p className="mt-8 text-center text-slate-600">{t("landing_v3.workflow_sub")}</p></div></section>

      <section id="tools" className="bg-[#0D1B4B] py-24 text-white"><div className="mx-auto max-w-7xl px-4"><SectionHead dark eyebrow={t("landing_v3.tools_eyebrow")} title={t("landing_v3.tools_title")} sub={t("landing_v3.tools_sub")} /><div className="mt-12 grid gap-5 lg:grid-cols-[.8fr_1.4fr_.8fr] lg:items-center"><div className="space-y-5"><Tool icon={ClipboardCheck} title={t("landing_v3.diagnostic")} desc={t("landing_v3.diagnostic_desc")} href="/diagnostic" /><Tool icon={Calculator} title={t("landing_v3.startup_calc")} desc={t("landing_v3.startup_calc_desc")} href="/calculateur" /></div><article className="landing-card rounded-2xl border-2 border-blue-400 bg-white p-8 text-slate-900 shadow-2xl"><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{t("landing_v3.most_used")}</span><Sparkles className="mt-6 h-9 w-9 text-blue-600" /><h3 className="mt-4 text-2xl font-black">{t("landing_v3.profit_calc")}</h3><p className="mt-3 leading-7 text-slate-600">{t("landing_v3.profit_calc_desc")}</p><div className="my-5 flex flex-wrap gap-2 text-xs">{["2 minutes",t("landing_v3.no_signup"),t("landing_v3.whatsapp_report")].map(x => <span key={x} className="rounded-full bg-slate-100 px-3 py-1">{x}</span>)}</div><Link href="/rentabilite" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">{t("landing_v3.calculate_profit")}<ArrowRight className="h-4 w-4" /></Link></article><div className="space-y-5"><Tool icon={BarChart3} title={t("landing_v3.health_score")} desc={t("landing_v3.health_score_desc")} href="/diagnostic" /><Tool icon={FileText} title={t("landing_v3.audit")} desc={t("landing_v3.audit_desc")} href="/diagnostic" /></div></div></div></section>

      <section id="features" className="py-24"><div className="mx-auto max-w-7xl px-4"><SectionHead eyebrow={t("landing_v3.product_eyebrow")} title={t("landing_v3.product_title")} /><div className="mt-12 grid gap-6 lg:grid-cols-3">{pillars.map(([Icon,key,border]) => <article key={key} className={`landing-card rounded-xl border border-slate-200 border-t-4 ${border} p-7`}><Icon className="h-8 w-8 text-blue-600" /><h3 className="mt-4 text-xl font-bold">{t(`landing_v3.pillar_${key}`)}</h3><ul className="mt-5 space-y-3">{Array.from({length:6},(_,i)=><li key={i} className="flex gap-2 text-sm text-slate-600"><Check className="h-4 w-4 shrink-0 text-emerald-500" />{t(`landing_v3.${key}_${i+1}`)}</li>)}</ul></article>)}</div><p className="mt-8 text-center text-sm text-slate-500">{t("landing_v3.product_note")}</p></div></section>

      <section className="bg-[#0D1B4B] py-24 text-white"><div className="mx-auto max-w-6xl px-4"><SectionHead dark eyebrow={t("landing_v3.dashboard_eyebrow")} title={t("landing_v3.dashboard_title")} /><div className="landing-reveal mt-12"><DashboardMockup detailed /></div><p className="mt-8 text-center text-blue-100">{t("landing_v3.dashboard_sub")}</p></div></section>

      <section className="bg-slate-50 py-24"><div className="mx-auto max-w-5xl px-4 text-center"><SectionHead eyebrow={t("landing_v3.demo_eyebrow")} title={t("landing_v3.demo_title")} sub={t("landing_v3.demo_sub")} /><div className="mt-10 aspect-video overflow-hidden rounded-2xl bg-[#0D1B4B] shadow-xl"><LazyDemoVideo language={i18n.language} /></div><div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{[[FileText,"demo_1"],[Layers3,"demo_2"],[CreditCard,"demo_3"],[BarChart3,"demo_4"]].map(([Icon,key]:any)=><div key={key} className="rounded-xl bg-white p-4 text-sm font-semibold shadow-sm"><Icon className="mx-auto mb-2 h-5 w-5 text-blue-600" />{t(`landing_v3.${key}`)}</div>)}</div><p className="mt-8">{t("landing_v3.demo_question")} <Link href="/auth?tab=register" className="font-bold text-blue-600">{t("landing_v3.start_free_arrow")}</Link></p></div></section>

      <section className="py-24"><div className="mx-auto max-w-6xl px-4"><SectionHead eyebrow={t("landing_v3.comparison_eyebrow")} title={t("landing_v3.comparison_title")} /><div className="mt-12 grid gap-5 md:grid-cols-2"><article className="rounded-2xl bg-red-50 p-7"><h3 className="text-xl font-bold text-red-800">{t("landing_v3.without")}</h3><ul className="mt-6 space-y-4">{comparisons.map(key=><li key={key} className="flex gap-3 text-slate-700"><XCircle className="h-5 w-5 shrink-0 text-red-500" />{t(`landing_v3.before_${key}`)}</li>)}</ul></article><article className="rounded-2xl bg-emerald-50 p-7"><h3 className="text-xl font-bold text-emerald-800">{t("landing_v3.with")}</h3><ul className="mt-6 space-y-4">{comparisons.map(key=><li key={key} className="flex gap-3 text-slate-700"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />{t(`landing_v3.after_${key}`)}</li>)}</ul></article></div></div></section>

      <section className="bg-slate-50 py-24"><div className="mx-auto max-w-6xl px-4"><SectionHead eyebrow={t("landing_v3.testimonials_eyebrow")} title={t("landing_v3.testimonials_title")} /><div className="mt-10 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-8 text-center font-bold text-amber-900">{t("landing_v3.testimonials_placeholder")}</div></div></section>

      <section className="bg-[#0D1B4B] py-24 text-white"><div className="mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-2"><div><SectionHead dark eyebrow={t("landing_v3.map_eyebrow")} title={t("landing_v3.map_title")} sub={t("landing_v3.map_sub")} /><div className="mt-8 flex flex-wrap gap-3">{["Orange Money","MTN MoMo","Wave",t("landing_v3.cash"),t("landing_v3.bank")].map(x=><span key={x} className="rounded-full border border-white/15 px-3 py-2 text-sm text-blue-100">{x}</span>)}</div></div><AfricaMap data={mapStats} /></div>{mapStats?.hasRealData && <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 pb-20 md:grid-cols-4">{[[mapStats.totals.activeSites,"active_laundries"],[mapStats.totals.totalOrders,"orders_processed"],[mapStats.totals.totalClients,"customers_registered"],[mapStats.countries.length,"countries"]].map(([v,k])=><div key={k} className="rounded-xl bg-white/10 p-4 text-center text-white"><strong className="text-2xl">{v}+</strong><p className="text-xs text-blue-200">{t(`landing_v3.${k}`)}</p></div>)}</div>}</section>

      <section id="pricing" className="py-24"><div className="mx-auto max-w-7xl px-4"><SectionHead eyebrow={t("landing_v3.pricing_eyebrow")} title={t("landing_v3.pricing_title")} sub={t("landing_v3.pricing_sub")} /><div className="mt-12 flex snap-x gap-4 overflow-x-auto pb-5 lg:grid lg:grid-cols-5 lg:overflow-visible">{plans.map(key=><article key={key} className={`relative min-w-[280px] snap-start rounded-2xl border p-6 ${key === "business" ? "border-2 border-blue-600 shadow-xl" : "border-slate-200"}`}>{key === "business" && <span className="absolute -top-3 left-4 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">{t("landing_v3.most_popular")}</span>}<h3 className="text-xl font-bold capitalize">{key}</h3><p className="mt-4 text-2xl font-black">{t(`landing_v3.price_${key}`)}</p><p className="mt-2 text-sm text-slate-500">{t(`landing_v3.limit_${key}`)}</p><p className="mt-5 text-sm">{t(`landing_v3.capacity_${key}`)}</p><Link href="/auth?tab=register" className={`mt-6 block min-h-11 rounded-lg px-4 py-3 text-center font-bold ${key === "business" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>{t(`landing_v3.cta_${key}`)}</Link></article>)}</div><p className="mt-7 text-center font-semibold text-slate-600">{t("landing_v3.pricing_trial")}</p></div></section>

      <section className="bg-[#0D1B4B] py-24 text-center text-white"><div className="mx-auto max-w-4xl px-4"><h2 className="text-3xl font-black sm:text-5xl">{t("landing_v3.final_title")}</h2><p className="mx-auto mt-5 max-w-2xl text-blue-100">{t("landing_v3.final_sub")}</p><div className="mx-auto mt-8 max-w-2xl rounded-2xl bg-white/10 p-6"><p className="text-xl font-bold">🎁 {t("landing_v3.final_offer")}</p><p className="mt-2 text-sm text-blue-200">{t("landing_v3.final_offer_sub")}</p><div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">{["no_card","no_commitment","cancel_anytime"].map(k=><span key={k}>✓ {t(`landing_v3.${k}`)}</span>)}</div></div><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/auth?tab=register" className="min-h-12 rounded-xl bg-white px-6 py-3 font-bold text-blue-700">{t("landing_v3.create_account")}</Link><Link href="/rentabilite" className="min-h-12 rounded-xl border border-white px-6 py-3 font-bold">{t("landing_v3.calculate_profit_plain")}</Link></div><Link href="/auth" className="mt-6 inline-block text-sm text-blue-200 underline">{t("landing_v3.already")}</Link><br/><a href="https://wa.me/237651638889" className="mt-3 inline-block text-sm text-blue-200 underline">{t("landing_v3.questions")}</a></div></section>
    </main>

    <footer id="contact" className="bg-[#081337] py-16 text-slate-300"><div className="mx-auto grid max-w-7xl gap-10 px-4 sm:grid-cols-2 lg:grid-cols-5"><div><p className="text-xl font-bold text-white">XpressPro</p><p className="mt-3 text-sm leading-6">{t("landing_v3.footer_tagline")}</p><p className="mt-4 text-sm">xpressclean23@gmail.com<br/>+237 651 638 889</p></div>{["product","resources","company","social"].map(group=><div key={group}><h3 className="font-bold text-white">{t(`landing_v3.footer_${group}`)}</h3><ul className="mt-4 space-y-3 text-sm">{Array.from({length:group === "social" ? 4 : 5},(_,i)=><li key={i}><a href={group === "product" && i === 1 ? "#pricing" : "#"} className="hover:text-white">{t(`landing_v3.footer_${group}_${i+1}`)}</a></li>)}</ul></div>)}</div><div className="mx-auto mt-12 flex max-w-7xl flex-col justify-between gap-4 border-t border-white/10 px-4 pt-6 text-xs sm:flex-row"><span>© 2026 XpressPro · General Advance Services</span><button className="min-h-11 px-3 font-bold" onClick={() => i18n.changeLanguage(i18n.language.startsWith("fr") ? "en" : "fr")}>FR / EN</button></div></footer>
  </div>;
}

function SectionHead({ eyebrow, title, sub, dark = false }: { eyebrow: string; title: string; sub?: string; dark?: boolean }) {
  return <div className="landing-reveal mx-auto max-w-3xl text-center"><p className={`text-xs font-bold uppercase tracking-[.24em] ${dark ? "text-blue-300" : "text-blue-600"}`}>{eyebrow}</p><h2 className={`mt-4 text-3xl font-black tracking-tight sm:text-5xl ${dark ? "text-white" : "text-[#0D1B4B]"}`}>{title}</h2>{sub && <p className={`mt-5 text-lg ${dark ? "text-blue-100" : "text-slate-600"}`}>{sub}</p>}</div>;
}

function Tool({ icon: Icon, title, desc, href }: { icon: any; title: string; desc: string; href: string }) {
  return <article className="landing-card rounded-xl border border-white/15 bg-white/7 p-5"><Icon className="h-7 w-7 text-blue-300" /><h3 className="mt-3 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-blue-100">{desc}</p><Link href={href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-blue-300">{title}<ArrowRight className="h-4 w-4" /></Link></article>;
}
