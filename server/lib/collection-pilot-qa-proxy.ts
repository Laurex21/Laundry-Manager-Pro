import type { Express, RequestHandler } from "express";
import http from "node:http";

/** Disposable fake-data rehearsal, reachable only in paused development. */
export function collectionQaAllowed(env:NodeJS.ProcessEnv=process.env) {
  return env.NODE_ENV === "development" && env.SAAS_BILLING_MODE === "disabled" && env.SAAS_LIVE_ENABLED === "false" && env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED === "true";
}
export function mountCollectionQaProxy(app:Express,auth:RequestHandler,env:NodeJS.ProcessEnv=process.env) {
  if(!collectionQaAllowed(env))return;
  app.use('/__qa/laurepressing50/api',auth,(req,res)=>{
    if(!collectionQaAllowed())return res.sendStatus(404);
    if(!(['GET','POST'].includes(req.method))||!/^\/(?:(?:info|quote|complete|[a-f0-9-]{36}\/(?:checkout|refresh))\/?)?$/.test(req.path))return res.sendStatus(404);
    if(req.method==='POST' && ![`https://${req.get('host')}`,`http://${req.get('host')}`].includes(req.get('origin')||''))return res.sendStatus(403);
    const body=req.method==='POST'?JSON.stringify(req.body||{}):undefined;
    const upstream=http.request({hostname:'127.0.0.1',port:5175,path:req.path,method:req.method,headers:{'Content-Type':'application/json',...(body?{'Content-Length':Buffer.byteLength(body)}:{})},timeout:5000},reply=>{
      if(reply.headers['x-xpresspro-qa-fixture']!=='laurepressing-50'){reply.resume();res.status(502).json({code:'QA_FIXTURE_UNAVAILABLE'});return;}
      res.status(reply.statusCode||502).set('Cache-Control','private, no-store').type('json');reply.pipe(res);
    });
    upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.status(503).json({code:'QA_FIXTURE_UNAVAILABLE'});else res.end();});
    upstream.end(body);
  });
}
