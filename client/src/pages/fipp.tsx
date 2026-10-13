import { useEffect } from "react";
import FippCountdown from "@/components/fipp-countdown";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from "lucide-react";

const schedule = [
  { time: "08h00 – 09h00", title: "Accueil & networking", detail: "Enregistrement, visite de l’exposition et café d’accueil" },
  { time: "09h00 – 09h35", title: "Conférence 1 · L’avenir du pressing en Afrique", detail: "Pourquoi moderniser son entreprise est devenu indispensable" },
  { time: "09h35 – 10h20", title: "Conférence 2 · Digitaliser la gestion", detail: "Performance, traçabilité et rentabilité" },
  { time: "10h20 – 10h35", title: "Pause & networking", detail: "Visite des stands et démonstrations" },
  { time: "10h35 – 11h15", title: "Conférence 3 · Marketing digital", detail: "Développer son pressing grâce au numérique" },
  { time: "11h15 – 11h50", title: "Conférence 4 · Technologies intelligentes", detail: "Sécuriser et professionnaliser son pressing" },
  { time: "11h50 – 12h25", title: "Panel d’échanges", detail: "Quel avenir pour le pressing africain ?" },
  { time: "12h25 – 12h40", title: "Questions & réponses", detail: "Échanges avec le public" },
  { time: "12h40 – 13h00", title: "Clôture officielle", detail: "Synthèse et remerciements" },
  { time: "13h00 – 14h00", title: "Cocktail & networking", detail: "Rencontres et opportunités d’affaires" },
];
const ticketOffers = [
  {
    name: "En ligne",
    price: "5 000",
    benefits: ["Suivi des conférences et du panel en direct", "Participation à distance depuis votre téléphone ou ordinateur", "Lien de connexion transmis après confirmation de l’inscription"],
    featured: false,
  },
  {
    name: "Standard",
    price: "10 000",
    benefits: ["Toutes les conférences et le panel d’échanges", "Accès aux démonstrations et à l’exposition", "Pause, cocktail et networking général"],
    featured: false,
  },
  {
    name: "VIP",
    price: "15 000",
    benefits: ["Tout le contenu de l’offre Standard", "Accueil prioritaire et place réservée devant", "Échange en petit groupe avec les intervenants et partenaires", "Kit numérique pratique : supports et checklist pressing"],
    featured: true,
  },
];
const registrationUrl = (offer: string) => `https://wa.me/237651638889?text=${encodeURIComponent(`Bonjour, je souhaite réserver une place ${offer} pour FIPP Africa le 19 décembre 2026.`)}`;
const exhibitorUrl = `https://wa.me/237651638889?text=${encodeURIComponent("Bonjour, notre entreprise souhaite exposer au FIPP Africa le 19 décembre 2026. Nom de l’entreprise : [nom]. Activité : [activité]. Besoin en espace : [précisez].")}`;
export default function FippPage() {
  useEffect(() => { document.title = "FIPP Africa · Forum international des professionnels du pressing"; }, []);
  return <div className="min-h-screen bg-[#fffaf0] text-[#082550]">
    <header className="border-b border-[#cba52a]/25 bg-white"><nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4" aria-label="Navigation FIPP Africa"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft className="h-4 w-4" />XpressGroup</Link><a href="#programme" className="text-sm font-bold hover:text-[#ad831c]">Programme</a></nav></header>
    <main>
      <section className="relative overflow-hidden px-4 py-16 sm:py-24">
        <div className="pointer-events-none absolute -left-24 top-4 h-72 w-72 rotate-45 border-[30px] border-[#cba52a]/10" />
        <div className="relative mx-auto max-w-4xl">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.25em] text-[#a57d1b]">2ᵉ édition · Une initiative de XpressGroup</p>
            <h1 className="mt-5 font-serif text-5xl font-bold leading-tight tracking-tight sm:text-7xl">FIPP <span className="text-[#cba52a]">AFRICA</span></h1>
            <p className="mt-3 max-w-2xl text-sm font-bold uppercase tracking-[.12em] sm:text-base">Forum international des professionnels du pressing</p>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">Moderniser et développer les entreprises de pressing en Afrique grâce à l’innovation, au digital et à la professionnalisation.</p>
            <div className="mt-7 flex flex-wrap gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-[#cba52a]/50 bg-white px-5 py-3 font-bold"><CalendarDays className="h-5 w-5 text-[#a57d1b]" />19 décembre 2026 · 08h provisoire</span><span className="inline-flex items-center gap-2 rounded-full border border-[#cba52a]/50 bg-white px-5 py-3 font-bold"><MapPin className="h-5 w-5 text-[#a57d1b]" />Lieu bientôt annoncé</span></div>
            <div className="mt-8"><FippCountdown translucent /></div>
            <div className="mt-7 flex flex-wrap gap-3"><a href="#billets" className="inline-flex min-h-12 items-center rounded-full bg-[#cba52a] px-6 py-3 font-bold text-[#082550] hover:bg-[#e2bd48]">Voir les offres et s’inscrire</a><a href="#programme" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#082550] px-6 py-3 font-bold">Voir le programme <ArrowRight className="h-4 w-4" /></a></div>
          </div>
        </div>
      </section>
      <section className="bg-[#082550] px-4 py-14 text-center text-white"><div className="mx-auto max-w-4xl"><p className="text-xs font-bold uppercase tracking-[.24em] text-[#e5c566]">Notre rendez-vous</p><h2 className="mt-4 font-serif text-3xl font-bold sm:text-4xl">Une matinée de conférences, démonstrations et rencontres</h2><p className="mt-4 leading-7 text-blue-100">Des échanges concrets pour moderniser, digitaliser, développer et professionnaliser le pressing africain.</p></div></section>
      <section id="billets" className="px-4 py-20" aria-labelledby="billets-title"><div className="mx-auto max-w-5xl"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#a57d1b]">Billetterie · 2ᵉ édition</p><h2 id="billets-title" className="mt-3 font-serif text-4xl font-bold">Choisissez votre expérience</h2><p className="mt-4 text-slate-600">Suivez l’événement en ligne ou participez sur place.</p></div><div className="mt-10 grid gap-6 md:grid-cols-3">{ticketOffers.map(offer => <article key={offer.name} className={`flex flex-col rounded-2xl border p-7 sm:p-9 ${offer.featured ? "border-[#cba52a] bg-[#082550] text-white shadow-xl" : "border-[#cba52a]/40 bg-white"}`}><div className="flex items-start justify-between gap-4"><div><p className={`text-xs font-extrabold uppercase tracking-[.2em] ${offer.featured ? "text-[#e5c566]" : "text-[#a57d1b]"}`}>{offer.featured ? "Expérience privilégiée" : offer.name === "En ligne" ? "À distance" : "Sur place"}</p><h3 className="mt-2 font-serif text-3xl font-bold">{offer.name}</h3></div><div className="text-right"><p className={`text-3xl font-black tabular-nums ${offer.featured ? "text-[#e5c566]" : "text-[#082550]"}`}>{offer.price}</p><p className="text-xs font-bold uppercase tracking-wide">FCFA / personne</p></div></div><ul className="mt-7 flex-1 space-y-4">{offer.benefits.map(benefit => <li key={benefit} className="flex gap-3 leading-6"><span aria-hidden="true" className={`mt-1 font-bold ${offer.featured ? "text-[#e5c566]" : "text-[#a57d1b]"}`}>✓</span><span>{benefit}</span></li>)}</ul><a href={registrationUrl(offer.name)} target="_blank" rel="noopener noreferrer" className={`mt-9 inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 text-center font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${offer.featured ? "bg-[#cba52a] text-[#082550] hover:bg-[#e2bd48]" : "bg-[#082550] text-white hover:bg-[#12396d]"}`}>{offer.name === "En ligne" ? "Réserver mon accès en ligne" : `Réserver ma place ${offer.name}`} sur WhatsApp</a></article>)}</div><p className="mt-6 text-center text-sm text-slate-600">L’accès en ligne et les modalités de l’échange VIP seront confirmés lors de la réservation. Places VIP limitées.</p></div></section>
      <section id="programme" className="scroll-mt-12 px-4 py-20"><div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#a57d1b]">19 décembre 2026</p><h2 className="mt-3 font-serif text-4xl font-bold">Programme provisoire</h2></div><p className="text-sm text-slate-600">Horaires et intervenants susceptibles d’évoluer</p></div><div className="mt-10 divide-y divide-[#cba52a]/30 border-y border-[#cba52a]/30">{schedule.map(item => <article key={item.time} className="grid gap-3 py-5 sm:grid-cols-[150px_1fr]"><time className="font-bold text-[#a57d1b]">{item.time}</time><div><h3 className="text-lg font-bold">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.detail}</p></div></article>)}</div></div></section>
      <section id="exposants" className="bg-[#082550] px-4 py-20 text-white" aria-labelledby="exposants-title">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-[#e5c566]">Entreprises & partenaires</p>
            <h2 id="exposants-title" className="mt-4 font-serif text-4xl font-bold leading-tight">Exposez vos solutions au FIPP Africa</h2>
            <p className="mt-5 max-w-2xl leading-7 text-blue-100">Présentez vos équipements, produits, services ou outils numériques aux professionnels du pressing réunis pour cette 2ᵉ édition.</p>
            <p className="mt-4 text-sm text-blue-100">Les modalités d’exposition et le lieu seront communiqués directement aux entreprises intéressées.</p>
          </div>
          <div className="rounded-2xl border border-[#cba52a]/60 bg-white/5 p-7">
            <p className="font-serif text-2xl font-bold text-[#e5c566]">Votre entreprise a sa place ici.</p>
            <p className="mt-3 text-sm leading-6 text-blue-100">Contactez-nous en indiquant le nom de votre entreprise, votre activité et le type d’espace souhaité.</p>
            <a href={exhibitorUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#cba52a] px-5 py-3 text-center font-bold text-[#082550] hover:bg-[#e2bd48] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Devenir exposant sur WhatsApp</a>
          </div>
        </div>
      </section>
      <section className="bg-[#f1ead9] px-4 py-16 text-center"><div className="mx-auto max-w-3xl"><h2 className="font-serif text-3xl font-bold">Rejoignez la 2ᵉ édition</h2><p className="mt-4 leading-7 text-slate-700">Le lieu sera annoncé prochainement. Les préinscriptions sont ouvertes par WhatsApp.</p><a href="#billets" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#082550] px-6 py-3 font-bold text-white">Choisir mon offre</a><p className="mt-5 text-sm font-bold uppercase tracking-widest text-[#a57d1b]">Excellence · Innovation · Collaboration · Impact</p></div></section>
    </main><footer className="bg-[#082550] px-4 py-8 text-center text-sm text-blue-100">FIPP Africa · Une initiative de XpressGroup · 2026</footer>
  </div>;
}
