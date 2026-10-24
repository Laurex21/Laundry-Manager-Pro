/** UI-only fixture. No database, no provider credentials, no external payment. */
import express from "express";
import path from "node:path";
import {readFile} from "node:fs/promises";
import {createServer} from "vite";
let invoice:any=null;
const app=express();app.use(express.json());
app.get('/api/saas/collection-pilot',(_req,res)=>res.json({amountXaf:50,subscriptionChanged:false,invoice}));
app.post('/api/saas/collection-pilot/quote',(_req,res)=>{invoice??={id:'00000000-0000-4000-8000-000000000050',status:'quoted',redirect_url:null};res.status(201).json(invoice);});
app.post('/api/saas/collection-pilot/:id/checkout',(_req,res)=>{invoice.status='pending';invoice.redirect_url='https://checkout.pawapay.io/synthetic-never-open';res.json(invoice);});
app.post('/api/saas/collection-pilot/:id/refresh',(_req,res)=>res.json(invoice));
app.post('/__qa/complete',(_req,res)=>{if(!invoice||invoice.status!=='pending')return res.sendStatus(409);invoice.status='paid';res.json({simulated:true});});
app.post('/__qa/reset',(_req,res)=>{invoice=null;res.json({simulated:true});});
const vite=await createServer({configFile:path.resolve('vite.config.ts'),server:{middlewareMode:true,hmr:false},appType:'spa'});
app.get('/collection-pilot-qa.html',async(_req,res)=>{const html=(await readFile(path.resolve('scripts/fixtures/saas-qa.html'),'utf8')).replace('/__SAAS_QA_ENTRY__','/@fs/'+path.resolve('scripts/fixtures/collection-pilot-qa.tsx'));res.type('html').send(await vite.transformIndexHtml('/collection-pilot-qa.html',html));});
app.get('/collection-pilot-mobile-qa.html',(_req,res)=>res.type('html').send('<!doctype html><title>Mobile collection QA</title><body style="margin:0"><iframe title="Mobile 390px" src="/collection-pilot-qa.html" style="width:390px;height:844px;border:0"></iframe>'));
app.use(vite.middlewares);
app.listen(5175,'127.0.0.1',()=>console.log('UI FIXTURE http://127.0.0.1:5175/collection-pilot-qa.html — synthetic data only; no DB/provider'));
