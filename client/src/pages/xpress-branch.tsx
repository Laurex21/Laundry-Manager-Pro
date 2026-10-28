import { SaasPublicPlans } from "@/components/saas-public-plans";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, MessageCircle } from "lucide-react";

type Branch = "pro" | "consulting" | "clean";
type PublicStats = { totalOrders: number; totalCustomers: number; totalLaundries: number; totalCountries: number };
const money = (amount: number) => `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
const wa = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
const consultingContact = wa("237651638889", "Bonjour, je souhaite en savoir plus sur Xpress Consulting.");
const cleanContact = wa("237655615806", "Bonjour, je souhaite en savoir plus sur les services Xpress Clean.");
const carePrices: [string, number][] = [
  ["Chemise, T-shirt, pantalon, jean ou robe simple", 500], ["Kaba", 1000], ["Pull-over", 1000],
  ["Veste simple", 1000], ["Chaussures", 1500], ["Paire de draps de couleur", 1500],
  ["Robe de soirée", 1500], ["Ensemble saillon", 1500], ["Ensemble veste", 2000],
  ["Paire de draps blancs", 2000], ["Ensemble gandoura", 2500], ["Couverture", 2500],
];
const subscriptions = [
  { name: "Essentiel", kg: 10, price: 12000, extra: 1500, collection: "Ramassage et livraison payants", audience: "Célibataires et jeunes actifs" },
  { name: "Confort", kg: 25, price: 28000, extra: 1300, collection: "1 ramassage + 1 livraison / mois", audience: "Couples et petites familles" },
  { name: "Famille", kg: 35, price: 38000, extra: 1200, collection: "2 ramassages + 2 livraisons / mois", audience: "Familles nombreuses" },
  { name: "Premium", kg: 45, price: 52000, extra: 1000, collection: "4 ramassages + 4 livraisons / mois", audience: "Professionnels et grandes familles" },
];
const consultingOffers = [
  { title: "Consultation personnalisée", price: "10 000 FCFA / 45 min", description: "Analyse de votre projet, réponses à vos questions et recommandations concrètes." },
  { title: "Plan de lancement pressing", price: "25 000 FCFA", description: "Équipements, produits recommandés, budget de démarrage et priorités d’achat." },
  { title: "Formation complète", price: "100 000 FCFA", description: "Apprenez à créer, gérer et développer un pressing avec des procédures opérationnelles." },
  { title: "Accompagnement personnalisé", price: "50 000 FCFA / mois", description: "Analyse du projet, conseils stratégiques, développement commercial et suivi personnalisé." },
];

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="max-w-3xl"><p className="text-xs font-extrabold uppercase tracking-[.22em] text-current opacity-65">{eyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{title}</h2>{description && <p className="mt-4 text-base leading-7 opacity-75">{description}</p>}</div>;
}
function ContactLink({ href, children, dark = false }: { href: string; children: React.ReactNode; dark?: boolean }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 font-bold transition hover:-translate-y-0.5 ${dark ? "bg-[#0d1b4b] text-white" : "bg-white text-[#0d1b4b]"}`}><MessageCircle className="h-4 w-4" />{children}</a>;
}
export default function XpressBranchPage({ branch }: { branch: Branch }) {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const proText = (french: string, english: string) => branch === "pro" && !fr ? english : french;
  const { data: stats } = useQuery<PublicStats>({ queryKey: ["/api/public/stats"], staleTime: 60_000, enabled: branch === "pro" });
  const metrics = [
    { value: stats?.totalLaundries, label: proText("Pressings actifs", "Active laundries") },
    { value: stats?.totalOrders, label: proText("Commandes traitées", "Orders processed") },
    { value: stats?.totalCustomers, label: proText("Clients enregistrés", "Customers registered") },
    { value: stats?.totalCountries, label: proText("Pays couverts", "Countries covered") },
  ].filter(metric => Number(metric.value) > 0);
  const config = {
    pro: { name: "XpressPro", label: "Plateforme de gestion", title: "Votre pressing sous contrôle, du dépôt au pilotage.", intro: "Clients, commandes, paiements et performances réunis dans une plateforme pensée pour les professionnels du pressing.", image: "/xpressgroup/pro.webp", bg: "bg-[#edf3ff]", accent: "text-[#1558cf]", button: "bg-[#1558cf]" },
    consulting: { name: "Xpress Consulting", label: "Conseil · Formation · Accompagnement", title: "Passez d’une idée de pressing à une activité bien organisée.", intro: "Des conseils concrets, une formation métier et un suivi adapté à chaque étape de votre projet.", image: "/xpressgroup/consulting.webp", bg: "bg-[#fff5e5]", accent: "text-[#895717]", button: "bg-[#895717]" },
    clean: { name: "Xpress Clean", label: "Pressing & blanchisserie à Douala", title: "Le soin du linge, simplement et avec méthode.", intro: "Vêtements, linge de maison, lavage au kilo et abonnements pour vous simplifier le quotidien.", image: "/xpressgroup/clean.webp", bg: "bg-[#e6f8fa]", accent: "text-[#087b8b]", button: "bg-[#087b8b]" },
  }[branch];
  if (branch === "pro") {
    config.label = fr ? "XpressPro, le logiciel de gestion de pressing de XpressGroup" : "XpressPro, laundry management software by XpressGroup";
    config.title = fr ? "Votre pressing. Une gestion plus simple." : "Your laundry business. Simpler to manage.";
    config.intro = fr ? "Commandes, clients et encaissements : simplifiez votre activité au quotidien." : "Orders, customers and payments: simplify your daily operations.";
  }
  useEffect(() => {
    document.title = `${config.name} | XpressGroup`;
    if (window.location.hash === "#pricing" && branch === "pro") {
      requestAnimationFrame(() => document.getElementById("pricing")?.scrollIntoView());
    } else {
      window.scrollTo(0, 0);
    }
  }, [branch, config.name]);
  return <div className="min-h-screen bg-white text-[#0d1b4b]">
    <header className="border-b border-[#0d1b4b]/10 bg-white"><nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4" aria-label="Navigation XpressGroup"><Link href="/" className="text-xl font-black">Xpress<span className="text-blue-600">Group</span></Link><div className="hidden gap-5 text-sm font-semibold lg:flex"><Link href="/xpresspro" className="hover:underline">XpressPro</Link><Link href="/xpress-consulting" className="hover:underline">Consulting</Link><Link href="/xpress-clean" className="hover:underline">Clean</Link></div><div className="flex items-center gap-2">{branch === "pro" && <><button type="button" className="min-h-11 min-w-11 rounded-lg px-2 text-sm font-bold" aria-label={fr ? "Passer en anglais" : "Switch to French"} onClick={() => i18n.changeLanguage(fr ? "en" : "fr")}>{fr ? "EN" : "FR"}</button><Link href="/auth" className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white sm:text-sm"><span className="sm:hidden">{fr ? "Connexion" : "Sign in"}</span><span className="hidden sm:inline">{fr ? "Me connecter à XpressPro" : "Sign in to XpressPro"}</span></Link></>}<Link href="/" className={`${branch === "pro" ? "hidden sm:inline-flex" : "inline-flex"} min-h-11 items-center gap-2 text-sm font-bold`}><ArrowLeft className="h-4 w-4" />{proText("Accueil", "Home")}</Link></div></nav></header>
    <main>
      <section className={`${config.bg} overflow-hidden`}><div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24"><div><p className={`text-xs font-extrabold uppercase tracking-[.22em] ${config.accent}`}>{config.label}</p><h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-[-.04em] sm:text-6xl">{config.title}</h1><p className="mt-6 max-w-xl text-lg leading-8 text-slate-700">{config.intro}</p>{branch === "pro" ? <><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Link href="/auth?tab=register" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">{fr ? "Créer mon compte" : "Create my account"}</Link><Link href="/auth" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-600 bg-white px-5 py-3 font-bold text-blue-700">{fr ? "Déjà inscrit ? Me connecter" : "Already registered? Sign in"}</Link></div><a href="#pricing" className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-600 bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{fr ? "Voir les formules et tarifs" : "View plans and pricing"}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a></> : <a href="#details" className={`mt-8 inline-flex min-h-12 items-center gap-2 rounded-full px-6 py-3 font-bold text-white ${config.button}`}>Découvrir <ArrowRight className="h-4 w-4" /></a>}</div><img src={config.image} alt={config.name} className="h-72 w-full rounded-3xl object-cover shadow-xl sm:h-[440px]" width="640" height="440" /></div></section>
      {branch === "pro" && <>
        <section className="border-y border-blue-100 bg-white px-4 py-12" aria-label={proText("Statistiques XpressPro", "XpressPro statistics")}><div className="mx-auto max-w-7xl">{metrics.length > 0 && <><p className="mb-8 text-center text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">{proText("XpressPro en chiffres", "XpressPro in numbers")}</p><div className="grid grid-cols-2 gap-7 md:grid-cols-4">{metrics.map(metric => <div key={metric.label} className="text-center"><p className="text-3xl font-black text-[#0d1b4b] sm:text-4xl">{Number(metric.value).toLocaleString("fr-FR")}+</p><p className="mt-1 text-sm text-slate-600">{metric.label}</p></div>)}</div></>}</div></section>
        <section id="details" className="mx-auto max-w-7xl px-4 py-20"><SectionTitle eyebrow={proText("La plateforme", "The platform")} title={proText("Tout suivre depuis un seul endroit", "Track everything in one place")} description={proText("XpressPro accompagne le travail quotidien, de la réception de l’article jusqu’au suivi de l’activité.", "XpressPro supports daily work, from garment intake to business reporting.")} /><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(fr ? ["Gestion des clients et historique", "Enregistrement et suivi des commandes", "Suivi des paiements", "Statistiques et tableau de bord", "Gestion de plusieurs points de collecte", "Traçabilité des articles et des étapes"] : ["Customers and history", "Order registration and tracking", "Payment tracking", "Statistics and dashboard", "Multiple collection points", "Garment and workflow tracking"]).map(item => <div key={item} className="rounded-2xl border border-blue-100 bg-[#f5f8ff] p-6"><Check className="mb-4 h-6 w-6 text-blue-600" /><h3 className="font-bold">{item}</h3></div>)}</div></section>
        <section className="bg-[#0d1b4b] px-4 py-20 text-white"><div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2"><div><SectionTitle eyebrow={proText("Pilotage", "Business overview")} title={proText("Des décisions appuyées par vos données", "Decisions backed by your data")} description={proText("Suivez les commandes, les encaissements et les performances de votre pressing depuis le téléphone ou la tablette.", "Track orders, payments and performance on your phone or tablet.")} /><Link href="/auth?tab=register" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-white px-6 py-3 font-bold text-[#0d1b4b]">{proText("Essayer la plateforme", "Try the platform")} <ArrowRight className="ml-2 h-4 w-4" /></Link></div><img src="/xpressgroup/field.webp" alt={proText("Responsable de pressing utilisant une tablette", "Laundry manager using a tablet")} className="h-72 w-full rounded-2xl object-cover" loading="lazy" /></div></section>
        <SaasPublicPlans />
      </>}
      {branch === "consulting" && <>
        <section id="details" className="mx-auto max-w-7xl px-4 py-20"><SectionTitle eyebrow="Nos offres" title="Le bon appui, au bon moment" description="Un parcours qui va de la première consultation au développement de votre pressing." /><div className="mt-10 grid gap-5 md:grid-cols-2">{consultingOffers.map(offer => <article key={offer.title} className="flex flex-col rounded-2xl border border-amber-200 bg-[#fffaf1] p-7"><h3 className="text-2xl font-black">{offer.title}</h3><p className="mt-3 flex-1 leading-7 text-slate-700">{offer.description}</p><p className="mt-6 text-xl font-black text-[#895717]">{offer.price}</p></article>)}</div></section>
        <section className="bg-[#fff5e5] px-4 py-20"><div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2"><img src="/xpressgroup/field.webp" alt="Formation sur le terrain dans un pressing" className="h-72 w-full rounded-2xl object-cover lg:h-96" loading="lazy" /><div><SectionTitle eyebrow="Formation à distance" title="Apprendre, pratiquer, progresser" description="Un programme de 14 à 31 jours avec des modules vidéo, des documents utiles et un suivi personnalisé par appel vocal ou vidéo." /><ul className="mt-7 space-y-3">{["Accueil et enregistrement des clients", "Lavage et traitement des articles", "Repassage et emballage", "Fonctionnement de la machine à laver", "Guide PDF, fiches pratiques et répertoire d’astuces", "Certificat de fin de formation"].map(item => <li key={item} className="flex gap-3"><Check className="mt-1 h-5 w-5 shrink-0 text-[#895717]" />{item}</li>)}</ul></div></div></section>
        <section className="mx-auto max-w-7xl px-4 py-20"><SectionTitle eyebrow="Formation par niveau" title="Choisissez votre point de départ" /><div className="mt-8 grid gap-4 md:grid-cols-4">{[["Enregistrement et suivi", 30000], ["Lavage et détachage", 50000], ["Repassage et emballage", 50000], ["Gestion opérationnelle", 50000]].map(([name, price]) => <div key={name} className="rounded-2xl border border-amber-200 p-5"><h3 className="font-bold">{name}</h3><p className="mt-5 text-lg font-black text-[#895717]">{money(Number(price))}</p></div>)}</div><p className="mt-5 text-sm text-slate-600">La formation complète est proposée à 100 000 FCFA au lieu de 180 000 FCFA pour les quatre niveaux séparés.</p><div className="mt-8"><ContactLink href={consultingContact} dark>Parler de mon projet</ContactLink></div></section>
      </>}
      {branch === "clean" && <>
        <section id="details" className="mx-auto max-w-7xl px-4 py-20"><SectionTitle eyebrow="Nos services" title="Un service pour chaque besoin" description="Ramassage et livraison, lavage, séchage, repassage et entretien des chaussures. Service basé à Douala, Makepe." /><div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{["Ramassage & livraison", "Lavage", "Séchage", "Repassage"].map(item => <div key={item} className="rounded-2xl bg-[#e6f8fa] p-6 font-bold"><Check className="mb-4 h-6 w-6 text-[#087b8b]" />{item}</div>)}</div></section>
        <section className="bg-[#effafb] px-4 py-20"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow="Grille tarifaire" title="Entretien à la pièce" /><div className="mt-9 grid gap-x-12 md:grid-cols-2">{carePrices.map(([name, price]) => <div key={name} className="flex justify-between gap-4 border-b border-[#087b8b]/20 py-4"><span>{name}</span><strong className="whitespace-nowrap">{money(price)}</strong></div>)}</div><p className="mt-6 text-sm text-slate-600">Délai annoncé : 24 à 72 h. Des frais supplémentaires peuvent s’appliquer aux taches difficiles après évaluation.</p></div></section>
        <section className="mx-auto max-w-7xl px-4 py-20"><SectionTitle eyebrow="Lavage au kilo" title="Un tarif simple selon la prestation" /><div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-cyan-200 p-7"><h3 className="text-xl font-bold">Lavage complet</h3><p className="mt-4 text-3xl font-black text-[#087b8b]">1 500 FCFA/kg</p></div><div className="rounded-2xl border border-cyan-200 p-7"><h3 className="text-xl font-bold">Lavage & séchage</h3><p className="mt-4 text-3xl font-black text-[#087b8b]">1 000 FCFA/kg</p></div></div></section>
        <section className="bg-[#e6f8fa] px-4 py-20"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow="Abonnements mensuels" title="La bonne formule pour votre volume de linge" /><div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{subscriptions.map(plan => <article key={plan.name} className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-[#087b8b]">{plan.audience}</p><h3 className="mt-3 text-2xl font-black">{plan.name}</h3><p className="mt-4 text-3xl font-black text-[#087b8b]">{plan.kg} kg</p><p className="mt-1 text-xl font-bold">{money(plan.price)} / mois</p><p className="mt-5 text-sm text-slate-700">{plan.collection}</p><p className="mt-2 text-sm text-slate-700">Kg supplémentaire : {money(plan.extra)}/kg</p></article>)}</div><p className="mt-6 text-sm text-slate-600">Formules Famille et Premium disponibles en quantité limitée.</p><div className="mt-8"><ContactLink href={cleanContact} dark>Demander une prestation</ContactLink></div></div></section>
      </>}
    </main><footer className="bg-[#0d1b4b] px-4 py-9 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><p className="font-bold">XpressGroup · {config.name}</p><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold">{proText("Retour à l’accueil", "Back to home")} <ArrowRight className="h-4 w-4" /></Link></div></footer>
  </div>;
}
