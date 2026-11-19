import type { Express, RequestHandler } from 'express';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { TrainingMediaCache } from './training-media-cache';
import path from 'node:path';
import { Client } from '@replit/object-storage';
import { trainingEnabled } from '../../shared/training-availability';
import { TRAINING_LESSONS } from '../../shared/training';

export function byteRange(header: string | undefined, size: number): {start:number;end:number}|null|false {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < size ? {start,end} : false;
}

// Production activation is explicit and never bypasses authentication.
export function registerTrainingRoutes(app: Express, authenticate: RequestHandler, loader?: (mode:'pc'|'mobile')=>Promise<Buffer>, adminAuthenticate?: RequestHandler, ambassadorAllowed: (req: Parameters<RequestHandler>[0])=>Promise<boolean> = async()=>false) {
  const enabled: RequestHandler = (_req,res,next) => trainingEnabled(process.env.NODE_ENV, process.env.TRAINING_ENABLED) ? next() : res.sendStatus(404);
  const cache = new TrainingMediaCache();
  let activeReaders=0;
  async function media(lesson:typeof TRAINING_LESSONS[number],mode:'pc'|'mobile') {
    const variant=lesson.variants[mode];
    return cache.acquire(lesson.id+':'+mode,async()=>{
      if(loader)return Readable.from([await loader(mode)]);
      if(process.env.TRAINING_LOCAL_MEDIA_DIR)return createReadStream(path.join(process.env.TRAINING_LOCAL_MEDIA_DIR,variant.file));
      if(!process.env.TRAINING_BUCKET_ID)throw Error('TRAINING_STORAGE_NOT_CONFIGURED');
      return new Client({bucketId:process.env.TRAINING_BUCKET_ID}).downloadAsStream(variant.file);
    },loader?undefined:variant.sha256);
  }
  app.get('/api/training',enabled,authenticate,async(req,res)=>{
    try {const ambassador=await ambassadorAllowed(req);
      res.set('Cache-Control','private, no-store').json({lessons:TRAINING_LESSONS.filter(x=>x.audience==='user'||(x.audience==='ambassador'&&ambassador))});
    }catch{res.sendStatus(503);}
  });
  const adminGuard: RequestHandler = adminAuthenticate ?? ((_req,res)=>{res.sendStatus(403);});
  app.get('/api/training/admin',enabled,adminGuard,async(req,res)=>{
    try {const ambassador=await ambassadorAllowed(req);res.set('Cache-Control','private, no-store').json({lessons:TRAINING_LESSONS.filter(x=>x.audience!=='ambassador'||ambassador)});}
    catch{res.sendStatus(503);}
  });
  app.get('/api/training/:lessonId/:mode/video',enabled,(req,res,next)=>{
    const lesson=TRAINING_LESSONS.find(x=>x.id===req.params.lessonId);
    return (lesson?.audience==='admin'?adminGuard:authenticate)(req,res,next);
  },async(req,res,next)=>{
    const lesson=TRAINING_LESSONS.find(x=>x.id===req.params.lessonId);
    try{if(lesson?.audience==='ambassador' && !await ambassadorAllowed(req))return void res.sendStatus(403);next();}
    catch{res.sendStatus(503);}
  },async(req,res)=>{
    const lesson=TRAINING_LESSONS.find(x=>x.id===req.params.lessonId);
    if(!lesson) return res.sendStatus(404);
    if(req.params.mode!=='pc' && req.params.mode!=='mobile') return res.sendStatus(404);
    if(activeReaders>=8)return void res.sendStatus(503);
    activeReaders++;
    let file:Awaited<ReturnType<typeof media>>|undefined;
    try {
      file=await media(lesson,req.params.mode);
      if(res.destroyed)return;
      res.set({'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
      const range=byteRange(req.headers.range,file.size);
      if(range===false)return void res.status(416).set('Content-Range',`bytes */${file.size}`).end();
      if(range)res.status(206).set({'Content-Range':`bytes ${range.start}-${range.end}/${file.size}`,'Content-Length':String(range.end-range.start+1)});
      else res.set('Content-Length',String(file.size));
      await pipeline(file.handle.createReadStream({...(range || {}),autoClose:false}),res);
    } catch {
      if(!res.headersSent && !res.destroyed)res.status(503).json({message:'La vidéo est momentanément indisponible. Réessayez dans un instant.'});
      else if(!res.destroyed)res.destroy();
    } finally {try{await file?.handle.close();}finally{activeReaders--;}}
  });
}
