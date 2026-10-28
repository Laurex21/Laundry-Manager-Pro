import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import FippCountdown from "@/components/fipp-countdown";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from "lucide-react";

export default function FippPage() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const copy = (french: string, english: string) => fr ? french : english;
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id === "programme" || id === "billets") document.getElementById(id)?.scrollIntoView();
  }, []);
  const schedule = [
  { time: "08:00 – 09:00", title: copy("Accueil & networking", "Welcome & networking"), detail: copy("Enregistrement, visite de l’exposition et café d’accueil", "Registration, exhibition tour and welcome coffee") },
  { time: "09:00 – 09:35", title: copy("Conférence 1 · L’avenir du pressing en Afrique", "Talk 1 · The future of laundry in Africa"), detail: copy("Pourquoi moderniser son entreprise est devenu indispensable", "Why modernising your business is now essential") },
  { time: "09:35 – 10:20", title: copy("Conférence 2 · Digitaliser la gestion", "Talk 2 · Digital management"), detail: copy("Performance, traçabilité et rentabilité", "Performance, traceability and profitability") },
  { time: "10:20 – 10:35", title: copy("Pause & networking", "Break & networking"), detail: copy("Visite des stands et démonstrations", "Exhibitor visits and demonstrations") },
  { time: "10:35 – 11:15", title: copy("Conférence 3 · Marketing digital", "Talk 3 · Digital marketing"), detail: copy("Développer son pressing grâce au numérique", "Grow your laundry business with digital tools") },
  { time: "11:15 – 11:50", title: copy("Conférence 4 · Technologies intelligentes", "Talk 4 · Smart technologies"), detail: copy("Sécuriser et professionnaliser son pressing", "Make your laundry business more secure and professional") },
  { time: "11:50 – 12:25", title: copy("Panel d’échanges", "Panel discussion"), detail: copy("Quel avenir pour le pressing africain ?", "What lies ahead for the African laundry industry?") },
  { time: "12:25 – 12:40", title: copy("Questions & réponses", "Questions & answers"), detail: copy("Échanges avec le public", "Audience discussion") },
  { time: "12:40 – 13:00", title: copy("Clôture officielle", "Official closing"), detail: copy("Synthèse et remerciements", "Key takeaways and acknowledgements") },
  { time: "13:00 – 14:00", title: copy("Cocktail & networking", "Reception & networking"), detail: copy("Rencontres et opportunités d’affaires", "Connections and business opportunities") },
];
const ticketOffers = [
  {
    name: copy("En ligne", "Online"),
    price: "5 000",
    benefits: [copy("Suivi des conférences et du panel en direct", "Watch the talks and panel live"), copy("Participation à distance depuis votre téléphone ou ordinateur", "Join remotely from your phone or computer"), copy("Lien de connexion transmis après confirmation de l’inscription", "Access link sent after registration is confirmed")],
    featured: false,
  },
  {
    name: "Standard",
    price: "10 000",
    benefits: [copy("Toutes les conférences et le panel d’échanges", "All talks and the panel discussion"), copy("Accès aux démonstrations et à l’exposition", "Access to demonstrations and the exhibition"), copy("Pause, cocktail et networking général", "Break, reception and networking")],
    featured: false,
  },
  {
    name: "VIP",
    price: "15 000",
    benefits: [copy("Tout le contenu de l’offre Standard", "Everything in the Standard ticket"), copy("Accueil prioritaire et place réservée devant", "Priority welcome and a reserved front seat"), copy("Échange en petit groupe avec les intervenants et partenaires", "Small-group discussion with speakers and partners"), copy("Kit numérique pratique : supports et checklist pressing", "Practical digital kit: resources and a laundry checklist")],
    featured: true,
  },
];
const registrationUrl = (offer: string) => `https://wa.me/237651638889?text=${encodeURIComponent(copy(`Bonjour, je souhaite réserver une place ${offer} pour FIPP Africa le 19 décembre 2026.`, `Hello, I would like to book a ticket (${offer}) for FIPP Africa on 19 December 2026.`))}`;
const exhibitorUrl = `https://wa.me/237651638889?text=${encodeURIComponent(copy("Bonjour, notre entreprise souhaite exposer au FIPP Africa le 19 décembre 2026. Nom de l’entreprise : [nom]. Activité : [activité]. Besoin en espace : [précisez].", "Hello, our company would like to exhibit at FIPP Africa on 19 December 2026. Company name: [name]. Business activity: [activity]. Space requirements: [please specify]."))}`;
  useEffect(() => { document.title = fr ? "FIPP Africa · Forum international des professionnels du pressing" : "FIPP Africa · International Forum for Laundry Professionals"; }, [fr]);
  return <div className="min-h-screen bg-[#fffaf0] text-[#082550]">
    <header className="border-b border-[#cba52a]/25 bg-white"><nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4" aria-label={copy("Navigation FIPP Africa", "FIPP Africa navigation")}><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft className="h-4 w-4" />XpressGroup</Link><a href="#programme" className="text-sm font-bold hover:text-[#ad831c]">Programme</a><button type="button" onClick={() => void i18n.changeLanguage(fr ? "en" : "fr")} aria-label={fr ? "Switch to English" : "Passer en français"} className="min-h-11 min-w-11 rounded-lg border border-[#082550]/20 px-3 text-sm font-bold">{fr ? "EN" : "FR"}</button></nav></header>
    <main>
      <section className="relative overflow-hidden px-4 py-16 sm:py-24">
        <div className="pointer-events-none absolute -left-24 top-4 h-72 w-72 rotate-45 border-[30px] border-[#cba52a]/10" />
        <div className="relative mx-auto max-w-4xl">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.25em] text-[#a57d1b]">{copy("2ᵉ édition · Une initiative de XpressGroup", "2nd edition · An initiative by XpressGroup")}</p>
            <h1 className="mt-5 font-serif text-5xl font-bold leading-tight tracking-tight sm:text-7xl">FIPP <span className="text-[#cba52a]">AFRICA</span></h1>
            <p className="mt-3 max-w-2xl text-sm font-bold uppercase tracking-[.12em] sm:text-base">{copy("Forum international des professionnels du pressing", "International Forum for Laundry Professionals")}</p>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">{copy("Moderniser et développer les entreprises de pressing en Afrique grâce à l’innovation, au digital et à la professionnalisation.", "Modernise and grow laundry businesses across Africa through innovation, digital tools and professional development.")}</p>
            <div className="mt-7 flex flex-wrap gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-[#cba52a]/50 bg-white px-5 py-3 font-bold"><CalendarDays className="h-5 w-5 text-[#a57d1b]" />{copy("19 décembre 2026 · 08h provisoire", "19 December 2026 · 08:00 provisional")}</span><span className="inline-flex items-center gap-2 rounded-full border border-[#cba52a]/50 bg-white px-5 py-3 font-bold"><MapPin className="h-5 w-5 text-[#a57d1b]" />{copy("Lieu bientôt annoncé", "Venue to be announced")}</span></div>
            <div className="mt-8"><FippCountdown translucent language={i18n.language} /></div>
            <div className="mt-7 flex flex-wrap gap-3"><a href="#billets" className="inline-flex min-h-12 items-center rounded-full bg-[#cba52a] px-6 py-3 font-bold text-[#082550] hover:bg-[#e2bd48]">{copy("Voir les offres et s’inscrire", "View tickets and register")}</a><a href="#programme" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#082550] px-6 py-3 font-bold">{copy("Voir le programme ", "View the programme ")}<ArrowRight className="h-4 w-4" /></a></div>
          </div>
        </div>
      </section>
      <section className="bg-[#082550] px-4 py-14 text-center text-white"><div className="mx-auto max-w-4xl"><p className="text-xs font-bold uppercase tracking-[.24em] text-[#e5c566]">{copy("Notre rendez-vous", "The event")}</p><h2 className="mt-4 font-serif text-3xl font-bold sm:text-4xl">{copy("Une matinée de conférences, démonstrations et rencontres", "A morning of talks, demonstrations and connections")}</h2><p className="mt-4 leading-7 text-blue-100">{copy("Des échanges concrets pour moderniser, digitaliser, développer et professionnaliser le pressing africain.", "Practical discussions to modernise, digitalise and grow the African laundry industry.")}</p></div></section>
      <section id="billets" className="px-4 py-20" aria-labelledby="billets-title"><div className="mx-auto max-w-5xl"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#a57d1b]">{copy("Billetterie · 2ᵉ édition", "Tickets · 2nd edition")}</p><h2 id="billets-title" className="mt-3 font-serif text-4xl font-bold">{copy("Choisissez votre expérience", "Choose your experience")}</h2><p className="mt-4 text-slate-600">{copy("Suivez l’événement en ligne ou participez sur place.", "Watch online or join us in person.")}</p></div><div className="mt-10 grid gap-6 md:grid-cols-3">{ticketOffers.map(offer => <article key={offer.name} className={`flex flex-col rounded-2xl border p-7 sm:p-9 ${offer.featured ? "border-[#cba52a] bg-[#082550] text-white shadow-xl" : "border-[#cba52a]/40 bg-white"}`}><div className="flex flex-col gap-4"><div><p className={`text-xs font-extrabold uppercase tracking-[.2em] ${offer.featured ? "text-[#e5c566]" : "text-[#a57d1b]"}`}>{offer.featured ? copy("Expérience privilégiée", "Premium experience") : offer.name === copy("En ligne", "Online") ? copy("À distance", "Online") : copy("Sur place", "In person")}</p><h3 className="mt-2 font-serif text-3xl font-bold">{offer.name}</h3></div><div className="text-left"><p className={`whitespace-nowrap text-3xl font-black tabular-nums ${offer.featured ? "text-[#e5c566]" : "text-[#082550]"}`}>{offer.price}</p><p className="text-xs font-bold uppercase tracking-wide">{copy("FCFA / personne", "FCFA / person")}</p></div></div><ul className="mt-7 flex-1 space-y-4">{offer.benefits.map(benefit => <li key={benefit} className="flex gap-3 leading-6"><span aria-hidden="true" className={`mt-1 font-bold ${offer.featured ? "text-[#e5c566]" : "text-[#a57d1b]"}`}>✓</span><span>{benefit}</span></li>)}</ul><a href={registrationUrl(offer.name)} target="_blank" rel="noopener noreferrer" className={`mt-9 inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 text-center font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${offer.featured ? "bg-[#cba52a] text-[#082550] hover:bg-[#e2bd48]" : "bg-[#082550] text-white hover:bg-[#12396d]"}`}>{offer.name === copy("En ligne", "Online") ? copy("Réserver mon accès en ligne", "Book my online access") : copy(`Réserver ma place ${offer.name}`, `Book my ${offer.name} ticket`)} {copy("sur WhatsApp", "on WhatsApp")}</a></article>)}</div><p className="mt-6 text-center text-sm text-slate-600">{copy("L’accès en ligne et les modalités de l’échange VIP seront confirmés lors de la réservation. Places VIP limitées.", "Online access and VIP discussion arrangements will be confirmed when booking. Limited VIP seats.")}</p></div></section>
      <section id="exposants" className="bg-[#082550] px-4 py-20 text-white" aria-labelledby="exposants-title">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-[#e5c566]">{copy("Entreprises & partenaires", "Businesses & partners")}</p>
            <h2 id="exposants-title" className="mt-4 font-serif text-4xl font-bold leading-tight">{copy("Exposez vos solutions au FIPP Africa", "Showcase your solutions at FIPP Africa")}</h2>
            <p className="mt-5 max-w-2xl leading-7 text-blue-100">{copy("Présentez vos équipements, produits, services ou outils numériques aux professionnels du pressing réunis pour cette 2ᵉ édition.", "Present your equipment, products, services or digital tools to laundry professionals at this 2nd edition.")}</p>
            <p className="mt-4 text-sm text-blue-100">{copy("Les modalités d’exposition et le lieu seront communiqués directement aux entreprises intéressées.", "Exhibition arrangements and the venue will be shared directly with interested companies.")}</p>
          </div>
          <div className="rounded-2xl border border-[#cba52a]/60 bg-white/5 p-7">
            <p className="font-serif text-2xl font-bold text-[#e5c566]">{copy("Votre entreprise a sa place ici.", "Your business belongs here.")}</p>
            <p className="mt-3 text-sm leading-6 text-blue-100">{copy("Contactez-nous en indiquant le nom de votre entreprise, votre activité et le type d’espace souhaité.", "Contact us with your company name, business activity and the type of space you need.")}</p>
            <a href={exhibitorUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#cba52a] px-5 py-3 text-center font-bold text-[#082550] hover:bg-[#e2bd48] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{copy("Devenir exposant sur WhatsApp", "Enquire about exhibiting on WhatsApp")}</a>
          </div>
        </div>
      </section>
      <section id="programme" className="scroll-mt-12 px-4 py-20"><div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#a57d1b]">{copy("19 décembre 2026", "19 December 2026")}</p><h2 className="mt-3 font-serif text-4xl font-bold">{copy("Programme provisoire", "Provisional programme")}</h2></div><p className="text-sm text-slate-600">{copy("Horaires et intervenants susceptibles d’évoluer", "Times and speakers may change")}</p></div><div className="mt-10 divide-y divide-[#cba52a]/30 border-y border-[#cba52a]/30">{schedule.map(item => <article key={item.time} className="grid gap-3 py-5 sm:grid-cols-[150px_1fr]"><time className="font-bold text-[#a57d1b]">{item.time}</time><div><h3 className="text-lg font-bold">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.detail}</p></div></article>)}</div></div></section>
      <section className="bg-[#f1ead9] px-4 py-16 text-center"><div className="mx-auto max-w-3xl"><h2 className="font-serif text-3xl font-bold">{copy("Rejoignez la 2ᵉ édition", "Join the 2nd edition")}</h2><p className="mt-4 leading-7 text-slate-700">{copy("Le lieu sera annoncé prochainement. Les préinscriptions sont ouvertes par WhatsApp.", "The venue will be announced soon. Pre-registration is open via WhatsApp.")}</p><a href="#billets" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#082550] px-6 py-3 font-bold text-white">{copy("Choisir mon offre", "Choose my ticket")}</a><p className="mt-5 text-sm font-bold uppercase tracking-widest text-[#a57d1b]">{copy("Excellence · Innovation · Collaboration · Impact", "Excellence · Innovation · Collaboration · Impact")}</p></div></section>
    </main><footer className="bg-[#082550] px-4 py-8 text-center text-sm text-blue-100">{copy("FIPP Africa · Une initiative de XpressGroup · 2026", "FIPP Africa · An initiative by XpressGroup · 2026")}</footer>
  </div>;
}
