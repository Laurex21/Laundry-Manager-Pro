// Read-only verification: approved training objects only, no database.
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {registerTrainingRoutes} from '../server/lib/training';
import {TRAINING_LESSONS} from '../shared/training';
assert.equal(process.env.NODE_ENV,'development');
const app=express();registerTrainingRoutes(app,(req,res,next)=>req.headers.authorization==='isolated-test'?next():res.sendStatus(401),undefined,(req,res,next)=>req.headers.authorization==='isolated-test'?next():res.sendStatus(401));
const s=app.listen(0,'127.0.0.1');await once(s,'listening');
try{
 const base=`http://127.0.0.1:${(s.address() as any).port}`;
 for(const lesson of TRAINING_LESSONS) for(const mode of ['pc','mobile'] as const){
  const url=base+lesson.variants[mode].url;
  assert.equal((await fetch(url)).status,401);
  const r=await fetch(url,{headers:{authorization:'isolated-test'}});assert.equal(r.status,200);
  const b=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(b).digest('hex'),lesson.variants[mode].sha256);
  const seek=await fetch(url,{headers:{authorization:'isolated-test',range:'bytes=100-199'}});assert.equal(seek.status,206);assert.equal((await seek.arrayBuffer()).byteLength,100);
  console.log(`STORAGE_VERIFIED ${lesson.id}/${mode}: ${b.length} bytes, hash and seek OK`);
 }
}finally{s.close();}
