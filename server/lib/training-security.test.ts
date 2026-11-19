import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import express from 'express';
import {once} from 'node:events';
import {TrainingMediaCache} from './training-media-cache';
import {registerTrainingRoutes} from './training';
import {securityHeaders} from './http-security';

test('streamed disk budget, eviction, concurrent reuse, integrity and retry',async()=>{
 const cache=new TrainingMediaCache(16,8);let loads=0;
 const source=async()=>{loads++;return Readable.from([Buffer.from('1234'),Buffer.from('5678')]);};
 const hash=createHash('sha256').update('12345678').digest('hex');
 try{
  const [a,b]=await Promise.all([cache.acquire('a',source,hash),cache.acquire('a',source,hash)]);
  assert.equal(loads,1);await b.handle.close();
  for(const key of ['b','c']){const f=await cache.acquire(key,source,hash);await f.handle.close();}
  assert.equal(await a.handle.readFile('utf8'),'12345678','eviction preserves active reader');await a.handle.close();
  const reload=await cache.acquire('a',source,hash);await reload.handle.close();assert.equal(loads,4);
  await assert.rejects(cache.acquire('large',async()=>Readable.from([Buffer.alloc(9)])),/TOO_LARGE/);
  await assert.rejects(cache.acquire('bad',source,'invalid'),/INTEGRITY/);
  const retry=await cache.acquire('bad',source,hash);assert.equal(retry.size,8);await retry.handle.close();
 }finally{await cache.dispose();}
});

test('Ambassador catalogue and direct PC/mobile access require current activation',async()=>{
 process.env.NODE_ENV='development';let active=false,loads=0,unavailable=false;
 const app=express();
 registerTrainingRoutes(app,(req,res,next)=>req.headers.authorization?next():res.sendStatus(401),async()=>{loads++;return Buffer.from('video');},(_req,res)=>res.sendStatus(403),async()=>{if(unavailable)throw Error('offline');return active;});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as any).port}`;const headers={authorization:'fictional-user'};
 try{
  const catalogue=async()=>(await(await fetch(base+'/api/training',{headers})).json()).lessons;
  assert.ok(!(await catalogue()).some((x:any)=>x.id==='ambassadeur'));
  for(const mode of ['pc','mobile'])assert.equal((await fetch(base+`/api/training/ambassadeur/${mode}/video`,{headers})).status,403);
  assert.equal(loads,0);active=true;
  assert.ok((await catalogue()).some((x:any)=>x.id==='ambassadeur'));
  for(const mode of ['pc','mobile'])assert.equal((await fetch(base+`/api/training/ambassadeur/${mode}/video`,{headers})).status,200);
  active=false;
  assert.equal((await fetch(base+'/api/training/ambassadeur/pc/video',{headers})).status,403,'cached media does not bypass revocation');
  unavailable=true;assert.equal((await fetch(base+'/api/training/ambassadeur/pc/video',{headers})).status,503);
  assert.equal(loads,2);
 }finally{server.close();}
});

test('Super Admin CSP excludes marketing while public measurement remains allowed',()=>{
 const oldEnv=process.env.NODE_ENV,oldPixel=process.env.VITE_TIKTOK_PIXEL_ENABLED;
 process.env.NODE_ENV='production';process.env.VITE_TIKTOK_PIXEL_ENABLED='true';
 try{
  for(const hostname of ['superadmin.xpressclean.cm','SUPERADMIN.xpressclean.cm','app.xpressclean.cm','xpressclean.cm'])for(const path of ['/','/xpresspro','/auth','/platform-admin','/dashboard']){
   const headers:Record<string,string>={};securityHeaders({hostname,path,query:{tab:'register'}} as any,{setHeader:(k:string,v:string)=>headers[k]=v} as any,()=>{});
   const allowed=!hostname.toLowerCase().startsWith('superadmin.')&&['/','/xpresspro','/auth'].includes(path);
   assert.equal(headers['Content-Security-Policy'].includes('analytics.tiktok.com'),allowed,hostname+path);
  }
 }finally{if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv;if(oldPixel===undefined)delete process.env.VITE_TIKTOK_PIXEL_ENABLED;else process.env.VITE_TIKTOK_PIXEL_ENABLED=oldPixel;}
});
