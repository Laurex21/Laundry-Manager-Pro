import crypto from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db';
import { users, type UpsertUser } from '../../shared/models/auth';
import { SALES_CODE, SALES_COUNTRIES } from '../../shared/sales-referrals';
import { authStorage } from '../replit_integrations/auth/storage';
import { rateLimit } from './rate-limit';
import { deferredSaasOrganisations } from './saas-deferred';

export function salesEnvironment(): 'test'|'production' {
 return process.env.NODE_ENV==='production' && process.env.SAAS_DATABASE_ENVIRONMENT==='production'?'production':'test';
}
export class SalesReferralError extends Error {}

// With a referral, user creation and immutable first attribution are one transaction.
// Existing logins and existing organisations are never reassigned by a URL parameter.
export async function createSalesRegistrationUser(data:UpsertUser, code:unknown) {
 if(code===undefined || code==='') return authStorage.upsertUser(data);
 if(typeof code!=='string'||!SALES_CODE.test(code)) throw new SalesReferralError('SALES_REFERRAL_UNAVAILABLE');
 return db.transaction(async tx=>{
  const result=await tx.execute(sql`SELECT id,country FROM sales_representatives WHERE code=${code} AND active AND environment=${salesEnvironment()} FOR SHARE`);
  const rep=result.rows[0];if(!rep)throw new SalesReferralError('SALES_REFERRAL_UNAVAILABLE');
  const [user]=await tx.insert(users).values(data).returning();
  await tx.execute(sql`INSERT INTO sales_registrations(user_id,representative_id,country,environment) VALUES(${user.id},${rep.id},${rep.country},${salesEnvironment()})`);
  return user;
 });
}
export async function completeSalesRegistration(userId:string, organisationId:number|null|undefined) {
 if(!organisationId)throw new SalesReferralError('SALES_REFERRAL_UNAVAILABLE');
 // Assignment can only be completed once, and only for this organisation's owner.
 const result=await pool.query(`UPDATE sales_registrations r SET organisation_id=o.id FROM organisations o
 WHERE r.user_id=$1 AND (r.organisation_id IS NULL OR r.organisation_id=$2) AND o.id=$2 AND o.owner_id=r.user_id AND r.environment=$3 RETURNING r.user_id`,[userId,organisationId,salesEnvironment()]);
 if(!result.rows.length)throw new SalesReferralError('SALES_REFERRAL_UNAVAILABLE');
}

const createSchema=z.object({name:z.string().trim().min(2).max(120),country:z.string().refine(v=>SALES_COUNTRIES.includes(v))}).strict();
const updateSchema=z.object({active:z.boolean()}).strict();
const publicLimit=rateLimit({name:'sales-referral-public',windowMs:60_000,max:60});
const adminLimit=rateLimit({name:'sales-referral-admin',windowMs:60_000,max:30,key:req=>String(req.session?.userId||''),keyOnly:true});
const pageOf=(value:unknown)=>typeof value==='string'&&/^\d+$/.test(value)&&Number(value)>=1&&Number(value)<=100000?Number(value):value===undefined?1:null;

// One invoice contributes once; verified live/sandbox payments are selected separately.
// Attribution predates the payment. Pilots, manual grants and pending/failed attempts are excluded.
const paidCte=`WITH paid AS (
 SELECT i.id,i.organisation_id,i.total_xaf,i.paid_at FROM saas_invoices i
 WHERE i.status='paid' AND i.provider_status='COMPLETED' AND i.paid_at<=now()
 AND i.provider_environment=$2 AND COALESCE(i.quote->>'purpose','') NOT IN ('collection_pilot','subscription_pilot')
 AND EXISTS(SELECT 1 FROM saas_events e WHERE e.organisation_id=i.organisation_id AND e.action='payment_applied' AND e.details->>'invoiceId'=i.id::text)
), registrations AS (
 SELECT r.*,u.business_name FROM sales_registrations r JOIN users u ON u.id=r.user_id
 WHERE r.environment=$1 AND r.organisation_id IS NOT NULL AND NOT(r.organisation_id=ANY($3::int[]))
), totals AS (
 SELECT r.user_id,count(p.id)::int AS payments,COALESCE(sum(p.total_xaf),0)::float8 AS amount_xaf,max(p.paid_at) AS last_paid_at
 FROM registrations r LEFT JOIN paid p ON p.organisation_id=r.organisation_id AND p.paid_at>=r.created_at GROUP BY r.user_id
)`;
const reportArgs=()=>{const env=salesEnvironment();return [env,env==='production'?'live':'sandbox',deferredSaasOrganisations()];};

export function registerSalesRoutes(app:Express, admin:RequestHandler) {
 app.get('/r/:code',publicLimit,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  const code=String(req.params.code);
  try {
   const valid=SALES_CODE.test(code)&&(await pool.query('SELECT id FROM sales_representatives WHERE code=$1 AND active AND environment=$2',[code,salesEnvironment()])).rows.length>0;
   // Fixed local destination: referral links never serve as credentials or open redirects.
   res.redirect(302,valid?`/auth?tab=register&sales=${encodeURIComponent(code)}`:'/auth?tab=register&salesUnavailable=1');
  } catch {res.status(503).send('Referral unavailable');}
 });
 app.get('/api/public/sales-referral/:code',publicLimit,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!SALES_CODE.test(String(req.params.code)))return void res.status(404).json({message:'Not found'});
  try {
   const r=await pool.query('SELECT name,country FROM sales_representatives WHERE code=$1 AND active AND environment=$2',[req.params.code,salesEnvironment()]);
   if(!r.rows[0])return void res.status(404).json({message:'Not found'});
   res.json(r.rows[0]);
  }catch{res.status(503).json({message:'Referral unavailable'});}
 });
 app.get('/api/platform-admin/sales',admin,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const page=pageOf(req.query.page),country=req.query.country;
  if(page===null||(country!==undefined&&!SALES_COUNTRIES.includes(String(country))))return void res.status(400).json({message:'Invalid filters'});
  try {
   const result=await pool.query(`${paidCte}, reps AS (
    SELECT s.*,count(r.user_id)::int AS registrations,count(r.user_id) FILTER(WHERE t.payments>0)::int AS paying_accounts,
    COALESCE(sum(t.payments),0)::int AS payments,COALESCE(sum(t.amount_xaf),0)::float8 AS amount_xaf
    FROM sales_representatives s LEFT JOIN registrations r ON r.representative_id=s.id LEFT JOIN totals t ON t.user_id=r.user_id
    WHERE s.environment=$1 AND ($4::text IS NULL OR s.country=$4) GROUP BY s.id
   ) SELECT (SELECT count(*)::int FROM reps) AS total,COALESCE((SELECT json_agg(p) FROM (SELECT * FROM reps ORDER BY id DESC LIMIT 25 OFFSET $5) p),'[]'::json) AS items`,[...reportArgs(),country||null,(page-1)*25]);
   // Never return administrator identities in this directory.
   for(const r of result.rows[0].items)delete r.created_by;
   res.json({...result.rows[0],page,pageSize:25,environment:salesEnvironment()});
  }catch{res.status(503).json({message:'Sales report unavailable'});}
 });
 app.get('/api/platform-admin/sales/:id/registrations',admin,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const id=Number(req.params.id),page=pageOf(req.query.page);
  if(!Number.isSafeInteger(id)||id<1||page===null)return void res.status(400).json({message:'Invalid filters'});
  try {
   const rep=await pool.query('SELECT id,name,country FROM sales_representatives WHERE id=$1 AND environment=$2',[id,salesEnvironment()]);
   if(!rep.rows.length)return void res.status(404).json({message:'Not found'});
   const result=await pool.query(`${paidCte}, selected AS (
    SELECT r.user_id,r.business_name,r.organisation_id,r.created_at,t.payments,t.amount_xaf,t.last_paid_at
    FROM registrations r JOIN totals t ON t.user_id=r.user_id WHERE r.representative_id=$4
   ) SELECT (SELECT count(*)::int FROM selected) AS total,COALESCE((SELECT json_agg(p) FROM (SELECT * FROM selected ORDER BY created_at DESC,user_id LIMIT 25 OFFSET $5) p),'[]'::json) AS items`,[...reportArgs(),id,(page-1)*25]);
   res.json({...result.rows[0],page,pageSize:25});
  }catch{res.status(503).json({message:'Sales registrations unavailable'});}
 });
 app.post('/api/platform-admin/sales',admin,adminLimit,async(req:any,res)=>{
  const parsed=createSchema.safeParse(req.body);
  if(!parsed.success)return void res.status(400).json({message:'Invalid representative'});
  try {
   const code=parsed.data.country+'-'+crypto.randomBytes(10).toString('hex').toUpperCase();
   const result=await pool.query(`WITH created AS (
    INSERT INTO sales_representatives(name,country,code,environment,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id,name,country,code,active
   ), audited AS (INSERT INTO sales_admin_events(actor_id,representative_id,action) SELECT $5,id,'created' FROM created)
   SELECT * FROM created`,[parsed.data.name,parsed.data.country,code,salesEnvironment(),req.session.userId]);
   res.status(201).json(result.rows[0]);
  }catch{res.status(503).json({message:'Representative creation unavailable'});}
 });
 app.patch('/api/platform-admin/sales/:id',admin,adminLimit,async(req:any,res)=>{
  const parsed=updateSchema.safeParse(req.body),id=Number(req.params.id);
  if(!parsed.success||!Number.isSafeInteger(id)||id<1)return void res.status(400).json({message:'Invalid representative'});
  try {
   const result=await pool.query(`WITH changed AS (
    UPDATE sales_representatives SET active=$2 WHERE id=$1 AND environment=$3 RETURNING id,name,country,code,active
   ), audited AS (INSERT INTO sales_admin_events(actor_id,representative_id,action) SELECT $4,id,CASE WHEN $2 THEN 'activated' ELSE 'disabled' END FROM changed)
   SELECT * FROM changed`,[id,parsed.data.active,salesEnvironment(),req.session.userId]);
   if(!result.rows.length)return void res.status(404).json({message:'Not found'});
   res.json(result.rows[0]);
  }catch{res.status(503).json({message:'Representative update unavailable'});}
 });
}

// Commercial self-service always passes the representative from its authenticated session.
export async function salesOwnSummary(representativeId:number){
 const rep=(await pool.query('SELECT id,name,country,code,active FROM sales_representatives WHERE id=$1 AND environment=$2',[representativeId,salesEnvironment()])).rows[0];
 if(!rep)return null;
 const r=await pool.query(`${paidCte} SELECT count(r.user_id)::int AS registrations,count(r.user_id) FILTER(WHERE t.payments>0)::int AS paying_accounts,COALESCE(sum(t.payments),0)::int AS payments,COALESCE(sum(t.amount_xaf),0)::float8 AS amount_xaf FROM registrations r JOIN totals t ON t.user_id=r.user_id WHERE r.representative_id=$4`,[...reportArgs(),representativeId]);
 return {representative:rep,...r.rows[0],environment:salesEnvironment()};
}
export async function salesOwnRegistrations(representativeId:number,page:number){
 const r=await pool.query(`${paidCte}, selected AS (
 SELECT r.organisation_id,r.business_name,r.created_at,t.payments,t.amount_xaf,t.last_paid_at FROM registrations r JOIN totals t ON t.user_id=r.user_id WHERE r.representative_id=$4
 ) SELECT (SELECT count(*)::int FROM selected) AS total,COALESCE((SELECT json_agg(p) FROM (SELECT * FROM selected ORDER BY created_at DESC,organisation_id DESC LIMIT 25 OFFSET $5) p),'[]'::json) AS items`,[...reportArgs(),representativeId,(page-1)*25]);
 return {...r.rows[0],page,pageSize:25};
}
