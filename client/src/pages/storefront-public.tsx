import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, Minus, Plus, Shirt, ShoppingBag } from "lucide-react";
import { GARMENT_LABELS, SIZE_LABELS, type CartLine, type Garment, type SizeGroup, type StorefrontQuote } from "@shared/storefront";
import type { StorefrontService } from "../../../server/lib/storefront-service";
import { ShopHeader, brandStyle } from "@/components/storefront-branding";
import { Message, QuoteSummary, money, storefrontApi, useStorefrontAction, whatsappHref } from "@/components/storefront-ui";
import { loadCart, updateCart } from "@/lib/storefront-cart";

type Shop = Awaited<ReturnType<StorefrontService["publicShop"]>>;
const newSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");

export default function StorefrontPublic() {
  const slug = decodeURIComponent(location.pathname.split("/")[2] ?? ""), base = `/api/public/shops/${encodeURIComponent(slug)}`;
  const cartKey = `storefront-cart:${slug}`;
  const shop = useQuery<Shop>({ queryKey: [base], queryFn: () => storefrontApi(base), staleTime: 30_000, retry: false });
  const [lines, setLines] = useState<CartLine[]>(() => loadCart(cartKey));
  const [serviceId, setServiceId] = useState(0), [size, setSize] = useState<SizeGroup>("adult");
  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [contact, setContact] = useState({ customerName: "", phone: "", note: "" });
  const [consentFingerprint, setConsentFingerprint] = useState("");
  const [receipt, setReceipt] = useState<{ reference: string; secret: string } | null>(null);
  const action = useStorefrontAction(), submitLock = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const cartSignature = JSON.stringify(lines), [debouncedCart, setDebouncedCart] = useState(cartSignature);
  useEffect(() => { const timer = setTimeout(() => setDebouncedCart(cartSignature), 350); return () => clearTimeout(timer); }, [cartSignature]);
  useEffect(() => { try { sessionStorage.setItem(cartKey, cartSignature); } catch { /* Storage is optional. */ } }, [cartKey, cartSignature]);
  useEffect(() => { if (shop.data && !serviceId) setServiceId(shop.data.services[0]?.id ?? 0); }, [shop.data, serviceId]);
  const estimate = useQuery<StorefrontQuote>({
    queryKey: [base, "quote", debouncedCart], queryFn: () => storefrontApi(`${base}/quote`, { lines: JSON.parse(debouncedCart) }),
    enabled: !!shop.data && JSON.parse(debouncedCart).length > 0, retry: false, staleTime: 0, refetchOnWindowFocus: true,
  });
  const quote = lines.length && debouncedCart === cartSignature && !estimate.isFetching && !estimate.error ? estimate.data : undefined;
  const count = lines.reduce((n, l) => n + l.count, 0);
  const change = (item: Omit<CartLine, "count">, delta: number) => { setConsentFingerprint(""); action.setError(""); setLines(v => updateCart(v, item, delta)); };
  const go = (next: typeof step) => { setStep(next); requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }); };
  const pendingSubmission = useRef<{ signature: string; requestKey: string; trackingSecret: string } | null>(null);
  const send = () => action.run(async () => {
    if (!quote || consentFingerprint !== quote.fingerprint || submitLock.current) return;
    submitLock.current = true;
    try {
      const key = `storefront-pending:${slug}`, payload = { lines, ...contact, quoteFingerprint: quote.fingerprint }, signature = JSON.stringify(payload);
      let saved = pendingSubmission.current;
      try { saved ??= JSON.parse(sessionStorage.getItem(key) || "null"); } catch { /* Fall back to the in-memory key. */ }
      if (!saved || saved.signature !== signature) saved = { signature, requestKey: crypto.randomUUID(), trackingSecret: newSecret() };
      pendingSubmission.current = saved;
      try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch { /* A retry in this page still uses the same key. */ }
      const result = await storefrontApi(`${base}/requests`, { ...payload, requestKey: saved.requestKey, trackingSecret: saved.trackingSecret });
      setReceipt({ reference: result.reference, secret: saved.trackingSecret });
      setLines([]);
    } catch (error) { setConsentFingerprint(""); void estimate.refetch(); throw error; }
    finally { submitLock.current = false; }
  });
  if (shop.isPending) return <main className="sf sf-public"><div className="sf-wrap"><Message>Ouverture de la boutique…</Message></div></main>;
  if (shop.error || !shop.data) return <main className="sf sf-public"><div className="sf-wrap"><Message error>{shop.error?.message ?? "Boutique indisponible"}</Message></div></main>;
  const data = shop.data, selectedService = data.services.find(s => s.id === serviceId);
  return <main className="sf sf-public sf-storefront" style={brandStyle(data.branding)}>
    <header className="sf-top"><a href="#boutique" className="sf-shop-name">{data.name}</a><a href={whatsappHref(data.whatsapp, `Bonjour ${data.name}, j’ai une question.`)}>Nous contacter</a></header>
    <div className="sf-wrap" id="boutique"><ShopHeader {...data} />
      {receipt ? <section className="sf-card sf-stack sf-success"><span className="sf-success-icon"><Check /></span><h2>Votre demande est enregistrée.</h2><p>Le pressing a reçu votre sélection. Référence : <strong>{receipt.reference}</strong>.</p><Message>Attendez la confirmation du dépôt avant de vous déplacer. Conservez votre lien de suivi pour accepter le devis définitif.</Message><a className="sf-button" href={`/suivi-boutique#${receipt.secret}`}>Ouvrir mon suivi</a><a href={whatsappHref(data.whatsapp, `Bonjour ${data.name}, ma demande porte la référence ${receipt.reference}.`)}>Une question ? Écrire au pressing</a></section> : <>
        <nav className="sf-steps" aria-label="Étapes de la demande"><button className="sf-secondary" aria-current={step === "choose" ? "step" : undefined} onClick={() => go("choose")}>1 <span>Mes vêtements</span></button><button className="sf-secondary" disabled={!quote} aria-current={step === "confirm" ? "step" : undefined} onClick={() => go("confirm")}>2 <span>Confirmer</span></button></nav>
        <div className="sf-order-grid"><section className="sf-stack">
          {step === "choose" ? <><div><span className="sf-eyebrow">Simple, rapide, sans compte</span><h2 ref={heading} tabIndex={-1}>Que souhaitez-vous nous confier ?</h2></div>
            <div className="sf-service-options" role="group" aria-label="Choisir un service">{data.services.map(s => <button type="button" key={s.id} className="sf-service-option" aria-pressed={serviceId === s.id} onClick={() => setServiceId(s.id)}>
              {data.branding.serviceImages[s.id] && <img src={data.branding.serviceImages[s.id]} alt="" loading="lazy" />}
              <span><strong>{s.name}</strong><small>{s.mode === "quote" ? "Sur devis" : `${money(s.price, data.currency)} / ${s.mode === "kg" ? "kg" : "pièce"}`}</small></span>
            </button>)}</div>
            {!data.services.length && <Message>Aucun service disponible actuellement.</Message>}
            {selectedService && <section className="sf-card sf-stack"><div><h3>{selectedService.name}</h3><p className="sf-muted">{selectedService.description}</p>{selectedService.mode === "kg" && Number(selectedService.minimumCharge) > 0 && <small>Minimum par lot : {money(selectedService.minimumCharge, data.currency)}</small>}</div>
              {selectedService.mode === "kg" && <div><label>Vêtements pour<select aria-label="Vêtements pour" value={size} onChange={e => setSize(e.target.value as SizeGroup)}>{Object.entries(SIZE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><small>Vous pouvez mélanger les gabarits dans votre panier. Ils servent uniquement à estimer le poids.</small></div>}
              <div className="sf-garments">{Object.entries(GARMENT_LABELS).map(([garment, label]) => {
                const item = { serviceId, garment: garment as Garment, size: selectedService.mode === "kg" ? size : "adult" as SizeGroup };
                const n = lines.find(l => l.serviceId === serviceId && l.garment === garment && l.size === item.size)?.count ?? 0;
                return <div className={`sf-garment ${n ? "sf-picked" : ""}`} key={garment}><Shirt size={22} aria-hidden="true" /><strong>{label}</strong><div className="sf-quantity"><button className="sf-secondary" aria-label={`Retirer ${label}`} disabled={!n} onClick={() => change(item, -1)}><Minus size={16} /></button><output aria-label={`Quantité ${label}`}>{n}</output><button className="sf-secondary" aria-label={`Ajouter ${label}`} disabled={n >= 100 || count >= 500 || (!n && lines.length >= 40)} onClick={() => change(item, 1)}><Plus size={16} /></button></div></div>;
              })}</div>
              {(lines.length >= 40 || count >= 500) && <Message>Maximum 40 types de vêtements et 500 pièces par demande.</Message>}
            </section>}
          </> : <section className="sf-card sf-stack"><button type="button" className="sf-secondary sf-back" onClick={() => go("choose")}><ChevronLeft size={16} />Modifier mes vêtements</button><h2 ref={heading} tabIndex={-1}>Confirmer ma demande</h2>
            <form className="sf-stack" onSubmit={e => { e.preventDefault(); void send(); }}><label>Votre nom<input autoComplete="name" required minLength={2} maxLength={120} value={contact.customerName} onChange={e => setContact({ ...contact, customerName: e.target.value })} /></label><label>Téléphone / WhatsApp<input autoComplete="tel" type="tel" placeholder="+237…" required pattern="\+[1-9][0-9]{7,14}" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value.replace(/\s/g, "") })} /></label>
              <details><summary>Ajouter une précision (facultatif)</summary><label>Précisions pour le pressing<textarea maxLength={600} value={contact.note} onChange={e => setContact({ ...contact, note: e.target.value })} /></label></details>
              <Message>Dépôt et paiement au pressing après validation. Vos coordonnées servent à traiter cette demande.</Message>
              <label className="sf-check"><input type="checkbox" required checked={!!quote && consentFingerprint === quote.fingerprint} disabled={!quote} onChange={e => setConsentFingerprint(e.target.checked ? quote!.fingerprint : "")} />Je comprends que ce prix est estimatif. J’accepterai le devis confirmé par le pressing avant facturation.</label>
              <button type="submit" disabled={action.busy || !quote || consentFingerprint !== quote.fingerprint}>{action.busy ? "Enregistrement…" : "Envoyer ma demande"}</button>
              {action.error && <Message error>{action.error}</Message>}
            </form></section>}
        </section>
        <aside className="sf-card sf-stack sf-cart" aria-label="Mon panier"><div className="sf-row"><h2>Mon panier</h2><span className="sf-pill">{count} pièce{count > 1 ? "s" : ""}</span></div>
          {!lines.length ? <div className="sf-cart-empty"><ShoppingBag size={32} /><p>Votre prochain moment de tranquillité commence ici.</p><small>Ajoutez vos vêtements avec le bouton +.</small></div> : <ul className="sf-list">{lines.map(l => <li key={`${l.serviceId}-${l.garment}-${l.size}`}><div className="sf-row"><div><strong>{l.count} × {GARMENT_LABELS[l.garment]}</strong><small>{data.services.find(s => s.id === l.serviceId)?.name ?? "Service indisponible"}{data.services.find(s => s.id === l.serviceId)?.mode === "kg" ? ` · ${SIZE_LABELS[l.size]}` : ""}</small></div><button type="button" className="sf-secondary" aria-label={`Supprimer ${GARMENT_LABELS[l.garment]} ${SIZE_LABELS[l.size]}`} onClick={() => change(l, -l.count)}>×</button></div></li>)}</ul>}
          {lines.length > 0 && <div aria-live="polite">{estimate.error && debouncedCart === cartSignature ? <Message error>{estimate.error.message}<button type="button" className="sf-secondary" onClick={() => estimate.refetch()}>Réessayer</button></Message> : quote ? <QuoteSummary quote={quote} /> : <p className="sf-muted">Mise à jour de l’estimation…</p>}</div>}
          {step === "choose" && <button type="button" className="sf-desktop-continue" disabled={!quote} onClick={() => go("confirm")}>Continuer avec {count} pièce{count > 1 ? "s" : ""}</button>}
        </aside></div>
        {step === "choose" && <div className="sf-mobile-cart"><div><small>{count} pièce{count > 1 ? "s" : ""} · estimation</small><strong>{quote ? money(quote.total, data.currency) : lines.length ? "Calcul en cours…" : money("0", data.currency)}</strong></div><button disabled={!quote} onClick={() => go("confirm")}>Continuer <span aria-hidden="true">→</span></button></div>}
      </>}
      <footer className="sf-footer">Propulsé par <strong>Xpress Pro</strong> · Dépôt au pressing</footer>
    </div>
  </main>;
}
