import type {Express,RequestHandler} from 'express';
import {z} from 'zod';
import {createPromo,listPromos} from './saas-promos';
import {SaasError} from './saas-store';
import {ambassadorDatabase,AmbassadorAccess} from './ambassador-access';
import {salesEnvironment} from './sales-referrals';
import {salesSameOrigin} from './sales-portal-routes';
import {rateLimit} from './rate-limit';
const limit=rateLimit({name:'promo-admin',windowMs:60000,max:30,key:req=>String(req.session?.userId),keyOnly:true});
export function registerPromoRoutes(app:Express,admin:RequestHandler,authenticate:RequestHandler){
 const env=()=>salesEnvironment()==='production'?'live':'sandbox';
 const wrap=(fn:RequestHandler):RequestHandler=>async(req,res,next)=>{res.set('Cache-Control','private, no-store');try{await fn(req,res,next);}catch(e:any){res.status(e instanceof z.ZodError?400:e.code==='23505'?409:e instanceof SaasError?e.status:503).json({code:e instanceof z.ZodError?'PROMO_INVALID':e.code==='23505'?'PROMO_DUPLICATE':e instanceof SaasError?e.code:'PROMO_UNAVAILABLE'});}};
 app.get('/api/platform-admin/promos',admin,limit,wrap(async(_req,res)=>{res.json(await listPromos(ambassadorDatabase,env()));}));
 app.post('/api/platform-admin/promos',admin,salesSameOrigin,limit,wrap(async(req:any,res)=>{res.status(201).json(await ambassadorDatabase.transaction(tx=>createPromo(tx,req.body,req.session.userId!,env())));}));
 app.patch('/api/platform-admin/promos/:id',admin,salesSameOrigin,limit,wrap(async(req:any,res)=>{
  const id=z.coerce.number().int().positive().parse(req.params.id),v=z.object({active:z.boolean()}).strict().parse(req.body);
  const row=await ambassadorDatabase.transaction(async tx=>{
   const r=(await tx.query('UPDATE saas_promos SET active=$3 WHERE id=$1 AND environment=$2 RETURNING id,active',[id,env(),v.active])).rows[0];
   if(!r)throw new SaasError('PROMO_UNAVAILABLE',404);
   await tx.query('INSERT INTO saas_promo_events(promo_id,actor_id,action) VALUES($1,$2,$3)',[id,req.session.userId,v.active?'activated':'disabled']);return r;
  });res.json(row);
 }));
 app.get('/api/ambassador/promos',authenticate,limit,wrap(async(req:any,res)=>{
  const rep=await new AmbassadorAccess().principal(req.session.userId!);
  if(!rep)throw new SaasError('AMBASSADOR_NOT_ENABLED',403);
  res.json(await listPromos(ambassadorDatabase,env(),rep.id));
 }));
}
