import {users} from "../../shared/models/auth";
import {eq} from "drizzle-orm";
import crypto from 'node:crypto';
import { deferredSaasOrganisations, saasIdentityDeferred, saasOrganisationDeferred } from './saas-deferred';
import type { Pool, PoolClient } from 'pg';

type Executor = Pick<PoolClient,'query'>;
export class AdminUserError extends Error { constructor(public code:string,public status=400){super(code);} }
export function resetEmail(value:unknown):string {return typeof value==='string'?value.trim().toLowerCase():'';}
const validEmail=(value:string)=> /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const digest=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
export function adminResetTokenMatchesEmail(token:string,email:unknown):boolean {
 if(!token.startsWith('adm1.'))return true; // Existing public reset tokens remain compatible.
 const parts=token.split('.');
 return parts.length===3 && /^[a-f0-9]{64}$/.test(parts[1]) && /^[a-f0-9]{64}$/.test(parts[2]) && crypto.timingSafeEqual(Buffer.from(parts[2],'hex'),Buffer.from(digest(resetEmail(email)),'hex'));
}
export async function adminResetLockedTargetMatches(tx:any,user:{id:string;email:string|null;organisationId:number|null;userType:string},token:string):Promise<boolean>{
 const [locked]=await tx.select().from(users).where(eq(users.id,user.id)).for("update");
 return !!locked && adminResetTokenMatchesEmail(token,locked.email) && locked.organisationId===user.organisationId && locked.userType===user.userType;
}
export async function adminResetTargetExcluded(db:Executor,user:{id:string;organisationId:number|null}):Promise<boolean>{
 return saasOrganisationDeferred(user.organisationId) || await saasIdentityDeferred(db as any,user.id);
}
export type AdminDirectoryUser={id:string;name:string;email:string|null;organisationId:number|null;organisationName:string|null;role:string;loginType:'owner'|'staff';platformAdmin:boolean;credentialConfigured:boolean;resetAllowed:boolean;resetBlockedReason:string|null;excluded:boolean};
const targetSql=`SELECT u.id,u.email,u.first_name,u.last_name,u.user_type,u.role,u.organisation_id,o.name AS organisation_name,o.owner_id,
 CASE WHEN EXISTS(SELECT 1 FROM site_members sm JOIN sites s ON s.id=sm.site_id WHERE sm.user_id=u.id AND s.organisation_id=u.organisation_id AND sm.role='manager') THEN 'manager'
 WHEN EXISTS(SELECT 1 FROM site_members sm JOIN sites s ON s.id=sm.site_id WHERE sm.user_id=u.id AND s.organisation_id=u.organisation_id) THEN 'operator' ELSE u.role END AS effective_role,
 (NULLIF(u.password_hash,'') IS NOT NULL) AS credential_configured,
 EXISTS(SELECT 1 FROM platform_admins a WHERE a.user_id=u.id AND a.is_active=true AND a.revoked_at IS NULL) AS platform_admin,
 (SELECT count(*)::int FROM users duplicate WHERE lower(trim(duplicate.email))=lower(trim(u.email))) AS email_count
 FROM users u LEFT JOIN organisations o ON o.id=u.organisation_id`;
async function directoryUser(db:Executor,row:any):Promise<AdminDirectoryUser>{
 const excluded=await adminResetTargetExcluded(db,{id:row.id,organisationId:row.organisation_id});
 const loginType=row.user_type!=='staff' && (!row.owner_id||row.owner_id===row.id)?'owner':'staff';
 const email=typeof row.email==='string'?row.email.trim():null;
 const blocked=excluded?'ADMIN_USER_EXCLUDED':!email||!validEmail(resetEmail(email))?'ADMIN_USER_NO_EMAIL':row.email_count!==1?'ADMIN_USER_AMBIGUOUS_EMAIL':(!row.organisation_id && !row.platform_admin)?'ADMIN_USER_LINK_REVIEW':null;
 return {id:row.id,name:[row.first_name,row.last_name].filter(Boolean).join(' ')||email||row.id,email,organisationId:row.organisation_id,organisationName:row.organisation_name,role:loginType==='owner'?'owner':['manager','operator'].includes(row.effective_role)?row.effective_role:'staff',loginType,platformAdmin:row.platform_admin,credentialConfigured:row.credential_configured,resetAllowed:!blocked,resetBlockedReason:blocked,excluded};
}
export async function adminUserDirectory(db:Executor,options:{search?:string;organisationId?:number;offset?:number;limit?:number}){
 deferredSaasOrganisations(); // Validate the exclusion configuration even for an empty directory.
 const search=String(options.search||'').trim().toLowerCase().slice(0,120),org=options.organisationId??null;
 const limit=Math.min(50,Math.max(1,options.limit??25)),offset=options.offset??0;
 if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000||!Number.isSafeInteger(limit)||org!==null&&(!Number.isSafeInteger(org)||org<1))throw new AdminUserError('ADMIN_USER_INVALID_FILTER');
 const where=` WHERE ($1::text='' OR strpos(lower(concat_ws(' ',u.id,u.email,u.first_name,u.last_name,o.name)),$1)>0) AND ($2::int IS NULL OR u.organisation_id=$2)`;
 const total=Number((await db.query(`SELECT count(*)::int AS total FROM users u LEFT JOIN organisations o ON o.id=u.organisation_id${where}`,[search,org])).rows[0].total);
 const rows=(await db.query(`${targetSql}${where} ORDER BY lower(coalesce(u.email,'')),u.id LIMIT $3 OFFSET $4`,[search,org,limit,offset])).rows;
 return {items:await Promise.all(rows.map(row=>directoryUser(db,row))),total,limit,offset,mode:process.env.NODE_ENV==='production'?'production':'preview',deliveryEnabled:process.env.NODE_ENV==='production'&&process.env.ADMIN_PASSWORD_RESET_EMAIL_ENABLED==='true'&&!!process.env.RESEND_API_KEY&&!!process.env.PASSWORD_RESET_EMAIL_FROM&&!!process.env.APP_BASE_URL};
}
type AuditContext={ip?:string;requestId?:string;userAgent?:string};
async function audit(db:Executor,actor:string,target:string|null,outcome:string,metadata:Record<string,unknown>,context:AuditContext={}){
 await db.query(`INSERT INTO platform_admin_audit_events(user_id,action,outcome,metadata,ip_hash,request_id,user_agent) VALUES($1,'platform_admin.user_password_reset',$2,$3::jsonb,$4,$5,$6)`,[actor,outcome,JSON.stringify({targetUserId:target,...metadata}),digest(context.ip||'unknown'),context.requestId||null,context.userAgent?.slice(0,500)||null]);
}
export function adminResetOrigin(env=process.env):string{
 const raw=env.APP_BASE_URL?.trim();
 if(!raw)throw new AdminUserError('ADMIN_RESET_EMAIL_NOT_CONFIGURED',503);
 let url:URL;try{url=new URL(raw);}catch{throw new AdminUserError('ADMIN_RESET_EMAIL_NOT_CONFIGURED',503);}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new AdminUserError('ADMIN_RESET_EMAIL_NOT_CONFIGURED',503);
 return url.origin;
}
export async function deliverAdminResetEmail(to:string,url:string):Promise<void>{
 // No connector fallback: activation and credentials must be explicitly configured.
 if(process.env.NODE_ENV!=='production'||process.env.ADMIN_PASSWORD_RESET_EMAIL_ENABLED!=='true'||!process.env.RESEND_API_KEY||!process.env.PASSWORD_RESET_EMAIL_FROM)throw new AdminUserError('ADMIN_RESET_EMAIL_NOT_CONFIGURED',503);
 const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10_000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.PASSWORD_RESET_EMAIL_FROM,to:[to],subject:'XpressPro — réinitialisation de votre mot de passe',text:`Une réinitialisation a été demandée par l’administrateur de la plateforme.\nChoisissez vous-même votre nouveau mot de passe :\n${url}\nCe lien est valable 30 minutes et utilisable une seule fois. Aucun mot de passe ne vous sera demandé par email. Si vous n’attendiez pas cette demande, contactez votre administrateur.`})});
 if(!response.ok)throw new AdminUserError('ADMIN_RESET_EMAIL_FAILED',502);
}
export async function requestAdminPasswordReset(pool:Pool,actor:string,userId:string,input:{expectedEmail?:unknown;reason?:unknown},context:AuditContext={}){
 const reason=typeof input.reason==='string'?input.reason.trim():'';
 if(reason.length<10||reason.length>500)throw new AdminUserError('ADMIN_RESET_REASON_REQUIRED');
 if(!userId||userId.length>200)throw new AdminUserError('ADMIN_USER_NOT_FOUND',404);
 const client=await pool.connect();let tokenId:string|undefined;let token:string|undefined;let recipient:string|undefined;let origin:string|undefined;let organisationId:number|null=null;
 try{
  await client.query('BEGIN');
  const row=(await client.query(`${targetSql} WHERE u.id=$1 FOR UPDATE OF u`,[userId])).rows[0];
  if(!row)throw new AdminUserError('ADMIN_USER_NOT_FOUND',404);
  const target=await directoryUser(client,row);
  if(!target.resetAllowed)throw new AdminUserError(target.resetBlockedReason!,409);
  if(typeof input.expectedEmail!=='string'||resetEmail(input.expectedEmail)!==resetEmail(target.email))throw new AdminUserError('ADMIN_USER_CHANGED',409);
  recipient=target.email!;organisationId=target.organisationId;
  if(process.env.NODE_ENV!=='production'){
   await audit(client,actor,userId,'success',{mode:'preview',reason,organisationId:target.organisationId},context);
   await client.query('COMMIT');return {status:'preview',recipient,expiresInMinutes:30};
  }
  if(process.env.ADMIN_PASSWORD_RESET_EMAIL_ENABLED!=='true'||!process.env.RESEND_API_KEY||!process.env.PASSWORD_RESET_EMAIL_FROM)throw new AdminUserError('ADMIN_RESET_EMAIL_NOT_CONFIGURED',503);
  origin=adminResetOrigin();
  const recent=await client.query(`SELECT 1 FROM platform_admin_audit_events WHERE action='platform_admin.user_password_reset' AND metadata->>'targetUserId'=$1 AND metadata->>'mode'='requested' AND created_at>now()-interval '5 minutes' LIMIT 1`,[userId]);
  if(recent.rows.length)throw new AdminUserError('ADMIN_RESET_RECENT_REQUEST',429);
  await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[userId]);
  token=`adm1.${crypto.randomBytes(32).toString('hex')}.${digest(resetEmail(recipient))}`;
  tokenId=crypto.randomUUID();
  await client.query(`INSERT INTO password_reset_tokens(id,user_id,token_hash,account_type,expires_at) VALUES($1,$2,$3,$4,$5)`,[tokenId,userId,digest(token),target.loginType,new Date(Date.now()+30*60*1000).toISOString()]);
  await audit(client,actor,userId,'success',{mode:'requested',reason,organisationId:target.organisationId},context);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
 try{await deliverAdminResetEmail(recipient!,`${origin}/reset-password/${token}`);}
 catch{
  await pool.query('UPDATE password_reset_tokens SET used_at=now() WHERE id=$1',[tokenId]);
  await audit(pool as any,actor,userId,'failure',{mode:'delivery_failed',organisationId},context);
  throw new AdminUserError('ADMIN_RESET_EMAIL_FAILED',502);
 }
 await audit(pool as any,actor,userId,'success',{mode:'sent',organisationId},context).catch(()=>{});
 return {status:'sent',recipient:recipient!,expiresInMinutes:30};
}
