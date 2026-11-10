import { promoSchema } from "../../shared/saas-promos";
import { deferredSaasOrganisations } from "./saas-deferred";
import type { SaasExecutor, SaasInvoice } from './saas-store';
import { SaasError } from './saas-store';
import type { SaasQuote } from '../../shared/saas-plans';
import { promoCode } from '../../shared/saas-promos';

// Called inside the billing transaction, after locking the account. A code lock
// serializes checkout reservations across organisations; quoted invoices use no quota.
export async function applyPromo(tx:SaasExecutor,org:number,environment:string,quote:SaasQuote,code:string,now:Date) {
 const normalized=promoCode.parse(code);
 const p=(await tx.query('SELECT * FROM saas_promos WHERE code=$1 AND environment=$2 FOR UPDATE',[normalized,environment])).rows[0];
 if(!p || !p.active || new Date(p.starts_at)>now || new Date(p.ends_at)<=now)throw new SaasError('PROMO_UNAVAILABLE');
 if(!p.plans.includes(quote.selection.plan) || !['cycle','renewal'].includes(quote.kind) || (quote as any).freeMonths>0 || (quote as any).durationMonths>1)throw new SaasError('PROMO_NOT_ELIGIBLE');
 if(p.representative_id){
  const rep=(await tx.query(`SELECT r.id FROM sales_representatives r JOIN sales_user_access a ON a.representative_id=r.id AND a.environment=r.environment
   WHERE r.id=$1 AND r.active AND r.environment=$2 AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id=a.user_id AND u.organisation_id=ANY($3::int[])) AND NOT EXISTS(SELECT 1 FROM organisations o WHERE o.owner_id=a.user_id AND o.id=ANY($3::int[]))`,[p.representative_id,environment==='live'?'production':'test',deferredSaasOrganisations()])).rows[0];
  if(!rep)throw new SaasError('PROMO_UNAVAILABLE');
 }
 const uses=(await tx.query(`SELECT organisation_id,quote,status FROM saas_invoices WHERE provider_environment=$1 AND status IN ('pending','paid','review') AND quote->'promo'->>'id'=$2`,[environment,String(p.id)])).rows;
 if(uses.length>=p.max_uses || uses.some(u=>Number(u.organisation_id)===org))throw new SaasError('PROMO_LIMIT_REACHED');
 if(p.first_only && (await tx.query(`SELECT id FROM saas_invoices WHERE organisation_id=$1 AND provider_environment=$2 AND (status IN ('paid','review') OR status='pending') AND COALESCE(quote->>'purpose','')<>'collection_pilot' LIMIT 1`,[org,environment])).rows.length)throw new SaasError('PROMO_FIRST_PAYMENT_ONLY');
 const discount=p.kind==='percent'?Math.floor(quote.totalXaf*p.value/100):p.value;
 if(discount<=0 || quote.totalXaf-discount<50)throw new SaasError('PROMO_AMOUNT_INVALID');
 return {...quote,totalXaf:quote.totalXaf-discount,promo:{id:p.id,code:p.code,discountXaf:discount,originalXaf:quote.totalXaf,representativeId:p.representative_id}};
}
export async function validatePromoReservation(tx:SaasExecutor,invoice:SaasInvoice,environment:string,now:Date){
 const p=invoice.quote.promo;if(!p)return;
 const fresh=await applyPromo(tx,invoice.organisation_id,environment,{...invoice.quote,totalXaf:p.originalXaf},p.code,now);
 if(JSON.stringify(fresh.promo)!==JSON.stringify(p)||fresh.totalXaf!==invoice.total_xaf)throw new SaasError('PROMO_CHANGED');
}
export async function attributePromo(tx:SaasExecutor,invoice:SaasInvoice,environment:string){
 const id=invoice.quote.promo?.representativeId;if(!id)return;
 // Never replace the prospect's first attribution, even when a different code is used.
 await tx.query(`INSERT INTO sales_registrations(user_id,representative_id,organisation_id,country,environment)
 SELECT o.owner_id,r.id,o.id,r.country,r.environment FROM organisations o,sales_representatives r
 WHERE o.id=$1 AND r.id=$2 AND r.environment=$3 ON CONFLICT DO NOTHING`,[invoice.organisation_id,id,environment==='live'?'production':'test']);
}

export async function createPromo(tx:SaasExecutor,input:unknown,actor:string,environment:string){
 const v=promoSchema.parse(input);
 if(v.representativeId){
  const r=(await tx.query(`SELECT r.id FROM sales_representatives r JOIN sales_user_access a ON a.representative_id=r.id AND a.environment=r.environment
   JOIN users u ON u.id=a.user_id WHERE r.id=$1 AND r.active AND r.environment=$2
   AND NOT(u.organisation_id=ANY($3::int[])) AND NOT EXISTS(SELECT 1 FROM organisations o WHERE o.owner_id=u.id AND o.id=ANY($3::int[]))`,[v.representativeId,environment==='live'?'production':'test',deferredSaasOrganisations()])).rows[0];
  if(!r)throw new SaasError('PROMO_AMBASSADOR_UNAVAILABLE');
 }
 const row=(await tx.query(`INSERT INTO saas_promos(code,environment,kind,value,plans,starts_at,ends_at,max_uses,first_only,representative_id,created_by)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[v.code,environment,v.kind,v.value,v.plans,v.startsAt,v.endsAt,v.maxUses,v.firstOnly,v.representativeId,actor])).rows[0];
 await tx.query("INSERT INTO saas_promo_events(promo_id,actor_id,action) VALUES($1,$2,'created')",[row.id,actor]);return row;
}
export async function listPromos(tx:SaasExecutor,environment:string,representativeId:number|null=null){
 return (await tx.query(`SELECT p.id,p.code,p.kind,p.value,p.plans,p.starts_at,p.ends_at,p.active,p.first_only,p.max_uses,p.representative_id,
 (SELECT count(*)::int FROM saas_invoices i WHERE i.provider_environment=p.environment AND i.quote->'promo'->>'id'=p.id::text AND i.status='paid') AS uses,
 (SELECT count(*)::int FROM saas_invoices i WHERE i.provider_environment=p.environment AND i.quote->'promo'->>'id'=p.id::text AND i.status IN ('pending','review')) AS reserved
 FROM saas_promos p WHERE p.environment=$1 AND ($2::int IS NULL OR p.representative_id=$2) ORDER BY p.id DESC LIMIT 200`,[environment,representativeId])).rows;
}
