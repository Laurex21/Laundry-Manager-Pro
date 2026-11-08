import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { once } from 'node:events';
import { byteRange, registerTrainingRoutes } from './training';

test('ranges allow seeking, suffixes and reject malformed or overflowing requests',()=>{
 assert.deepEqual(byteRange('bytes=2-4',10),{start:2,end:4});
 assert.deepEqual(byteRange('bytes=7-',10),{start:7,end:9});
 assert.deepEqual(byteRange('bytes=-3',10),{start:7,end:9});
 assert.deepEqual(byteRange('bytes=2-99',10),{start:2,end:9});
 for(const h of ['bytes=10-','bytes=4-2','bytes=-0','bytes=0-1,3-4','bytes=','bytes=999999999999999999-'])assert.equal(byteRange(h,10),false);
});
test('authenticated delivery, isolated variants, seeking, recovery and production guard',async()=>{
 const old=process.env.NODE_ENV;process.env.NODE_ENV='development';
 const app=express();let loads=0,fail=true;
 registerTrainingRoutes(app,(req,res,next)=>req.headers.authorization==='test-session'?next():res.sendStatus(401),async mode=>{
  loads++;if(mode==='mobile'&&fail){fail=false;throw Error('unavailable');}return Buffer.from(mode==='pc'?'0123456789':'mobile');
 });
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const headers={authorization:'test-session'};
 try{
  for(const route of ['/api/training','/api/training/connexion-menu/pc/video'])assert.equal((await fetch(base+route)).status,401);
  assert.equal(loads,0);
  assert.equal((await fetch(base+'/api/training',{headers})).status,200);
  assert.equal((await fetch(base+'/api/training/connexion-menu/invalid/video',{headers})).status,404);
  const url=base+'/api/training/connexion-menu/pc/video';
  const range=await fetch(url,{headers:{...headers,range:'bytes=2-4'}});
  assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),'bytes 2-4/10');assert.equal(await range.text(),'234');
  assert.equal(range.headers.get('cache-control'),'private, no-store');
  assert.equal((await fetch(url,{headers:{...headers,range:'bytes=50-'}})).status,416);
  assert.equal(await(await fetch(url,{headers})).text(),'0123456789');assert.equal(loads,1);
  assert.equal((await fetch(base+'/api/training/missing/pc/video',{headers})).status,404);
  assert.equal((await fetch(base+'/api/training/parametres-recus/pc/video')).status,401);
  assert.equal(await(await fetch(base+'/api/training/parametres-recus/pc/video',{headers})).text(),'0123456789');
  assert.equal(loads,2,'second lesson must have independent cache');
  for(const mode of ['pc','mobile']){
   const route=base+'/api/training/services-tarifs/'+mode+'/video';
   assert.equal((await fetch(route)).status,401);
  }
  assert.equal(await(await fetch(base+'/api/training/services-tarifs/pc/video',{headers})).text(),'0123456789');
  assert.equal(loads,3,'third lesson must have independent cache');
  const mobile=base+'/api/training/connexion-menu/mobile/video';
  assert.equal((await fetch(mobile,{headers})).status,503);
  assert.equal(await(await fetch(mobile,{headers})).text(),'mobile');
  process.env.NODE_ENV='production';
  assert.equal((await fetch(url,{headers})).status,404);
  assert.equal((await fetch(base+'/api/training',{headers})).status,404);
 }finally{server.close();process.env.NODE_ENV=old;}
});

test('complete catalogue and private Super Admin videos enforce server access',async()=>{
 const old=process.env.NODE_ENV;process.env.NODE_ENV='development';
 const app=express();let loads=0;
 registerTrainingRoutes(app,(req,res,next)=>req.headers.authorization==='user'?next():res.sendStatus(401),async()=>{loads++;return Buffer.from('training');},(req,res,next)=>req.headers.authorization==='verified-admin'?next():res.sendStatus(403));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{
  const catalogue=await(await fetch(base+'/api/training',{headers:{authorization:'user'}})).json();
  assert.equal(catalogue.lessons.length,17);assert.ok(!catalogue.lessons.some((x:any)=>x.id==='super-admin'));
  assert.equal((await fetch(base+'/api/training/admin',{headers:{authorization:'user'}})).status,403);
  for(const mode of ['pc','mobile'])assert.equal((await fetch(base+`/api/training/super-admin/${mode}/video`,{headers:{authorization:'user'}})).status,403);
  assert.equal(loads,0,'denied requests must not load private media');
  const all=await(await fetch(base+'/api/training/admin',{headers:{authorization:'verified-admin'}})).json();assert.equal(all.lessons.length,18);
  for(const lesson of all.lessons)for(const mode of ['pc','mobile']){
   const headers={authorization:lesson.audience==='admin'?'verified-admin':'user'};
   assert.equal((await fetch(base+lesson.variants[mode].url,{headers})).status,200);
  }
  assert.equal(loads,36,'each lesson and format must use a distinct cache');
  process.env.NODE_ENV='production';
  assert.equal((await fetch(base+'/api/training/admin',{headers:{authorization:'verified-admin'}})).status,404);
  assert.equal((await fetch(base+'/api/training/super-admin/pc/video',{headers:{authorization:'verified-admin'}})).status,404);
 }finally{server.close();process.env.NODE_ENV=old;}
});
