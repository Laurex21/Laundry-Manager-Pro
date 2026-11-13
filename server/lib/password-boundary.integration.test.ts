import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/isolated';
process.env.SALES_EMAIL_ENABLED='false';process.env.SAAS_BILLING_MODE='disabled';process.env.SAAS_LIVE_ENABLED='false';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN');};
const {registerAuthRoutes,validatePassword}=await import('../replit_integrations/auth/routes');
const {pool}=await import('../db');
(pool as any).query=async()=>{throw Error('DATABASE_ACCESS_FORBIDDEN')};
const routes=new Map<string,Function>();registerAuthRoutes({post:(p:string,...h:Function[])=>routes.set(p,h.at(-1)!),get:()=>{}} as any);
try {
 for(const password of ['A'.repeat(72),'é'.repeat(36),'🔐'.repeat(18)]) assert.equal(validatePassword(password),null,'72 UTF-8 bytes allowed');
 for(const password of ['A'.repeat(73),'é'.repeat(37),'🔐'.repeat(19)]){
  for(const path of ['/api/auth/register','/api/staff/onboard/:token','/api/auth/password-reset/confirm']){
   let status=200,body:any;const res:any={status:(n:number)=>{status=n;return res},json:(v:any)=>body=v};
   await routes.get(path)!({body:{email:'fictitious@example.invalid',acceptedLegal:true,password,token:'fake'},params:{token:'fake'},headers:{},get:()=>undefined},res);
   assert.equal(status,400,path);assert.equal(body.message,'AUTH_PASSWORD_TOO_LONG',path);
  }
 }
 const old='A'.repeat(80);const hash=await bcrypt.hash(old,4);
 assert.ok(await bcrypt.compare(old,hash),'existing long-password login remains compatible');
 console.log('PASS new passwords rejected before database access for register/onboard/reset; legacy comparison unchanged');
}finally{await pool.end();}
