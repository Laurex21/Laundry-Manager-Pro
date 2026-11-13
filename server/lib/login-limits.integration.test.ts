import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/isolated';
process.env.SALES_EMAIL_ENABLED='false';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN');};
const {pool}=await import('../db');
const {loginRateLimits}=await import('./rate-limit');
const pg=new PGlite();
await pg.exec('CREATE TABLE security_rate_limits(bucket_key text PRIMARY KEY,count int NOT NULL,reset_at timestamptz NOT NULL)');
const original=pool.query;
(pool as any).query=(sql:string,args:any[])=>pg.query(sql,args);
async function attempt(email:string,ip:string,name='test'){
 let status=200,retry='';
 const res:any={setHeader:(_:string,v:string)=>retry=v,status:(v:number)=>{status=v;return res},json:()=>res};
 for(const middleware of loginRateLimits(name)){
  let next=false;await middleware({body:{email},ip} as any,res,()=>{next=true});if(!next)break;
 }
 return {status,retry};
}
try {
 for(let i=0;i<20;i++)assert.equal((await attempt(' Victim@Example.invalid ',`ip${i}`)).status,200);
 assert.equal((await attempt('victim@example.invalid','new-ip')).status,429,'rotating IP does not reset account');
 await pg.exec('TRUNCATE security_rate_limits');
 for(let i=0;i<60;i++)assert.equal((await attempt(`user${i}@example.invalid`,'shared-ip')).status,200);
 assert.equal((await attempt('another@example.invalid','shared-ip')).status,429,'rotating accounts does not reset IP');
 await pg.exec('TRUNCATE security_rate_limits');
 const concurrent=await Promise.all(Array.from({length:30},(_,i)=>attempt('same@example.invalid',`parallel${i}`)));
 assert.equal(concurrent.filter(x=>x.status===200).length,20,'atomic SQL quotas');
 const expiry=await pg.query('SELECT bucket_key,reset_at FROM security_rate_limits ORDER BY bucket_key');
 assert.equal((await attempt('same@example.invalid','parallel0')).status,429);
 assert.deepEqual((await pg.query('SELECT bucket_key,reset_at FROM security_rate_limits ORDER BY bucket_key')).rows,expiry.rows,'blocked attempts do not extend locks');
 await pg.exec("UPDATE security_rate_limits SET reset_at=now()-interval '1 second'");
 assert.equal((await attempt('same@example.invalid','parallel0')).status,200,'automatic recovery');
 (pool as any).query=async()=>{throw Error('synthetic database failure')};
 assert.equal((await attempt('none@example.invalid','ip')).status,503,'fail closed');
 console.log('PASS isolated login quotas: rotating IP/accounts, normalization, concurrency, fixed expiry and fail closed');
}finally{(pool as any).query=original;await pg.close();await pool.end();}
