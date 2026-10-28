import { useSearch } from "wouter";
import { readPlanIntent } from "@/lib/saas-plan-intent";
import { SaasPlanDetails } from "@/components/saas-plan-details";
import { SaasCustomPlan } from "@/components/saas-custom-plan";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SAAS_PLANS, saasMonthly, type SaasState, type SaasSelection, type SaasQuote } from "@shared/saas-plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ReceiptDownloadMenu } from "@/components/receipt-download-menu";
import { downloadReceiptDocument } from "@/lib/receipt-export";

type Invoice = { id: string; status: string; total_xaf: number; quote: SaasQuote; redirect_url: string | null; paid_at: string | null; created_at: string };
type Current = { state: SaasState; quotas: { sites: number; staff: number }; monthlyXaf: number; sandboxConfigured: boolean; paymentConfigured?: boolean; mode?: "sandbox" | "live"; sites: {id:number;name:string}[]; staff: {id:string;first_name:string;last_name:string;email:string}[] };
async function request(url: string, body?: unknown) {
  const result = await fetch(url, { credentials: "include", ...(body !== undefined ? { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await result.json();
  if (!result.ok) throw new Error(data.code || data.message || "SAAS_UNAVAILABLE");
  return data;
}
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export default function SaasSubscriptions() {
  const { i18n } = useTranslation(); const fr = i18n.language.startsWith("fr");
  const text = (a:string,b:string) => fr?a:b;
  const money = (n:number) => `${n.toLocaleString(i18n.language)} FCFA`;
  const qc = useQueryClient();
  const planSearch = useSearch();
  const current = useQuery<Current>({queryKey:["/api/saas/current"],queryFn:()=>request("/api/saas/current"),refetchInterval:60_000});
  const invoices = useQuery<Invoice[]>({queryKey:["/api/saas/invoices"],queryFn:()=>request("/api/saas/invoices"),refetchInterval:30_000});
  const [selection,setSelection] = useState<SaasSelection>({plan:"pro",extraSites:0,extraStaff:0});
  const [quote,setQuote] = useState<Invoice|null>(null); const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [success,setSuccess] = useState("");
  const [sites,setSites] = useState<number[]|null>(null); const [staff,setStaff] = useState<string[]|null>(null);
  const state = current.data?.state;
  const live = current.data?.mode === "live";
  const paymentConfigured = current.data?.paymentConfigured ?? current.data?.sandboxConfigured;
  const remainingHours = state?.trialEndsAt ? Math.max(0, Math.ceil((Date.parse(state.trialEndsAt)-Date.now())/3_600_000)) : 0;
  const [initialised,setInitialised] = useState(false);
  useEffect(()=>{if(state&&!initialised){const intent=readPlanIntent(planSearch);const chosen=state.renewal?.selection??state;setSelection(intent??{plan:chosen.plan==="starter"?"pro":chosen.plan,extraSites:chosen.extraSites,extraStaff:chosen.extraStaff});setInitialised(true);}},[state,initialised,planSearch]);
  useEffect(()=>{ if(quote){const latest=invoices.data?.find(row=>row.id===quote.id);if(latest&&latest.status!==quote.status)setQuote(latest);} },[invoices.data,quote?.id]);
  const lineLabels = {plan:text("Formule mensuelle","Monthly plan"),sites:text("Boutiques supplémentaires","Additional sites"),staff:text("Places d’employés supplémentaires","Additional staff places"),creditPro:text("Crédit Pro non utilisé","Unused Pro credit"),creditStaff:text("Crédit des places non utilisées","Unused staff credit")};
  const statuses: Record<string,string> = {quoted:text("Devis à confirmer","Quote awaiting confirmation"),pending:text("En attente de confirmation","Awaiting confirmation"),paid:text("Paiement confirmé","Payment confirmed"),failed:text("Paiement non abouti","Payment unsuccessful"),expired:text("Devis expiré","Quote expired"),review:text("Paiement reçu · vérification nécessaire","Payment received · review required")};
  const errors:Record<string,string> = {
    EXCESS_CREDIT_REQUIRES_REVIEW:text("Votre crédit dépasse cette facture. Une vérification est nécessaire pour conserver tout votre crédit ; aucun paiement n’a été lancé.","Your credit exceeds this invoice. Review is required to preserve your full credit; no payment was started."),
    PAYMENT_ALREADY_PENDING:text("Un paiement est déjà en cours. Actualisez son état avant de recommencer.","A payment is already pending. Refresh its status before trying again."),
    QUOTA_EXCEEDED:text("La sélection dépasse les places ou boutiques incluses.","Your selection exceeds the included staff or site quota."),
    LEGACY_SUBSCRIPTION_REQUIRES_REVIEW:text("Cet ancien abonnement doit être vérifié avant sa migration.","This legacy subscription requires review before migration."),
    SANDBOX_TOKEN_NOT_CONFIGURED:text("La clé pawaPay de test doit être configurée sur le serveur.","Configure the pawaPay test token on the server."),
    SANDBOX_RETURN_URL_NOT_CONFIGURED:text("L’adresse de retour du test doit être configurée sur le serveur.","Configure the sandbox return URL on the server."),
    PAYMENT_AWAITING_RECONCILIATION:text("La confirmation est encore attendue. Actualisez le paiement ; ne payez pas une deuxième fois.","Confirmation is still pending. Refresh the payment; do not pay again."),
    RENEWAL_ALREADY_PAID:text("Le prochain cycle est déjà payé. Aucune nouvelle facture ne sera créée.","The next cycle is already paid. No further invoice will be created."),
    QUOTE_EXPIRED:text("Ce devis a expiré. Demandez un nouveau devis.","This quote expired. Request a new quote."),
  };
  async function act(fn:()=>Promise<void>) {
    setBusy(true);setError("");setSuccess("");
    try{await fn();await qc.invalidateQueries({queryKey:["/api/saas/current"]});await qc.invalidateQueries({queryKey:["/api/saas/invoices"]});await qc.invalidateQueries({queryKey:["/api/auth/user"]});}
    catch(e){const code=e instanceof Error?e.message:"";setError(errors[code] || text("Cette opération n’a pas abouti. Actualisez les données et vérifiez les quotas ou le paiement en cours.","This action could not be completed. Refresh and check quotas or the pending payment."));}
    finally{setBusy(false);}
  }
  async function checkout(invoice:Invoice){await act(async()=>{const updated=await request(`/api/saas/invoices/${invoice.id}/checkout`,{});setQuote(updated);});}
  function invoiceHtml(invoice:Invoice){return `<!doctype html><html><head><meta charset="utf-8"><title>XpressPro ${esc(invoice.id)}</title><style>body{font:15px Arial;background:#eee;margin:0;padding:20px}.receipt{width:680px;background:white;margin:auto;padding:32px;box-sizing:border-box}h1{color:#082d5b}table{width:100%;border-collapse:collapse}td,th{padding:12px 4px;text-align:left;border-bottom:1px solid #ddd}td:last-child{text-align:right}footer{margin-top:32px;color:#555}</style></head><body><main class="receipt"><h1>XpressPro · ${live?text("Facture SaaS","SaaS invoice"):text("Facture SaaS de test","Sandbox SaaS invoice")}</h1><p>${esc(invoice.id)}</p><p>${esc(statuses[invoice.status])}</p><p>${esc(new Date(invoice.created_at).toLocaleString(i18n.language))}</p><table><tbody>${invoice.quote.lines.map(line=>`<tr><td>${esc(lineLabels[line.label])} × ${line.quantity}</td><td>${esc(money(line.amountXaf))}</td></tr>`).join('')}<tr><th>Total XAF</th><td>${esc(money(invoice.total_xaf))}</td></tr></tbody></table><footer>${live?text("Renouvellement manuel. Aucun prélèvement automatique.","Manual renewal. No automatic debit."):text("Mode test uniquement. Renouvellement manuel. Aucun prélèvement automatique.","Sandbox only. Manual renewal. No automatic debit.")}</footer></main></body></html>`;}
  if(current.isLoading)return <p>{text("Chargement de l’abonnement…","Loading subscription…")}</p>;
  if(current.error)return <div role="alert" className="rounded-xl border p-5">{errors[current.error.message]||text("L’abonnement est temporairement indisponible. Aucun paiement n’a été lancé.","Subscription temporarily unavailable. No payment was initiated.")}</div>;
  const data=current.data!;
  const scheduled=(state?.launchBusiness && state.phase==="trialing" && selection.plan==="starter") || state?.phase==="active" && (selection.plan==="starter" || (state.plan==="business"&&selection.plan==="pro") || saasMonthly(selection)<data.monthlyXaf);
  return <div className="space-y-6" data-testid="saas-subscriptions-v5">
    <header><h1 className="text-2xl font-bold">{text("Mon abonnement XpressPro","My XpressPro subscription")}</h1><p>{text("Renouvellement manuel · Paiements en FCFA (XAF)","Manual renewal · Payments in FCFA (XAF)")}</p></header>
    {!live && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">{text("Mode test pawaPay — aucun abonnement réel n’est vendu ici.","pawaPay sandbox — no real subscription is sold here.")}</p>}
    <Card><CardContent className="space-y-2 p-5"><h2 className="font-bold">{SAAS_PLANS[state!.plan].name} · {text(state!.phase==="trialing"?"Essai gratuit":state!.phase==="active"?"Actif":"Gratuit",state!.phase==="trialing"?"Free trial":state!.phase==="active"?"Active":"Free")}</h2>
      {state!.trialEndsAt&&state!.phase==="trialing"&&<p>{text("Fin de l’essai : ","Trial ends: ")}{new Date(state!.trialEndsAt).toLocaleString(i18n.language)} · {Math.floor(remainingHours/24)} {text("jours","days")} {remainingHours%24} h</p>}
      {state!.cycleEnd&&state!.phase==="active"&&<p>{text("Échéance : ","Period ends: ")}{new Date(state!.cycleEnd).toLocaleString(i18n.language)}</p>}
      <p>{text("Boutiques exploitées","Operating sites")} : {state!.activeSiteIds.length}/{data.quotas.sites} · {text("Personnel actif (propriétaire exclu)","Active staff (owner excluded)")} : {state!.activeStaffIds.length}/{data.quotas.staff}</p>
      {state!.renewal&&<p role="status">{text("Période payante réservée du ","Paid period reserved from ")}{new Date(state!.renewal.start).toLocaleString(i18n.language)}{text(" au "," to ")}{new Date(state!.renewal.end).toLocaleString(i18n.language)} · {SAAS_PLANS[state!.renewal.selection.plan].name}. {text("Vos jours offerts sont conservés.","Your free days are preserved.")}</p>}
      {state!.pending&&<p>{text("Changement prévu à l’échéance : ","Scheduled at renewal: ")}{SAAS_PLANS[state!.pending.plan].name} · {money(saasMonthly(state!.pending))}</p>}
      {state!.renewal&&<p>{text("Prochain cycle déjà payé jusqu’au ","Next cycle already paid until ")}{new Date(state!.renewal.end).toLocaleDateString(i18n.language)}</p>}
    </CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Object.values(SAAS_PLANS).map(plan=><Card key={plan.slug} className={selection.plan===plan.slug&&(plan.slug!=="business"||!selection.extraSites&&!selection.extraStaff)?"ring-2 ring-primary":""}><CardHeader><CardTitle>{plan.name}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-xl font-bold">{money(plan.priceXaf)}{text("/mois","/month")}</p><p>{plan.sites} {text("boutique(s)","site(s)")} · {plan.staff} {text("employé(s) + propriétaire","staff + owner")}</p><SaasPlanDetails plan={plan.slug} /><Button variant="outline" onClick={()=>{setSelection({plan:plan.slug,extraSites:0,extraStaff:0});setQuote(null);}}>{text("Choisir","Choose")}</Button></CardContent></Card>)}<SaasCustomPlan selection={selection} onSelect={target=>{setSelection(target);setQuote(null);}}/></div>
    <Card><CardContent className="space-y-4 p-5"><h2 className="font-bold">{text("Options et devis","Options and quote")}</h2>
      {selection.plan==="business"&&<label className="block">{text("Boutiques au-delà des 2 incluses · 5 000 FCFA chacune, avec 2 places d’employés","Sites beyond the 2 included · 5,000 FCFA each, including 2 staff places")}<Input type="number" min={0} max={1000} value={selection.extraSites} onChange={e=>{setSelection({...selection,extraSites:Math.max(0,Number(e.target.value))});setQuote(null);}}/></label>}
      {selection.plan!=="starter"&&<label className="block">{text("Places de personnel au-delà du quota · 2 000 FCFA chacune","Staff places beyond the quota · 2,000 FCFA each")}<Input type="number" min={0} max={1000} value={selection.extraStaff} onChange={e=>{setSelection({...selection,extraStaff:Math.max(0,Number(e.target.value))});setQuote(null);}}/></label>}
      <p className="text-sm">{text("Au renouvellement, seules les places supplémentaires utilisées par du personnel actif sont facturées.","At renewal, only additional places used by active staff are charged.")}</p>
      <p>{text("Montant mensuel avec ces options : ","Monthly price with these options: ")}{money(saasMonthly(selection))}</p>
      <Button disabled={busy||!!state!.renewal||selection.plan==="starter"&&!scheduled} onClick={()=>void act(async()=>{if(scheduled){await request("/api/saas/schedule",selection);setSuccess(text("Changement enregistré pour la prochaine échéance.","Change scheduled for the next renewal."));}else setQuote(await request("/api/saas/quote",selection));})}>{scheduled?text("Prévoir ce changement à l’échéance","Schedule change at renewal"):text("Calculer le devis avant paiement","Calculate quote before payment")}</Button>
      {quote&&<div className="space-y-3 rounded-xl border p-4" data-testid="saas-quote"><h3 className="font-bold">{text("Détail du devis","Quote details")}</h3>{quote.quote.lines.map((line,i)=><p key={i} className="flex justify-between gap-3"><span>{lineLabels[line.label]} × {line.quantity}</span><strong>{money(line.amountXaf)}</strong></p>)}<p className="font-bold">{text("À payer : ","Amount due: ")}{money(quote.total_xaf)}</p><p>{text("Devis valable jusqu’au ","Quote valid until ")}{new Date(quote.quote.expiresAt).toLocaleString(i18n.language)}</p><p>{text("Au renouvellement : ","At renewal: ")}{money(quote.quote.nextMonthlyXaf)} · {text("une seule facture, sans prélèvement automatique","one invoice, no automatic debit")}</p>
      {quote.quote.cycleEnd&&<p>{text("Échéance du cycle en cours : ","Current period ends: ")}{new Date(quote.quote.cycleEnd).toLocaleString(i18n.language)}</p>}
      {state!.phase==="trialing"&&quote.quote.kind==="renewal"&&<p>{text("Cette période payante commencera après votre essai, le ","This paid period starts after your trial, on ")}{new Date(quote.quote.cycleEnd!).toLocaleString(i18n.language)}. {text("Aucun jour offert perdu.","No free days lost.")}</p>}
      {quote.quote.kind==="options"&&<p>{text("Options au prorata ; la date de renouvellement ne change pas.","Prorated options; the renewal date does not change.")}</p>}{quote.quote.kind==="upgrade"&&<p>{text("Le crédit affiché est déduit. Un nouveau mois Business commence après confirmation du paiement.","The displayed credit is deducted. A new Business month starts after payment confirmation.")}</p>}
      {quote.status==="quoted"&&<Button disabled={busy||!paymentConfigured&&quote.total_xaf!==0} onClick={()=>void checkout(quote)}>{live ? text("Confirmer et payer avec pawaPay","Confirm and pay with pawaPay") : text("Confirmer et préparer le paiement de test","Confirm and prepare sandbox payment")}</Button>}
      {quote.redirect_url&&quote.status==="pending"&&<a className="block text-primary underline" href={quote.redirect_url} target="_blank" rel="noopener noreferrer">{live ? text("Ouvrir le paiement sécurisé pawaPay","Open secure pawaPay checkout") : text("Ouvrir pawaPay en mode test","Open pawaPay sandbox")}</a>}</div>}
      {!paymentConfigured&&<p>{text("Le paiement est temporairement indisponible. Réessayez plus tard.","Payment is temporarily unavailable. Please try again later.")}</p>}
    </CardContent></Card>
    <Card><CardContent className="space-y-4 p-5"><h2 className="font-bold">{text("Choisir les accès actifs","Choose active access")}</h2><p>{text("Les autres boutiques restent consultables par le propriétaire. Business est requis pour les exploiter.","Other sites remain available to the owner for historical consultation. Business is required to operate them.")}</p>
      <div className="grid gap-2 sm:grid-cols-2">{data.sites.map(site=><label key={site.id} className="flex items-center gap-2"><input type="checkbox" checked={(sites??state!.activeSiteIds).includes(site.id)} onChange={e=>{const ids=sites??state!.activeSiteIds;setSites(e.target.checked?[...ids,site.id]:ids.filter(id=>id!==site.id));}}/>{site.name}</label>)}</div>
      <div className="grid gap-2 sm:grid-cols-2">{data.staff.map(person=><label key={person.id} className="flex items-center gap-2"><input type="checkbox" checked={(staff??state!.activeStaffIds).includes(person.id)} onChange={e=>{const ids=staff??state!.activeStaffIds;setStaff(e.target.checked?[...ids,person.id]:ids.filter(id=>id!==person.id));}}/>{person.first_name} {person.last_name} {person.email}</label>)}</div>
      <Button disabled={busy} onClick={()=>void act(async()=>{await request("/api/saas/access",{sites:sites??state!.activeSiteIds,staff:staff??state!.activeStaffIds});setSites(null);setStaff(null);setSuccess(text("Accès enregistrés.","Access saved."));})}>{text("Enregistrer les accès","Save access")}</Button>
    </CardContent></Card>
    <Card><CardContent className="space-y-4 p-5"><h2 className="font-bold">{text("Factures et paiements SaaS","SaaS invoices and payments")}</h2>{invoices.data?.map(invoice=><div key={invoice.id} className="space-y-2 border-t py-3"><p className="break-all text-sm">{invoice.id}</p><p>{money(invoice.total_xaf)} · {statuses[invoice.status]||invoice.status}</p><div className="flex flex-wrap gap-2">{invoice.status==="pending"&&<Button disabled={busy} variant="outline" onClick={()=>void act(async()=>{await request(`/api/saas/invoices/${invoice.id}/refresh`,{});})}>{text("Actualiser la confirmation","Refresh confirmation")}</Button>}{(invoice.status==="quoted"||(invoice.status==="pending"&&!invoice.redirect_url))&&<Button disabled={busy} variant="outline" onClick={()=>void checkout(invoice)}>{live ? text("Reprendre le paiement","Resume payment") : text("Reprendre le paiement de test","Resume sandbox checkout")}</Button>}{invoice.redirect_url&&invoice.status==="pending"&&<a className="p-2 text-primary underline" href={invoice.redirect_url} target="_blank" rel="noopener noreferrer">{live ? "pawaPay" : "pawaPay Sandbox"}</a>}<ReceiptDownloadMenu variant="outline" onDownload={format=>downloadReceiptDocument(invoiceHtml(invoice),`xpresspro-saas-${invoice.id}.html`,format)}>{text("Télécharger la facture","Download invoice")}</ReceiptDownloadMenu></div></div>)}</CardContent></Card>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}{success&&<p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{success}</p>}
  </div>;
}
