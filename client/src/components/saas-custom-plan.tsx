import {useState,useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'wouter';
import {SAAS_PLANS,SAAS_OPTION_PRICES,saasMonthly,saasQuotas,saasSelection,type SaasSelection} from '@shared/saas-plans';
export function SaasCustomPlan({onSelect,selection:selected,previewOnly=false}:{previewOnly?:boolean;onSelect?:(selection:SaasSelection)=>void;selection?:SaasSelection}){
 const {i18n}=useTranslation();const fr=i18n.language.startsWith('fr');
 const [sites,setSites]=useState(selected?.plan==='business'?selected.extraSites:0);const [staff,setStaff]=useState(selected?.plan==='business'?selected.extraStaff:0);
 useEffect(()=>{if(selected?.plan==='business'){setSites(selected.extraSites);setStaff(selected.extraStaff);}},[selected?.plan,selected?.extraSites,selected?.extraStaff]);
 const selection=saasSelection('business',sites,staff);const quota=saasQuotas(selection);
 const price=(value:number)=>`${value.toLocaleString(i18n.language)} FCFA`;
 const change=(value:string,set:(n:number)=>void)=>{const n=Number(value);if(Number.isSafeInteger(n)&&n>=0&&n<=1000)set(n);};
 return <article className={"rounded-xl border bg-white p-6 text-slate-950 "+(selected?.plan==='business'&&(selected.extraSites>0||selected.extraStaff>0)?"ring-2 ring-primary":"")} data-testid="saas-custom-plan">
  <h3 className="text-xl font-bold">{fr?'Personnalisé':'Custom'}</h3>
  <p className="mt-3 text-sm">{fr?'Toutes les fonctionnalités de Business, avec les boutiques et places employés adaptées à votre activité.':'All Business features, with site and staff capacity tailored to your business.'}</p>
  <p className="my-3">{fr?'Base Business : 2 boutiques et 5 employés + propriétaire':'Business base: 2 sites and 5 staff + owner'} · {price(SAAS_PLANS.business.priceXaf)}{fr?'/mois':'/month'}</p>
  <div className="space-y-4">
   <label className="block">{fr?'Boutiques supplémentaires':'Additional sites'} · {price(SAAS_OPTION_PRICES.siteXaf)}{fr?'/mois chacune':'/month each'}
    <input className="mt-2 block w-full rounded-md border p-2" type="number" min="0" max="1000" step="1" value={sites} onChange={e=>change(e.target.value,setSites)} />
   </label>
   <p className="text-sm">{fr?'Chaque boutique supplémentaire inclut 2 places d’employés.':'Each additional site includes 2 staff places.'}</p>
   <label className="block">{fr?'Places d’employés supplémentaires, au-delà des places incluses':'Additional staff places, beyond included places'} · {price(SAAS_OPTION_PRICES.staffXaf)}{fr?'/mois chacune':'/month each'}
    <input className="mt-2 block w-full rounded-md border p-2" type="number" min="0" max="1000" step="1" value={staff} onChange={e=>change(e.target.value,setStaff)} />
   </label>
   <p>{quota.sites} {fr?'boutiques au total':'total sites'} · {quota.staff} {fr?'places employés + propriétaire hors quota':'staff places + owner outside quota'}</p>
   <p className="text-2xl font-bold" aria-live="polite">{fr?'Total mensuel : ':'Monthly total: '}{price(saasMonthly(selection))}</p>
   <p className="text-sm">{fr?'Le devis de paiement confirme le montant et la date de début. Aucun prélèvement automatique.':'The payment quote confirms the amount and start date. No automatic debit.'}</p>
   {previewOnly?<p className="text-sm text-muted-foreground">{fr?'Simulation uniquement. Paiements et changements de formule indisponibles.':'Preview only. Payments and plan changes are unavailable.'}</p>:onSelect?<button type="button" className="rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white" onClick={()=>onSelect(selection)}>{fr?'Choisir cette formule':'Choose this plan'}</button>:<Link href="/auth?tab=register" className="inline-block rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white">{fr?'Créer mon compte':'Create my account'}</Link>}
  </div>
 </article>;
}
