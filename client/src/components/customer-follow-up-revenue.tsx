import {Link} from 'wouter';
import {useTranslation} from 'react-i18next';
import {ArrowRight,Clock3,LockKeyhole} from 'lucide-react';
import {Button} from './ui/button';
import {Card,CardContent} from './ui/card';
import {CUSTOMER_FOLLOW_UP_URL} from './customer-follow-up-notice';
import type {FollowUpCustomer} from '@shared/customer-follow-up';

export function CustomerFollowUpEntry({canAnalyze}:{canAnalyze:boolean}){
 const {i18n}=useTranslation(),fr=i18n.language.startsWith('fr');
 return <section className="flex flex-col gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-950 sm:flex-row sm:items-center sm:justify-between" data-testid="customers-follow-up-entry">
  <div className="min-w-0"><h2 className="flex items-start gap-2 font-semibold"><Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true"/>{fr?'Clients qui tardent à revenir':'Customers overdue for a visit'}</h2><p className="mt-1 text-sm">{fr?'Retrouvez les clients à relancer, le manque à gagner estimé et le suivi de vos contacts.':'Find overdue customers, estimated revenue at risk and your contact history.'}</p></div>
  <Button asChild className="h-auto min-h-11 shrink-0 whitespace-normal text-center"><Link href={canAnalyze?CUSTOMER_FOLLOW_UP_URL:'/subscriptions?plan=pro'}>{canAnalyze?<ArrowRight className="mr-2 h-4 w-4 shrink-0" aria-hidden="true"/>:<LockKeyhole className="mr-2 h-4 w-4 shrink-0" aria-hidden="true"/>}{canAnalyze?(fr?'Voir les clients à relancer':'View customers to follow up'):(fr?'Découvrir Pro et Business':'Explore Pro and Business')}</Link></Button>
 </section>;
}

export function followUpRevenueSummary(customers:Pick<FollowUpCustomer,'atRisk'|'monthlyRevenueAtRisk'>[]){
 const overdue=customers.filter(c=>c.atRisk);
 const estimated=overdue.filter(c=>c.monthlyRevenueAtRisk!=null&&Number.isFinite(c.monthlyRevenueAtRisk)&&c.monthlyRevenueAtRisk>=0);
 return {total:estimated.reduce((sum,c)=>sum+c.monthlyRevenueAtRisk!,0),estimated:estimated.length,missing:overdue.length-estimated.length,overdue:overdue.length};
}
export function FollowUpRevenueSummary({customers,symbol}:{customers:FollowUpCustomer[];symbol:string}){
 const {i18n}=useTranslation(),fr=i18n.language.startsWith('fr'),s=followUpRevenueSummary(customers);
 const money=(v:number)=>`${v.toLocaleString(fr?'fr-FR':'en-GB',{maximumFractionDigits:0})} ${symbol}`;
 return <Card className="border-orange-200 bg-orange-50/60" data-testid="follow-up-revenue-summary"><CardContent className="space-y-2 p-5">
  <h2 className="font-semibold text-orange-950">{fr?'Manque à gagner mensuel estimé':'Estimated monthly revenue at risk'}</h2>
  <p className="break-words text-3xl font-bold text-orange-950">{s.overdue>0&&s.estimated===0?(fr?'Non estimable':'Not enough data'):money(s.total)}</p>
  <p className="text-sm">{fr?`Pour les clients encore en retard dans la liste filtrée, toutes pages comprises. Estimation disponible pour ${s.estimated} ${s.estimated===1?'client':'clients'}.`:`For overdue customers in the filtered list, across all pages. ${s.estimated} customer(s) estimated.`}</p>
  {s.missing>0&&<p className="text-sm font-medium">{fr?`${s.missing} ${s.missing===1?'client sans historique suffisant, non inclus':'clients sans historique suffisant, non inclus'} dans ce montant.`:`${s.missing} customer(s) with insufficient history, excluded from this amount.`}</p>}
  <p className="text-xs text-muted-foreground">{fr?'Estimation sur 30 jours : panier moyen des commandes non annulées × 30 ÷ intervalle habituel entre deux visites. Au moins 3 commandes sont nécessaires. Il s’agit de chiffre d’affaires potentiel, pas d’une dette du client ni d’un bénéfice garanti.':'30-day estimate: average non-cancelled order value × 30 ÷ usual visit interval. At least 3 orders are required. This is potential revenue, not customer debt or guaranteed profit.'}</p>
 </CardContent></Card>;
}
export function FollowUpRevenueAmount({customer,symbol}:{customer:FollowUpCustomer;symbol:string}){
 const {i18n}=useTranslation(),fr=i18n.language.startsWith('fr');
 return <p className="mt-2 text-sm font-medium text-orange-900" data-testid="follow-up-revenue-amount">{fr?'Manque à gagner estimé : ':'Estimated revenue at risk: '}{!customer.atRisk?(fr?'aucun retard actuel':'no current delay'):customer.monthlyRevenueAtRisk==null?(fr?'historique insuffisant':'insufficient history'):`${customer.monthlyRevenueAtRisk.toLocaleString(fr?'fr-FR':'en-GB',{maximumFractionDigits:0})} ${symbol}${fr?' / mois':' / month'}`}</p>;
}
