import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { once } from 'node:events';
import { trainingEnabled } from '../../shared/training-availability';
import { registerTrainingRoutes } from './training';

test('activation is explicit in production and fails closed for invalid values',()=>{
 assert.equal(trainingEnabled('development',undefined),true);
 for(const env of ['production','test',undefined]) assert.equal(trainingEnabled(env,undefined),false);
 for(const flag of ['false','','TRUE','1','yes']) for(const env of ['production','development']) assert.equal(trainingEnabled(env,flag),false);
 assert.equal(trainingEnabled('production','true'),true);
});

test('production activation preserves ordinary and admin authorization, and can be disabled',async()=>{
 const oldEnv=process.env.NODE_ENV, oldFlag=process.env.TRAINING_ENABLED;
 process.env.NODE_ENV='production';process.env.TRAINING_ENABLED='true';
 const app=express();let loads=0;
 registerTrainingRoutes(app,(req,res,next)=>req.headers.authorization==='user'?next():res.sendStatus(401),async()=>{loads++;return Buffer.from('0123456789');},(req,res,next)=>req.headers.authorization==='verified-admin'?next():res.sendStatus(403));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{
  assert.equal((await fetch(base+'/api/training')).status,401);
  const data=await(await fetch(base+'/api/training',{headers:{authorization:'user'}})).json();
  assert.equal(data.lessons.length,17);assert.ok(data.lessons.every((l:any)=>l.audience!=='admin'));
  for(const route of ['/api/training/admin','/api/training/super-admin/pc/video','/api/training/super-admin/mobile/video'])assert.equal((await fetch(base+route,{headers:{authorization:'user'}})).status,403);
  assert.equal(loads,0);
  for(const mode of ['pc','mobile']){
   assert.equal((await fetch(base+`/api/training/connexion-menu/${mode}/video`)).status,401);
   assert.equal((await fetch(base+`/api/training/connexion-menu/${mode}/video`,{headers:{authorization:'user',range:'bytes=2-4'}})).status,206);
   assert.equal((await fetch(base+`/api/training/super-admin/${mode}/video`,{headers:{authorization:'verified-admin'}})).status,200);
  }
  process.env.TRAINING_ENABLED='false';
  for(const route of ['/api/training','/api/training/admin','/api/training/connexion-menu/pc/video','/api/training/super-admin/mobile/video'])assert.equal((await fetch(base+route,{headers:{authorization:'verified-admin'}})).status,404);
 }finally{
  server.close();
  if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv;
  if(oldFlag===undefined)delete process.env.TRAINING_ENABLED;else process.env.TRAINING_ENABLED=oldFlag;
 }
});
