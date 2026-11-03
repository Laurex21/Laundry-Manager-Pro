import type {Express,RequestHandler} from 'express';
import {CustomerFollowUps,FollowUpError} from './customer-follow-ups';
export function registerCustomerFollowUpRoutes(app:Express,auth:RequestHandler,store:CustomerFollowUps,plan:(req:any)=>Promise<string>){
 const guarded=(fn:(req:any,res:any)=>Promise<void>)=>async(req:any,res:any)=>{
  try{
   if(!['pro','business','enterprise'].includes(await plan(req))){res.status(403).json({code:'SAAS_FEATURE_REQUIRED',feature:'reports'});return;}
   await fn(req,res);
  }catch(error:any){
   if(error instanceof FollowUpError){res.status(error.status).json({code:error.code});return;}
   if(error?.name==='ZodError'){res.status(400).json({code:'INVALID_FOLLOW_UP'});return;}
   res.status(503).json({code:error?.code==='42P01'?'FOLLOW_UP_MIGRATION_REQUIRED':'FOLLOW_UP_UNAVAILABLE'});
  }
 };
 const id=(req:any)=>{const n=Number(req.params.id);if(!Number.isSafeInteger(n)||n<=0)throw new FollowUpError('CUSTOMER_NOT_FOUND',404);return n;};
 const scope=(req:any)=>Array.isArray(req.siteScope)?req.siteScope:[];
 app.get('/api/customer-follow-ups',auth,guarded(async(req,res)=>{res.json(await store.list(scope(req)));}));
 app.get('/api/customer-follow-ups/:id',auth,guarded(async(req,res)=>{res.json(await store.detail(scope(req),id(req)));}));
 app.post('/api/customer-follow-ups/:id/events',auth,guarded(async(req,res)=>{
  // All-sites mode is explicitly read-only, even for an owner.
  const site=Number.isSafeInteger(req.siteId)?req.siteId:null;
  res.status(200).json(await store.record(scope(req),site,id(req),req.userId,req.body));
 }));
}
