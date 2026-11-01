import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SALES_COUNTRIES, type SalesRepresentative, type SalesRegistration } from '@shared/sales-referrals';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type Page<T>={items:T[];total:number;page:number;pageSize:number;environment?:string};
async function api(path:string,options?:RequestInit){const r=await fetch(path,{credentials:'same-origin',...options});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}
export function salesReferralUrl(code:string,origin=window.location.origin){
 const base=new URL(origin);if(base.hostname==='superadmin.xpressclean.cm')base.hostname='app.xpressclean.cm';
 return `${base.origin}/r/${encodeURIComponent(code)}`;
}
export default function SalesDirectory(){
 const {i18n}=useTranslation();const fr=i18n.language.startsWith('fr');const text=(a:string,b:string)=>fr?a:b;
 const queryClient=useQueryClient();
 const [name,setName]=useState(''),[country,setCountry]=useState('CM'),[filter,setFilter]=useState(''),[page,setPage]=useState(1);
 const [selected,setSelected]=useState<SalesRepresentative|null>(null),[detailPage,setDetailPage]=useState(1),[feedback,setFeedback]=useState('');
 const displayCountry=(code:string)=>new Intl.DisplayNames([fr?'fr':'en'],{type:'region'}).of(code)||code;
 const list=useQuery<Page<SalesRepresentative>>({queryKey:['sales-directory',filter,page],queryFn:()=>api(`/api/platform-admin/sales?page=${page}${filter?`&country=${filter}`:''}`),staleTime:0});
 const details=useQuery<Page<SalesRegistration>>({queryKey:['sales-registrations',selected?.id,detailPage],queryFn:()=>api(`/api/platform-admin/sales/${selected!.id}/registrations?page=${detailPage}`),enabled:!!selected,staleTime:0});
 const create=useMutation({mutationFn:()=>api('/api/platform-admin/sales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,country})}),onSuccess:async(created)=>{setName('');setPage(1);setFilter(created.country);setSelected(null);setFeedback(text('Commercial créé. Son lien personnel est disponible ci-dessous.','Representative created. The personal link is available below.'));await queryClient.invalidateQueries({queryKey:['sales-directory']});}});
 const toggle=useMutation({mutationFn:(rep:SalesRepresentative)=>api(`/api/platform-admin/sales/${rep.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!rep.active})}),onSuccess:async()=>{setFeedback(text('État du lien mis à jour. Les inscriptions et paiements déjà attribués sont conservés.','Link status updated. Existing attributed registrations and payments are retained.'));await queryClient.invalidateQueries({queryKey:['sales-directory']});}});
 const money=(n:number)=>`${Number(n).toLocaleString(i18n.language)} FCFA (XAF)`;
 const date=(v:string|null)=>v?new Date(v).toLocaleString(i18n.language):'—';
 const refresh=async()=>{await list.refetch();if(selected)await details.refetch();};
 return <section className="space-y-5" data-testid="sales-directory">
  <Card><CardHeader><CardTitle>{text('Commerciaux par pays','Sales representatives by country')}</CardTitle><p className="text-sm text-muted-foreground">{text('Liens personnels d’inscription, sans accès au Super Admin. Attribution conservée à l’inscription. Aucun calcul ni paiement de commission dans cette version.','Personal signup links with no Super Admin access. Attribution is retained at signup. This version does not calculate or pay commissions.')}</p></CardHeader><CardContent>
   <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();setFeedback('');create.mutate();}}>
    <label className="min-w-48 flex-1 text-sm">{text('Nom public du commercial','Public representative name')}<Input className="mt-1" required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} autoComplete="off"/></label>
    <label className="min-w-44 text-sm">{text('Pays','Country')}<select className="mt-1 block h-10 w-full rounded-md border bg-background px-3" value={country} onChange={e=>setCountry(e.target.value)}>{SALES_COUNTRIES.map(c=><option key={c} value={c}>{displayCountry(c)} ({c})</option>)}</select></label>
    <Button type="submit" disabled={create.isPending||name.trim().length<2}>{create.isPending?text('Création…','Creating…'):text('Créer le commercial','Create representative')}</Button>
   </form>
   {feedback&&<p className="mt-3 text-sm" role="status">{feedback}</p>}
   {(create.error||toggle.error)&&<p className="mt-3 text-sm text-destructive" role="alert">{text('Action impossible. Vérifiez votre session Super Admin et réessayez.','Action unavailable. Check your Super Admin session and retry.')} ({(create.error||toggle.error)?.message})</p>}
  </CardContent></Card>
  <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-sm">{text('Filtrer par pays','Filter by country')}<select className="ml-2 rounded-md border bg-background p-2" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);setSelected(null);}}><option value="">{text('Tous les pays','All countries')}</option>{SALES_COUNTRIES.map(c=><option key={c} value={c}>{displayCountry(c)}</option>)}</select></label><Button variant="outline" onClick={refresh}>{text('Actualiser','Refresh')}</Button></div>
  <p className="text-sm text-muted-foreground">{list.data?.environment==='production'?text('Production : paiements pawaPay confirmés uniquement.','Production: confirmed pawaPay payments only.'):text('Développement : suivi de test, paiements Sandbox uniquement.','Development: test tracking and Sandbox payments only.')} {text('Totaux cumulés depuis l’inscription attribuée. Les pilotes, attributions gratuites et comptes exclus ne comptent pas comme paiements.','Cumulative totals since attributed signup. Pilots, free grants and excluded accounts are not counted as payments.')}</p>
  {list.isLoading&&<p role="status">{text('Chargement…','Loading…')}</p>}
  {list.error&&<p role="alert" className="text-destructive">{text('Suivi indisponible. Vérifiez la session administrateur et la migration de développement.','Tracking unavailable. Check the administrator session and development migration.')}</p>}
  <div className="grid gap-4 xl:grid-cols-2">{list.data?.items.map(rep=><Card key={rep.id}><CardContent className="space-y-3 p-4">
   <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{rep.name} · {displayCountry(rep.country)}</h3><span className={rep.active?'text-sm text-emerald-700':'text-sm text-muted-foreground'}>{rep.active?text('Lien actif','Active link'):text('Lien désactivé','Disabled link')}</span></div>
   <label className="block text-xs text-muted-foreground">{text('Lien personnel à partager','Personal link to share')}<Input className="mt-1" readOnly value={salesReferralUrl(rep.code)} onFocus={e=>e.target.select()}/></label>
   <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(salesReferralUrl(rep.code));setFeedback(text('Lien copié.','Link copied.'));}catch{setFeedback(text('Sélectionnez et copiez le lien dans le champ.','Select and copy the link from its field.'));}}}>{text('Copier le lien','Copy link')}</Button><Button size="sm" variant="outline" disabled={toggle.isPending} onClick={()=>toggle.mutate(rep)}>{rep.active?text('Désactiver le lien','Disable link'):text('Réactiver le lien','Reactivate link')}</Button></div>
   <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">{text('Inscriptions','Registrations')}</dt><dd className="text-xl font-semibold">{rep.registrations}</dd></div><div><dt className="text-muted-foreground">{text('Comptes ayant payé','Paying accounts')}</dt><dd className="text-xl font-semibold">{rep.paying_accounts}</dd></div><div><dt className="text-muted-foreground">{text('Paiements confirmés','Confirmed payments')}</dt><dd className="font-semibold">{rep.payments}</dd></div><div><dt className="text-muted-foreground">{text('Montant confirmé','Confirmed amount')}</dt><dd className="font-semibold">{money(rep.amount_xaf)}</dd></div></dl>
   <Button size="sm" onClick={()=>{setSelected(rep);setDetailPage(1);}}>{text('Voir les inscriptions et paiements','View registrations and payments')}</Button>
  </CardContent></Card>)}</div>
  {!list.isLoading&&!list.error&&!list.data?.items.length&&<p>{text('Aucun commercial pour cette sélection.','No representatives for this selection.')}</p>}
  {!!list.data?.total&&<div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={page<=1} onClick={()=>setPage(page-1)}>{text('Précédent','Previous')}</Button><span>{page} / {Math.max(1,Math.ceil(list.data.total/25))}</span><Button variant="outline" disabled={page*25>=list.data.total} onClick={()=>setPage(page+1)}>{text('Suivant','Next')}</Button></div>}
  {selected&&<Card data-testid="sales-registrations"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{selected.name} · {text('Inscriptions attribuées','Attributed registrations')}</CardTitle><Button variant="ghost" onClick={()=>setSelected(null)}>{text('Fermer','Close')}</Button></div></CardHeader><CardContent className="space-y-3">
   {details.isLoading&&<p role="status">{text('Chargement…','Loading…')}</p>}{details.error&&<p role="alert">{text('Détail indisponible. Actualisez ou reconnectez-vous.','Details unavailable. Refresh or sign in again.')}</p>}
   {details.data?.items.map(row=><article key={row.user_id} className="grid gap-2 rounded border p-3 text-sm sm:grid-cols-2"><div><p className="font-semibold">{row.business_name||text('Compte sans nom','Unnamed account')} · #{row.organisation_id}</p><p>{text('Inscription','Signup')} : {date(row.created_at)}</p></div><div><p>{row.payments} {text('paiement(s) confirmé(s)','confirmed payment(s)')} · {money(row.amount_xaf)}</p><p className="text-muted-foreground">{text('Dernier paiement','Last payment')} : {date(row.last_paid_at)}</p></div></article>)}
   {!details.isLoading&&!details.error&&!details.data?.items.length&&<p>{text('Aucune inscription attribuée.','No attributed registrations.')}</p>}
   {!!details.data?.total&&<div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={detailPage<=1} onClick={()=>setDetailPage(detailPage-1)}>{text('Précédent','Previous')}</Button><span>{detailPage} / {Math.max(1,Math.ceil(details.data.total/25))}</span><Button variant="outline" disabled={detailPage*25>=details.data.total} onClick={()=>setDetailPage(detailPage+1)}>{text('Suivant','Next')}</Button></div>}
  </CardContent></Card>}
 </section>;
}
