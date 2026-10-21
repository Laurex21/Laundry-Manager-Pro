import { ArrowRight } from "lucide-react";

type Copy = {
  eyebrow: string; first: string; second: string; subtitle: string; explore: string; approach: string;
  branches: { category: string; name: string; description: string; action: string; image: string; alt: string; href: string; tone: string; accent: string }[];
  methodEyebrow: string; methodTitle: string; methodBody: string;
};

const french: Copy = {
  eyebrow: "Un groupe · trois métiers complémentaires", first: "Former. Gérer. Servir.", second: "Faire avancer le pressing.",
  subtitle: "Vous gérez un pressing, souhaitez vous former ou cherchez un service pour votre linge ? Choisissez le parcours qui correspond à votre besoin.",
  explore: "Explorer les 3 activités", approach: "Découvrir XpressPro",
  branches: [
    { category: "Logiciel de gestion", name: "XpressPro", description: "Commandes, clients, paiements et activité de votre pressing dans une même plateforme.", action: "Gérer mon pressing", image: "/xpressgroup/pro.webp", alt: "Responsable suivant l’activité d’un pressing", href: "/xpresspro", tone: "bg-[#edf3ff]", accent: "text-[#145dda]" },
    { category: "Conseil & formation", name: "Xpress Consulting", description: "Se former, lancer son pressing et structurer l’exploitation avec un accompagnement concret.", action: "Me former et développer mon activité", image: "/xpressgroup/consulting.webp", alt: "Formation pratique en blanchisserie", href: "/xpress-consulting", tone: "bg-[#fff6e8]", accent: "text-[#9b621b]" },
    { category: "Pressing & blanchisserie", name: "Xpress Clean", description: "Un service de soin du linge pour les particuliers et les professionnels à Douala.", action: "Faire entretenir mon linge", image: "/xpressgroup/clean.webp", alt: "Accueil d’une cliente dans un pressing", href: "/xpress-clean", tone: "bg-[#e8f8fa]", accent: "text-[#008da8]" },
  ],
  methodEyebrow: "Notre logique", methodTitle: "Du terrain à la technologie. Et toujours dans cet ordre.",
  methodBody: "Xpress Clean vit la réalité des opérations. Xpress Consulting transmet les méthodes. XpressPro aide à les suivre au quotidien. Chaque branche a sa mission ; ensemble, elles forment un écosystème cohérent.",
};

const english: Copy = {
  eyebrow: "One group · three complementary businesses", first: "Train. Manage. Serve.", second: "Move laundry forward.",
  subtitle: "Do you run a laundry business, want professional training or need your laundry cared for? Choose the path that matches your needs.",
  explore: "Explore the 3 businesses", approach: "Discover XpressPro",
  branches: [
    { category: "Management software", name: "XpressPro", description: "Orders, customers, payments and operations in one platform for your laundry business.", action: "Manage my laundry business", image: "/xpressgroup/pro.webp", alt: "Manager overseeing laundry operations", href: "/xpresspro", tone: "bg-[#edf3ff]", accent: "text-[#145dda]" },
    { category: "Consulting & training", name: "Xpress Consulting", description: "Learn the trade, launch your laundry and organise operations with practical support.", action: "Get training and grow my business", image: "/xpressgroup/consulting.webp", alt: "Practical laundry training", href: "/xpress-consulting", tone: "bg-[#fff6e8]", accent: "text-[#9b621b]" },
    { category: "Laundry services", name: "Xpress Clean", description: "Professional garment care for households and businesses in Douala.", action: "Have my laundry cared for", image: "/xpressgroup/clean.webp", alt: "Customer welcomed at a laundry", href: "/xpress-clean", tone: "bg-[#e8f8fa]", accent: "text-[#008da8]" },
  ],
  methodEyebrow: "Our approach", methodTitle: "From real operations to technology. In that order.",
  methodBody: "Xpress Clean experiences daily operations. Xpress Consulting teaches the methods. XpressPro helps teams track them. Each business has a clear job; together they form one connected ecosystem.",
};

export default function XpressGroupGateway({ language }: { language: string }) {
  const copy = language.startsWith("fr") ? french : english;
  return <>
    <section id="branches" className="scroll-mt-20 bg-[#fafaf5] bg-[linear-gradient(#dfe8e84d_1px,transparent_1px),linear-gradient(90deg,#dfe8e84d_1px,transparent_1px)] bg-[size:60px_60px] pb-20 pt-16 text-[#0D1B4B]">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">{copy.eyebrow}</p>
          <h1 className="mt-6 text-4xl font-black leading-[1.06] tracking-[-.055em] sm:text-6xl lg:text-7xl"><span className="text-blue-600">{copy.first}</span><br />{copy.second}</h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{copy.subtitle}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            {copy.branches.map(branch => <a key={branch.href} href={branch.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-blue-600 bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50">{branch.action}<ArrowRight className="h-4 w-4 shrink-0" /></a>)}
          </div>
        </div>
        <div id="branch-cards" className="mt-16 grid scroll-mt-24 gap-5 md:grid-cols-3">
          {copy.branches.map((branch) => <article key={branch.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_36px_rgba(13,27,75,.08)]">
            <img src={branch.image} alt={branch.alt} width="640" height="420" className="h-48 w-full object-cover" loading="lazy" />
            <div className={`flex min-h-[220px] flex-col p-6 ${branch.tone}`}>
              <p className={`text-[11px] font-extrabold uppercase tracking-[.17em] ${branch.accent}`}>{branch.category}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">{branch.name}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-700">{branch.description}</p>
              <a href={branch.href} className={`mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold ${branch.accent}`}>{branch.action}<ArrowRight className="h-4 w-4" /></a>
            </div>
          </article>)}
        </div>
      </div>
    </section>
    <section id="group-approach" className="scroll-mt-20 border-y border-slate-200 bg-[#f5f4ef] py-14 text-[#0D1B4B]"><div className="mx-auto grid max-w-7xl items-center gap-8 px-4 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-slate-600">{copy.methodEyebrow}</p><h2 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl">{copy.methodTitle}</h2></div><div><p className="max-w-2xl leading-7 text-slate-700">{copy.methodBody}</p><div className="mt-5 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[#e7efff] px-3 py-2 text-[#145dda]">XpressPro</span><span className="rounded-full bg-[#fff0d9] px-3 py-2 text-[#9b621b]">Xpress Consulting</span><span className="rounded-full bg-[#def4f6] px-3 py-2 text-[#008da8]">Xpress Clean</span></div></div></div></section>
  </>;
}
