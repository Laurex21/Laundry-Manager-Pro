import {currentCustomerRisk} from './customer-risk';
import {followUpInput,followUpStatus,type FollowUpEvent,type FollowUpCustomer,type FollowUpDetail} from '../../shared/customer-follow-up';
type Database={query:(sql:string,args?:any[])=>Promise<{rows:any[]}>};
export class FollowUpError extends Error{constructor(readonly code:string,readonly status:number){super(code)}}
const customerSql=`SELECT c.*, COALESCE(f.contact_count,0)::int AS contact_count,
 f.last_contact_at, f.last_outcome, f.next_reminder_date,
 CASE WHEN f.last_contact_at IS NOT NULL THEN (SELECT MIN(o.created_at AT TIME ZONE 'UTC') FROM orders o WHERE o.customer_id=c.id AND o.site_id=ANY($1::int[]) AND o.status<>'cancelled' AND (o.created_at AT TIME ZONE 'UTC')>f.last_contact_at AND (o.created_at AT TIME ZONE 'UTC')<=$2) END AS returned_at
 FROM customers c
 LEFT JOIN LATERAL (SELECT COUNT(*)::int AS contact_count,MAX(created_at) AS last_contact_at,
  (array_agg(outcome ORDER BY created_at DESC,id DESC))[1] AS last_outcome,
  (array_agg(next_reminder_date ORDER BY created_at DESC,id DESC))[1] AS next_reminder_date
 FROM customer_follow_up_events e WHERE e.customer_id=c.id AND e.site_id=c.site_id) f ON true
 WHERE c.site_id=ANY($1::int[])`;
const iso=(v:any)=>v==null?null:new Date(v).toISOString();
const day=(v:any)=>v==null?null:typeof v==='string'?v.slice(0,10):new Date(v).toISOString().slice(0,10);
function customerDto(row:any,now:Date):FollowUpCustomer{
 const candidates=[row.last_visit_at,row.returned_at].filter(Boolean).map(v=>new Date(v)).filter(d=>Number.isFinite(d.getTime())&&d.getTime()<=now.getTime());
 const lastVisit=candidates.length?new Date(Math.max(...candidates.map(d=>d.getTime()))):null;
 const risk=currentCustomerRisk({visitCount:row.visit_count,avgDaysBetweenVisits:row.avg_days_between_visits,lastVisitAt:lastVisit,segment:row.segment,churnRiskScore:row.churn_risk_score},now);
 return {id:row.id,siteId:row.site_id,name:row.name,phone:row.phone,email:row.email,lastVisitAt:iso(lastVisit),avgDaysBetweenVisits:row.avg_days_between_visits==null?null:Number(row.avg_days_between_visits),visitCount:row.visit_count,daysSinceLastVisit:lastVisit?Math.max(0,Math.floor((now.getTime()-lastVisit.getTime())/86400000)):null,atRisk:risk.atRisk,status:followUpStatus(row.last_outcome?{outcome:row.last_outcome}:null,!!row.returned_at),contactCount:row.contact_count,lastContactAt:iso(row.last_contact_at),nextReminderDate:day(row.next_reminder_date),returnedAt:iso(row.returned_at)};
}
function eventDto(r:any):FollowUpEvent{return{id:r.id,customerId:r.customer_id,actorName:r.actor_name,channel:r.channel,outcome:r.outcome,note:r.note,nextReminderDate:day(r.next_reminder_date),createdAt:iso(r.created_at)!};}
export class CustomerFollowUps{
 constructor(readonly db:Database){}
 async list(siteIds:number[],now=new Date()):Promise<FollowUpCustomer[]>{
  if(!siteIds.length)return [];
  const result=await this.db.query(customerSql+' ORDER BY c.name,c.id',[siteIds,now]);
  return result.rows.map(r=>customerDto(r,now)).filter(c=>c.atRisk||c.contactCount>0);
 }
 async detail(siteIds:number[],id:number,now=new Date()):Promise<FollowUpDetail>{
  if(!siteIds.length)throw new FollowUpError('CUSTOMER_NOT_FOUND',404);
  const {rows}=await this.db.query(customerSql+' AND c.id=$3',[siteIds,now,id]);
  if(!rows.length)throw new FollowUpError('CUSTOMER_NOT_FOUND',404);
  const events=await this.db.query('SELECT * FROM customer_follow_up_events WHERE customer_id=$1 AND site_id=ANY($2::int[]) ORDER BY created_at DESC,id DESC',[id,siteIds]);
  return {customer:customerDto(rows[0],now),events:events.rows.map(eventDto)};
 }
 async record(siteIds:number[],writeSite:number|null,customerId:number,userId:string,input:unknown,now=new Date()):Promise<FollowUpEvent>{
  if(!writeSite||!siteIds.includes(writeSite))throw new FollowUpError('SELECT_SITE_REQUIRED',400);
  const data=followUpInput.parse(input);
  if(data.nextReminderDate&&data.nextReminderDate<now.toISOString().slice(0,10))throw new FollowUpError('REMINDER_IN_PAST',400);
  const {rows}=await this.db.query(`INSERT INTO customer_follow_up_events(id,customer_id,site_id,actor_user_id,actor_name,channel,outcome,note,next_reminder_date)
   SELECT $1,c.id,c.site_id,u.id,COALESCE(NULLIF(trim(concat_ws(' ',u.first_name,u.last_name)),''),u.email,'Team member'),$5,$6,$7,$8::date
   FROM customers c JOIN users u ON u.id=$4 WHERE c.id=$2 AND c.site_id=$3
   ON CONFLICT(id) DO NOTHING RETURNING *`,[data.id,customerId,writeSite,userId,data.channel,data.outcome,data.note,data.nextReminderDate]);
  if(rows.length)return eventDto(rows[0]);
  const existing=await this.db.query('SELECT * FROM customer_follow_up_events WHERE id=$1 AND customer_id=$2 AND site_id=$3 AND actor_user_id=$4',[data.id,customerId,writeSite,userId]);
  if(!existing.rows.length){const c=await this.db.query('SELECT id FROM customers WHERE id=$1 AND site_id=$2',[customerId,writeSite]);throw new FollowUpError(c.rows.length?'FOLLOW_UP_CONFLICT':'CUSTOMER_NOT_FOUND',c.rows.length?409:404);}
  const old=existing.rows[0];
  if(old.channel!==data.channel||old.outcome!==data.outcome||old.note!==data.note||day(old.next_reminder_date)!==data.nextReminderDate)throw new FollowUpError('FOLLOW_UP_CONFLICT',409);
  return eventDto(old);
 }
}
