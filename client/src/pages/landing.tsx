import FippHomeBanner from "@/components/fipp-home-banner";
import { SaasPublicPlans, SaasTrialInfo } from "@/components/saas-public-plans";
import { trackMarketingEvent } from "@/lib/marketing";
import { useEffect, useState } from "react";
import XpressGroupGateway from "./xpressgroup-gateway";
import FippCountdown from "@/components/fipp-countdown";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  ArrowRight, Calculator, CalendarDays, MapPin,
  ClipboardCheck, Menu, Play, Sparkles, X,
} from "lucide-react";

const NAVY = "#0D1B4B";
const BLUE = "#1E63F0";

const LANDING_FR: Record<string, string> = {
  about_company_title:"À propos de XPRESS CLEAN",about_company_statement:"XPRESS CLEAN est un produit ou nom commercial de General Advance Services.",
  skip:"Aller au contenu",main_nav:"Navigation principale",menu:"Ouvrir le menu",contact:"Contact",start_free:"Créer mon compte",hero_badge:"Conçu pour les pressings africains",hero_title:"Gérez un pressing plus rentable.",hero_sub:"Commandes, clients, paiements, traçabilité des vêtements, coûts de production, rentabilité et performances depuis une seule plateforme intelligente conçue pour l'Afrique.",start_trial:"Démarrer gratuitement — 30 jours",calculate_profit:"Calculer mon profit →",calculate_profit_plain:"Calculer mon profit",hero_trust:"Sans carte bancaire · Sans engagement · Résiliation à tout moment",receipt_generated:"Reçu généré automatiquement",profit_up:"+23% bénéfice ce mois",proof:"Preuves d'utilisation",trusted_across_africa:"Des pressings à travers l'Afrique et au-delà font confiance à XpressPro.",active_laundries:"Pressings actifs",orders_processed:"Commandes traitées",customers_registered:"Clients enregistrés",countries:"Pays couverts",
  problem_eyebrow:"Le problème quotidien",problem_title:"Vous reconnaissez-vous dans ces situations ?",problem_solution:"XpressPro résout chacun de ces problèmes — dès le premier jour d'utilisation.",pain_garments:"Vêtements égarés",pain_garments_desc:"Aucune trace du dépôt. Impossible de retrouver les habits du client sans fouiller vos carnets.",pain_payments:"Paiements oubliés",pain_payments_desc:"Des clients repartent sans payer. Vous le découvrez seulement en fin de journée.",pain_notebooks:"Carnets illisibles",pain_notebooks_desc:"Ratures, pages arrachées, carnets perdus. Vos commandes disparaissent avec eux.",pain_profit:"Rentabilité inconnue",pain_profit_desc:"Vous travaillez dur mais ne savez pas si votre pressing gagne ou perd de l'argent.",pain_customers:"Clients insatisfaits",pain_customers_desc:"« Mon linge est prêt ? » Vous cherchez dans vos papiers pendant cinq minutes.",pain_data:"Aucun pilotage",pain_data_desc:"Impossible de savoir quels services rapportent le plus ou quels jours sont les plus chargés.",
  workflow_eyebrow:"Comment ça marche",workflow_title:"Du dépôt à la livraison — chaque étape est tracée",workflow_sub:"Votre équipe sait toujours où en est chaque commande. Vos clients aussi.",client:"Client",order:"Commande",sorting:"Tri",washing:"Lavage",drying:"Séchage",ironing:"Repassage",packing:"Emballage",ready:"Prêt",delivery:"Livraison",reports:"Rapports",
  tools_eyebrow:"Outils gratuits",tools_title:"Commencez à piloter votre pressing — même sans compte",tools_sub:"Des outils professionnels gratuits conçus pour les entrepreneurs du pressing africain.",most_used:"Le plus utilisé",diagnostic:"Diagnostic Professionnel",diagnostic_desc:"Identifiez les axes d'amélioration de votre pressing en quelques minutes.",startup_calc:"Calculateur de Démarrage",startup_calc_desc:"Estimez votre budget total pour ouvrir un pressing selon votre ville et capacité.",profit_calc:"Calculateur de Rentabilité",profit_calc_desc:"En 4 étapes, calculez votre seuil de rentabilité, votre bénéfice réel et recevez un rapport personnalisé sur WhatsApp.",no_signup:"Sans inscription",whatsapp_report:"Rapport WhatsApp",
  product_eyebrow:"La plateforme complète",product_title:"Tout ce dont votre pressing a besoin — en un seul endroit",product_note:"Toutes les fonctionnalités incluses dès le plan Starter.",pillar_run:"Gérer votre pressing",pillar_grow:"Développer votre activité",pillar_learn:"Apprendre et progresser",
  run_1:"Gestion des commandes",run_2:"Profils clients & historique",run_3:"Paiements Mobile Money et espèces",run_4:"Reçus automatiques",run_5:"Traçabilité des vêtements",run_6:"Employés & machines",grow_1:"Coûts de production & rentabilité",grow_2:"Tableau de bord financier",grow_3:"Rapports & exports",grow_4:"KPIs & alertes intelligentes",grow_5:"Multi-sites & dashboard HQ",grow_6:"Analyses clients",learn_1:"Programmes de formation pressing",learn_2:"Guides opérationnels",learn_3:"Recommandations IA",learn_4:"Calculateurs gratuits",learn_5:"Consulting & accompagnement",learn_6:"Communauté d'entrepreneurs",
  dashboard_eyebrow:"Intelligence opérationnelle",dashboard_title:"Votre pressing, piloté par les données",dashboard_sub:"Sachez exactement ce que vous gagnez — aujourd'hui, cette semaine, ce mois.",live_control:"Contrôle opérationnel en direct",live:"En direct",orders_today:"Commandes aujourd'hui",revenue_today:"CA du jour (FCFA)",cost_kg:"Coût/kg (FCFA)",profit:"Bénéfice",revenue_7_days:"Revenus — 7 derniers jours",break_even:"Seuil de rentabilité atteint",
  demo_eyebrow:"Voir XpressPro en action",demo_title:"3 minutes pour comprendre XpressPro",demo_sub:"Découvrez comment créer une commande, suivre le traitement, encaisser un paiement et consulter votre rentabilité — en temps réel.",demo_soon:"Démo vidéo disponible bientôt",demo_wait:"En attendant, démarrez votre essai gratuit →",demo_1:"Créer une commande en 30 secondes",demo_2:"Suivre le pipeline de traitement",demo_3:"Enregistrer un paiement Mobile Money",demo_4:"Consulter le tableau de bord financier",demo_question:"Vous préférez essayer vous-même ?",start_free_arrow:"Créer mon compte gratuit →",
  comparison_eyebrow:"La différence XpressPro",comparison_title:"Avant et après XpressPro",without:"Sans XpressPro",with:"Avec XpressPro",before_notebook:"Carnet papier perdu",after_notebook:"Commandes digitales, toujours disponibles",before_receipts:"Reçus manuels",after_receipts:"Reçus automatiques en 3 secondes",before_profitability:"Rentabilité inconnue",after_profitability:"Seuil de rentabilité en temps réel",before_garments:"Vêtements égarés",after_garments:"Traçabilité de chaque article",before_analytics:"Aucune analyse",after_analytics:"Intelligence opérationnelle complète",before_multisite:"Gestion multi-sites difficile",after_multisite:"Dashboard HQ unifié",before_balances:"Paiements oubliés",after_balances:"Soldes clients toujours à jour",
  pricing_eyebrow:"Tarification",pricing_title:"Un plan pour chaque pressing",pricing_sub:"Toutes les fonctionnalités incluses dès le plan Starter. Seules les limites évoluent.",most_popular:"Le plus populaire",pricing_trial:"30 jours gratuits OU vos 50 premières commandes — selon ce qui dure le plus longtemps. Sans carte bancaire.",price_discover:"Gratuit",price_starter:"3 900 FCFA",price_professional:"12 900 FCFA",price_business:"24 900 FCFA",price_enterprise:"49 900 FCFA",price_period:"/mois",limit_discover:"50 commandes à vie",limit_starter:"100 commandes/mois",limit_professional:"600 commandes/mois",limit_business:"3 000 commandes/mois",limit_enterprise:"Commandes illimitées",capacity_discover:"1 site · 1 utilisateur",capacity_starter:"1 site · 1 utilisateur",capacity_professional:"1 site · 3 utilisateurs",capacity_business:"3 sites · 20 utilisateurs",capacity_enterprise:"Sites & utilisateurs illimités",cta_discover:"Démarrer gratuitement",cta_starter:"Choisir Starter",cta_professional:"Choisir Professional",cta_business:"Choisir Business",cta_enterprise:"Contacter l'équipe",
  final_title:"Prêt à transformer votre pressing ?",final_sub:"XpressPro vous aide à gérer chaque commande, chaque paiement et votre rentabilité — conçu pour l'Afrique.",final_offer:"30 jours gratuits OU vos 50 premières commandes",final_offer_sub:"Selon ce qui dure le plus longtemps — puis à partir de 3 900 FCFA/mois",no_card:"Sans carte bancaire",no_commitment:"Sans engagement",cancel_anytime:"Résiliation à tout moment",create_account:"Créer mon compte gratuit →",already:"Déjà inscrit ? Se connecter →",questions:"Des questions ? Contactez-nous sur WhatsApp →",
  footer_tagline:"La plateforme professionnelle de gestion de pressing conçue pour l'Afrique.",footer_product:"Produit",footer_resources:"Outils",footer_company:"Entreprise",footer_social:"Contact",footer_product_1:"Fonctionnalités",footer_product_2:"Tarifs",footer_product_3:"Calculateur de rentabilité",footer_product_4:"Diagnostic professionnel",footer_product_5:"Outils gratuits",footer_resources_1:"Diagnostic professionnel",footer_resources_2:"Calculateur de démarrage",footer_resources_3:"Calculateur de rentabilité",footer_company_1:"À propos",footer_company_2:"Conditions d'utilisation",footer_company_3:"Politique de confidentialité",footer_company_4:"Contact",footer_social_1:"WhatsApp",
};

const LANDING_EN: Record<string, string> = {
  ...LANDING_FR, about_company_title:"About XPRESS CLEAN",about_company_statement:"XPRESS CLEAN is a product or trading name of General Advance Services.", skip:"Skip to content",main_nav:"Main navigation",menu:"Open menu",contact:"Contact",start_free:"Create my account",hero_badge:"Built for African laundry businesses",hero_title:"Run a more profitable laundry business.",hero_sub:"Orders, customers, payments, garment tracking, production costs, profitability and business performance from one intelligent platform built for Africa.",start_trial:"Start Free Trial — 30 days",calculate_profit:"Calculate My Profit →",calculate_profit_plain:"Calculate My Profit",hero_trust:"No credit card · No commitment · Cancel anytime",receipt_generated:"Receipt generated automatically",profit_up:"+23% profit this month",proof:"Usage proof",trusted_across_africa:"Laundry businesses across Africa and beyond trust XpressPro.",active_laundries:"Active laundries",orders_processed:"Orders processed",customers_registered:"Customers served",countries:"Countries",
  problem_eyebrow:"The daily reality",problem_title:"Do these sound familiar?",problem_solution:"XpressPro solves every one of these — from day one.",pain_garments:"Lost garments",pain_garments_desc:"No reliable intake trail. Finding a customer's clothes means searching through notebooks.",pain_payments:"Forgotten payments",pain_payments_desc:"Customers leave without paying and you only notice at the end of the day.",pain_notebooks:"Paper notebooks",pain_notebooks_desc:"Crossed-out lines, missing pages and lost books take orders with them.",pain_profit:"Unknown profitability",pain_profit_desc:"You work hard without knowing whether the laundry is making or losing money.",pain_customers:"Unhappy customers",pain_customers_desc:"Customers ask if laundry is ready while your team searches through paper.",pain_data:"No business data",pain_data_desc:"You cannot see which services earn most or which days carry the heaviest load.",
  workflow_eyebrow:"How it works",workflow_title:"From drop-off to delivery — every step is tracked",workflow_sub:"Your team always knows where every order stands. So do your customers.",client:"Customer",order:"Order",sorting:"Sorting",washing:"Washing",drying:"Drying",ironing:"Ironing",packing:"Packing",ready:"Ready",delivery:"Delivery",reports:"Reports",
  tools_eyebrow:"Free tools",tools_title:"Start managing your laundry — even without an account",tools_sub:"Professional free tools built for African laundry entrepreneurs.",most_used:"Most used",diagnostic:"Professional Diagnostic",diagnostic_desc:"Identify improvement opportunities in your laundry in minutes.",startup_calc:"Startup Calculator",startup_calc_desc:"Estimate the total budget to open a laundry for your city and capacity.",profit_calc:"Profitability Calculator",profit_calc_desc:"In four steps, calculate break-even, real profit and receive a personalized WhatsApp report.",no_signup:"No signup",whatsapp_report:"WhatsApp report",
  product_eyebrow:"The complete platform",product_title:"Everything your laundry needs — in one place",product_note:"All features included from the Starter plan.",pillar_run:"Run your laundry",pillar_grow:"Grow your business",pillar_learn:"Learn and improve",
  dashboard_eyebrow:"Operational intelligence",dashboard_title:"Your laundry, powered by data",dashboard_sub:"Know exactly what you earn — today, this week, this month.",live_control:"Live operations control",live:"Live",orders_today:"Orders today",revenue_today:"Revenue today (FCFA)",cost_kg:"Cost/kg (FCFA)",profit:"Profit",revenue_7_days:"Revenue — last 7 days",break_even:"Break-even reached",
  demo_eyebrow:"See XpressPro in action",demo_title:"Understand XpressPro in 3 minutes",demo_sub:"See how to create an order, track production, collect payment and check profitability in real time.",demo_soon:"Video demo coming soon",demo_wait:"In the meantime, start your free trial →",demo_1:"Create an order in 30 seconds",demo_2:"Track the production pipeline",demo_3:"Record a Mobile Money payment",demo_4:"Check the financial dashboard",demo_question:"Prefer to try it yourself?",start_free_arrow:"Create my free account →",
  comparison_eyebrow:"The XpressPro difference",comparison_title:"Before and after XpressPro",without:"Without XpressPro",with:"With XpressPro",
  pricing_eyebrow:"Pricing",pricing_title:"A plan for every laundry",pricing_sub:"All features included from Starter. Only the limits change.",most_popular:"Most popular",pricing_trial:"30 days free OR your first 50 orders — whichever lasts longer. No credit card.",price_discover:"Free",price_starter:"3,900 FCFA",price_professional:"12,900 FCFA",price_business:"24,900 FCFA",price_enterprise:"49,900 FCFA",price_period:"/month",limit_discover:"50 lifetime orders",limit_starter:"100 orders/month",limit_professional:"600 orders/month",limit_business:"3,000 orders/month",limit_enterprise:"Unlimited orders",capacity_discover:"1 site · 1 user",capacity_starter:"1 site · 1 user",capacity_professional:"1 site · 3 users",capacity_business:"3 sites · 20 users",capacity_enterprise:"Unlimited sites & users",cta_discover:"Start free",cta_starter:"Choose Starter",cta_professional:"Choose Professional",cta_business:"Choose Business",cta_enterprise:"Contact the team",
  final_title:"Ready to transform your laundry business?",final_sub:"XpressPro helps you manage every order, every payment and profitability — built for Africa.",final_offer:"30 days free OR your first 50 orders",final_offer_sub:"Whichever lasts longer — then from 3,900 FCFA/month",no_card:"No credit card",no_commitment:"No commitment",cancel_anytime:"Cancel anytime",create_account:"Create my free account →",already:"Already have an account? Sign in →",questions:"Questions? Contact us on WhatsApp →",footer_tagline:"The professional laundry management platform built for Africa.",footer_product:"Product",footer_resources:"Resources",footer_company:"Company",footer_social:"Social media",
};

Object.assign(LANDING_FR, { close_menu: "Fermer le menu", language: "Langue", play_demo: "Lire la démo XpressPro" });
Object.assign(LANDING_EN, {
  close_menu: "Close menu", language: "Language", play_demo: "Play the XpressPro demo",
  footer_resources_1: "Professional diagnostic", footer_resources_2: "Startup calculator", footer_resources_3: "Profitability calculator",
  footer_company_1: "About", footer_company_2: "Terms of use", footer_company_3: "Privacy policy", footer_company_4: "Contact",
});

const FIPP_HOME = {
  fr: {
    banner: "Le rendez-vous des professionnels du pressing",
    date: "19 décembre 2026", discover: "Découvrir l’événement", edition: "Rencontre · 2ᵉ édition",
    name: "Forum international des professionnels du pressing",
    title: "Une matinée pour faire grandir votre activité.",
    description: "Professionnels du pressing, entrepreneurs et partenaires : échangez sur les méthodes, les outils numériques et les opportunités qui font évoluer le métier en Afrique.",
    topics: ["Digitalisation & rentabilité", "Marketing & innovation", "Démonstrations & rencontres"],
    location: "Lieu annoncé prochainement", details: "Programme provisoire, offres et modalités de participation sur la page de l’événement.",
    accessible: "FIPP Africa · Événement à venir",
  },
  en: {
    banner: "The meeting place for laundry professionals",
    date: "19 December 2026", discover: "Discover the event", edition: "Event · 2nd edition",
    name: "International Forum for Laundry Professionals",
    title: "A morning to help your business grow.",
    description: "Laundry professionals, entrepreneurs and partners: explore practical methods, digital tools and opportunities shaping the industry across Africa.",
    topics: ["Digital tools & profitability", "Marketing & innovation", "Demonstrations & networking"],
    location: "Venue to be announced", details: "Find the provisional programme, ticket options and participation details on the event page.",
    accessible: "FIPP Africa · Upcoming event",
  },
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

function useLandingMeta(language: string) {
  useEffect(() => {
    const french = language.startsWith("fr");
    const title = french ? "XpressGroup — Logiciel, conseil et pressing en Afrique" : "XpressGroup — Software, training and laundry services in Africa";
    const description = french ? "XpressGroup réunit XpressPro, Xpress Consulting et Xpress Clean : logiciel de gestion, conseil et services de pressing en Afrique." : "XpressGroup brings together XpressPro, Xpress Consulting and Xpress Clean: management software, training and laundry services in Africa.";
    document.title = title;
    document.documentElement.lang = french ? "fr" : "en";
    const values: Record<string, string> = {
      description,
      "og:title": title,
      "og:description": description,
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
  }, [language]);
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

function LazyDemoVideo({ url, label }: { url: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  if (playing) return <iframe className="h-full w-full" src={url} title={label} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
  return <div className="grid h-full place-items-center text-white"><button type="button" onClick={() => { trackMarketingEvent("demo_started"); setPlaying(true); }} className="grid h-16 w-16 place-items-center rounded-full border-2 border-white bg-blue-600" aria-label={label}><Play className="ml-1 h-7 w-7 fill-white" /></button></div>;
}

export default function LandingPage() {

  const { t, i18n } = useTranslation();
  if (!i18n.exists("landing_v3.play_demo", { lng: "fr" })) {
    i18n.addResourceBundle("fr", "translation", { landing_v3: LANDING_FR }, true, true);
    i18n.addResourceBundle("en", "translation", { landing_v3: LANDING_EN }, true, true);
  }
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const french = i18n.language.startsWith("fr");
  const loginLabel = french ? "Me connecter à XpressPro" : "Sign in to XpressPro";
  const demoUrl = demoEmbedUrl(i18n.language);
  const fipp = FIPP_HOME[i18n.language.startsWith("fr") ? "fr" : "en"];
  useLandingReveal(); useLandingMeta(i18n.language);
  useEffect(() => { const fn = () => setScrolled(window.scrollY > 20); window.addEventListener("scroll", fn, { passive: true }); return () => window.removeEventListener("scroll", fn); }, []);
  const footerLinks: Record<string, Array<{ href: string; label: string }>> = {
    resources: [
      { href: "/diagnostic", label: "footer_resources_1" },
      { href: "/calculateur", label: "footer_resources_2" },
      { href: "/rentabilite", label: "footer_resources_3" },
    ],
    company: ["#about", "/terms", "/privacy", "#contact"].map((href, index) => ({ href, label: `footer_company_${index + 1}` })),
  };

  return <div className="min-h-screen overflow-x-hidden bg-white text-slate-950">
    <style>{`.landing-reveal{opacity:0;transform:translateY(24px);transition:opacity .4s ease,transform .4s ease}.landing-reveal.is-visible{opacity:1;transform:none}.landing-card{transition:transform .2s ease,box-shadow .2s ease}.landing-card:hover{transform:translateY(-2px)}@media(prefers-reduced-motion:reduce){.landing-reveal,.landing-card{opacity:1;transform:none;transition:none!important}}`}</style>
    <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-20 rounded bg-white px-4 py-2 font-semibold text-blue-700 focus:translate-y-0">{t("landing_v3.skip")}</a>
    <header className={`fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 text-[#0D1B4B] backdrop-blur ${scrolled ? "shadow-sm" : ""}`}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4" aria-label={t("landing_v3.main_nav")}>
        <Link href="/" className="shrink-0 text-lg font-black tracking-tight sm:text-2xl">Xpress<span className="text-blue-600">Group</span></Link>
        <div className="hidden items-center gap-5 xl:flex"><a href="/xpresspro" className="text-sm font-semibold hover:text-blue-600">XpressPro</a><a href="/xpress-consulting" className="text-sm font-semibold hover:text-amber-700">Xpress Consulting</a><a href="/xpress-clean" className="text-sm font-semibold hover:text-cyan-700">Xpress Clean</a><a href="/rencontre" className="text-sm font-semibold hover:text-[#ad831c]">FIPP Africa</a></div>
        <div className="hidden items-center gap-2 xl:flex"><button className="min-h-11 rounded-lg px-3 text-sm font-bold" onClick={() => i18n.changeLanguage(i18n.language.startsWith("fr") ? "en" : "fr")}>{i18n.language.startsWith("fr") ? "EN" : "FR"}</button><Link href="/auth" className="min-h-11 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white">{loginLabel}</Link><Link href="/auth?tab=register" className="min-h-11 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white">{t("landing_v3.start_free")}</Link></div>
        <div className="flex shrink-0 items-center gap-1 xl:hidden"><Link href="/auth" aria-label={french ? "Connexion XpressPro" : "XpressPro sign-in"} className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"><span className="min-[380px]:hidden">{french ? "Connexion" : "Sign in"}</span><span className="hidden min-[380px]:inline">{french ? "Connexion XpressPro" : "XpressPro sign-in"}</span></Link><button className="grid min-h-11 min-w-11 place-items-center xl:hidden" aria-label={t(menu ? "landing_v3.close_menu" : "landing_v3.menu")} aria-controls="home-mobile-menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></div>
      </nav>
      {menu && <div id="home-mobile-menu" className="border-t bg-white p-4 text-[#0D1B4B] xl:hidden"><div className="mb-2 flex items-center gap-2" role="group" aria-label={t("landing_v3.language")}>{["fr", "en"].map(language => <button key={language} type="button" lang={language} aria-pressed={i18n.language.startsWith(language)} onClick={() => i18n.changeLanguage(language)} className="min-h-11 min-w-11 rounded-lg border px-3 font-bold aria-pressed:bg-blue-600 aria-pressed:text-white">{language.toUpperCase()}</button>)}</div>{[["/xpresspro", "XpressPro"],["/xpress-consulting", "Xpress Consulting"],["/xpress-clean", "Xpress Clean"],["/rencontre", "FIPP Africa"]].map(([href,label]) => <a key={href} href={href} onClick={() => setMenu(false)} className="block min-h-11 py-3 font-medium">{label}</a>)}<Link href="/auth" onClick={() => setMenu(false)} className="block min-h-11 py-3 font-medium">{loginLabel}</Link><Link href="/auth?tab=register" onClick={() => setMenu(false)} className="block min-h-11 py-3 font-bold text-blue-600">{t("landing_v3.start_free")}</Link></div>}
    </header>

    <main id="main-content">
      <FippHomeBanner language={i18n.language} compact />
      <XpressGroupGateway language={i18n.language} />

      <section id="fipp-africa" className="scroll-mt-20 border-y border-[#cba52a]/25 bg-[#fffaf0] px-4 py-16 text-[#082550] sm:py-20" aria-labelledby="fipp-home-title">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#805f12]">{fipp.edition}</p>
            <h2 id="fipp-home-title" className="mt-4 font-serif text-4xl font-bold leading-tight sm:text-6xl">FIPP <span className="text-[#946c0a]">AFRICA</span></h2>
            <p className="mt-3 text-sm font-bold uppercase tracking-[.08em] sm:text-base">{fipp.name}</p>
            <p className="mt-6 text-2xl font-bold leading-tight sm:text-3xl">{fipp.title}</p>
            <p className="mt-4 max-w-2xl leading-7 text-slate-700">{fipp.description}</p>
            <div className="mt-6 flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:flex-wrap">
              <p className="inline-flex items-center gap-2"><CalendarDays className="h-5 w-5 shrink-0 text-[#805f12]" aria-hidden="true" /><time dateTime="2026-12-19">{fipp.date}</time></p>
              <p className="inline-flex items-center gap-2"><MapPin className="h-5 w-5 shrink-0 text-[#805f12]" aria-hidden="true" />{fipp.location}</p>
            </div>
            <ul className="mt-6 flex flex-wrap gap-2">{fipp.topics.map(topic => <li key={topic} className="rounded-full border border-[#cba52a]/35 bg-white px-3 py-2 text-xs font-semibold text-[#614b17]">{topic}</li>)}</ul>
            <Link href="/rencontre" className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#082550] px-6 py-3 text-center font-bold text-white hover:bg-[#123b70] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#082550] sm:w-auto">{fipp.discover}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Link>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{fipp.details}</p>
          </div>
          <FippCountdown compact language={i18n.language} />
        </div>
      </section>


      <SaasPublicPlans />

      <section id="about" className="scroll-mt-20 border-b border-slate-200 bg-slate-50 py-14"><div className="mx-auto max-w-6xl px-4"><h2 className="text-2xl font-bold text-[#0D1B4B]">{t("landing_v3.about_company_title")}</h2><p className="mt-3 max-w-3xl text-lg leading-8 text-slate-700">{t("landing_v3.about_company_statement")}</p></div></section>



      <section id="tools" className="bg-[#0D1B4B] py-24 text-white"><div className="mx-auto max-w-7xl px-4"><SectionHead dark eyebrow={t("landing_v3.tools_eyebrow")} title={t("landing_v3.tools_title")} sub={t("landing_v3.tools_sub")} /><div className="mt-12 grid gap-5 lg:grid-cols-[.8fr_1.4fr] lg:items-center"><div className="space-y-5"><Tool icon={ClipboardCheck} title={t("landing_v3.diagnostic")} desc={t("landing_v3.diagnostic_desc")} href="/diagnostic" /><Tool icon={Calculator} title={t("landing_v3.startup_calc")} desc={t("landing_v3.startup_calc_desc")} href="/calculateur" /></div><article className="landing-card rounded-2xl border-2 border-blue-400 bg-white p-8 text-slate-900 shadow-2xl"><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{t("landing_v3.most_used")}</span><Sparkles className="mt-6 h-9 w-9 text-blue-600" /><h3 className="mt-4 text-2xl font-black">{t("landing_v3.profit_calc")}</h3><p className="mt-3 leading-7 text-slate-600">{t("landing_v3.profit_calc_desc")}</p><div className="my-5 flex flex-wrap gap-2 text-xs">{["2 minutes",t("landing_v3.no_signup"),t("landing_v3.whatsapp_report")].map(x => <span key={x} className="rounded-full bg-slate-100 px-3 py-1">{x}</span>)}</div><Link href="/rentabilite" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">{t("landing_v3.calculate_profit")}<ArrowRight className="h-4 w-4" /></Link></article></div></div></section>



      {demoUrl && <section className="bg-slate-50 py-24"><div className="mx-auto max-w-5xl px-4 text-center"><SectionHead eyebrow={t("landing_v3.demo_eyebrow")} title={t("landing_v3.demo_title")} sub={t("landing_v3.demo_sub")} /><div className="mt-10 aspect-video overflow-hidden rounded-2xl bg-[#0D1B4B] shadow-xl"><LazyDemoVideo url={demoUrl} label={t("landing_v3.play_demo")} /></div><p className="mt-8">{t("landing_v3.demo_question")} <Link href="/auth?tab=register" className="font-bold text-blue-600">{t("landing_v3.start_free_arrow")}</Link></p></div></section>}



      <section className="bg-[#0D1B4B] py-24 text-center text-white"><div className="mx-auto max-w-4xl px-4"><p className="mb-4 text-sm font-bold uppercase tracking-widest">XpressPro · {i18n.language.startsWith("fr") ? "Gérer mon pressing" : "Manage my laundry business"}</p><h2 className="text-3xl font-black sm:text-5xl">{t("landing_v3.final_title")}</h2><p className="mx-auto mt-5 max-w-2xl text-blue-100">{t("landing_v3.final_sub")}</p><div className="mx-auto mt-8 max-w-2xl rounded-2xl bg-white/10 p-6"><SaasTrialInfo /><div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">{["no_card","no_commitment","cancel_anytime"].map(k=><span key={k}>✓ {t(`landing_v3.${k}`)}</span>)}</div></div><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/auth?tab=register" className="min-h-12 rounded-xl bg-white px-6 py-3 font-bold text-blue-700">{t("landing_v3.create_account")}</Link><Link href="/rentabilite" className="min-h-12 rounded-xl border border-white px-6 py-3 font-bold">{t("landing_v3.calculate_profit_plain")}</Link></div><Link href="/auth" className="mt-6 inline-block text-sm text-blue-200 underline">{t("landing_v3.already")}</Link><br/><a href="https://wa.me/237651638889" className="mt-3 inline-block text-sm text-blue-200 underline">{t("landing_v3.questions")}</a></div></section>
    </main>

    <footer id="contact" className="bg-[#081337] py-16 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="text-2xl font-black tracking-tight text-white">Xpress<span className="text-blue-400">Group</span></Link>
          <p className="mt-4 max-w-xs text-sm leading-6">{i18n.language.startsWith("fr") ? "XpressGroup réunit une plateforme de gestion, la formation et le conseil, et des services de pressing pour faire avancer l’entretien textile en Afrique." : "XpressGroup brings together management software, training and consulting, and laundry services to advance textile care across Africa."}</p>
          <p className="mt-4 text-sm">xpressclean23@gmail.com<br/>+237 651 638 889</p>
        </div>
        {["resources","company"].map(group => <div key={group}>
          <h3 className="font-bold text-white">{t(`landing_v3.footer_${group}`)}</h3>
          <ul className="mt-4 space-y-3 text-sm">{footerLinks[group].map(({ href, label }) => <li key={label}><a href={href} className="hover:text-white">{t(`landing_v3.${label}`)}</a></li>)}</ul>
        </div>)}
        <div>
          <h3 className="font-bold text-white">{i18n.language.startsWith("fr") ? "Réseaux sociaux" : "Social media"}</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li><a href="https://www.tiktok.com/@xpressclean6" target="_blank" rel="noopener noreferrer" className="hover:text-white">TikTok · @xpressclean6</a></li>
            <li><a href="https://www.youtube.com/@xpressclean6" target="_blank" rel="noopener noreferrer" className="hover:text-white">YouTube · @xpressclean6</a></li>
            <li><a href="https://wa.me/237651638889" target="_blank" rel="noopener noreferrer" className="hover:text-white">WhatsApp</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-col justify-between gap-4 border-t border-white/10 px-4 pt-6 text-xs sm:flex-row"><span>© 2026 XpressGroup</span><button className="min-h-11 px-3 font-bold" onClick={() => i18n.changeLanguage(i18n.language.startsWith("fr") ? "en" : "fr")}>FR / EN</button></div>
    </footer>
  </div>;
}

function SectionHead({ eyebrow, title, sub, dark = false }: { eyebrow: string; title: string; sub?: string; dark?: boolean }) {
  return <div className="landing-reveal mx-auto max-w-3xl text-center"><p className={`text-xs font-bold uppercase tracking-[.24em] ${dark ? "text-blue-300" : "text-blue-600"}`}>{eyebrow}</p><h2 className={`mt-4 text-3xl font-black tracking-tight sm:text-5xl ${dark ? "text-white" : "text-[#0D1B4B]"}`}>{title}</h2>{sub && <p className={`mt-5 text-lg ${dark ? "text-blue-100" : "text-slate-600"}`}>{sub}</p>}</div>;
}

function Tool({ icon: Icon, title, desc, href }: { icon: any; title: string; desc: string; href: string }) {
  return <article className="landing-card rounded-xl border border-white/15 bg-white/7 p-5"><Icon className="h-7 w-7 text-blue-300" /><h3 className="mt-3 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-blue-100">{desc}</p><Link href={href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-blue-300">{title}<ArrowRight className="h-4 w-4" /></Link></article>;
}
