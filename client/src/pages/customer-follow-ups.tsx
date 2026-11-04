import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Link,useParams} from 'wouter';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useAuth} from '@/hooks/use-auth';
import {useCurrency} from '@/hooks/use-currency';
import {FollowUpRevenueSummary,FollowUpRevenueAmount} from '@/components/customer-follow-up-revenue';
import {useWhatsAppLauncher} from '@/components/whatsapp-launcher';
import {UpgradePrompt} from '@/components/upgrade-prompt';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Card,CardContent} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Loader2,Phone,MessageCircle,ArrowLeft,ArrowRight,Check,UserRound,Clock3} from 'lucide-react';
import {formatBusinessDateTime} from '@/lib/date-time';
import {followUpLabels} from '@/lib/follow-up-labels';
import {followUpChannels,followUpOutcomes,followUpStatuses,type FollowUpCustomer,type FollowUpDetail,type FollowUpInput} from '@shared/customer-follow-up';

async function request(url:string,body?:unknown){
 const response=await fetch(url,{credentials:'include',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const value=await response.json();if(!response.ok)throw Error(value.code||'FOLLOW_UP_UNAVAILABLE');return value;
}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export default function CustomerFollowUps(){
 const {hasFeature}=useAuth();const {i18n}=useTranslation();const fr=i18n.language.startsWith('fr');const {id}=useParams<{id?:string}>();
 if(!hasFeature('analytics'))return <UpgradePrompt title={fr?'Suivi des relances clients':'Customer follow-up'} description={fr?'Repérez les clients qui tardent à revenir et conservez le résultat de chaque contact.':'Identify overdue customers and keep a record of every contact.'} requiredPlan="Pro"/>;
 if(id&&(!Number.isSafeInteger(Number(id))||Number(id)<=0))return <p role="alert">{fr?'Client introuvable.':'Customer not found.'}</p>;
 return <FollowUpWorkspace key={id??'list'} id={id?Number(id):null}/>;
}
export function FollowUpWorkspace({id}:{id:number|null}){
 const symbol=useCurrency(state=>state.getSymbol());
 const {i18n}=useTranslation();const fr=i18n.language.startsWith('fr'),text=(a:string,b:string)=>fr?a:b,labels=followUpLabels(fr);
 const {currentSite,user}=useAuth();const scope=currentSite?.id??'all';const qc=useQueryClient();const {openWhatsApp}=useWhatsAppLauncher();
 const list=useQuery<FollowUpCustomer[]>({queryKey:['/api/customer-follow-ups',scope],enabled:id===null,queryFn:()=>request('/api/customer-follow-ups'),refetchInterval:60_000});
 const detail=useQuery<FollowUpDetail>({queryKey:['/api/customer-follow-ups',scope,id],enabled:id!==null,queryFn:()=>request(`/api/customer-follow-ups/${id}`),refetchInterval:60_000});
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(0);
 const [channel,setChannel]=useState<FollowUpInput['channel']>('call'),[outcome,setOutcome]=useState<FollowUpInput['outcome']>('contacted'),[note,setNote]=useState(''),[reminder,setReminder]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const submitting=useRef(false),eventId=useRef(crypto.randomUUID());
 useEffect(()=>{setPage(0)},[scope]);
 const failures:Record<string,string>={
  SAAS_FEATURE_REQUIRED:text('Cet espace est réservé aux formules Pro et Business.','This workspace requires Pro or Business.'),
  SAAS_SITE_READ_ONLY:text('Cette boutique est consultable en historique uniquement. Sélectionnez une boutique active.','This site is historical only. Select an active site.'),
  SELECT_SITE_REQUIRED:text('Sélectionnez une boutique précise avant d’enregistrer une relance.','Select a specific site before recording a contact.'),
  CUSTOMER_NOT_FOUND:text('Ce client est introuvable dans les boutiques auxquelles vous avez accès.','This customer was not found in your authorised sites.'),
  REMINDER_IN_PAST:text('La date de rappel doit être aujourd’hui ou une date à venir.','The reminder must be today or in the future.'),
  FOLLOW_UP_MIGRATION_REQUIRED:text('L’espace de relance est en cours de préparation. L’historique client reste accessible.','The follow-up workspace is being prepared. Customer history remains available.'),
  FOLLOW_UP_CONFLICT:text('Cette relance a peut-être déjà été enregistrée. Vérifiez l’historique avant de recommencer.','This contact may already have been recorded. Check the history before trying again.'),
  INVALID_FOLLOW_UP:text('Vérifiez le moyen de contact, le résultat, le compte rendu et la date de rappel.','Check the channel, outcome, notes and reminder date.'),
 };
 const failure=(code:string)=>failures[code]??text('Le suivi n’a pas pu être chargé ou enregistré. Réessayez sans créer un second contact.','The follow-up could not be loaded or saved. Retry without creating a second contact.');
 async function submit(e:FormEvent){
  e.preventDefault();if(submitting.current||!id)return;
  if(note.trim().length<3||note.trim().length>2000){setError(failures.INVALID_FOLLOW_UP);return;}
  submitting.current=true;setBusy(true);setError('');setSuccess('');
  try{
   await request(`/api/customer-follow-ups/${id}/events`,{id:eventId.current,channel,outcome,note:note.trim(),nextReminderDate:reminder||null});
   eventId.current=crypto.randomUUID();setNote('');setReminder('');setSuccess(text('Relance enregistrée. La date et l’auteur ont été sauvegardés.','Contact recorded. The date and author were saved.'));
   await qc.invalidateQueries({queryKey:['/api/customer-follow-ups']});
  }catch(e){setError(failure(e instanceof Error?e.message:''));await qc.invalidateQueries({queryKey:['/api/customer-follow-ups']});}
  finally{submitting.current=false;setBusy(false);}
 }
 const activeQuery=id===null?list:detail;
 if(activeQuery.isLoading)return <p className="flex items-center gap-2 p-5"><Loader2 className="h-5 w-5 animate-spin"/>{text('Chargement des relances…','Loading follow-ups…')}</p>;
 if(activeQuery.error)return <Card><CardContent className="space-y-4 p-6"><p role="alert">{failure(activeQuery.error.message)}</p><Button variant="outline" onClick={()=>void activeQuery.refetch()}>{text('Réessayer','Retry')}</Button><Link className="block text-primary underline" href="/customers">{text('Voir les clients','View customers')}</Link></CardContent></Card>;
 if(id===null){
  const rows=list.data??[],filtered=rows.filter(c=>(filter==='all'||c.status===filter)&&`${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/20)),current=Math.min(page,pages-1),visible=filtered.slice(current*20,(current+1)*20);
  return <div className="space-y-5" data-testid="follow-up-workspace"><header><h1 className="text-2xl font-bold text-[#082d5b]">{text('Clients à relancer','Customer follow-up')}</h1><p className="mt-1 text-sm text-muted-foreground">{text('Suivez les clients qui tardent à revenir, vos contacts et leurs résultats.','Track overdue customers, your contacts and their outcomes.')}</p></header>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
    [text('Clients à suivre','Customers to follow'),rows.length],
    [text('À relancer','To contact'),rows.filter(c=>c.status==='to_contact').length],
    [text('Retour annoncé','Return planned'),rows.filter(c=>c.status==='return_planned').length],
    [text('Retour confirmé','Return confirmed'),rows.filter(c=>c.status==='returned').length],
   ].map(([label,value])=><Card key={String(label)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><strong className="mt-2 block text-2xl">{value}</strong></CardContent></Card>)}</div>
   <FollowUpRevenueSummary customers={filtered} symbol={symbol}/>
   <Card><CardContent className="space-y-4 p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row"><Input aria-label={text('Rechercher un client','Find a customer')} placeholder={text('Nom ou téléphone du client…','Customer name or phone…')} value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/><select aria-label={text('Statut de la relance','Follow-up status')} className="min-h-11 rounded-md border bg-background px-3 text-sm" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}><option value="all">{text('Tous les statuts','All statuses')}</option>{followUpStatuses.map(s=><option key={s} value={s}>{labels.status[s]}</option>)}</select></div>
    <p className="text-sm text-muted-foreground" aria-live="polite">{filtered.length?current*20+1:0}–{Math.min((current+1)*20,filtered.length)} / {filtered.length} {text('clients','customers')}</p>
    <ul className="space-y-3">{visible.map(c=><li key={c.id}><Link href={`/customer-follow-ups/${c.id}`} className="flex min-h-20 flex-col items-stretch justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary"><div className="min-w-0"><p className="break-words font-bold">{c.name}</p><p className="mt-1 text-xs text-muted-foreground">{c.lastVisitAt?`${text('Dernière visite : ','Last visit: ')}${formatBusinessDateTime(c.lastVisitAt)}`:text('Dernière visite non renseignée','No last visit recorded')}</p><p className="mt-1 text-xs text-muted-foreground">{c.contactCount} {text('relance(s)','contact(s)')}{c.nextReminderDate?` · ${text('Rappel : ','Reminder: ')}${c.nextReminderDate}`:''}</p><FollowUpRevenueAmount customer={c} symbol={symbol}/></div><div className="flex shrink-0 items-center gap-2"><Badge className="max-w-32 whitespace-normal text-center" variant={c.status==='returned'?'default':'secondary'}>{labels.status[c.status]}</Badge><ArrowRight className="h-4 w-4"/></div></Link></li>)}</ul>
    {!filtered.length&&<p className="py-6 text-center text-sm text-muted-foreground">{text('Aucun client à afficher avec ces critères.','No customers match these filters.')}</p>}
    {pages>1&&<nav aria-label={text('Pages des relances','Follow-up pages')} className="flex flex-wrap items-center justify-center gap-3"><Button variant="outline" disabled={current===0} onClick={()=>setPage(current-1)}>{text('Précédent','Previous')}</Button><span className="text-sm">{current+1} / {pages}</span><Button variant="outline" disabled={current===pages-1} onClick={()=>setPage(current+1)}>{text('Suivant','Next')}</Button></nav>}
   </CardContent></Card><p className="text-xs text-muted-foreground">{text('Un retour annoncé n’est pas une visite. Le retour est confirmé uniquement par une nouvelle commande non annulée après le dernier contact.','A planned return is not a visit. A return is confirmed only by a new non-cancelled order after the latest contact.')}</p></div>;
 }
 const data=detail.data;if(!data)return null;const c=data.customer;
 const phone=c.phone.replace(/[^+\d]/g,'');const author=[user?.firstName,user?.lastName].filter(Boolean).join(' ')||text('Votre compte connecté','Your signed-in account');
 return <div className="space-y-5" data-testid="follow-up-detail"><Link href="/customer-follow-ups" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"><ArrowLeft className="h-4 w-4"/>{text('Clients à relancer','Customer follow-up')}</Link>
  <header><h1 className="text-2xl font-bold text-[#082d5b]">{text('Suivi des relances','Follow-up history')}</h1><p className="mt-1 text-sm text-muted-foreground">{text('Gardez une trace de chaque échange et de sa suite.','Keep a record of every conversation and its next steps.')}</p></header>
  <Card><CardContent className="flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center"><div className="flex items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound/></div><div className="min-w-0"><h2 className="break-words text-xl font-bold">{c.name}</h2><p className="break-words text-sm text-muted-foreground">{c.phone}{c.email?` · ${c.email}`:''}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href={`/customers/${c.id}`}>{text('Fiche client','Customer profile')}</Link></Button><Button variant="outline" disabled={!phone} onClick={()=>openWhatsApp({phone:c.phone})}><MessageCircle className="mr-2 h-4 w-4"/>WhatsApp</Button>{phone&&<Button variant="outline" asChild><a href={`tel:${phone}`}><Phone className="mr-2 h-4 w-4"/>{text('Appeler','Call')}</a></Button>}</div></CardContent></Card>
  <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-xs text-muted-foreground">{text('Statut du suivi','Follow-up status')}</p><strong className="mt-1 block">{labels.status[c.status]}</strong></div><p className="max-w-xl text-xs text-muted-foreground">{c.returnedAt?`${text('Nouvelle commande enregistrée le ','New order recorded on ')}${formatBusinessDateTime(c.returnedAt)}`:text('Une relance ou une promesse ne confirme pas le retour du client.','A contact or promise does not confirm a customer’s return.')}</p></CardContent></Card>
  <FollowUpRevenueAmount customer={c} symbol={symbol}/>
  <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]"><div className="space-y-5"><div className="grid grid-cols-3 gap-2">{[[text('Sans visite depuis','Last visit'),c.daysSinceLastVisit===null?'—':`${c.daysSinceLastVisit} ${text('j','days')}`],[text('Fréquence habituelle','Usual interval'),c.avgDaysBetweenVisits?`${Number(c.avgDaysBetweenVisits.toFixed(1))} ${text('j','days')}`:'—'],[text('Relances effectuées','Recorded contacts'),c.contactCount]].map(([label,value])=><Card key={String(label)}><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">{label}</p><strong className="mt-2 block text-xl">{value}</strong></CardContent></Card>)}</div>
   <Card><CardContent className="space-y-5 p-5"><h2 className="font-bold">{text('Historique des relances','Contact history')}</h2>{!data.events.length&&<p className="text-sm text-muted-foreground">{text('Aucune relance enregistrée pour ce client.','No contacts have been recorded for this customer.')}</p>}<ol className="space-y-5">{data.events.map(event=><li key={event.id} className="border-l-2 border-primary/20 pl-4"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{labels.channel[event.channel]}</strong><span className="text-xs text-muted-foreground">{formatBusinessDateTime(event.createdAt)}</span></div><Badge className="mt-2" variant="secondary">{labels.outcome[event.outcome]}</Badge><p className="mt-2 whitespace-pre-wrap break-words text-sm">{event.note}</p><p className="mt-2 text-xs text-muted-foreground">{text('Enregistré par ','Recorded by ')}{event.actorName}{event.nextReminderDate?` · ${text('Rappel : ','Reminder: ')}${event.nextReminderDate}`:''}</p></li>)}</ol></CardContent></Card></div>
   <Card className="order-first lg:order-none"><CardContent className="space-y-4 p-5"><h2 className="font-bold">{text('Enregistrer une relance','Record a contact')}</h2><p className="text-xs text-muted-foreground">{text('À remplir après le message ou l’appel réellement effectué.','Complete this after the message or call was actually made.')}</p><div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs"><p>{text('Date et auteur sauvegardés automatiquement','Date and author saved automatically')}</p><strong className="mt-1 block">{author}</strong></div>
    {!currentSite&&<p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-950">{failures.SELECT_SITE_REQUIRED}</p>}
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy||!currentSite} className="space-y-4"><legend className="sr-only">{text('Nouvelle relance','New contact')}</legend><label className="block text-sm font-medium">{text('Moyen de contact','Contact channel')}<select className="mt-2 min-h-11 w-full rounded-md border bg-background px-3" value={channel} onChange={e=>setChannel(e.target.value as typeof channel)}>{followUpChannels.map(s=><option key={s} value={s}>{labels.channel[s]}</option>)}</select></label><label className="block text-sm font-medium">{text('Résultat de l’échange','Contact outcome')}<select className="mt-2 min-h-11 w-full rounded-md border bg-background px-3" value={outcome} onChange={e=>setOutcome(e.target.value as typeof outcome)}>{followUpOutcomes.map(s=><option key={s} value={s}>{labels.outcome[s]}</option>)}</select></label><label className="block text-sm font-medium">{text('Compte rendu','Notes')}<Textarea className="mt-2 min-h-28" minLength={3} maxLength={2000} required value={note} onChange={e=>setNote(e.target.value)} placeholder={text('Ce qui a été dit, disponibilité du client, suite à donner…','What was discussed, customer availability, next steps…')}/></label><label className="block text-sm font-medium">{text('Prochain rappel (facultatif)','Next reminder (optional)')}<Input className="mt-2" type="date" min={today()} value={reminder} onInput={e=>setReminder(e.currentTarget.value)} onChange={e=>setReminder(e.target.value)}/></label><Button className="h-auto min-h-12 w-full whitespace-normal" type="submit" disabled={busy||!currentSite}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Check className="mr-2 h-4 w-4"/>}{busy?text('Enregistrement…','Saving…'):text('Enregistrer la relance','Save contact')}</Button></fieldset></form>
    {error&&<p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}{success&&<p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-900">{success}</p>}<p className="text-xs text-muted-foreground">{text('Ouvrir WhatsApp ou lancer un appel ne crée aucune relance automatiquement. Aucun message n’est envoyé par cet enregistrement.','Opening WhatsApp or starting a call does not record a contact automatically. Saving this record sends no message.')}</p>
   </CardContent></Card>
  </div></div>;
}
