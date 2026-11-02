import {Check,Clock3,ShieldCheck,Loader2} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {SAAS_PLANS,saasMonthly,type SaasState,type SaasSelection} from '@shared/saas-plans';
import {paymentJourneyStep,type JourneyInvoice} from '@/lib/saas-payment-journey';
import {Button} from './ui/button';

type Props={selection:SaasSelection;durationMonths:1;invoice:JourneyInvoice|null};
type StatusProps={invoice:JourneyInvoice|null;state:SaasState;busy:boolean;onRefresh:()=>void};
export function SaasPaymentJourney({selection,durationMonths,invoice}:Props){
 const {i18n}=useTranslation(),fr=i18n.language.startsWith('fr');const text=(a:string,b:string)=>fr?a:b;
 const step=paymentJourneyStep(invoice),paid=invoice?.status==='paid';
 const chosen=invoice?.quote.selection??selection;const duration=invoice?.quote.durationMonths??durationMonths;
 const amount=invoice?.total_xaf??saasMonthly(chosen);
 const plan=chosen.plan==='business'&&(chosen.extraSites>0||chosen.extraStaff>0)?text('Personnalisé · Business','Custom · Business'):SAAS_PLANS[chosen.plan].name;
 const money=(n:number)=>`${n.toLocaleString(fr?'fr-FR':'en-GB')} FCFA`;
 const labels=[text('Formule','Plan'),text('Paiement','Payment'),text('Confirmation','Confirmation')];
 return <section aria-label={text('Parcours de paiement','Payment journey')} data-testid="saas-payment-journey" className="sticky top-20 z-20 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-md dark:border-slate-700 dark:bg-slate-950">
  <div className="grid md:grid-cols-[1.1fr_1fr]">
   <nav aria-label={text('Étapes du paiement','Payment steps')} className="p-4 sm:p-5"><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{text('Votre abonnement, en 3 étapes','Your subscription in 3 steps')}</p>
    <ol className="grid grid-cols-3 gap-2">{labels.map((label,i)=>{const n=i+1,done=n<step||(paid&&n===3);return <li key={label} aria-current={n===step?'step':undefined} className="min-w-0"><span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${done?'bg-emerald-100 text-emerald-800':n===step?'bg-primary text-primary-foreground ring-4 ring-primary/10':'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{done?<Check className="h-4 w-4" aria-label={text('Terminée','Completed')}/>:n}</span><span className={`block break-words text-xs sm:text-sm ${n===step?'font-bold text-foreground':'text-muted-foreground'}`}>{label}</span></li>})}</ol>
   </nav>
   <div className="flex items-center justify-between gap-4 bg-[#082d5b] px-4 py-4 text-white sm:px-5" data-testid="saas-payment-summary">
    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-blue-200">{text('Votre choix','Your selection')}</p><p className="mt-1 break-words text-lg font-bold">{plan}</p><p className="text-sm text-blue-100">{duration} {text('mois',duration===1?'month':'months')} · {text('Renouvellement manuel','Manual renewal')}</p></div>
    <div className="shrink-0 text-right"><p className="text-xs text-blue-100">{invoice?(paid?text('Payé','Paid'):text('À payer','Amount due')):text('Estimation','Estimate')}</p><p className="mt-1 whitespace-nowrap text-lg font-bold sm:text-2xl">{money(amount)}</p>{!invoice&&<p className="mt-1 max-w-36 text-xs text-blue-200">{text('Montant à confirmer au devis','Final amount shown in quote')}</p>}</div>
   </div>
  </div>
 </section>;
}

export function SaasPaymentStatus({invoice,state,busy,onRefresh}:StatusProps){
 const {i18n}=useTranslation(),fr=i18n.language.startsWith('fr'),text=(a:string,b:string)=>fr?a:b;
 if(!invoice||invoice.status==='quoted')return null;
 const paid=invoice.status==='paid',review=invoice.status==='review',pending=invoice.status==='pending';
 const target=invoice.quote.selection;const matches=(s:SaasSelection)=>s.plan===target.plan&&s.extraSites===target.extraSites&&s.extraStaff===target.extraStaff;
 const reserved=paid&&state.renewal&&matches(state.renewal.selection)?state.renewal:null;
 const active=paid&&!reserved&&state.phase==='active'&&matches(state);
 return <div role="status" aria-live="polite" className={`space-y-3 rounded-xl border p-4 ${paid?'border-emerald-200 bg-emerald-50 text-emerald-950':pending||review?'border-amber-200 bg-amber-50 text-amber-950':'border-red-200 bg-red-50 text-red-950'}`} data-testid="saas-payment-status">
  <div className="flex items-start gap-3">{paid?<ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/>:<Clock3 className="mt-0.5 h-5 w-5 shrink-0"/>}<div><p className="font-bold">{paid?(invoice.total_xaf===0?text('Changement confirmé','Change confirmed'):text('Paiement confirmé','Payment confirmed')):review?text('Paiement reçu, vérification en cours','Payment received, review in progress'):pending?text('Confirmation du paiement en attente','Waiting for payment confirmation'):text('Paiement non confirmé','Payment not confirmed')}</p><p className="mt-1 text-sm">{paid?(invoice.total_xaf===0?text('Aucun débit n’a été nécessaire pour ce changement.','No charge was needed for this change.'):text('La confirmation a été reçue par XpressPro.','XpressPro has received the payment confirmation.')):review?text('Une vérification est nécessaire. Ne payez pas à nouveau.','A review is required. Do not pay again.'):pending?text('Terminez la validation Mobile Money sur votre téléphone, puis vérifiez ici. Une demande en attente ne signifie pas encore que vous avez été débité. Ne lancez pas un deuxième paiement.','Complete the Mobile Money approval on your phone, then check here. A pending request does not yet mean you have been charged. Do not start a second payment.'):text('Vérifiez le statut et votre solde Mobile Money avant de recommencer.','Check the status and your Mobile Money balance before trying again.')}</p></div></div>
  {reserved&&<p className="text-sm">{text('Votre période est réservée du ','Your period is reserved from ')}{new Date(reserved.start).toLocaleDateString(i18n.language)}{text(' au ',' to ')}{new Date(reserved.end).toLocaleDateString(i18n.language)}.</p>}
  {active&&state.cycleEnd&&<p className="text-sm">{text('Formule active : ','Active plan: ')}<strong>{SAAS_PLANS[state.plan].name}</strong> · {text('Échéance : ','Period ends: ')}{new Date(state.cycleEnd).toLocaleDateString(i18n.language)}.</p>}
  {(pending||review)&&<Button type="button" variant="outline" disabled={busy} onClick={onRefresh} className="h-auto min-h-11 whitespace-normal">{busy&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{busy?text('Vérification…','Checking…'):text('Vérifier la confirmation','Check confirmation')}</Button>}
 </div>;
}
