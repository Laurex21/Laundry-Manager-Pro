import { ArrowRight } from "lucide-react";

type Copy = {
  eyebrow: string; first: string; second: string; subtitle: string; explore: string; approach: string;
  branches: { category: string; name: string; description: string; action: string; image: string; alt: string; href: string; tone: string; accent: string }[];
  methodEyebrow: string; methodTitle: string; methodBody: string;
  consultingEyebrow: string; consultingTitle: string; consultingBody: string; consultingAction: string;
  cleanEyebrow: string; cleanTitle: string; cleanBody: string; cleanAction: string;
};

const french: Copy = {
  eyebrow: "Un groupe · trois métiers complémentaires", first: "Former. Gérer. Servir.", second: "Faire avancer le pressing.",
  subtitle: "XpressGroup relie l’expertise terrain, les services de blanchisserie et les outils numériques pour faire progresser l’entretien textile en Afrique.",
  explore: "Explorer nos branches", approach: "Notre approche",
  branches: [
    { category: "Logiciel de gestion", name: "XpressPro", description: "Commandes, clients, paiements et activité de votre pressing dans une même plateforme.", action: "Découvrir la plateforme", image: "/xpressgroup/pro.webp", alt: "Responsable suivant l’activité d’un pressing", href: "#features", tone: "bg-[#edf3ff]", accent: "text-[#145dda]" },
    { category: "Conseil & formation", name: "Xpress Consulting", description: "Se former, lancer son pressing et structurer l’exploitation avec un accompagnement concret.", action: "Voir l’accompagnement", image: "/xpressgroup/consulting.webp", alt: "Formation pratique en blanchisserie", href: "#consulting", tone: "bg-[#fff6e8]", accent: "text-[#9b621b]" },
    { category: "Pressing & blanchisserie", name: "Xpress Clean", description: "Un service de soin du linge pour les particuliers et les professionnels à Douala.", action: "Voir les services", image: "/xpressgroup/clean.webp", alt: "Accueil d’une cliente dans un pressing", href: "#clean", tone: "bg-[#e8f8fa]", accent: "text-[#008da8]" },
  ],
  methodEyebrow: "Notre logique", methodTitle: "Du terrain à la technologie. Et toujours dans cet ordre.",
  methodBody: "Xpress Clean vit la réalité des opérations. Xpress Consulting transmet les méthodes. XpressPro aide à les suivre au quotidien. Chaque branche a sa mission ; ensemble, elles forment un écosystème cohérent.",
  consultingEyebrow: "Xpress Consulting · Conseil & formation", consultingTitle: "Apprendre le métier. Structurer l’entreprise.",
  consultingBody: "Consultation, plan de lancement, formation et accompagnement : des réponses adaptées au niveau de votre projet.", consultingAction: "Parler de mon projet",
  cleanEyebrow: "Xpress Clean · Pressing & blanchisserie", cleanTitle: "Un pressing qui simplifie le quotidien.",
  cleanBody: "Vêtements, linge de maison, lavage au kilo et formules mensuelles : découvrez nos services à Douala.", cleanAction: "Demander nos services et tarifs",
};

const english: Copy = {
  eyebrow: "One group · three complementary businesses", first: "Train. Manage. Serve.", second: "Move laundry forward.",
  subtitle: "XpressGroup connects hands-on expertise, laundry services and digital tools to advance textile care across Africa.",
  explore: "Explore our businesses", approach: "Our approach",
  branches: [
    { category: "Management software", name: "XpressPro", description: "Orders, customers, payments and operations in one platform for your laundry business.", action: "Explore the platform", image: "/xpressgroup/pro.webp", alt: "Manager overseeing laundry operations", href: "#features", tone: "bg-[#edf3ff]", accent: "text-[#145dda]" },
    { category: "Consulting & training", name: "Xpress Consulting", description: "Learn the trade, launch your laundry and organise operations with practical support.", action: "Explore consulting", image: "/xpressgroup/consulting.webp", alt: "Practical laundry training", href: "#consulting", tone: "bg-[#fff6e8]", accent: "text-[#9b621b]" },
    { category: "Laundry services", name: "Xpress Clean", description: "Professional garment care for households and businesses in Douala.", action: "Explore services", image: "/xpressgroup/clean.webp", alt: "Customer welcomed at a laundry", href: "#clean", tone: "bg-[#e8f8fa]", accent: "text-[#008da8]" },
  ],
  methodEyebrow: "Our approach", methodTitle: "From real operations to technology. In that order.",
  methodBody: "Xpress Clean experiences daily operations. Xpress Consulting teaches the methods. XpressPro helps teams track them. Each business has a clear job; together they form one connected ecosystem.",
  consultingEyebrow: "Xpress Consulting · Consulting & training", consultingTitle: "Learn the trade. Build the business.",
  consultingBody: "Consultations, launch planning, training and support tailored to the stage of your project.", consultingAction: "Discuss my project",
  cleanEyebrow: "Xpress Clean · Laundry services", cleanTitle: "Laundry that makes everyday life easier.",
  cleanBody: "Clothing, household linen, wash-by-weight and monthly plans: explore our services in Douala.", cleanAction: "Ask about services and prices",
};

const whatsapp = (number: string, message: string) => `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

export default function XpressGroupGateway({ language }: { language: string }) {
  const copy = language.startsWith("fr") ? french : english;
  const consultingHref = whatsapp("237651638889", language.startsWith("fr") ? "Bonjour, je souhaite en savoir plus sur Xpress Consulting." : "Hello, I would like to learn more about Xpress Consulting.");
  const cleanHref = whatsapp("237655615806", language.startsWith("fr") ? "Bonjour, je souhaite connaître les services et tarifs Xpress Clean." : "Hello, I would like to know the Xpress Clean services and prices.");
  return <>
    <section id="branches" className="scroll-mt-20 bg-[#fafaf5] bg-[linear-gradient(#dfe8e84d_1px,transparent_1px),linear-gradient(90deg,#dfe8e84d_1px,transparent_1px)] bg-[size:60px_60px] pb-20 pt-32 text-[#0D1B4B]">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">{copy.eyebrow}</p>
          <h1 className="mt-6 text-4xl font-black leading-[1.06] tracking-[-.055em] sm:text-6xl lg:text-7xl"><span className="text-blue-600">{copy.first}</span><br />{copy.second}</h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{copy.subtitle}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#branch-cards" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">{copy.explore}<ArrowRight className="h-4 w-4" /></a>
            <a href="#group-approach" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#0D1B4B] px-6 py-3 font-bold hover:bg-white">{copy.approach}</a>
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
    <section id="group-approach" className="scroll-mt-20 bg-[#0D1B4B] py-20 text-white"><div className="mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-2 lg:gap-20"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{copy.methodEyebrow}</p><h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl">{copy.methodTitle}</h2><p className="mt-6 max-w-xl leading-8 text-blue-100">{copy.methodBody}</p></div><img src="/xpressgroup/field.webp" alt={language.startsWith("fr") ? "Conseil opérationnel dans un pressing" : "Operational advice in a laundry"} width="640" height="420" loading="lazy" className="h-72 w-full rounded-2xl object-cover sm:h-96" /></div></section>
    <section id="consulting" className="scroll-mt-20 bg-[#fffaf2] py-20"><div className="mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-2 lg:gap-20"><img src="/xpressgroup/consulting.webp" alt={language.startsWith("fr") ? "Formation pratique dans un pressing" : "Practical laundry training"} width="640" height="420" loading="lazy" className="h-72 w-full rounded-2xl object-cover sm:h-96" /><div><p className="text-xs font-bold uppercase tracking-[.2em] text-amber-700">{copy.consultingEyebrow}</p><h2 className="mt-4 text-3xl font-black tracking-tight text-[#0D1B4B] sm:text-5xl">{copy.consultingTitle}</h2><p className="mt-5 leading-8 text-slate-700">{copy.consultingBody}</p><a href={consultingHref} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center rounded-full border border-[#0D1B4B] px-6 py-3 font-bold text-[#0D1B4B] hover:bg-white">{copy.consultingAction}</a></div></div></section>
    <section id="clean" className="scroll-mt-20 bg-[#eaf8fa] py-20"><div className="mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-2 lg:gap-20"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-800">{copy.cleanEyebrow}</p><h2 className="mt-4 text-3xl font-black tracking-tight text-[#0D1B4B] sm:text-5xl">{copy.cleanTitle}</h2><p className="mt-5 leading-8 text-slate-700">{copy.cleanBody}</p><a href={cleanHref} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#0D1B4B] px-6 py-3 font-bold text-white hover:bg-[#18356b]">{copy.cleanAction}</a></div><img src="/xpressgroup/clean.webp" alt={language.startsWith("fr") ? "Accueil d’une cliente chez Xpress Clean" : "Customer welcomed at Xpress Clean"} width="640" height="420" loading="lazy" className="h-72 w-full rounded-2xl object-cover sm:h-96" /></div></section>
  </>;
}
