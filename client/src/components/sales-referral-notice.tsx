import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
export function SalesReferralNotice({code,remove}:{code:string;remove:()=>void}) {
 const fr=useTranslation().i18n.language.startsWith('fr');
 const info=useQuery<{name:string;country:string}>({queryKey:['sales-referral',code],queryFn:async()=>{
  const r=await fetch(`/api/public/sales-referral/${encodeURIComponent(code)}`);if(!r.ok)throw Error('Referral unavailable');return r.json();
 },retry:false,staleTime:0});
 return <aside className="rounded-lg border bg-muted/30 p-3 text-sm" data-testid="sales-referral-notice">
  <p>{info.isLoading?(fr?'Vérification du lien commercial…':'Checking referral link…'):info.error?(fr?'Ce lien commercial est indisponible. Vous pouvez poursuivre sans recommandation.':'This referral link is unavailable. You can continue without a referral.'):(fr?`Inscription recommandée par ${info.data?.name} · ${info.data?.country}.`:`Referred by ${info.data?.name} · ${info.data?.country}.`)}</p>
  {!info.error&&<p className="mt-1 text-xs text-muted-foreground">{fr?'Cette recommandation sera associée à votre inscription pour le suivi commercial. Elle ne donne aucun accès à vos commandes.':'This referral will be associated with your signup for sales tracking. It does not grant access to your orders.'}</p>}
  <button type="button" onClick={remove} className="mt-2 underline">{fr?'Continuer sans recommandation':'Continue without a referral'}</button>
 </aside>;
}
