import { createHash } from 'node:crypto';
import { createWriteStream, rmSync } from 'node:fs';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Private, bounded disk cache. Serial fills bound download memory; open file
// handles keep in-flight readers valid when an older entry is evicted.
export class TrainingMediaCache {
  private directory?: Promise<string>;
  private resolvedDirectory?: string;
  private cleanup = () => {if(this.resolvedDirectory)rmSync(this.resolvedDirectory,{recursive:true,force:true});};
  private entries = new Map<string, {file:string;size:number}>();
  private bytes = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  constructor(private budget = 512 * 1024 * 1024, private maxFile = 256 * 1024 * 1024) {process.once('exit',this.cleanup);}
  async acquire(key:string, source:()=>Promise<Readable>, sha256?:string) {
    if(this.pending >= 16) throw Error('TRAINING_BUSY');
    this.pending++;
    const task = this.tail.then(async()=>{
      let entry = this.entries.get(key);
      if(!entry) {
        this.directory ??= mkdtemp(path.join(tmpdir(),'xpress-training-')).then(dir=>{this.resolvedDirectory=dir;return dir;});
        const file=path.join(await this.directory,createHash('sha256').update(key).digest('hex'));
        let size=0; const hash=createHash('sha256');
        const meter=new Transform({transform:(chunk,_encoding,callback)=>{
          size+=chunk.length;
          if(size>Math.min(this.budget,this.maxFile))return callback(Error('TRAINING_TOO_LARGE'));
          hash.update(chunk);callback(null,chunk);
        }});
        try {
          // Reserve enough disk space before downloading another file.
          while(this.bytes + Math.min(this.budget,this.maxFile)>this.budget && this.entries.size) {
            const [oldKey,old]=this.entries.entries().next().value!;
            await rm(old.file,{force:true});this.entries.delete(oldKey);this.bytes-=old.size;
          }
          await pipeline(await source(),meter,createWriteStream(file,{mode:0o600,flags:'wx'}),{signal:AbortSignal.timeout(300_000)});
          if(sha256 && hash.digest('hex')!==sha256)throw Error('TRAINING_MEDIA_INTEGRITY');
          entry={file,size};this.entries.set(key,entry);this.bytes+=size;
        } catch(error) {await rm(file,{force:true});throw error;}
      }
      this.entries.delete(key);this.entries.set(key,entry);
      const handle=await open(entry.file,'r');
      return {handle,size:entry.size};
    });
    this.tail=task.catch(()=>{});
    try{return await task;}finally{this.pending--;}
  }
  async dispose() {await this.tail;if(this.directory)await rm(await this.directory,{recursive:true,force:true});this.entries.clear();this.bytes=0;this.directory=undefined;this.resolvedDirectory=undefined;process.removeListener('exit',this.cleanup);}
}
