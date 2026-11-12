import { report, prepareClose } from './cashbook-engine.mjs';
export interface CashDb { query(sql:string, params?:any[]):Promise<{rows:any[]}> }
export class CashbookError extends Error {
 constructor(readonly code:string,readonly status=409){ super(code); }
}
export class CashbookStore {
 constructor(private db:CashDb, private storageTimeZone:string) {
  new Intl.DateTimeFormat('en',{timeZone:storageTimeZone});
 }
 async sites(org:number,ids:number[]){
  return (await this.db.query('SELECT id,name FROM sites WHERE organisation_id=$1 AND id=ANY($2::int[]) ORDER BY id',[org,ids])).rows;
 }
 async accounts(org:number,ids:number[]){
  const {rows}=await this.db.query(`SELECT id::text,organisation_id AS "organisationId",site_id AS "siteId",label,method,currency,
   reporting_timezone AS "timeZone",opened_at AS "openedAt",opening_balance::text AS "openingBalance",true AS "openingValidated"
   FROM cashbook_development.cashbook_accounts WHERE organisation_id=$1 AND site_id=ANY($2::int[]) ORDER BY site_id,id`,[org,ids]);
  return rows.map(a=>({...a,openedAt:new Date(a.openedAt).toISOString()}));
 }
 async summary(org:number,ids:number[],currency:string,month:string){
  const allAccounts=await this.accounts(org,ids);
  if(allAccounts.some(a=>a.currency!==currency))throw new CashbookError('SELECT_SITES_WITH_SAME_CURRENCY');
  const accounts=allAccounts.filter(a=>new Intl.DateTimeFormat('sv-SE',{timeZone:a.timeZone,year:'numeric',month:'2-digit'}).format(new Date(a.openedAt))<=month);
  if(!accounts.length) return {needsOpening:true,accounts:[],sites:await this.sites(org,ids)};
  const zones=new Set(accounts.map(a=>a.timeZone));
  if(zones.size!==1) throw new CashbookError('REPORTING_TIMEZONE_MISMATCH');
  // Legacy dates are timestamp WITHOUT timezone. The development operator must
  // explicitly confirm storage convention; never depend on the host/PG session.
  const {rows}=await this.db.query(`
   SELECT 'payments:'||p.id AS key,o.site_id,p.date AT TIME ZONE $3 AS at,'receipt' AS kind,p.amount::text,p.method,NULL::int AS account_id
   FROM payments p JOIN orders o ON o.id=p.order_id JOIN sites s ON s.id=o.site_id
   WHERE s.organisation_id=$1 AND s.id=ANY($2::int[]) AND p.method IS DISTINCT FROM 'Client Credit'
   UNION ALL
   SELECT 'credit_transactions:'||ct.id,ct.site_id,ct.created_at AT TIME ZONE $3,'receipt',ct.amount::text,p.method,NULL::int
   FROM credit_transactions ct JOIN sites s ON s.id=ct.site_id LEFT JOIN payments p ON p.id=ct.payment_id
   WHERE ct.organisation_id=$1 AND s.organisation_id=$1 AND s.id=ANY($2::int[]) AND ct.type='credit' AND ct.reason='overpayment'
   UNION ALL
   SELECT 'expenditures:'||e.id,e.site_id,e.date AT TIME ZONE $3,'expense',e.amount::text,NULL::text,a.account_id
   FROM expenditures e JOIN sites s ON s.id=e.site_id LEFT JOIN cashbook_development.cashbook_expense_allocations a ON a.expense_id=e.id AND a.organisation_id=$1 AND a.site_id=e.site_id
   WHERE s.organisation_id=$1 AND s.id=ANY($2::int[])
   UNION ALL
   SELECT 'manual:'||m.id,m.site_id,m.occurred_at,m.kind,m.amount::text,NULL::text,m.account_id
   FROM cashbook_development.cashbook_manual_movements m JOIN cashbook_development.cashbook_accounts a ON a.id=m.account_id
   WHERE m.organisation_id=$1 AND m.site_id=ANY($2::int[]) AND a.currency=$4
   UNION ALL
   SELECT 'membership_payment:'||m.payment_id,m.site_id,m.occurred_at,'receipt',m.amount::text,m.method,NULL::int
   FROM cashbook_development.cashbook_membership_receipts m JOIN sites s ON s.id=m.site_id
   WHERE m.organisation_id=$1 AND s.organisation_id=$1 AND s.id=ANY($2::int[])
   UNION ALL
   SELECT 'correction:'||c.id,c.site_id,c.occurred_at,CASE WHEN c.direction='increase' THEN 'correction_in' ELSE 'correction_out' END,c.amount::text,NULL::text,c.account_id
   FROM cashbook_development.cashbook_corrections c JOIN cashbook_development.cashbook_accounts a ON a.id=c.account_id
   WHERE c.organisation_id=$1 AND c.site_id=ANY($2::int[]) AND a.currency=$4
  `,[org,ids,this.storageTimeZone,currency]);
  const unknown:any[]=[]; const movements:any[]=[];
  for(const row of rows){
   const siteAccounts=accounts.filter(a=>a.siteId===row.site_id);
   if(!siteAccounts.length){unknown.push({sourceKey:row.key,reason:'SITE_WITHOUT_OPENING'});continue;}
   const time=row.at==null?NaN:new Date(row.at).getTime();
   if(!Number.isFinite(time)){unknown.push({sourceKey:row.key,reason:'INVALID_DATE'});continue;}
   if(time<Math.min(...siteAccounts.map(a=>Date.parse(a.openedAt))))continue;
   let account=siteAccounts.find(a=>row.account_id!=null?a.id===String(row.account_id):row.method!=null&&a.method===row.method);
   if(account&&time<Date.parse(account.openedAt))account=undefined;
   const at=new Date(time).toISOString();
   movements.push({organisationId:org,siteId:row.site_id,accountId:account?.id??'unallocated',currency,sourceKey:row.key,kind:row.kind,amount:row.amount,at});
  }
  const result=report({organisationId:org,authorisedSiteIds:ids,siteIds:ids,currency,month,timeZone:accounts[0].timeZone,accounts,movements});
  const selected=(await this.sites(org,ids));
  for(const site of selected)if(!accounts.some(a=>a.siteId===site.id))unknown.push({siteId:site.id,reason:'SITE_WITHOUT_OPENING'});
  result.canClose=result.canClose&&unknown.length===0;
  result.anomalies=unknown;
  result.sites=selected;
  // Full movement set is available only to authorised managers/owner, for
  // allocation of legacy expenses. Never expose another organisation's records.
  result.unallocated=movements.filter(m=>m.accountId==='unallocated'&&new Intl.DateTimeFormat('sv-SE',{timeZone:result.timeZone,year:'numeric',month:'2-digit'}).format(new Date(m.at))<=month);
  return result;
 }
 async closePreview(org:number,ids:number[],input:any,actor:string){
  const current=await this.summary(org,ids,input.currency,input.month);
  if(current.needsOpening)throw new CashbookError('OPENING_REQUIRED');
  return prepareClose(current,input.counted,actor,input.reason);
 }
}
