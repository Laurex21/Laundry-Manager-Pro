import crypto from 'node:crypto';
import { salesEnvironment } from './sales-referrals';
export type SalesAuthExecutor={query:(text:string,values?:any[])=>Promise<{rows:any[]}>};
export type SalesAuthDatabase=SalesAuthExecutor&{transaction:<T>(fn:(tx:SalesAuthExecutor)=>Promise<T>)=>Promise<T>};
export class SalesAccountError extends Error{}
export const invitationHash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
export class SalesAccountStore {
 constructor(public db:SalesAuthDatabase){}
 async account(repId:number){
  const rep=(await this.db.query('SELECT id FROM sales_representatives WHERE id=$1 AND environment=$2',[repId,salesEnvironment()])).rows[0];if(!rep)throw new SalesAccountError('NOT_FOUND');
  const account=(await this.db.query(`SELECT id,email,active,activated_at,password_hash IS NOT NULL AS has_password FROM sales_accounts WHERE representative_id=$1 AND environment=$2`,[repId,salesEnvironment()])).rows[0]||null;
  const invitation=account?(await this.db.query(`SELECT delivery_status,expires_at,used_at,revoked_at FROM sales_invitations WHERE account_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,[account.id])).rows[0]||null:null;
  return {account,invitation};
 }
 async invite(repId:number,email:string,adminId:string){
  const token=crypto.randomBytes(32).toString('base64url'),id=crypto.randomUUID();
  const value=await this.db.transaction(async tx=>{
   const rep=(await tx.query('SELECT id,name FROM sales_representatives WHERE id=$1 AND environment=$2 FOR UPDATE',[repId,salesEnvironment()])).rows[0];if(!rep)throw new SalesAccountError('NOT_FOUND');
   let a=(await tx.query('SELECT * FROM sales_accounts WHERE representative_id=$1 FOR UPDATE',[repId])).rows[0];
   if(a&&a.environment!==salesEnvironment())throw new SalesAccountError('NOT_FOUND');
   if(a?.password_hash&&a.email!==email)throw new SalesAccountError('EMAIL_LOCKED');
   const conflict=(await tx.query('SELECT id FROM sales_accounts WHERE email=$1 AND representative_id<>$2',[email,repId])).rows[0];if(conflict)throw new SalesAccountError('EMAIL_IN_USE');
   if(!a)a=(await tx.query(`INSERT INTO sales_accounts(id,representative_id,email,environment) VALUES($1,$2,$3,$4) RETURNING *`,[crypto.randomUUID(),repId,email,salesEnvironment()])).rows[0];
   else if(!a.password_hash)await tx.query('UPDATE sales_accounts SET email=$2 WHERE id=$1',[a.id,email]);
   await tx.query('UPDATE sales_invitations SET revoked_at=now() WHERE account_id=$1 AND used_at IS NULL AND revoked_at IS NULL',[a.id]);
   const invitation=(await tx.query(`INSERT INTO sales_invitations(id,account_id,token_hash,expires_at,created_by) VALUES($1,$2,$3,now()+interval '24 hours',$4) RETURNING expires_at`,[id,a.id,invitationHash(token),adminId])).rows[0];
   await tx.query("INSERT INTO sales_access_events(account_id,admin_id,action) VALUES($1,$2,'invited')",[a.id,adminId]);
   return {accountId:a.id,representativeName:rep.name,expiresAt:new Date(invitation.expires_at).toISOString()};
  });return {...value,id,token,email};
 }
 async delivery(id:string,status:'sent'|'preview'|'failed'){
  await this.db.transaction(async tx=>{
   const row=(await tx.query(`UPDATE sales_invitations SET delivery_status=$2,revoked_at=CASE WHEN $2='failed' THEN now() ELSE revoked_at END WHERE id=$1 RETURNING account_id`,[id,status])).rows[0];
   if(row&&status==='failed')await tx.query("INSERT INTO sales_access_events(account_id,action) VALUES($1,'invitation_failed')",[row.account_id]);
  });
 }
 async inspect(token:string){
  const r=(await this.db.query(`SELECT a.email,s.name,s.country,i.expires_at FROM sales_invitations i JOIN sales_accounts a ON a.id=i.account_id JOIN sales_representatives s ON s.id=a.representative_id
   WHERE i.token_hash=$1 AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND i.delivery_status IN ('sent','preview') AND a.environment=$2`,[invitationHash(token),salesEnvironment()])).rows[0];
  if(!r)throw new SalesAccountError('INVALID_INVITATION');
  return {name:r.name,country:r.country,expiresAt:r.expires_at,emailHint:r.email[0]+'***@'+r.email.split('@')[1]};
 }
 async accept(token:string,passwordHash:string){
  return this.db.transaction(async tx=>{
   // Account first: same lock order as invite/resend/suspension. Parallel accepts cannot reuse a token.
   const ref=(await tx.query('SELECT account_id FROM sales_invitations WHERE token_hash=$1',[invitationHash(token)])).rows[0];if(!ref)throw new SalesAccountError('INVALID_INVITATION');
   const a=(await tx.query('SELECT id,environment FROM sales_accounts WHERE id=$1 FOR UPDATE',[ref.account_id])).rows[0];
   if(!a||a.environment!==salesEnvironment())throw new SalesAccountError('INVALID_INVITATION');
   const invite=(await tx.query(`UPDATE sales_invitations SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now() AND delivery_status IN ('sent','preview') RETURNING id`,[invitationHash(token)])).rows[0];
   if(!invite)throw new SalesAccountError('INVALID_INVITATION');
   await tx.query('UPDATE sales_accounts SET password_hash=$2,active=CASE WHEN activated_at IS NULL THEN true ELSE active END,auth_version=auth_version+1,activated_at=COALESCE(activated_at,now()) WHERE id=$1',[a.id,passwordHash]);
   await tx.query('UPDATE sales_invitations SET revoked_at=now() WHERE account_id=$1 AND id<>$2 AND used_at IS NULL AND revoked_at IS NULL',[a.id,invite.id]);
   await tx.query("INSERT INTO sales_access_events(account_id,action) VALUES($1,'accepted')",[a.id]);
  });
 }
 async setActive(repId:number,active:boolean,adminId:string){
  await this.db.transaction(async tx=>{
   const a=(await tx.query('SELECT id,password_hash FROM sales_accounts WHERE representative_id=$1 AND environment=$2 FOR UPDATE',[repId,salesEnvironment()])).rows[0];if(!a)throw new SalesAccountError('NOT_FOUND');
   if(active&&!a.password_hash)throw new SalesAccountError('INVITATION_REQUIRED');
   await tx.query('UPDATE sales_accounts SET active=$2,auth_version=auth_version+1 WHERE id=$1',[a.id,active]);
   if(!active)await tx.query('UPDATE sales_invitations SET revoked_at=now() WHERE account_id=$1 AND used_at IS NULL AND revoked_at IS NULL',[a.id]);
   await tx.query('INSERT INTO sales_access_events(account_id,admin_id,action) VALUES($1,$2,$3)',[a.id,adminId,active?'reactivated':'suspended']);
  });
 }
 async credentials(email:string){return (await this.db.query('SELECT id,password_hash,auth_version,active FROM sales_accounts WHERE email=$1 AND environment=$2',[email,salesEnvironment()])).rows[0];}
 async principal(accountId:string,version:number){return (await this.db.query(`SELECT a.id,a.email,a.representative_id,s.name,s.country FROM sales_accounts a JOIN sales_representatives s ON s.id=a.representative_id WHERE a.id=$1 AND a.auth_version=$2 AND a.active AND a.password_hash IS NOT NULL AND a.environment=$3 AND s.environment=$3`,[accountId,version,salesEnvironment()])).rows[0];}
}
