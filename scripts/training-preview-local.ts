/** Training fixture only. No DB imports, no external services. Original frontend unchanged. */
import express from 'express';
import {registerTrainingRoutes} from '../server/lib/training';
process.env.NODE_ENV='development';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {getDemoFixture,DEMO_USER} from '../client/src/lib/demo-data';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
process.env.SALES_EMAIL_ENABLED='false';process.env.SAAS_BILLING_MODE='disabled';process.env.SAAS_LIVE_ENABLED='false';process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
const app=express();app.use(express.json());
const user={...DEMO_USER,id:'training-owner',email:'formation@example.invalid',businessName:'Pressing Formation',firstName:'Camille',lastName:'Formation',currentSiteId:1,currentSite:{id:1,name:'Pressing Formation'},allSites:[{id:1,name:'Pressing Formation'}],legalAcceptance:{required:false},isPlatformAdmin:false};
app.post('/api/auth/login',(req,res)=>{if(req.body.email!=='formation@example.invalid'||req.body.password!=='Formation-Local-2026!')return res.status(401).json({message:'Identifiants incorrects'});res.setHeader('Set-Cookie','training_session=yes; HttpOnly; SameSite=Strict; Path=/');res.json(user);});
app.post('/api/auth/logout',(_req,res)=>{res.setHeader('Set-Cookie','training_session=; Max-Age=0; Path=/');res.json({ok:true});});
registerTrainingRoutes(app,(req,res,next)=>req.headers.cookie?.includes('training_session=yes')?next():res.sendStatus(401));
app.use('/api',(req,res)=>{
 if(req.path==='/auth/user')return req.headers.cookie?.includes('training_session=yes')?res.json(user):res.sendStatus(401);
 if(req.method!=='GET')return res.status(403).json({message:'Formation : écriture désactivée'});
 if(req.path==='/ambassador/access')return res.json({enabled:false});
 if(req.path==='/analytics/customer-follow-up-summary')return res.json({count:0});
 if(req.path.includes('marketing')||req.path.includes('pixel'))return res.json({enabled:false});
 const fixture=getDemoFixture('/api'+req.url,1);res.json(fixture??[]);
});
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
app.use(vite.middlewares);
app.get(/.*/,async(req,res)=>res.type('html').send(await vite.transformIndexHtml(req.originalUrl,await readFile('client/index.html','utf8'))));
app.listen(5340,'127.0.0.1',()=>console.log('TRAINING ONLY http://127.0.0.1:5340/auth — no database, no emails, no payments, no jobs'));
