import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { accessCopy, failureKind } from '@/lib/access-feedback';
export function AccessNotice({kind, error}: {kind?: 'historical'|'premium'; error?: unknown}) {
  const {i18n}=useTranslation(); const {isOwner,allSites,user,switchSite,isSwitchingSite}=useAuth();
  const copy=accessCopy(i18n.language); const reason=kind ?? failureKind(error);
  const active=allSites.filter(site=>user?.saas?.activeSiteIds.includes(site.id));
  return <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" data-testid={`access-notice-${reason}`}>
    <p>{copy[reason === 'failure' ? 'load' : reason]}</p>
    {(reason==='premium'||reason==='historical') && <div className="mt-3 flex flex-wrap items-center gap-3">
      {isOwner ? <>
        {reason==='historical' && active.length>0 && <ButtonActive/>}
        <Link className="inline-flex min-h-11 items-center rounded-lg bg-[#082D5B] px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2" href={reason==='historical'?'/subscriptions?plan=business':'/subscriptions?plan=pro'}>{reason==='historical'?copy.business:copy.plans}</Link>
      </> : <p>{copy.owner}</p>}
    </div>}
  </div>;
  function ButtonActive(){return <button type="button" disabled={isSwitchingSite} onClick={()=>switchSite(active[0].id)} className="min-h-11 rounded-lg border border-amber-400 px-4 py-2 font-semibold disabled:opacity-50">{copy.active}{active.length>1?` · ${active[0].name}`:''}</button>;}
}
