import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getMetaConsent, hasConfiguredMetaPixel, isMetaAllowedPath, isMetaPixelLoaded, prepareMetaAuth, setMetaConsent, setMetaTrackingEligibility, trackMetaPage } from "@/lib/meta-pixel";

export default function MetaConsent() {
  const [path] = useLocation();
  const { user, isLoading } = useAuth();
  const [consent, setConsent] = useState(getMetaConsent);
  const [open, setOpen] = useState(false);
  const eligible = !isLoading && !user && isMetaAllowedPath(path) && hasConfiguredMetaPixel();

  useEffect(() => {
    setMetaTrackingEligibility(eligible);
    if (isLoading) return;
    // A full navigation unloads the marketing script before any private app view appears.
    if ((!isMetaAllowedPath(path) || user) && isMetaPixelLoaded()) {
      window.location.replace(window.location.pathname + window.location.search);
      return;
    }
    if (eligible && consent === "accepted") {
      if (path === "/auth") prepareMetaAuth();
      else trackMetaPage(path, false);
    }
  }, [path, user, isLoading, eligible, consent]);

  if (!eligible) return null;
  const choose = (value: "accepted" | "rejected") => {
    setMetaConsent(value);
    setConsent(value);
    setOpen(false);
    if (value === "accepted") {
      if (path === "/auth") prepareMetaAuth();
      else trackMetaPage(path, false);
    }
  };
  return <>
    {consent === null || open ? <section aria-label="Préférences marketing" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
      <h2 className="text-base font-semibold">Votre choix de confidentialité</h2>
      <p className="mt-2 text-sm leading-6">Avec votre accord, nous utilisons le Pixel Meta uniquement sur nos pages publiques pour mesurer nos campagnes. Aucun suivi Meta dans votre espace de gestion. <a href="/cookies" className="underline focus-visible:outline-2">Politique des cookies</a>.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => choose("rejected")} className="min-h-11 rounded-lg border border-slate-400 px-4 font-medium focus-visible:outline-2">Refuser</button>
        <button type="button" onClick={() => choose("accepted")} className="min-h-11 rounded-lg bg-blue-800 px-4 font-medium text-white focus-visible:outline-2">Accepter</button>
      </div>
    </section> : <button type="button" onClick={() => setOpen(true)} className="fixed bottom-3 left-3 z-[100] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-md focus-visible:outline-2">Cookies marketing</button>}
  </>;
}
