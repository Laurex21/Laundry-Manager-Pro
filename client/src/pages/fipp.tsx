import { useEffect, useState } from "react";
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
function daysUntilEvent() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
  const today = Date.UTC(value("year"), value("month") - 1, value("day"));
  return Math.round((Date.UTC(2026, 11, 19) - today) / 86_400_000);
}
export default function FippPage() {
  const [days, setDays] = useState(daysUntilEvent);
  useEffect(() => {
    document.title = "FIPP Africa · Forum international des professionnels du pressing";
    const interval = window.setInterval(() => setDays(daysUntilEvent()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  return <div className="min-h-screen bg-[#fffaf0] text-[#082550]">
    <header className="border-b border-[#cba52a]/25 bg-white"><nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4" aria-label="Navigation FIPP Africa"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft className="h-4 w-4" />XpressGroup</Link><a href="#programme" className="text-sm font-bold hover:text-[#ad831c]">Programme</a></nav></header>
    <main>
      <section className="relative overflow-hidden px-4 py-16 sm:py-24"><div className="pointer-events-none absolute -left-24 top-4 h-72 w-72 rotate-45 border-[30px] border-[#cba52a]/10" /><div className="pointer-events-none absolute -right-24 top-12 h-80 w-80 rotate-45 border-[35px] border-[#082550]/10" /><div className="relative mx-auto max-w-5xl text-center"><img src="/fipp/fipp-mark.svg" alt="Emblème FIPP Africa" className="mx-auto h-20 w-20" /><p className="mt-5 text-xs font-extrabold uppercase tracking-[.3em] text-[#a57d1b]">2ᵉ édition · Une initiative de XpressGroup</p><h1 className="mt-5 font-serif text-5xl font-bold leading-tight tracking-tight sm:text-7xl">FIPP <span className="text-[#cba52a]">AFRICA</span></h1><p className="mx-auto mt-4 max-w-2xl text-sm font-bold uppercase tracking-[.14em] sm:text-base">Forum international des professionnels du pressing</p><p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-700">Moderniser et développer les entreprises de pressing en Afrique grâce à l’innovation, au digital et à la professionnalisation.</p><div className="mx-auto mt-10 flex max-w-xl flex-wrap items-center justify-center gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-[#cba52a]/50 bg-white px-5 py-3 font-bold"><CalendarDays className="h-5 w-5 text-[#a57d1b]" />19 décembre 2026</span><span className="inline-flex items-center gap-2 rounded-full border border-[#cba52a]/50 bg-white px-5 py-3 font-bold"><MapPin className="h-5 w-5 text-[#a57d1b]" />Lieu bientôt annoncé</span></div><div className="mx-auto mt-10 max-w-md rounded-2xl bg-[#082550] p-7 text-white shadow-xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#e5c566]">Compte à rebours</p><p className="mt-2 text-5xl font-black text-[#e5c566]">{days > 0 ? `J–${days}` : days === 0 ? "Aujourd’hui" : "Édition terminée"}</p><p className="mt-2 text-sm text-blue-100">{days > 0 ? "avant la rencontre des professionnels du pressing" : days === 0 ? "Bienvenue à la rencontre" : "Rendez-vous pour la prochaine édition"}</p></div><a href="#programme" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#cba52a] px-6 py-3 font-bold text-[#082550] hover:bg-[#e2bd48]">Voir le programme <ArrowRight className="h-4 w-4" /></a></div></section>
      <section className="bg-[#082550] px-4 py-14 text-center text-white"><div className="mx-auto max-w-4xl"><p className="text-xs font-bold uppercase tracking-[.24em] text-[#e5c566]">Notre rendez-vous</p><h2 className="mt-4 font-serif text-3xl font-bold sm:text-4xl">Une matinée de conférences, démonstrations et rencontres</h2><p className="mt-4 leading-7 text-blue-100">Des échanges concrets pour moderniser, digitaliser, développer et professionnaliser le pressing africain.</p></div></section>
      <section id="programme" className="scroll-mt-12 px-4 py-20"><div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#a57d1b]">19 décembre 2026</p><h2 className="mt-3 font-serif text-4xl font-bold">Programme provisoire</h2></div><p className="text-sm text-slate-600">Horaires et intervenants susceptibles d’évoluer</p></div><div className="mt-10 divide-y divide-[#cba52a]/30 border-y border-[#cba52a]/30">{schedule.map(item => <article key={item.time} className="grid gap-3 py-5 sm:grid-cols-[150px_1fr]"><time className="font-bold text-[#a57d1b]">{item.time}</time><div><h3 className="text-lg font-bold">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.detail}</p></div></article>)}</div></div></section>
      <section className="bg-[#f1ead9] px-4 py-16 text-center"><div className="mx-auto max-w-3xl"><h2 className="font-serif text-3xl font-bold">Rejoignez la 2ᵉ édition</h2><p className="mt-4 leading-7 text-slate-700">Le lieu et les modalités d’inscription seront annoncés prochainement.</p><p className="mt-5 text-sm font-bold uppercase tracking-widest text-[#a57d1b]">Excellence · Innovation · Collaboration · Impact</p></div></section>
    </main><footer className="bg-[#082550] px-4 py-8 text-center text-sm text-blue-100">FIPP Africa · Une initiative de XpressGroup · 2026</footer>
  </div>;
}
