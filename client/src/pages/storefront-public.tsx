import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GARMENT_LABELS, SIZE_LABELS, type CartLine, type StorefrontQuote } from "@shared/storefront";
import type { StorefrontService } from "../../../server/lib/storefront-service";
import { Message, QuoteSummary, money, storefrontApi, useStorefrontAction, whatsappHref } from "@/components/storefront-ui";

type Shop = Awaited<ReturnType<StorefrontService["publicShop"]>>;
const newSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
export default function StorefrontPublic() {
  const slug = decodeURIComponent(location.pathname.split("/")[2] ?? "");
  const base = `/api/public/shops/${encodeURIComponent(slug)}`;
  const shop = useQuery<Shop>({ queryKey: [base], queryFn: () => storefrontApi(base), staleTime: 30_000, retry: false });
  const [lines, setLines] = useState<CartLine[]>([]), [quote, setQuote] = useState<StorefrontQuote | null>(null);
  const [line, setLine] = useState<CartLine>({ serviceId: 0, garment: "tshirt", size: "adult", count: 1 });
  const [contact, setContact] = useState({ customerName: "", phone: "", note: "" });
  const [consent, setConsent] = useState(false), [receipt, setReceipt] = useState<{ reference: string; secret: string } | null>(null);
  const action = useStorefrontAction();
  useEffect(() => { if (shop.data && !line.serviceId) setLine(l => ({ ...l, serviceId: shop.data!.services[0]?.id ?? 0 })); }, [shop.data, line.serviceId]);
  const changeLines = (value: CartLine[]) => { setLines(value); setQuote(null); setConsent(false); };
  if (shop.isPending) return <main className="sf sf-public"><div className="sf-wrap"><Message>Ouverture de la boutique…</Message></div></main>;
  if (shop.error || !shop.data) return <main className="sf sf-public"><div className="sf-wrap"><Message error>{shop.error?.message ?? "Boutique indisponible"}</Message></div></main>;
  const data = shop.data;
  const send = () => action.run(async () => {
    if (!quote) return;
    // Keep the same idempotency credentials after a timeout or a repeated click.
    const key = `storefront-pending:${slug}`;
    const payload = { lines, ...contact, quoteFingerprint: quote.fingerprint };
    const signature = JSON.stringify(payload);
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(key) || "null"); } catch { saved = null; }
    if (!saved || saved.signature !== signature) { saved = { signature, requestKey: crypto.randomUUID(), trackingSecret: newSecret() }; sessionStorage.setItem(key, JSON.stringify(saved)); }
    const result = await storefrontApi(`${base}/requests`, { ...payload, requestKey: saved.requestKey, trackingSecret: saved.trackingSecret });
    setReceipt({ reference: result.reference, secret: saved.trackingSecret });
  });
  return <main className="sf sf-public">
    <header className="sf-top"><div className="sf-brand">Xpress<span>Pro</span></div><span className="sf-pill">Boutique du pressing</span></header>
    <div className="sf-wrap"><div className="sf-hero"><span className="sf-eyebrow">Votre linge, en quelques gestes</span><h1>{data.name}</h1><p className="sf-muted">{data.description}</p><p className="sf-muted">{data.address} · {data.hours}</p></div>
    {receipt ? <section className="sf-card sf-stack"><span className="sf-pill">Demande enregistrée</span><h2>Merci, votre demande est arrivée au pressing.</h2><p>Référence : <strong>{receipt.reference}</strong>. Attendez la confirmation du dépôt avant de vous déplacer.</p><Message>Conservez votre lien de suivi. Il permet de consulter votre demande et d’accepter le devis définitif.</Message><div className="sf-actions"><a className="sf-button" href={`/suivi-boutique#${receipt.secret}`}>Ouvrir mon suivi</a><a className="sf-button sf-secondary" href={whatsappHref(data.whatsapp, `Bonjour ${data.name}, j’ai déposé la demande ${receipt.reference} dans votre boutique.`)} target="_blank" rel="noopener noreferrer">Préparer un message WhatsApp</a></div><small>Le message s’ouvre dans WhatsApp. Vous choisissez ensuite de l’envoyer. La demande est déjà enregistrée.</small></section> : <>
    <div className="sf-progress"><span>1 · Choisir mes vêtements</span><span>2 · Voir mon estimation</span><span>3 · Envoyer ma demande</span></div>
    <div className="sf-grid"><div className="sf-stack"><section className="sf-card"><h2>Les services du pressing</h2>{!data.services.length && <Message>Aucun service disponible actuellement.</Message>}{data.services.map(s => <div className="sf-service" key={s.id}><div className="sf-row"><strong>{s.name}</strong><span className="sf-pill">{s.mode === "quote" ? "Sur devis" : `${money(s.price, data.currency)} / ${s.mode === "kg" ? "kg" : "pièce"}`}</span></div><p className="sf-muted">{s.description}</p>{s.mode === "kg" && Number(s.minimumCharge) > 0 && <small>Minimum par lot : {money(s.minimumCharge, data.currency)}</small>}</div>)}</section>
    <form className="sf-card sf-stack" onSubmit={e => { e.preventDefault(); changeLines([...lines, line]); }}><h2>Quels vêtements confiez-vous ?</h2><label>Service<select value={line.serviceId} onChange={e => setLine({ ...line, serviceId: Number(e.target.value) })}>{data.services.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Type de vêtement<select value={line.garment} onChange={e => setLine({ ...line, garment: e.target.value as CartLine["garment"] })}>{Object.entries(GARMENT_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><div className="sf-fields"><label>Gabarit<select value={line.size} onChange={e => setLine({ ...line, size: e.target.value as CartLine["size"] })}>{Object.entries(SIZE_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Nombre de pièces<input required type="number" min="1" max="100" value={line.count || ""} onChange={e => setLine({ ...line, count: Number(e.target.value) })} /></label></div><small>Choisissez le gabarit du vêtement, plutôt que l’âge exact de la personne. Vous pouvez mélanger les gabarits dans le panier.</small><button disabled={!line.serviceId || lines.length >= 40} type="submit">+ Ajouter au panier</button></form></div>
    <div className="sf-stack"><section className="sf-card sf-stack"><h2>Mon panier <span className="sf-pill">{lines.reduce((n, l) => n + l.count, 0)} pièces</span></h2>{!lines.length && <p className="sf-muted">Ajoutez vos premiers vêtements pour obtenir une estimation.</p>}<ul className="sf-list">{lines.map((l, i) => <li key={i} className="sf-row"><div><strong>{l.count} × {GARMENT_LABELS[l.garment]}</strong><small>{SIZE_LABELS[l.size]} · {data.services.find(s => s.id === l.serviceId)?.name}</small></div><button className="sf-secondary" aria-label={`Retirer la ligne ${i + 1}`} onClick={() => changeLines(lines.filter((_, index) => index !== i))}>Retirer</button></li>)}</ul>{lines.length > 0 && <button disabled={action.busy} onClick={() => action.run(async () => setQuote(await storefrontApi(`${base}/quote`, { lines })))}>Calculer mon estimation</button>}{quote && <QuoteSummary quote={quote} />}</section>
    {quote && <form className="sf-card sf-stack" onSubmit={e => { e.preventDefault(); void send(); }}><h2>Mes coordonnées</h2><label>Votre nom<input autoComplete="name" required minLength={2} maxLength={120} value={contact.customerName} onChange={e => setContact({ ...contact, customerName: e.target.value })} /></label><label>Téléphone / WhatsApp<input autoComplete="tel" type="tel" placeholder="+237…" required pattern="\+[1-9][0-9]{7,14}" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value.replace(/\s/g, "") })} /></label><label>Précisions pour le pressing<textarea maxLength={600} value={contact.note} onChange={e => setContact({ ...contact, note: e.target.value })} /></label><Message>Dépôt au pressing · Paiement au pressing après validation. Vos coordonnées servent au traitement de cette demande.</Message><label className="sf-check"><input required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Je comprends que le prix est estimatif et que je devrai accepter le devis confirmé par le pressing.</label><button type="submit" disabled={action.busy || !consent}>{action.busy ? "Enregistrement…" : "Envoyer ma demande"}</button></form>}
    {action.error && <Message error>{action.error}</Message>}</div></div></>}
    <footer className="sf-muted" style={{ marginTop: 32 }}>Une boutique propulsée par Xpress Pro · <a href={whatsappHref(data.whatsapp, `Bonjour, j’ai une question sur votre boutique.`)} target="_blank" rel="noopener noreferrer">Contacter le pressing</a></footer></div></main>;
}
