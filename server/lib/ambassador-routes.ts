import type {Express,RequestHandler} from 'express';
import {z} from 'zod';
import {AmbassadorAccess,AmbassadorError} from './ambassador-access';
import {SALES_COUNTRIES} from '../../shared/sales-referrals';
import {rateLimit} from './rate-limit';
import {salesOwnSummary,salesOwnRegistrations} from './sales-referrals';
import {salesSameOrigin} from './sales-portal-routes';

const inputSchema=z.object({userId:z.string().min(1).max(128),name:z.string().trim().min(2).max(120),country:z.string().refine(v=>SALES_COUNTRIES.includes(v)),representativeId:z.number().int().positive().optional()}).strict();
const adminLimit=rateLimit({name:'ambassador-access-admin',windowMs:60_000,max:30,key:req=>String(req.session?.userId||''),keyOnly:true});
const pageSchema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
const noStore:RequestHandler=(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();};
const wrap=(fn:RequestHandler):RequestHandler=>async(req,res,next)=>{
  try{await fn(req,res,next);}catch(error){
    if(error instanceof AmbassadorError)res.status(error.message==='AMBASSADOR_DEFERRED'?403:error.message.endsWith('NOT_FOUND')?404:409).json({code:error.message});
    else res.status(503).json({code:'AMBASSADOR_UNAVAILABLE'});
  }
};
export function registerAmbassadorRoutes(app:Express,admin:RequestHandler,authenticate:RequestHandler,store=new AmbassadorAccess()){
  app.get('/api/platform-admin/ambassadors/users',admin,noStore,adminLimit,wrap(async(req,res)=>{
    const input=z.object({search:z.string().trim().min(2).max(120)}).strict().safeParse(req.query);
    if(!input.success)return void res.status(400).json({code:'INVALID_SEARCH'});
    res.json({items:await store.candidates(input.data.search)});
  }));
  app.post('/api/platform-admin/ambassadors',admin,noStore,salesSameOrigin,adminLimit,wrap(async(req:any,res)=>{
    const input=inputSchema.safeParse(req.body);
    if(!input.success)return void res.status(400).json({code:'INVALID_AMBASSADOR'});
    res.json(await store.activate(input.data,req.session.userId));
  }));
  app.patch('/api/platform-admin/ambassadors/:id',admin,noStore,salesSameOrigin,adminLimit,wrap(async(req:any,res)=>{
    const input=z.object({active:z.boolean()}).strict().safeParse(req.body),id=Number(req.params.id);
    if(!input.success||!Number.isSafeInteger(id)||id<1)return void res.status(400).json({code:'INVALID_AMBASSADOR'});
    res.json(await store.setActive(id,input.data.active,req.session.userId));
  }));
  const principal:RequestHandler=wrap(async(req:any,res,next)=>{
    if(!req.session?.userId)return void res.status(401).json({code:'SIGN_IN_REQUIRED'});
    const rep=await store.principal(req.session.userId);
    if(!rep)return void res.status(403).json({code:'AMBASSADOR_NOT_ENABLED'});
    req.ambassador=rep;next();
  });
  app.get('/api/ambassador/access',authenticate,noStore,wrap(async(req:any,res)=>{res.json({enabled:!!(await store.principal(req.session.userId))});}));
  app.get('/api/ambassador/summary',authenticate,noStore,principal,wrap(async(req:any,res)=>{
    if(Object.keys(req.query).length)return void res.status(400).json({code:'INVALID_FILTERS'});
    const summary=await salesOwnSummary(req.ambassador.id);
    if(!summary)return void res.status(403).json({code:'AMBASSADOR_NOT_ENABLED'});
    res.json(summary);
  }));
  app.get('/api/ambassador/registrations',authenticate,noStore,principal,wrap(async(req:any,res)=>{
    const input=pageSchema.safeParse(req.query);
    if(!input.success)return void res.status(400).json({code:'INVALID_FILTERS'});
    res.json(await salesOwnRegistrations(req.ambassador.id,input.data.page));
  }));
}
