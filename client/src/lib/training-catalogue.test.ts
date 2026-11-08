import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTrainingCatalogue } from './training-catalogue';
import { TRAINING_LESSONS } from '../../../shared/training';
const ordinary = TRAINING_LESSONS.filter(x => x.audience !== 'admin');
for (const status of [401,403,500]) test(`ordinary lessons survive admin refusal ${status}`, async()=>{
 const calls:string[]=[];
 const data=await loadTrainingCatalogue(true,async(url,options)=>{
  calls.push(String(url));assert.equal(options?.credentials,'include');
  return String(url).endsWith('/admin')?new Response('{}',{status}):Response.json({lessons:ordinary});
 });
 assert.equal(data.lessons.length,17);assert.ok(data.lessons.every(x=>x.audience!=='admin'));assert.equal(data.adminUnavailable,true);
 assert.deepEqual(calls,['/api/training','/api/training/admin']);
});
test('ordinary users never request the admin catalogue',async()=>{
 const data=await loadTrainingCatalogue(false,async(url)=>{assert.equal(url,'/api/training');return Response.json({lessons:ordinary});});
 assert.equal(data.lessons.length,17);assert.equal(data.adminUnavailable,false);
});
test('server-authorized admin catalogue includes the protected lesson',async()=>{
 const data=await loadTrainingCatalogue(true,async(url)=>Response.json({lessons:String(url).endsWith('/admin')?TRAINING_LESSONS:ordinary}));
 assert.equal(data.lessons.length,18);assert.equal(data.adminUnavailable,false);
});
test('network failure on optional catalogue preserves ordinary lessons',async()=>{
 const data=await loadTrainingCatalogue(true,async(url)=>{if(String(url).endsWith('/admin'))throw Error('offline');return Response.json({lessons:ordinary});});
 assert.equal(data.lessons.length,17);
});
test('ordinary authentication failure is not bypassed',async()=>{
 await assert.rejects(loadTrainingCatalogue(true,async()=>new Response('{}',{status:401})),/TRAINING_CATALOGUE_UNAVAILABLE/);
});
