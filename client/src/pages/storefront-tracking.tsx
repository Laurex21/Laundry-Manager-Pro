import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { REQUEST_LABELS } from "@shared/storefront";
import type { StorefrontService } from "../../../server/lib/storefront-service";
import { Message, QuoteSummary, storefrontApi, useStorefrontAction, whatsappHref } from "@/components/storefront-ui";
export default function StorefrontTracking() {
  const [secret] = useState(() => location.hash.slice(1));
  const api = "/api/public/storefront-tracking";
  const query = useQuery<Awaited<ReturnType<StorefrontService["tracking"]>>>({ queryKey: [api, secret], queryFn: () => storefrontApi(api, undefined, "GET", secret), refetchInterval: 15_000, retry: false });
  const action = useStorefrontAction(), [agreed, setAgreed] = useState(false);
  const data = query.data;
  useEffect(() => { setAgreed(false); }, [data?.version, data?.finalQuote?.fingerprint]);
  const decide = (accept: boolean) => action.run(async () => { await storefrontApi(`${api}/decision`, { expectedVersion: data!.version, accept }, "POST", secret); setAgreed(false); await query.refetch(); });
  const statuses: Record<string, string> = { received: "Vêtements reçus", processing: "En traitement", ready: "Prêts à retirer", delivered: "Remis au client", cancelled: "Commande annulée" };
  return <main className="sf sf-public"><header className="sf-top"><div className="sf-brand">Xpress<span>Pro</span></div><span className="sf-pill">Mon suivi</span></header><div className="sf-wrap" style={{ maxWidth: 740 }}>
    {query.isPending && <Message>Chargement du suivi…</Message>}{query.error && <Message error>{query.error.message}</Message>}
    {data && <div className="sf-stack"><div className="sf-hero"><span className="sf-eyebrow">{data.shop.name}</span><h1>{REQUEST_LABELS[data.status]}</h1><p className="sf-muted">{data.reference}</p></div>
    {data.status === "submitted" && <Message>Le pressing doit encore accepter votre dépôt. Vous pouvez revenir sur cette page pour suivre sa réponse.</Message>}
    {data.status === "awaiting_dropoff" && <Message>Votre dépôt est accepté. Apportez les vêtements à cette adresse : {data.shop.address}. Le pressing vérifiera les articles et leur poids.</Message>}
    {data.order && <Message>Commande {data.order.reference} : {statuses[data.order.status] ?? data.order.status}. Paiement : {data.order.paymentStatus === "paid" ? "réglé" : data.order.paymentStatus === "partial" ? "partiellement réglé" : "à régler au pressing"}.</Message>}
    <QuoteSummary quote={data.finalQuote ?? data.estimate} />
    {data.status === "awaiting_customer_approval" && <section className="sf-card sf-stack"><h2>Confirmez le devis définitif</h2><p>Le pressing a vérifié votre dépôt. Votre accord porte sur le montant affiché ci-dessus.</p><label className="sf-check"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />J’accepte ce montant et le mode de facturation indiqué.</label><div className="sf-actions"><button disabled={!agreed || action.busy} onClick={() => decide(true)}>Accepter le devis</button><button className="sf-secondary" disabled={action.busy} onClick={() => decide(false)}>Refuser ce devis</button></div></section>}
    {data.status === "ready_to_convert" && <Message>Votre accord est enregistré. Le pressing va créer la commande.</Message>}
    {data.history.some(h => h.note) && <section className="sf-card"><h2>Messages du pressing</h2>{data.history.filter(h => h.note).map((h, i) => <p key={i}>{h.note}</p>)}</section>}
    {action.error && <Message error>{action.error}</Message>}<div className="sf-actions"><button className="sf-secondary" onClick={() => query.refetch()}>Actualiser le suivi</button><a className="sf-button sf-secondary" href={whatsappHref(data.shop.whatsapp, `Bonjour, concernant ma demande ${data.reference}…`)} target="_blank" rel="noopener noreferrer">Ouvrir WhatsApp</a></div><small>Ce lien est personnel. Toute personne qui le possède peut consulter et accepter ce devis.</small></div>}
  </div></main>;
}
