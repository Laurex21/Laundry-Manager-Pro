import {useState} from 'react';
import {Link} from 'wouter';
import {useTranslation} from 'react-i18next';
import {AlertTriangle,ChevronRight,LockKeyhole} from 'lucide-react';
import {Button} from './ui/button';
import {formatBusinessDateTime} from '@/lib/date-time';
export const CUSTOMER_FOLLOW_UP_URL='/analytics?view=customers#churn-risk';
export function CustomerFollowUpNotice({count,canAnalyze}:{count:number;canAnalyze:boolean}){
 const {i18n}=useTranslation();const fr=i18n.language.startsWith('fr'),text=(a:string,b:string)=>fr?a:b;
 if(!Number.isSafeInteger(count)||count<=0)return null;
 return <Link href={canAnalyze?CUSTOMER_FOLLOW_UP_URL:'/subscriptions?plan=pro'} className="flex min-h-12 items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3.5 py-3 text-orange-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200" data-testid="banner-churn-risk">
  <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true"/><div className="min-w-0"><p className="font-semibold">{text('Clients qui tardent à revenir','Customers overdue for a visit')} : {count}</p><p className="mt-1 text-sm">{text('Ils ne sont pas revenus depuis plus longtemps que leur fréquence habituelle.','They have not returned within their usual visit interval.')}</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold underline">{!canAnalyze&&<LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true"/>}{canAnalyze?text('Voir les clients à relancer','View customers to follow up'):text('Voir la liste avec Pro ou Business','Unlock the list with Pro or Business')}</p></div><ChevronRight className="ml-auto mt-1 h-4 w-4 shrink-0" aria-hidden="true"/>
 </Link>;
}
type Customer={id:number;name:string;lastVisitAt:string|null;avgDaysBetweenVisits:number|null};
export function followUpPage<T>(customers:T[],page:number,size=20){const pages=Math.max(1,Math.ceil(customers.length/size)),current=Math.max(0,Math.min(page,pages-1));return{current,pages,rows:customers.slice(current*size,(current+1)*size),from:customers.length?current*size+1:0,to:Math.min((current+1)*size,customers.length)};}
export function CustomerFollowUpList({customers}:{customers:Customer[]}){
 const {i18n}=useTranslation();const fr=i18n.language.startsWith('fr'),text=(a:string,b:string)=>fr?a:b;
 const [page,setPage]=useState(0);const view=followUpPage(customers,page);
 if(!customers.length)return <p className="text-sm text-muted-foreground">{text('Aucun client en retard sur sa fréquence habituelle de visite.','No customers are overdue for their usual visit interval.')}</p>;
 return <div className="space-y-3"><p className="text-sm" aria-live="polite">{view.from}–{view.to} / {customers.length} {text('clients à relancer','customers to follow up')}</p><ul className="space-y-2">{view.rows.map(customer=><li key={customer.id} className="rounded-md border p-3 text-sm"><Link href={`/customers/${customer.id}`} className="font-semibold text-primary underline break-words">{customer.name}</Link><p className="mt-1 text-xs text-muted-foreground">{text('Dernière visite : ','Last visit: ')}{customer.lastVisitAt?formatBusinessDateTime(customer.lastVisitAt):'—'} · {text('Fréquence habituelle : ','Usual interval: ')}{customer.avgDaysBetweenVisits?`${Math.round(customer.avgDaysBetweenVisits)} ${text('jours','days')}`:'—'}</p></li>)}</ul>{view.pages>1&&<nav aria-label={text('Pages des clients à relancer','Customer follow-up pages')} className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" disabled={view.current===0} onClick={()=>setPage(view.current-1)}>{text('Précédent','Previous')}</Button><span>{view.current+1} / {view.pages}</span><Button type="button" variant="outline" disabled={view.current===view.pages-1} onClick={()=>setPage(view.current+1)}>{text('Suivant','Next')}</Button></nav>}</div>;
}
