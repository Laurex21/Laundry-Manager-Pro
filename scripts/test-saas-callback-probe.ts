/** Temporary sandbox-only callback probe; no database or merchant token imports. */
import {createServer, request} from 'node:http';
import {appendFileSync} from 'node:fs';
import {sandboxPublicKeys, verifyPawapaySandboxCallback} from '../server/lib/pawapay-sandbox-callback';
const path='/api/saas/sandbox/callback';
createServer(async(req,res)=>{
 if(req.method!=='POST'||req.url!==path){res.statusCode=404;res.end();return;}
 try{
 const chunks:Buffer[]=[];let size=0;
 for await(const part of req){size+=part.length;if(size>1_000_000){res.statusCode=413;res.end();return;}chunks.push(part);}
 const raw=Buffer.concat(chunks);const keys=await sandboxPublicKeys();
 const headers=Object.fromEntries(Object.entries(req.headers).map(([k,v])=>[k,typeof v==='string'?v:undefined]));
 const authorities=[headers.host,headers['x-forwarded-host']].filter((v):v is string=>!!v);
 const checks=authorities.map(authority=>({authority,valid:verifyPawapaySandboxCallback({method:'POST',authority,path,headers,rawBody:raw,keys})}));
 const response=await new Promise<{status:number;body:string}>((resolve,reject)=>{
 const forwarded=request({hostname:'127.0.0.1',port:5174,path,method:'POST',headers:{...Object.fromEntries(Object.entries(headers).filter(([k,v])=>!!v&&['host','content-type','signature','signature-input','signature-date','content-digest'].includes(k))),'content-length':raw.length}},incoming=>{const parts:Buffer[]=[];incoming.on('data',part=>parts.push(part));incoming.on('end',()=>resolve({status:incoming.statusCode||503,body:Buffer.concat(parts).toString()}));});
 forwarded.setTimeout(10000,()=>forwarded.destroy(new Error('TIMEOUT')));forwarded.on('error',reject);forwarded.end(raw);
 });
 const body=response.body;
 appendFileSync('/tmp/xpresspro-saas-isolated-20261021/callback-audit.jsonl',JSON.stringify({receivedAt:new Date().toISOString(),checks,responseStatus:response.status,responseBody:body,headers:Object.fromEntries(Object.entries(headers).filter(([k])=>['host','x-forwarded-host','content-type','signature','signature-input','signature-date','content-digest'].includes(k))),rawBodyBase64:raw.toString('base64')})+'\n');
 res.statusCode=response.status;res.setHeader('Content-Type','application/json');res.end(body);
 }catch(e){res.statusCode=503;res.end(JSON.stringify({code:'ISOLATED_PROBE_UNAVAILABLE'}));}
}).listen(3004,'0.0.0.0',()=>console.log('ISOLATED_CALLBACK_PROBE_READY port=3004'));
