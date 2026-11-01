import type { Express, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db';
import { rateLimit } from './rate-limit';
import { SalesAccountStore, SalesAccountError, type SalesAuthDatabase } from './sales-account-store';
import { sendSalesInvitationEmail, type SalesInvitationEmail, type SalesEmailDelivery } from './sales-invitation-email';
import { salesOwnSummary, salesOwnRegistrations } from './sales-referrals';

const SESSION_MS=8*60*60*1000;
const tokenSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const inviteSchema=z.object({email:z.string().trim().toLowerCase().email().max(254)}).strict();
const acceptSchema=z.object({token:tokenSchema,password:z.string().min(12).max(72).refine(p=>Buffer.byteLength(p,'utf8')<=72).refine(p=>!['password','123456','qwerty','xpresspro'].some(s=>p.toLowerCase().includes(s)))}).strict();
const loginSchema=z.object({email:z.string().trim().toLowerCase().email().max(254),password:z.string().min(1).max(128)}).strict();
const activeSchema=z.object({active:z.boolean()}).strict();
const pageSchema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
// Deliberately not associated with any real account.
const dummyHash=bcrypt.hashSync('dummy-compare-only-not-an-account',12);
export const salesSameOrigin:RequestHandler=(req,res,next)=>{
 try{const origin=new URL(String(req.get('origin')));if(req.get('sec-fetch-site')==='cross-site'||origin.origin!==`${req.protocol}://${req.get('host')}`)return void res.status(403).json({code:'SALES_ORIGIN_REQUIRED'});next();}
 catch{res.status(403).json({code:'SALES_ORIGIN_REQUIRED'});}
};
const ipLimit=rateLimit({name:'sales-auth-ip',windowMs:15*60_000,max:60});
const loginLimit=rateLimit({name:'sales-auth-email',windowMs:15*60_000,max:8,key:req=>String(req.body?.email||'').trim().toLowerCase()});
const tokenLimit=rateLimit({name:'sales-invitation-use',windowMs:15*60_000,max:20});
const adminLimit=rateLimit({name:'sales-access-admin',windowMs:60_000,max:20,key:req=>String(req.session?.userId||''),keyOnly:true});
const runtimeDb:SalesAuthDatabase={query:(s,v)=>pool.query(s,v),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
function portalOrigin(req:any){
 if(process.env.NODE_ENV==='production')return 'https://app.xpressclean.cm';
 const url=new URL(`${req.protocol}://${req.get('host')}`);
 if(!['localhost','127.0.0.1'].includes(url.hostname)&&!url.hostname.endsWith('.replit.dev'))throw new SalesAccountError('INVALID_PORTAL_ORIGIN');
 return url.origin;
}
const regenerate=(session:any)=>new Promise<void>((resolve,reject)=>session.regenerate((e:any)=>e?reject(e):resolve()));
const save=(session:any)=>new Promise<void>((resolve,reject)=>session.save((e:any)=>e?reject(e):resolve()));
export function salesSessionGuard(store:SalesAccountStore):RequestHandler{return async(req:any,res,next)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
 const s=req.session;
 if(!s||s.userId||!z.string().uuid().safeParse(s.salesAccountId).success||!Number.isInteger(s.salesAccountVersion)||!Number.isFinite(s.salesLoginAt)||s.salesLoginAt>Date.now()||Date.now()-s.salesLoginAt>SESSION_MS)return void res.status(401).json({code:'SALES_SIGN_IN_REQUIRED'});
 try{const p=await store.principal(s.salesAccountId,s.salesAccountVersion);if(!p)return void res.status(401).json({code:'SALES_SIGN_IN_REQUIRED'});req.salesPrincipal=p;next();}catch{res.status(503).json({code:'SALES_UNAVAILABLE'});}
};}
export function registerSalesPortalRoutes(app:Express,admin:RequestHandler,options:{db?:SalesAuthDatabase;sendEmail?:(mail:SalesInvitationEmail)=>Promise<SalesEmailDelivery>}={}){
 const store=new SalesAccountStore(options.db||runtimeDb),send=options.sendEmail||sendSalesInvitationEmail,guard=salesSessionGuard(store);
 const wrap=(fn:RequestHandler):RequestHandler=>async(req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');try{await fn(req,res,next);}catch(e){if(e instanceof SalesAccountError){res.status(e.message==='NOT_FOUND'?404:409).json({code:e.message});}else{res.status(503).json({code:'SALES_UNAVAILABLE'});}}};
 app.get('/api/platform-admin/sales/:id/account',admin,wrap(async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return void res.status(400).json({code:'INVALID_REPRESENTATIVE'});res.json(await store.account(id));
 }));
 app.post('/api/platform-admin/sales/:id/invitation',admin,salesSameOrigin,adminLimit,wrap(async(req:any,res)=>{
  const id=Number(req.params.id),input=inviteSchema.safeParse(req.body);if(!input.success||!Number.isSafeInteger(id)||id<1)return void res.status(400).json({code:'INVALID_INVITATION_EMAIL'});
  const origin=portalOrigin(req);const invite=await store.invite(id,input.data.email,req.session.userId);
  try{const delivery=await send({to:invite.email,representativeName:invite.representativeName,url:`${origin}/commercial#invite=${invite.token}`,expiresAt:invite.expiresAt});await store.delivery(invite.id,delivery.status);res.status(201).json({status:delivery.status,expiresAt:invite.expiresAt,...(process.env.NODE_ENV!=='production'?{previewUrl:delivery.previewUrl,previewText:delivery.previewText}:{})});}
  catch{await store.delivery(invite.id,'failed');res.status(503).json({code:'SALES_EMAIL_DELIVERY_FAILED'});}
 }));
 app.patch('/api/platform-admin/sales/:id/account',admin,salesSameOrigin,adminLimit,wrap(async(req:any,res)=>{
  const id=Number(req.params.id),input=activeSchema.safeParse(req.body);if(!input.success||!Number.isSafeInteger(id)||id<1)return void res.status(400).json({code:'INVALID_ACCOUNT_STATE'});await store.setActive(id,input.data.active,req.session.userId);res.json({ok:true});
 }));
 app.post('/api/sales/invitations/inspect',salesSameOrigin,ipLimit,tokenLimit,wrap(async(req,res)=>{
  const v=z.object({token:tokenSchema}).strict().safeParse(req.body);if(!v.success)return void res.status(400).json({code:'INVALID_INVITATION'});res.json(await store.inspect(v.data.token));
 }));
 app.post('/api/sales/invitations/accept',salesSameOrigin,ipLimit,tokenLimit,wrap(async(req,res)=>{
  const v=acceptSchema.safeParse(req.body);if(!v.success)return void res.status(400).json({code:'SALES_PASSWORD_RULE'});
  // Validate before expensive hashing; the transaction rechecks expiry/revocation and single use.
  await store.inspect(v.data.token);await store.accept(v.data.token,await bcrypt.hash(v.data.password,12));res.json({ok:true});
 }));
 app.post('/api/sales/login',salesSameOrigin,ipLimit,loginLimit,wrap(async(req:any,res)=>{
  const v=loginSchema.safeParse(req.body);if(!v.success)return void res.status(401).json({code:'SALES_INVALID_CREDENTIALS'});
  const a=await store.credentials(v.data.email);const matches=await bcrypt.compare(v.data.password,a?.password_hash||dummyHash);
  if(!a||!a.active||!a.password_hash||!matches)return void res.status(401).json({code:'SALES_INVALID_CREDENTIALS'});
  await store.db.query("INSERT INTO sales_access_events(account_id,action) VALUES($1,'login')",[a.id]);
  await regenerate(req.session);req.session.salesAccountId=a.id;req.session.salesAccountVersion=a.auth_version;req.session.salesLoginAt=Date.now();req.session.cookie.maxAge=SESSION_MS;await save(req.session);res.json({ok:true});
 }));
 app.get('/api/sales/session',guard,wrap(async(req:any,res)=>{const p=req.salesPrincipal;res.json({name:p.name,country:p.country,email:p.email});}));
 app.get('/api/sales/summary',guard,wrap(async(req:any,res)=>{const r=await salesOwnSummary(req.salesPrincipal.representative_id);if(!r)return void res.status(404).json({code:'NOT_FOUND'});res.json(r);}));
 app.get('/api/sales/registrations',guard,wrap(async(req:any,res)=>{const p=pageSchema.safeParse(req.query);if(!p.success)return void res.status(400).json({code:'INVALID_FILTERS'});res.json(await salesOwnRegistrations(req.salesPrincipal.representative_id,p.data.page));}));
 app.post('/api/sales/logout',salesSameOrigin,guard,wrap(async(req:any,res)=>{const id=req.salesPrincipal.id;await new Promise<void>((resolve,reject)=>req.session.destroy((e:any)=>e?reject(e):resolve()));res.clearCookie('connect.sid',{path:'/'});await store.db.query("INSERT INTO sales_access_events(account_id,action) VALUES($1,'logout')",[id]);res.json({ok:true});}));
}
