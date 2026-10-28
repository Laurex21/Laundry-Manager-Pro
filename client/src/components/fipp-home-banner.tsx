import FippCountdown, { FippDayBadge } from "./fipp-countdown";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import "./fipp-home-banner.css";

const COPY = {
  fr: {
    label: "Forum international des professionnels du pressing", illustration: "Visuel d’illustration",
    title: "Faites passer votre pressing", accent: "au niveau supérieur.",
    description: "Nouvelles idées, outils numériques et rencontres : préparez la prochaine étape de votre activité avec FIPP Africa.",
    action: "Je découvre FIPP Africa", compactAction: "Découvrir le programme", benefit: "Des idées, des outils et des rencontres pour développer votre pressing.", date: "19 décembre 2026", month: "DÉCEMBRE", edition: "2ᵉ ÉDITION",
    topics: ["INNOVATION", "RENTABILITÉ", "RENCONTRES"], note: "Programme et modalités de participation", visual: "L’avenir du pressing se construit ensemble.",
  },
  en: {
    label: "International Forum for Laundry Professionals", illustration: "Illustrative image",
    title: "Take your laundry business", accent: "to the next level.",
    description: "Fresh ideas, digital tools and new connections: prepare your next business move with FIPP Africa.",
    action: "Explore FIPP Africa", compactAction: "Explore the programme", benefit: "Ideas, tools and connections to grow your laundry business.", date: "19 December 2026", month: "DECEMBER", edition: "2ND EDITION",
    topics: ["INNOVATION", "PROFITABILITY", "CONNECTIONS"], note: "Programme and participation details", visual: "Shaping the future of laundry. Together.",
  },
};

export default function FippHomeBanner({ language, compact = false }: { language: string; compact?: boolean }) {
  const text = COPY[language.startsWith("fr") ? "fr" : "en"];
  if (compact) return <aside className="fipp-compact" aria-label="FIPP Africa" data-testid="fipp-home-banner">
    <div className="fipp-compact__inner">
      <div className="fipp-compact__copy">
        <p className="fipp-compact__eyebrow"><strong>FIPP AFRICA</strong><span>· {text.edition}</span></p>
        <p className="fipp-compact__name">{text.label}</p>
        <p className="fipp-compact__benefit">{text.benefit}</p>
      </div>
      <div className="fipp-compact__action">
        <div className="fipp-compact__date"><time dateTime="2026-12-19">{text.date}</time><FippDayBadge language={language} /></div>
        <Link href="/rencontre#programme" className="fipp-compact__button">{text.compactAction}<ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
    </div>
  </aside>;
  return <aside className="fipp-promo" aria-labelledby="fipp-promo-title" data-testid="fipp-home-banner">
    <img className="fipp-promo__background" src="/images/fipp-professionals-2026.webp" alt="" aria-hidden="true" width="1536" height="1024" fetchPriority="high" />
    <div className="fipp-promo__inner">
      <div className="fipp-promo__copy">
        <p className="fipp-promo__eyebrow"><span className="fipp-promo__brand">FIPP AFRICA</span><span className="fipp-promo__edition">{text.edition}</span></p>
        <p className="fipp-promo__label">{text.label}</p>
        <h2 id="fipp-promo-title">{text.title}<br /><span>{text.accent}</span></h2>
        <p className="fipp-promo__description">{text.description}</p>
        <div className="fipp-promo__actions"><Link href="/rencontre" className="fipp-promo__button">{text.action}<ArrowRight size={20} aria-hidden="true" /></Link><p className="fipp-promo__note">{text.note}</p></div>
      </div>
      <div className="fipp-promo__poster">
        <div className="fipp-promo__poster-top"><span>FIPP<span className="fipp-promo__africa">AFRICA</span></span><Sparkles size={24} aria-hidden="true" /></div>
        <div className="fipp-promo__date"><time dateTime="2026-12-19" aria-label={text.date}><strong>19</strong><span>{text.month}<b>2026</b></span></time></div>
        <div className="fipp-promo__countdown"><FippCountdown compact language={language} /></div>
        <div className="fipp-promo__topics">{text.topics.map(topic => <span key={topic}>{topic}</span>)}</div>
      </div>
    </div>
    <span className="fipp-promo__image-note">{text.illustration}</span>
  </aside>;
}
