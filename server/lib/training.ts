import type { Express, RequestHandler } from 'express';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
export function registerTrainingRoutes(app: Express, authenticate: RequestHandler, loader?: (mode:'pc'|'mobile')=>Promise<Buffer>, adminAuthenticate?: RequestHandler) {
  const enabled: RequestHandler = (_req,res,next) => trainingEnabled(process.env.NODE_ENV, process.env.TRAINING_ENABLED) ? next() : res.sendStatus(404);
  const cache = new Map<string,Promise<Buffer>>();
  async function media(lesson:typeof TRAINING_LESSONS[number],mode:'pc'|'mobile') {
    const cacheKey=lesson.id+':'+mode;
    if (!cache.has(cacheKey)) cache.set(cacheKey,(async()=>{
      const variant=lesson.variants[mode];
      let bytes:Buffer;
      if(loader) bytes=await loader(mode);
      else if(process.env.TRAINING_LOCAL_MEDIA_DIR) bytes=await readFile(path.join(process.env.TRAINING_LOCAL_MEDIA_DIR,variant.file));
      else {
        if(!process.env.TRAINING_BUCKET_ID) throw Error('TRAINING_STORAGE_NOT_CONFIGURED');
        const result=await new Client({bucketId:process.env.TRAINING_BUCKET_ID}).downloadAsBytes(variant.file);
        if(!result.ok) throw Error('TRAINING_MEDIA_UNAVAILABLE');
        bytes=Buffer.from(result.value[0]);
      }
      if(!loader && createHash('sha256').update(bytes).digest('hex')!==variant.sha256) throw Error('TRAINING_MEDIA_INTEGRITY');
      return bytes;
    })().catch(e=>{cache.delete(cacheKey);throw e;}));
    return cache.get(cacheKey)!;
  }
  app.get('/api/training',enabled,authenticate,(_req,res)=>res.json({lessons:TRAINING_LESSONS.filter(x=>x.audience!=='admin')}));
  const adminGuard: RequestHandler = adminAuthenticate ?? ((_req,res)=>{res.sendStatus(403);});
  app.get('/api/training/admin',enabled,adminGuard,(_req,res)=>res.json({lessons:TRAINING_LESSONS}));
  app.get('/api/training/:lessonId/:mode/video',enabled,(req,res,next)=>{
    const lesson=TRAINING_LESSONS.find(x=>x.id===req.params.lessonId);
    return (lesson?.audience==='admin'?adminGuard:authenticate)(req,res,next);
  },async(req,res)=>{
    const lesson=TRAINING_LESSONS.find(x=>x.id===req.params.lessonId);
    if(!lesson) return res.sendStatus(404);
    if(req.params.mode!=='pc' && req.params.mode!=='mobile') return res.sendStatus(404);
    try {
      const bytes=await media(lesson,req.params.mode);
      res.set({'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
      const range=byteRange(req.headers.range,bytes.length);
      if(range===false) return res.status(416).set('Content-Range',`bytes */${bytes.length}`).end();
      if(range) return res.status(206).set({'Content-Range':`bytes ${range.start}-${range.end}/${bytes.length}`,'Content-Length':String(range.end-range.start+1)}).end(bytes.subarray(range.start,range.end+1));
      return res.set('Content-Length',String(bytes.length)).end(bytes);
    } catch { return res.status(503).json({message:'La vidéo est momentanément indisponible. Réessayez dans un instant.'}); }
  });
}
