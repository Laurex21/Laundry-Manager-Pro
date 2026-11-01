import { AccessNotice } from "./access-notice";
import { SaasTrialBanner } from "./saas-trial-banner";
import { businessTrialBanner } from "@shared/saas-business-launch";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

export function SaasNotice() {
  const { user, isOwner } = useAuth(); const { i18n } = useTranslation();
  const [notice,setNotice] = useState<any>(null);
  const [now,setNow] = useState(()=>new Date());
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60_000);return()=>clearInterval(timer);},[]);
  const saas = (user as any)?.saas;
  useEffect(()=>{
    if(saas?.renewal){setNotice(null);return;}
    if(!saas || !isOwner)return;
    let mounted=true;
    fetch('/api/saas/notices',{credentials:'include',headers:{'X-Client-Timezone':Intl.DateTimeFormat().resolvedOptions().timeZone}})
      .then(r=>r.ok?r.json():[]).then(rows=>{if(mounted&&rows[0])setNotice(rows[0]);}).catch(()=>{});
    return ()=>{mounted=false;};
  },[user?.id,isOwner,saas?.phase,saas?.renewal?.start]);
  const fr=i18n.language.startsWith('fr');
  const banner=saas?businessTrialBanner(saas,now):null;
  if((user as any)?.saasSuspended)return <div role="alert" className="m-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">{fr?'Votre accès est suspendu par l’abonnement de l’entreprise. Contactez le propriétaire.':'Your access is suspended by the business subscription. Contact the owner.'}</div>;
  if(!saas)return null;
  const archived=(user as any)?.currentSite && !saas.activeSiteIds.includes((user as any).currentSite.id);
  return <>
    {archived&&<div className="m-4"><AccessNotice kind="historical"/></div>}
    {banner&&<SaasTrialBanner endsAt={banner.endsAt} days={banner.days} language={i18n.language}/>}
    {!banner&&notice&&<div role="status" className="m-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">{notice.kind==='expired'?(fr?'Votre abonnement est passé à Starter gratuit. Vos données sont conservées.':'Your plan changed to free Starter. Your data is preserved.'):(fr?(saas.plan==='business'?'Votre essai Business se termine le ':'Votre essai Pro se termine le '):(saas.plan==='business'?'Your Business trial ends on ':'Your Pro trial ends on '))}{notice.details.endsAt&&new Date(notice.details.endsAt).toLocaleString(i18n.language)}{' '}<Link className="font-semibold underline" href="/subscriptions">{fr?'Voir les formules':'View plans'}</Link></div>}
  </>;
}
