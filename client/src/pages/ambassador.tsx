import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Handshake,Link2,Copy,Users,CheckCircle2,Wallet,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Card,CardContent} from '@/components/ui/card';
import {useAmbassador,ambassadorApi} from '@/hooks/use-ambassador';
import {salesReferralUrl} from '@/lib/sales-links';
import type {SalesRepresentative,SalesRegistration} from '@shared/sales-referrals';

type Summary={representative:SalesRepresentative;registrations:number;paying_accounts:number;payments:number;amount_xaf:number;environment:string};
export default function AmbassadorPage(){
  const {i18n}=useTranslation(),fr=i18n.language.startsWith('fr'),text=(a:string,b:string)=>fr?a:b;
  const {userId,access,enabled}=useAmbassador();
  const [page,setPage]=useState(1),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
  const summary=useQuery<Summary>({queryKey:['ambassador',userId,'summary'],queryFn:()=>ambassadorApi('/api/ambassador/summary'),enabled,retry:false,staleTime:0,gcTime:0,refetchInterval:30000});
  const registrations=useQuery<{items:SalesRegistration[];total:number}>({queryKey:['ambassador',userId,'registrations',page],queryFn:()=>ambassadorApi(`/api/ambassador/registrations?page=${page}`),enabled,retry:false,staleTime:0,gcTime:0,refetchInterval:30000});
  const money=(value:number)=>`${value.toLocaleString(fr?'fr-FR':'en-GB')} FCFA`;
  const date=(value:string|null)=>value?new Date(value).toLocaleDateString(fr?'fr-FR':'en-GB'):'—';
  const refresh=()=>{access.refetch();summary.refetch();registrations.refetch();};
  if(access.isLoading)return <p role="status" className="p-6">{text('Vérification de votre accès…','Checking your access…')}</p>;
  if(access.isError)return <div className="space-y-3 p-6" role="alert"><p>{text('Impossible de vérifier votre accès ambassadeur. Réessayez.','Unable to check your ambassador access. Please retry.')}</p><Button onClick={()=>access.refetch()}>{text('Réessayer','Retry')}</Button></div>;
  if(!enabled)return <Card className="m-4"><CardContent className="space-y-3 p-6"><Handshake aria-hidden="true"/><h1 className="text-xl font-semibold">{text('Espace Ambassadeur','Ambassador workspace')}</h1><p>{text('Ce rôle doit être activé par le Super Admin sur votre compte XpressPro. Votre accès au pressing reste inchangé.','The Super Admin must enable this role on your XpressPro account. Your laundry access remains unchanged.')}</p><Button asChild variant="outline"><a href="/dashboard">{text('Revenir au tableau de bord','Back to dashboard')}</a></Button></CardContent></Card>;
  // Do not render cached private results if access has been revoked or a refresh fails.
  if(summary.isError||registrations.isError)return <div className="space-y-3 p-6" role="alert"><p>{text('Résultats indisponibles ou accès suspendu. Actualisez pour vérifier votre accès.','Results unavailable or access suspended. Refresh to check your access.')}</p><Button onClick={refresh}>{text('Actualiser','Refresh')}</Button></div>;
  const data=summary.data,link=data?salesReferralUrl(data.representative.code):'';
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8" data-testid="ambassador-workspace">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="mb-1 text-sm font-medium text-primary">XpressPro · {text('Mon réseau','My network')}</p><h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><Handshake aria-hidden="true"/>{text('Mon espace Ambassadeur','My Ambassador workspace')}</h1><p className="mt-2 text-muted-foreground">{text('Partagez votre lien. Retrouvez vos inscriptions et leurs paiements confirmés.','Share your link. Follow your registrations and their confirmed payments.')}</p></div><Button variant="outline" onClick={refresh} disabled={summary.isFetching||registrations.isFetching}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true"/>{text('Actualiser','Refresh')}</Button></header>
    {!data?<p role="status">{text('Chargement de vos résultats…','Loading your results…')}</p>:<>
      <section className="rounded-2xl bg-gradient-to-br from-[#102f59] to-[#4532a4] p-5 text-white sm:p-7" aria-label={text('Mon lien personnel','My personal link')}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-semibold"><Link2 aria-hidden="true"/>{text('Mon lien personnel','My personal link')}</h2><span className="rounded-full bg-white/15 px-3 py-1 text-sm">{data.representative.name} · {data.representative.country}</span></div>
        <p className="mt-2 text-sm text-white/85">{text('Les nouveaux comptes créés depuis ce lien vous sont automatiquement rattachés.','New accounts created through this link are automatically attributed to you.')}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><Input aria-label={text('Lien personnel à partager','Personal link to share')} className="h-12 min-w-0 flex-1 border-white/25 bg-white/10 text-white" readOnly value={link} onFocus={e=>e.target.select()}/><Button className="h-12 bg-white text-[#102f59] hover:bg-white/90" onClick={async()=>{setCopyError(false);try{await navigator.clipboard.writeText(link);setCopied(true);}catch{setCopyError(true);}}}><Copy className="mr-2 h-4 w-4" aria-hidden="true"/>{copied?text('Lien copié','Link copied'):text('Copier mon lien','Copy my link')}</Button></div>
        <p className="mt-3 text-sm text-white/85" role="status">{copyError?text('Sélectionnez le lien ci-dessus et copiez-le manuellement.','Select the link above and copy it manually.'):copied?text('Vous pouvez maintenant le partager avec vos prospects.','You can now share it with your prospects.'):text('Un seul compte XpressPro pour votre pressing et votre activité ambassadeur.','One XpressPro account for your laundry and ambassador activity.')}</p>
      </section>
      <div className="grid gap-3 sm:grid-cols-3">{[
        {label:text('Inscriptions attribuées','Attributed registrations'),value:data.registrations,Icon:Users},
        {label:text('Comptes ayant payé','Paying accounts'),value:data.paying_accounts,Icon:CheckCircle2},
        {label:text('Paiements confirmés (XAF)','Confirmed payments (XAF)'),value:money(data.amount_xaf),Icon:Wallet},
      ].map(({label,value,Icon})=><Card key={label}><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" aria-hidden="true"/></div><div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 break-words text-2xl font-bold">{value}</p></div></CardContent></Card>)}</div>
      <section className="rounded-2xl border bg-card p-4 sm:p-6"><h2 className="text-xl font-semibold">{text('Mes inscriptions et paiements','My registrations and payments')}</h2><p className="mt-1 text-sm text-muted-foreground">{text('Seuls les comptes inscrits avec votre lien apparaissent ici.','Only accounts registered through your link appear here.')}</p>
        {registrations.isLoading?<p className="py-5" role="status">{text('Chargement…','Loading…')}</p>:!registrations.data?.items.length?<div className="py-10 text-center"><Users className="mx-auto mb-3 text-muted-foreground" aria-hidden="true"/><p className="font-medium">{text('Votre réseau commence ici','Your network starts here')}</p><p className="mt-1 text-sm text-muted-foreground">{text('Partagez votre lien pour voir apparaître vos premières inscriptions.','Share your link to see your first registrations.')}</p></div>:<div className="mt-5 space-y-3">{registrations.data.items.map(row=><article key={row.organisation_id} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div className="min-w-0"><h3 className="break-words font-semibold">{row.business_name||text('Pressing sans nom','Unnamed laundry')}</h3><p className="mt-1 text-sm text-muted-foreground">{text('Inscrit le','Registered on')} {date(row.created_at)}</p></div><span className={`w-fit rounded-full px-3 py-1 text-sm ${row.payments?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{row.payments?text('Paiement confirmé','Payment confirmed'):text('Inscrit · aucun paiement confirmé','Registered · no confirmed payment')}</span><div className="sm:text-right"><p className="font-semibold">{money(row.amount_xaf)}</p><p className="text-xs text-muted-foreground">{row.payments} {text('paiement(s)','payment(s)')} · {text('Dernier','Latest')} : {date(row.last_paid_at)}</p></div></article>)}</div>}
        {!!registrations.data?.total&&<nav className="mt-5 flex items-center justify-between gap-2" aria-label={text('Pagination des inscriptions','Registration pagination')}><Button variant="outline" disabled={page<=1} onClick={()=>setPage(page-1)}>{text('Précédent','Previous')}</Button><span className="text-sm">{page} / {Math.max(1,Math.ceil(registrations.data.total/25))}</span><Button variant="outline" disabled={page*25>=registrations.data.total} onClick={()=>setPage(page+1)}>{text('Suivant','Next')}</Button></nav>}
      </section>
      <p className="text-sm text-muted-foreground">{text('Montants cumulés des abonnements confirmés. Ces montants ne représentent pas une commission.','Cumulative confirmed subscription amounts. These amounts are not commissions.')} {data.environment==='test'&&text('Données de développement uniquement.','Development data only.')}</p>
    </>}
  </div>;
}
