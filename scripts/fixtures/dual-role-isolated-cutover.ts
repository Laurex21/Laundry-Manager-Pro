/** TEST-ONLY cutover: PGlite + synthetic identities only. No production DB/route/CLI. */
import {PGlite} from '@electric-sql/pglite';
import {createHash} from 'node:crypto';
import {previewDualRoleSeparation} from '../../server/lib/saas-dual-role-preview';
import {saasQuotas} from '../../shared/saas-plans';
const canonical=(v:any):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'&&!(v instanceof Date)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const fingerprint=(v:any)=>createHash('sha256').update(canonical(v)).digest('hex');
const requireTrue=(condition:any,code:string)=>{if(!condition)throw Error(code);};
export type CopyCutover={ownerId:string;staffId:string;ownedOrg:number;employerOrg:number;ownedSite:number;employerSite:number;role:'operator'|'manager'};
export class IsolatedDualRoleCutover {
 constructor(private readonly memory:PGlite){requireTrue(memory instanceof PGlite,'PGLITE_ONLY');}
 private guard(c:CopyCutover){
  requireTrue(process.env.SAAS_BILLING_MODE==='disabled'&&process.env.SAAS_LIVE_ENABLED==='false'&&process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED==='true','ISOLATED_SAFETY_FLAGS_REQUIRED');
  requireTrue(/^copy-owner-\d+$/.test(c.ownerId)&&/^copy-staff-\d+$/.test(c.staffId),'SYNTHETIC_IDENTITIES_ONLY');
  requireTrue([c.ownedOrg,c.employerOrg,c.ownedSite,c.employerSite].every(n=>Number.isSafeInteger(n)&&n>0)&&c.ownedOrg!==c.employerOrg,'INVALID_CONTEXT');
 }
 async prepare(c:CopyCutover,email:string,passwordHash:string){
  this.guard(c);requireTrue(/^[a-z0-9._-]+@example\.invalid$/.test(email)&&passwordHash.startsWith('$2'),'SYNTHETIC_CREDENTIALS_REQUIRED');
  return this.memory.transaction(async tx=>{
   const rows=(await tx.query<any>('SELECT id,email,organisation_id FROM users WHERE id=$1 OR lower(email)=lower($2) FOR UPDATE',[c.staffId,email])).rows;
   if(rows.length){requireTrue(rows.length===1&&rows[0].id===c.staffId&&rows[0].email===email&&rows[0].organisation_id===null,'IDENTIFIER_CONFLICT');return 'already_prepared';}
   await tx.query("INSERT INTO users(id,email,password_hash,user_type,role,organisation_id,current_site_id) VALUES($1,$2,$3,'staff',$4,NULL,NULL)",[c.staffId,email,passwordHash,c.role]);return 'prepared_without_access';
  });
 }
 private async snapshot(tx:any,c:CopyCutover){
  return {
   users:(await tx.query('SELECT * FROM users WHERE id=ANY($1::varchar[]) ORDER BY id FOR UPDATE',[[c.ownerId,c.staffId]])).rows,
   orgs:(await tx.query('SELECT * FROM organisations WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE',[[c.ownedOrg,c.employerOrg]])).rows,
   sites:(await tx.query('SELECT * FROM sites WHERE organisation_id=ANY($1::int[]) ORDER BY id FOR UPDATE',[[c.ownedOrg,c.employerOrg]])).rows,
   memberships:(await tx.query('SELECT * FROM site_members WHERE user_id=ANY($1::varchar[]) ORDER BY id FOR UPDATE',[[c.ownerId,c.staffId]])).rows,
   employees:(await tx.query('SELECT * FROM employees WHERE auth_user_id=ANY($1::varchar[]) ORDER BY id FOR UPDATE',[[c.ownerId,c.staffId]])).rows,
   accounts:(await tx.query('SELECT * FROM saas_accounts WHERE organisation_id=ANY($1::int[]) ORDER BY organisation_id FOR UPDATE',[[c.ownedOrg,c.employerOrg]])).rows,
   pending:(await tx.query("SELECT id FROM saas_invoices WHERE organisation_id=ANY($1::int[]) AND status IN ('quoted','pending','review') ORDER BY id FOR UPDATE",[[c.ownedOrg,c.employerOrg]])).rows,
  };
 }
 async review(c:CopyCutover){this.guard(c);return this.memory.transaction(async tx=>fingerprint({context:c,snapshot:await this.snapshot(tx,c)}));}
 async apply(c:CopyCutover,review:string,failAt?:'membership'|'employee'|'saas'|'sessions'){
  this.guard(c);
  return this.memory.transaction(async tx=>{
   const s=await this.snapshot(tx,c);
   const prior=(await tx.query<any>('SELECT * FROM isolated_cutover_audit WHERE owner_id=$1 FOR UPDATE',[c.ownerId])).rows[0];
   if(prior){requireTrue(prior.review===review&&prior.context_hash===fingerprint(c),'REVIEW_CONFLICT');requireTrue(prior.after_hash===fingerprint(s),'POST_CUTOVER_STATE_CHANGED');return 'already_applied';}
   requireTrue(fingerprint({context:c,snapshot:s})===review,'STALE_REVIEW');requireTrue(s.pending.length===0,'PAYMENT_PENDING_REQUIRES_REVIEW');
   const owner=s.users.find((u:any)=>u.id===c.ownerId),staff=s.users.find((u:any)=>u.id===c.staffId);
   requireTrue(owner&&staff&&owner.organisation_id===c.employerOrg&&staff.organisation_id===null&&staff.user_type==='staff'&&staff.current_site_id===null,'IDENTITY_STATE_REQUIRES_REVIEW');
   requireTrue(s.orgs.find((o:any)=>o.id===c.ownedOrg)?.owner_id===c.ownerId&&!s.orgs.some((o:any)=>o.id===c.employerOrg&&o.owner_id===c.ownerId),'OWNERSHIP_CHANGED');
   requireTrue((await tx.query<any>('SELECT count(*)::int n FROM organisations WHERE owner_id=$1',[c.ownerId])).rows[0].n===1,'MULTIPLE_OWNERSHIPS');
   const membershipEvidence=s.memberships.filter((m:any)=>m.user_id===c.ownerId).map((m:any)=>({siteId:m.site_id,role:m.role,organisationId:s.sites.find((site:any)=>site.id===m.site_id)?.organisation_id}));
   const p=previewDualRoleSeparation({ownerId:c.ownerId,ownedOrganisationId:c.ownedOrg,linkedOrganisationId:c.employerOrg,ownedCount:1,memberships:membershipEvidence});
   requireTrue(p.status==='ready_for_isolated_separation'&&p.owner.memberships.length===1&&p.owner.memberships[0].siteId===c.ownedSite&&p.staff.memberships.length===1&&p.staff.memberships[0].siteId===c.employerSite&&p.staff.memberships[0].role===c.role,'ACCESS_CHANGED');
   requireTrue(!s.memberships.some((m:any)=>m.user_id===c.staffId)&&s.sites.filter((site:any)=>[c.ownedSite,c.employerSite].includes(site.id)).every((site:any)=>site.is_active),'PENDING_IDENTITY_HAS_ACCESS');
   requireTrue(s.employees.every((e:any)=>e.auth_user_id!==c.staffId),'EMPLOYEE_BINDING_CONFLICT');
   const points=['membership','employee','saas','sessions'];const checkpoint=(point:string)=>{if(failAt===point)throw Error('SIMULATED_INTERRUPTION_'+point);};
   requireTrue(!failAt||points.includes(failAt),'INVALID_TEST_CHECKPOINT');
   const beforeCandidates=(await tx.query<any>('SELECT DISTINCT u.id FROM users u JOIN site_members sm ON sm.user_id=u.id JOIN sites st ON st.id=sm.site_id JOIN organisations o ON o.id=st.organisation_id WHERE st.organisation_id=$1 AND u.organisation_id=$1 AND st.is_active AND u.id<>o.owner_id ORDER BY u.id',[c.employerOrg])).rows;
   await tx.query('UPDATE site_members SET user_id=$1 WHERE user_id=$2 AND site_id=$3',[c.staffId,c.ownerId,c.employerSite]);checkpoint('membership');
   await tx.query('UPDATE employees SET auth_user_id=$1 WHERE auth_user_id=$2 AND site_id=$3',[c.staffId,c.ownerId,c.employerSite]);checkpoint('employee');
   await tx.query("UPDATE users SET organisation_id=$1,current_site_id=$2,user_type='owner',role='owner' WHERE id=$3",[c.ownedOrg,c.ownedSite,c.ownerId]);
   await tx.query("UPDATE users SET organisation_id=$1,current_site_id=$2,role=$3 WHERE id=$4",[c.employerOrg,c.employerSite,c.role,c.staffId]);
   const account=s.accounts.find((a:any)=>a.organisation_id===c.employerOrg);
   if(account){const state=structuredClone(account.state);requireTrue(state.activeStaffIds.includes(c.ownerId)&&!state.activeStaffIds.includes(c.staffId),'STAFF_SELECTION_REQUIRES_REVIEW');state.activeStaffIds=state.activeStaffIds.map((id:string)=>id===c.ownerId?c.staffId:id);state.version++;
    requireTrue(new Set(state.activeStaffIds).size===state.activeStaffIds.length&&state.activeStaffIds.length<=saasQuotas(state).staff,'STAFF_QUOTA_CHANGED');
    await tx.query('UPDATE saas_accounts SET state=$1 WHERE organisation_id=$2',[state,c.employerOrg]);
   }checkpoint('saas');
   const afterCandidates=(await tx.query<any>('SELECT DISTINCT u.id FROM users u JOIN site_members sm ON sm.user_id=u.id JOIN sites st ON st.id=sm.site_id JOIN organisations o ON o.id=st.organisation_id WHERE st.organisation_id=$1 AND u.organisation_id=$1 AND st.is_active AND u.id<>o.owner_id ORDER BY u.id',[c.employerOrg])).rows;
   requireTrue(beforeCandidates.length===afterCandidates.length,'ADDITIONAL_EMPLOYEE_PLACE_FORBIDDEN');
   await tx.query("DELETE FROM sessions WHERE sess->>'userId'=ANY($1::text[])",[[c.ownerId,c.staffId]]);checkpoint('sessions');
   const after=await this.snapshot(tx,c);
   await tx.query('INSERT INTO isolated_cutover_audit(owner_id,review,context_hash,after_hash,mapping) VALUES($1,$2,$3,$4,$5)',[c.ownerId,review,fingerprint(c),fingerprint(after),{ownerId:c.ownerId,staffId:c.staffId,site:c.employerSite,role:c.role,beforeStaff:beforeCandidates.length,afterStaff:afterCandidates.length}]);
   return 'applied_in_isolated_copy';
  });
 }
}
