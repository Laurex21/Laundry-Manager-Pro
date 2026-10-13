import { useEffect, useState } from "react";

// 19 December 2026, 08:00 in Cameroon (Africa/Douala, UTC+1).
const EVENT_START = Date.parse("2026-12-19T08:00:00+01:00");
const remaining = () => Math.max(0, Math.floor((EVENT_START - Date.now()) / 1000));
const twoDigits = (value: number) => String(value).padStart(2, "0");

export default function FippCountdown({ compact = false, translucent = false }: { compact?: boolean; translucent?: boolean }) {
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds(remaining()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const parts = [
    { label: "Jours", value: Math.floor(seconds / 86400) },
    { label: "Heures", value: Math.floor((seconds % 86400) / 3600) },
    { label: "Minutes", value: Math.floor((seconds % 3600) / 60) },
    { label: "Secondes", value: seconds % 60 },
  ];
  return <div className={`rounded-3xl border border-[#d9b540]/40 ${translucent ? "bg-[#082550]/85" : "bg-[#082550]"} text-white shadow-[0_20px_55px_rgba(8,37,80,.2)] ${compact ? "p-5 sm:p-7" : "p-6 sm:p-9"}`} role="timer" aria-label={seconds ? `Temps restant : ${parts.map(part => `${part.value} ${part.label.toLowerCase()}`).join(", ")}` : "La rencontre a commencé"}>
    <p className="text-center text-xs font-bold uppercase tracking-[.24em] text-[#e5c566]">{seconds ? "Compte à rebours · 19 décembre 2026" : "FIPP Africa · 19 décembre 2026"}</p>
    {seconds ? <><div className="mt-5 grid grid-cols-4 gap-1.5 sm:gap-3">{parts.map(part => <div key={part.label} className="rounded-xl border border-white/15 bg-white/[.06] px-1 py-3 text-center sm:py-5"><span className={`block font-black tabular-nums leading-none text-[#e5c566] ${compact ? "text-3xl sm:text-5xl" : "text-4xl sm:text-6xl lg:text-7xl"}`}>{part.label === "Jours" ? part.value : twoDigits(part.value)}</span><span className="mt-2 block text-[10px] font-semibold uppercase tracking-[.1em] text-blue-100 sm:text-xs">{part.label}</span></div>)}</div><p className="mt-4 text-center text-xs text-blue-100">Début visé : 08h, heure de Douala · horaire provisoire</p></> : <p className="mt-5 text-center font-serif text-2xl font-bold text-[#e5c566]">La rencontre a commencé</p>}
  </div>;
}
