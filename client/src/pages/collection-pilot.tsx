import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type Invoice = { id: string; status: string; redirect_url: string | null; quote?: {retryOf?:string} };
async function request(path: string, post = false) {
  const response=await fetch(path,{credentials:"include",...(post?{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}:{})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.code || "PAYMENT_UNAVAILABLE");
  return data;
}
export default function CollectionPilot({apiBase="/api/saas/collection-pilot",simulation=false}:{apiBase?:string;simulation?:boolean} = {}) {
  const {i18n}=useTranslation();const fr=i18n.language.startsWith("fr");const text=(a:string,b:string)=>fr?a:b;
  const current=useQuery<{amountXaf:number;invoice:Invoice|null;retryAllowed?:boolean}>({queryKey:[apiBase],queryFn:()=>request(apiBase)});
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const invoice=current.data?.invoice;
  async function act(action:"quote"|"checkout"|"refresh"|"retry") {
    setBusy(true);setError("");
    try {await request(action==="quote"?`${apiBase}/quote`:`${apiBase}/${invoice!.id}/${action}`,true);await current.refetch();}
    catch {setError(text("Opération non confirmée. Actualisez l’état avant toute nouvelle tentative. Ne payez pas deux fois.","Action not confirmed. Refresh the status before retrying. Do not pay twice."));}
    finally {setBusy(false);}
  }
  const statuses:Record<string,string>={quoted:text("Demande préparée","Request prepared"),pending:text("Confirmation attendue","Awaiting confirmation"),paid:text("Paiement confirmé","Payment confirmed"),failed:text("Paiement non abouti · nouvelle tentative soumise à vérification","Payment unsuccessful · review required before another attempt"),expired:text("Demande expirée · vérification nécessaire","Request expired · review required")};
  return <section className="mx-auto max-w-xl space-y-5 rounded-xl border p-5" data-testid="collection-pilot">
    <h1 className="text-2xl font-bold">{text("Test d’encaissement · 50 FCFA","Collection test · 50 XAF")}</h1>
    <p>{simulation?text("Ce paiement est simulé. Il vérifie le parcours sans encaissement réel et sans changer votre abonnement.","This payment is simulated. It checks the flow without collecting real money or changing your subscription."):text("Ce paiement réel sert uniquement à vérifier l’encaissement et sa confirmation. Il n’achète aucun abonnement et ne modifie ni votre formule, ni vos jours restants. Aucun prélèvement automatique.","This real payment only checks collection and confirmation. It purchases no subscription and does not change your plan or remaining days. No automatic debit.")}</p>
    {current.isLoading?<p>{text("Chargement…","Loading…")}</p>:current.error?<p role="alert">{text("Test temporairement indisponible. Aucun paiement lancé.","Test temporarily unavailable. No payment started.")}</p>:<>
      <p role="status">{invoice?statuses[invoice.status]||text("Vérification nécessaire","Review required"):text("Aucun paiement pilote créé.","No pilot payment created.")}</p>
      {invoice?.quote?.retryOf&&<p>{text("Nouvel essai après échec. Choisissez MTN sur la page pawaPay.","New test after failure. Choose MTN on the pawaPay page.")}</p>}
      {current.data?.retryAllowed&&<Button disabled={busy} onClick={()=>void act("retry")}>{text("Préparer le test MTN de 50 FCFA","Prepare the 50 XAF MTN test")}</Button>}
      {!invoice&&<Button disabled={busy} onClick={()=>void act("quote")}>{text("Préparer le test de 50 FCFA","Prepare the 50 XAF test")}</Button>}
      {invoice?.status==="quoted"&&<Button disabled={busy} onClick={()=>void act("checkout")}>{text("Préparer le paiement sécurisé de 50 FCFA","Prepare secure 50 XAF checkout")}</Button>}
      {invoice?.status==="pending"&&<div className="flex flex-wrap gap-3">{invoice.redirect_url?<a className="underline text-primary" href={invoice.redirect_url} target="_blank" rel="noopener noreferrer">{text("Ouvrir pawaPay · 50 FCFA","Open pawaPay · 50 XAF")}</a>:<Button disabled={busy} onClick={()=>void act("checkout")}>{text("Retrouver le lien de 50 FCFA","Recover the 50 XAF link")}</Button>}<Button disabled={busy} variant="outline" onClick={()=>void act("refresh")}>{text("Vérifier la confirmation","Check confirmation")}</Button></div>}
      {invoice?.status==="paid"&&<p>{text("50 FCFA confirmés. Votre abonnement est conservé. Le test est terminé ; aucun second paiement n’est proposé.","50 XAF confirmed. Your subscription is preserved. The test is complete; no second payment is offered.")}</p>}
    </>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
