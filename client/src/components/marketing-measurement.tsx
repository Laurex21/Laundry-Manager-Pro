import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { marketingPage, marketingHostAllowed, pixelSafeSearch } from "@shared/marketing";
import { marketingConsent, saveMarketingConsent, setMarketingScope, trackMarketingEvent, trackMarketingPage } from "@/lib/marketing";

export default function MarketingMeasurement() {
  const [path] = useLocation();
  const search = useSearch();
  const { user, isLoading } = useAuth();
  const { i18n } = useTranslation();
  const [consent, setConsent] = useState(marketingConsent);
  const [open, setOpen] = useState(consent === null);
  const publicPage = marketingHostAllowed(window.location.hostname) && !isLoading && !user && marketingPage(path, search) !== null;
  const language = i18n.language.startsWith("fr") ? "fr" : i18n.language.startsWith("pt") ? "pt" : "en";
  const copy = {
    fr: { title: "Mesure des visites", body: "Avec votre accord, nous utilisons TikTok et notre outil de mesure pour comprendre les visites, contacts et inscriptions. Ce choix est facultatif et modifiable ici.", accept: "Accepter", reject: "Refuser", settings: "Choix de mesure", privacy: "Confidentialité" },
    en: { title: "Visit measurement", body: "With your permission, we use TikTok and our analytics tool to understand visits, contacts and registrations. This is optional and you can change your choice here.", accept: "Accept", reject: "Decline", settings: "Measurement choices", privacy: "Privacy" },
    pt: { title: "Medição de visitas", body: "Com a sua autorização, usamos o TikTok e a nossa ferramenta de análise para compreender visitas, contactos e registos. É opcional e pode alterar a sua escolha aqui.", accept: "Aceitar", reject: "Recusar", settings: "Opções de medição", privacy: "Privacidade" },
  }[language];

  useEffect(() => {
    setMarketingScope(publicPage && pixelSafeSearch(search));
    if (publicPage && consent === "accepted") trackMarketingPage();
  }, [publicPage, path, search, consent]);

  useEffect(() => {
    if (!publicPage) return;
    function click(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!target) return;
      try {
        const url = new URL(target.href);
        if (url.hostname === "wa.me" || url.hostname === "api.whatsapp.com") trackMarketingEvent("whatsapp_clicked");
        else if (url.origin === window.location.origin && url.pathname === "/auth" && url.searchParams.get("tab") === "register") trackMarketingEvent("signup_started");
      } catch { /* Ignore non-web links. */ }
    }
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [publicPage]);

  function choose(value: "accepted" | "rejected") {
    saveMarketingConsent(value);
    setConsent(value);
    setOpen(false);
  }

  if (!publicPage) return null;
  return <>
    <button type="button" className="fixed bottom-2 left-2 z-40 rounded-md border bg-background px-3 py-2 text-xs shadow-sm" onClick={() => setOpen(true)}>{copy.settings}</button>
    {open && <section aria-label={copy.title} className="fixed inset-x-3 bottom-14 z-50 mx-auto max-w-xl rounded-xl border bg-background p-5 text-foreground shadow-xl" data-testid="marketing-consent">
      <h2 className="font-semibold">{copy.title}</h2>
      <p className="mt-2 text-sm leading-6">{copy.body} <a className="underline" href="/privacy" target="_blank" rel="noopener noreferrer">{copy.privacy}</a></p>
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={() => choose("accepted")} className="min-h-11 flex-1 rounded-md border px-4 py-2 font-medium">{copy.accept}</button>
        <button type="button" onClick={() => choose("rejected")} className="min-h-11 flex-1 rounded-md border px-4 py-2 font-medium">{copy.reject}</button>
      </div>
    </section>}
  </>;
}
