import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';

export type OverviewData = {
  date: string; timeZone: string; updatedAt: string; weekStart: string;
  operations: {status:string;count:number}[];
  priorities:{overdue:number;due:number;outstanding:number};
  resources:{employees:number;present:number;machines:number;running:number;low_stock:number};
  trend:{day:string;orders:number;collections:number}[];
  sites:{id:number;name:string;pending:number;overdue:number;collections:number}[];
  memberships:{active:number;expiring:number;low:number;expired:number;collections:number};
};

type Props = { showRisk:boolean; risk?:{atRiskCount:number;insufficientHistoryCount:number}; riskError:boolean; data:OverviewData; today:{ordersCount:number;newCustomersCount:number;collections:number;expenses:number}; openReturns:number; reportsToReview:number; partialError:boolean; onSelect:(v:'quality'|'daily')=>void; money:(n:number)=>string };

export function Overview360({showRisk,risk,riskError,data:d,today,openReturns,reportsToReview,partialError,onSelect,money}:Props) {
  const {t,i18n}=useTranslation(); const fr=i18n.language.startsWith('fr');
  const text=(frText:string,en:string)=>fr?frText:en;
  const block=(title:string,children:React.ReactNode)=> <Card><CardContent className="space-y-4 p-4 sm:p-5"><h2 className="text-lg font-semibold">{title}</h2>{children}</CardContent></Card>;
  const tile=(label:string,value:string|number,href:string)=> <Link key={label} href={href} className="block min-w-0 rounded-lg border p-3 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 break-words text-xl font-semibold tabular-nums">{value}</p></Link>;
  const memberships='/membership-plans?view=subscribers';
  const standardStages=['received','sorting','stain_treatment','washing','drying','ironing','packaging','ready'];
  const stages=[...standardStages,...d.operations.map(x=>x.status).filter(x=>x!=='delivered'&&!standardStages.includes(x))];
  const week=d.trend.filter(x=>x.day>=d.weekStart),previous=d.trend.filter(x=>x.day<d.weekStart);
  const sum=(rows:typeof week,key:'orders'|'collections')=>rows.reduce((a,r)=>a+Number(r[key]),0);
  const delta=(key:'orders'|'collections')=>{const old=sum(previous,key);return old>0?`${((sum(week,key)-old)/old*100).toFixed(1)} %`:text('Pas de base de comparaison','No comparison baseline');};
  return <div className="space-y-4" data-testid="pilotage-overview-360">
    <div className="text-sm text-muted-foreground">{d.date} · {d.timeZone} · {text('Actualisé à','Updated at')} {new Date(d.updatedAt).toLocaleTimeString(i18n.language,{timeZone:d.timeZone,hour:'2-digit',minute:'2-digit'})}</div>
    {block(text('1. Priorités immédiates','1. Immediate priorities'),<>
      {partialError&&<p role="alert" className="text-amber-700">{t('decision_partial_error')}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tile(text('Commandes en retard','Overdue orders'),d.priorities.overdue,'/orders?status=active')}
        {tile(text('Retraits prévus aujourd’hui','Collections due today'),d.priorities.due,'/orders?status=active')}
        {tile(text('Reste à encaisser · toutes commandes','Outstanding · all orders'),money(d.priorities.outstanding),'/payments?view=history')}
        {tile(text('Forfaits expirant sous 7 jours','Memberships expiring within 7 days'),d.memberships.expiring,memberships)}
      </div>
      {showRisk&&<div className="rounded-lg border border-amber-300 bg-amber-50/40 p-3" data-testid="pilotage-customer-risk">
        {tile(text('Clients à risque de perte','Customers at risk of leaving'),riskError?text('Indisponible','Unavailable'):risk?.atRiskCount??'…','/analytics?view=customers#churn-risk')}
        <p className="mt-2 text-xs text-muted-foreground">{riskError ? text('Le risque client n’a pas pu être chargé ; aucune valeur zéro n’est supposée.','Customer risk could not be loaded; zero is not assumed.') : text('Même calcul qu’Analytique : au moins 3 visites et un retour attendu dépassé d’environ 1,8 fois la fréquence habituelle.','Same calculation as Analytics: at least 3 visits and elapsed time of roughly 1.8 times the usual visit interval.')} {risk&&!riskError&&<>{risk.insufficientHistoryCount} {text('clients avec historique insuffisant, exclus du risque.','customers with insufficient history, excluded from risk.')}</>}</p>
        <Link href="/analytics?view=customers#churn-risk" className="inline-flex min-h-11 items-center text-sm text-primary underline">{text('Voir les clients à relancer','View customers to follow up')}</Link>
      </div>}
      <div className="flex flex-wrap gap-4 text-sm">
        <button type="button" className="min-h-11 text-primary underline" onClick={()=>onSelect('quality')}>{partialError?'—':openReturns} {t('pilotage_open_returns')}</button>
        {reportsToReview > 0 && <button type="button" className="min-h-11 text-primary underline" onClick={()=>onSelect('daily')}>{reportsToReview} {t('pilotage_reports_to_review')}</button>}
        <Link href={memberships} className="flex min-h-11 items-center text-primary underline">{d.memberships.low} {text('forfaits presque épuisés','memberships nearly exhausted')} · {d.memberships.expired} {text('échéances dépassées à examiner','expired memberships to review')}</Link>
      </div>
      <p className="text-xs text-muted-foreground">{text('Retards : date promise antérieure à aujourd’hui. Les liens ouvrent le module concerné ; les compteurs ne représentent pas uniquement les commandes reçues aujourd’hui.','Overdue means a promised date before today. Links open the relevant workspace; counts include orders received on earlier days.')}</p>
    </>)}
    {block(text('2. Production en cours','2. Production'),<>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{stages.map(status=>tile(t(`stage_${status}`,text('Autre étape : ','Other stage: ')+status),d.operations.find(x=>x.status===status)?.count??0,`/orders?status=${['received','washing','ready'].includes(status)?status:'active'}`))}{tile(text('Livrées aujourd’hui','Delivered today'),d.operations.find(x=>x.status==='delivered')?.count??0,'/orders?status=delivered')}</div>
      <p className="text-xs text-muted-foreground">{text('Charge actuelle, quelle que soit la date de réception. Les livraisons sont celles enregistrées aujourd’hui.','Current workload, regardless of receipt date. Deliveries are those recorded today.')}</p>
    </>)}
    {block(text('3. Argent et activité du jour','3. Money and today’s activity'),<>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tile(t('pilotage_today_orders'),today.ordersCount,'/orders')}{tile(t('pilotage_today_customers'),today.newCustomersCount,'/customers')}
        {tile(text('Encaissements commandes','Order collections'),money(today.collections),'/payments')}{tile(t('pilotage_today_expenses'),money(today.expenses),'/expenses')}
        {tile(text('Solde commandes moins dépenses','Order collections less expenses'),money(today.collections-today.expenses),'/analytics')}
        {tile(text('Encaissements abonnements clients · séparés','Customer membership collections · separate'),money(d.memberships.collections),'/membership-plans?view=revenue')}
      </div><p className="text-xs text-muted-foreground">{text('Le solde indicatif n’est pas un bénéfice ni un solde bancaire. Les paiements de forfaits sont présentés séparément et ne sont pas additionnés aux encaissements des commandes.','This indicative balance is neither profit nor a bank balance. Membership payments are shown separately and are not added to order collections.')}</p>
    </>)}
    {block(text('4. Moyens disponibles','4. Available resources'),<>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tile(text('Présents pointés / employés actifs','Checked in / active employees'),`${d.resources.present} / ${d.resources.employees}`,'/employees')}
        {tile(text('Machines actives','Active machines'),d.resources.machines,'/machines')}
        {tile(text('Machines avec cycle en cours','Machines with running cycles'),d.resources.running,'/machines')}
        {tile(text('Produits au seuil ou en dessous','Products at or below threshold'),d.resources.low_stock,'/inventory')}
      </div><p className="text-xs text-muted-foreground">{text('Présence basée sur les arrivées pointées aujourd’hui sans départ. Sans pointage ni cycle enregistré, la disponibilité réelle ne peut pas être déduite.','Presence is based on today’s check-ins without checkout. Actual availability cannot be inferred without recorded attendance and production cycles.')}</p>
    </>)}
    {block(text('5. Évolution et boutiques','5. Trends and sites'),<>
      <p className="text-sm">{text('7 derniers jours, aujourd’hui inclus :','Last 7 days, including today:')} {sum(week,'orders')} {text('commandes','orders')} · {money(sum(week,'collections'))}</p>
      <p className="text-xs text-muted-foreground">{text('Par rapport aux 7 jours précédents : commandes','Compared with the previous 7 days: orders')} {delta('orders')} · {text('encaissements','collections')} {delta('collections')}. {text('Aujourd’hui est une journée partielle.','Today is a partial day.')}</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{text('Activité quotidienne sur 7 jours','Daily activity over 7 days')}</caption><thead><tr><th className="p-2">Date</th><th className="p-2">{t('orders')}</th><th className="p-2">{text('Encaissements commandes','Order collections')}</th></tr></thead><tbody>{week.map(x=><tr key={x.day} className="border-t"><td className="p-2">{x.day}</td><td className="p-2">{x.orders}</td><td className="p-2">{money(x.collections)}</td></tr>)}</tbody></table></div>
      <h3 className="font-medium">{text('Boutiques du périmètre sélectionné','Sites in the selected scope')}</h3>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{[text('Boutique','Site'),text('En cours','Pending'),text('En retard','Overdue'),text('Encaissé aujourd’hui','Collected today')].map(x=><th className="p-2" key={x}>{x}</th>)}</tr></thead><tbody>{d.sites.map(x=><tr key={x.id} className="border-t"><td className="p-2">{x.name}</td><td className="p-2">{x.pending}</td><td className="p-2">{x.overdue}</td><td className="p-2">{money(x.collections)}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">{text('Sélectionnez « Tous les sites » dans le sélecteur pour comparer vos boutiques autorisées.','Select “All sites” in the site selector to compare your authorised sites.')}</p>
    </>)}
    {block(text('6. Abonnements clients','6. Customer memberships'),<>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{tile(text('Forfaits actifs et valides','Active, valid memberships'),d.memberships.active,memberships)}{tile(text('Expirent sous 7 jours','Expiring within 7 days'),d.memberships.expiring,memberships)}{tile(text('Quota restant à 20 % ou moins','Remaining quota at 20% or less'),d.memberships.low,memberships)}{tile(text('Expirés à examiner','Expired memberships to review'),d.memberships.expired,memberships)}</div>
      <p className="text-xs text-muted-foreground">{text('Forfaits des clients du pressing, distincts de votre abonnement XpressPro. Validité calculée avec les dates, même si les traitements automatiques sont suspendus. Aucune modification d’abonnement ni relance automatique. Le quota faible est calculé sur les kg, pièces ou commandes incluses ; un quota illimité n’est pas considéré épuisé. Les forfaits expirés remplacés par un nouveau forfait ne sont pas comptés.','These are your customers’ laundry memberships, separate from your XpressPro subscription. Validity uses recorded dates even while automatic jobs are suspended. No membership is modified and no reminder is sent. Low quota uses included kg, pieces or orders; unlimited quotas are excluded. Expired memberships replaced by a newer membership are excluded.')}</p>
      <Link href={memberships} className="inline-flex min-h-11 items-center text-primary underline">{text('Gérer les abonnements clients','Manage customer memberships')}</Link>
    </>)}
  </div>;
}
