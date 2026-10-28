import { adminSubscribers } from './platform-admin-saas';
import type { SaasExecutor } from './saas-store';
import { automaticMaintenanceSuspended } from './automatic-maintenance';
import { deferredSaasOrganisations } from './saas-deferred';
import type { DecisionOverview, DecisionAccount } from '../../shared/platform-admin-decision';
const DAY=86400000;
export function decisionDays(value:unknown):number {
  if(value===undefined)return 30;
  if(!['number','string'].includes(typeof value)||!['7','30','90'].includes(String(value)))throw Error('INVALID_DECISION_PERIOD');
  return Number(value);
}
export async function adminDecisionOverview(db:SaasExecutor,days=30,now=new Date()):Promise<DecisionOverview> {
  decisionDays(days);
  // Calendar-day windows in Douala; current day is partial, preceding days complete.
  const local=new Date(now.getTime()+3600000);
  const today=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-3600000;
  const start=today-(days-1)*DAY, previousStart=start-days*DAY, previousEnd=now.getTime()-days*DAY;
  const [accounts,activityResult,invoicesResult,grantsResult]=await Promise.all([
    adminSubscribers(db,now),
    db.query(`SELECT s.organisation_id,min(o.created_at) AT TIME ZONE 'UTC' AS first_order_at,max(o.created_at) AT TIME ZONE 'UTC' AS last_order_at,
      count(*) FILTER(WHERE o.created_at >= ($1::timestamptz AT TIME ZONE 'UTC') AND o.created_at <= ($2::timestamptz AT TIME ZONE 'UTC'))::int AS period_orders
      FROM orders o JOIN sites s ON s.id=o.site_id WHERE o.created_at <= ($2::timestamptz AT TIME ZONE 'UTC') GROUP BY s.organisation_id`,[new Date(start),now]),
    db.query(`SELECT i.id,i.organisation_id,i.total_xaf,i.status,i.provider_status,i.payment_source,i.created_at,i.paid_at,i.quote,
      EXISTS(SELECT 1 FROM saas_events e WHERE e.organisation_id=i.organisation_id AND e.details->>'invoiceId'=i.id::text
        AND e.action IN ('payment_applied','subscription_pilot_paid')) AS activation_event
      FROM saas_invoices i WHERE i.provider_environment='live' AND i.created_at <= $1`,[now]),
    db.query(`SELECT DISTINCT organisation_id FROM saas_events WHERE action='admin_grant'`)
  ]);
  const eligible=accounts.filter(a=>!a.deferred&&Date.parse(a.createdAt)<=now.getTime()),eligibleIds=new Set(eligible.map(a=>a.id));
  const activities=new Map(activityResult.rows.map((r:any)=>[Number(r.organisation_id),r]));
  const allInvoices=invoicesResult.rows.filter((i:any)=>eligibleIds.has(Number(i.organisation_id)));
  const completed=(i:any)=>i.status==='paid'&&i.provider_status==='COMPLETED'&&i.paid_at&&Date.parse(i.paid_at)<=now.getTime();
  const pilot=(i:any)=>['collection_pilot','subscription_pilot'].includes(i.quote?.purpose);
  const inPeriod=(v:any)=>v&&Date.parse(v)>=start&&Date.parse(v)<=now.getTime();
  const commercial=allInvoices.filter((i:any)=>completed(i)&&!pilot(i));
  const paid=allInvoices.filter(completed);
  const current=commercial.filter((i:any)=>inPeriod(i.paid_at));
  const cumulativePayers=new Set(commercial.map((i:any)=>Number(i.organisation_id)));
  const newAccounts=eligible.filter(a=>inPeriod(a.createdAt));
  const trialAccounts=eligible.filter(a=>a.subscription?.status==='trial');
  const due=(a:any,n:number)=>a.subscription?.endDate&&Date.parse(a.subscription.endDate)>now.getTime()&&Date.parse(a.subscription.endDate)<=now.getTime()+n*DAY;
  const ref=(a:any):DecisionAccount=>({id:a.id,name:a.name,endDate:a.subscription?.endDate??null,lastOrderAt:activities.get(a.id)?.last_order_at??null});
  const never=eligible.filter(a=>!activities.has(a.id)&&Date.parse(a.createdAt)<=now.getTime()-7*DAY).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  const inactive=eligible.filter(a=>activities.has(a.id)&&Date.parse(activities.get(a.id)!.last_order_at)<now.getTime()-14*DAY).sort((a,b)=>Date.parse(activities.get(a.id)!.last_order_at)-Date.parse(activities.get(b.id)!.last_order_at));
  const pending=allInvoices.filter((i:any)=>i.status==='pending');
  const failed=allInvoices.filter((i:any)=>i.status==='failed'&&inPeriod(i.created_at));
  const review=allInvoices.filter((i:any)=>i.status==='review'||i.status==='paid'&&i.provider_status!=='COMPLETED');
  // Old contracts without an activation event are not automatically classified as broken.
  // New paid commercial invoices must have the standard immutable 'payment_applied' event.
  const activationMissing=paid.filter((i:any)=>!pilot(i)&&inPeriod(i.paid_at)&&!i.activation_event);
  const issues=[...new Map([...review,...activationMissing,...pending,...failed].map((i:any)=>[i.id,i])).values()]
    .sort((a:any,b:any)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  const offeredIds=new Set(grantsResult.rows.map((r:any)=>Number(r.organisation_id)));
  const daily=Array.from({length:days},(_,n)=>({date:new Date(start+n*DAY+3600000).toISOString().slice(0,10),amount:0}));
  for(const i of current){const day=new Date(Date.parse(i.paid_at)+3600000).toISOString().slice(0,10); const point=daily.find(d=>d.date===day); if(point)point.amount+=Number(i.total_xaf);}
  return {
    generatedAt:now.toISOString(),days,start:new Date(start).toISOString(),previousStart:new Date(previousStart).toISOString(),
    growth:{registered:eligible.length,newAccounts:newAccounts.length,previousNewAccounts:eligible.filter(a=>Date.parse(a.createdAt)>=previousStart&&Date.parse(a.createdAt)<=previousEnd).length,
      activeAccounts:eligible.filter(a=>Number(activities.get(a.id)?.period_orders)>0).length,
      firstOrders:eligible.filter(a=>inPeriod(activities.get(a.id)?.first_order_at)).length,
      cohortSize:newAccounts.length,cohortFirstOrders:newAccounts.filter(a=>activities.has(a.id)).length,
      cohortPayers:newAccounts.filter(a=>cumulativePayers.has(a.id)).length},
    trials:{active:trialAccounts.length,due7:trialAccounts.filter(a=>due(a,7)).length,due14:trialAccounts.filter(a=>due(a,14)).length,
      paidPlansDue7:eligible.filter(a=>a.subscription?.status==='active'&&a.subscription.planPrice>0&&due(a,7)).length,
      free:eligible.filter(a=>a.subscription?.planSlug==='starter'&&a.subscription.status==='active').length,
      historical:eligible.filter(a=>a.source==='legacy').length,excluded:accounts.length-eligible.length,
      due:trialAccounts.filter(a=>due(a,7)).sort((a,b)=>Date.parse(a.subscription!.endDate!)-Date.parse(b.subscription!.endDate!)).slice(0,8).map(ref)},
    revenue:{commercial:current.reduce((n:number,i:any)=>n+Number(i.total_xaf),0),
      previousCommercial:commercial.filter((i:any)=>Date.parse(i.paid_at)>=previousStart&&Date.parse(i.paid_at)<=previousEnd).reduce((n:number,i:any)=>n+Number(i.total_xaf),0),
      pilots:paid.filter((i:any)=>pilot(i)&&inPeriod(i.paid_at)).reduce((n:number,i:any)=>n+Number(i.total_xaf),0),
      renewals:current.filter((i:any)=>i.quote?.kind==='renewal').reduce((n:number,i:any)=>n+Number(i.total_xaf),0),
      payingAccounts:new Set(current.map((i:any)=>Number(i.organisation_id))).size,cumulativePayers:cumulativePayers.size,
      offeredOrHistorical:eligible.filter(a=>a.subscription?.status==='active'&&a.subscription.planPrice>0&&(a.source==='legacy'||offeredIds.has(a.id))&&!cumulativePayers.has(a.id)).length,daily},
    payments:{failed:failed.length,pending:pending.length,review:review.length,paidWithoutActivation:activationMissing.length,
      issues:issues.slice(0,12).map((i:any)=>({id:i.id,organisationId:Number(i.organisation_id),name:eligible.find(a=>a.id===Number(i.organisation_id))!.name,status:activationMissing.includes(i)?'activation_review':i.status,providerStatus:i.provider_status,createdAt:new Date(i.created_at).toISOString(),amount:Number(i.total_xaf),paymentSource:i.payment_source}))},
    support:{neverOrdered:never.length,inactive:inactive.length,never:never.slice(0,8).map(a=>({id:a.id,name:a.name,createdAt:new Date(a.createdAt).toISOString()})),returning:inactive.slice(0,8).map(a=>({id:a.id,name:a.name,lastOrderAt:new Date(activities.get(a.id)!.last_order_at).toISOString()}))},
    technical:{maintenanceSuspended:automaticMaintenanceSuspended(),excludedIds:deferredSaasOrganisations(),billingMode:process.env.SAAS_BILLING_MODE??'unknown',liveEnabled:process.env.SAAS_LIVE_ENABLED==='true',databaseEnvironment:process.env.SAAS_DATABASE_ENVIRONMENT??'unknown',buildCommit:null,builtAt:null,backupVerifiedAt:null}
  };
}
