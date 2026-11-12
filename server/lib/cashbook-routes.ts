import { money, decimal } from './cashbook-engine.mjs';
import { cashbookErrorResponse, respondCashbookDatabaseError } from './cashbook-errors';
import { createHash } from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import { z } from 'zod';
import { CashbookStore, CashbookError, type CashDb } from './cashbook-store';
type Pool = CashDb & {connect():Promise<CashDb & {release():void}>};
type Options={db:Pool;auth:RequestHandler;siteIds:(req:any)=>number[];role:(req:any,site:number)=>Promise<string|null>};
const amount=z.string().regex(/^\d{1,12}(\.\d{1,6})?$/).refine(v=>Number(v)>0);
const opening=z.string().regex(/^-?\d{1,12}(\.\d{1,6})?$/);
const reason=z.string().trim().min(10).max(1000);
const instant=z.string().datetime({offset:true});
const currency=z.string().regex(/^[A-Z]{3}$/);
const period=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const id=z.coerce.number().int().positive();
const accountSchema=z.object({siteId:id,label:z.string().trim().min(1).max(120),method:z.string().trim().min(1).max(50).refine(v=>v!=='Client Credit'),currency,timeZone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}}),openedAt:instant,openingBalance:opening,reason,idempotencyKey:z.string().uuid()}).strict();
const allocationSchema=z.object({siteId:id,expenseId:id,accountId:id,reason,idempotencyKey:z.string().uuid()}).strict();
const movementSchema=z.object({siteId:id,accountId:id,targetAccountId:id.optional(),kind:z.enum(['withdrawal','refund','transfer']),amount,at:instant,reason,idempotencyKey:z.string().uuid()}).strict().refine(v=>v.kind==='transfer'?!!v.targetAccountId&&v.targetAccountId!==v.accountId:!v.targetAccountId);

function balanceFingerprint(result:any){
 const comparable=(r:any)=>{const copy={...r};for(const k of ['correctionsIn','correctionsOut'])if(copy[k]==='0')delete copy[k];return copy;};
 const rows=[...(result.rows??[])].map(comparable).sort((a,b)=>`${a.siteId}:${a.id}`.localeCompare(`${b.siteId}:${b.id}`));
 const unallocated=[...(result.unallocated??[])].sort((a,b)=>a.sourceKey.localeCompare(b.sourceKey));
 return createHash('sha256').update(JSON.stringify({month:result.month,currency:result.currency,timeZone:result.timeZone,totals:comparable(result.totals),rows,unallocated,anomalies:result.anomalies,canClose:result.canClose})).digest('hex');
}
const reconciliationSchema=z.object({siteId:id.optional(),currency,month:period,counted:z.record(z.string(),opening),reason,fingerprint:z.string().regex(/^[a-f0-9]{64}$/),idempotencyKey:z.string().uuid()}).strict();

// Explicit development-only registration, even if a flag leaks into production.
// No database access/migration or job registration occurs while disabled.
export function registerCashbookRoutes(app:Express,options:Options){
 if(process.env.NODE_ENV!=='development'||process.env.XPRESSPRO_CASHBOOK_DEVELOPMENT!=='true')return;
 const storageZone=process.env.XPRESSPRO_CASHBOOK_LEGACY_STORAGE_TIMEZONE ?? '';
 if(!storageZone)throw Error('Cashbook development requires confirmed legacy timestamp storage timezone');
 new Intl.DateTimeFormat('en',{timeZone:storageZone});
 const {db,auth}=options;const store=new CashbookStore(db,storageZone);
 const wrap=(fn:(req:any,res:any)=>Promise<any>):RequestHandler=>async(req,res)=>{try{await fn(req,res);}catch(e){
  if(e instanceof z.ZodError){res.status(400).json(cashbookErrorResponse('INVALID_CASHBOOK_INPUT'));return;}
  if(respondCashbookDatabaseError(res,e))return;
  if(e instanceof Error&&e.message.includes('CASHBOOK_PERIOD_CLOSED')){res.status(409).json({message:'Ce mois est clôturé. Enregistrez une correction dans une période ouverte.'});return;}
  if(e instanceof Error&&['RECONCILIATION_REQUIRED','COUNT_REQUIRED'].includes(e.message)){res.status(409).json(cashbookErrorResponse(e.message));return;}
  if((e as any)?.code==='40001'||(e as any)?.code==='40P01'){res.status(409).json(cashbookErrorResponse('CASHBOOK_RETRY'));return;}
  if(e instanceof CashbookError){res.status(e.status).json(cashbookErrorResponse(e.code));return;}
  console.error('[cashbook-development]',e instanceof Error?e.message:'request failed');res.status(500).json(cashbookErrorResponse('CASHBOOK_UNAVAILABLE'));
 }};
 async function scope(req:any,requested?:number,ownerOnly=false){
  const org=Number(req.organisationId),actor=req.session?.userId??req.userId;
  if(!Number.isSafeInteger(org)||org<1||!actor||req.saasSuspended)throw new CashbookError('FORBIDDEN',403);
  const allowed=options.siteIds(req).filter(Number.isSafeInteger);
  if(requested&&!allowed.includes(requested))throw new CashbookError('FORBIDDEN_SITE',403);
  const candidates=requested?[requested]:allowed;
  const {rows}=await db.query(
   'SELECT p.site_id FROM cashbook_development.cashbook_pilot_sites p JOIN sites s ON s.id=p.site_id WHERE s.organisation_id=$1 AND p.site_id=ANY($2::int[])',
   [org,candidates],
  );
  const ids=rows.map(row=>row.site_id as number);
  if(!ids.length)throw new CashbookError('CASHBOOK_SITE_NOT_ENABLED',403);
  for(const s of ids){const role=await options.role(req,s);if(role!=='owner'&&(ownerOnly||role!=='manager'))throw new CashbookError('FORBIDDEN_ROLE',403);}
  if((await store.sites(org,ids)).length!==ids.length)throw new CashbookError('FORBIDDEN_ORGANISATION',403);
  return {org,actor,ids};
 }
 async function mutate(org:number,actor:string,input:any,action:string,fn:(tx:CashDb)=>Promise<any>){
  const tx=await db.connect();
  try{
   await tx.query(action==='reconciliation'?'BEGIN ISOLATION LEVEL REPEATABLE READ':'BEGIN');await tx.query('SELECT pg_advisory_xact_lock(61106,$1)',[org]);
   const payload={action,...input};
   const old=(await tx.query('SELECT actor,payload,response FROM cashbook_development.cashbook_requests WHERE organisation_id=$1 AND idempotency_key=$2',[org,input.idempotencyKey])).rows[0];
   if(old){
    const same=(await tx.query('SELECT $1::jsonb=$2::jsonb AS same',[JSON.stringify(old.payload),JSON.stringify(payload)])).rows[0].same;
    if(!same||old.actor!==actor)throw new CashbookError('IDEMPOTENCY_CONFLICT');
    await tx.query('COMMIT');return old.response;
   }
   const response=await fn(tx);
   await tx.query('INSERT INTO cashbook_development.cashbook_requests(organisation_id,idempotency_key,actor,payload,response) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',[org,input.idempotencyKey,actor,JSON.stringify(payload),JSON.stringify(response)]);
   await tx.query('COMMIT');return response;
  }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
 }
 app.get('/api/cashbook/summary',auth,wrap(async(req,res)=>{
  const input=z.object({siteId:id.optional(),month:period,currency}).strict().parse(req.query);const s=await scope(req,input.siteId);
  const client=await db.connect();
  try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const result=await new CashbookStore(client,storageZone).summary(s.org,s.ids,input.currency,input.month);await client.query('COMMIT');res.json(result);}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }));
 app.get('/api/cashbook/accounts',auth,wrap(async(req,res)=>{const s=await scope(req);res.json({accounts:await store.accounts(s.org,s.ids),sites:await store.sites(s.org,s.ids)});}));
 app.post('/api/cashbook/accounts',auth,wrap(async(req,res)=>{
  const input=accountSchema.parse(req.body),s=await scope(req,input.siteId,true);
  if(Date.parse(input.openedAt)>Date.now())throw new CashbookError('FUTURE_OPENING',400);
  res.status(201).json(await mutate(s.org,s.actor,input,'opening',async tx=>{
   const accounts=await new CashbookStore(tx,storageZone).accounts(s.org,s.ids);
   if(accounts.some(a=>a.currency!==input.currency||a.timeZone!==input.timeZone))throw new CashbookError('ACCOUNT_CURRENCY_OR_TIMEZONE_MISMATCH');
   if(accounts.some(a=>a.method===input.method))throw new CashbookError('ACCOUNT_METHOD_ALREADY_EXISTS');
   const result=await tx.query(`INSERT INTO cashbook_development.cashbook_accounts(organisation_id,site_id,label,method,currency,reporting_timezone,opened_at,opening_balance,opening_reason,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[s.org,input.siteId,input.label,input.method,input.currency,input.timeZone,input.openedAt,input.openingBalance,input.reason,s.actor]);return result.rows[0];
  }));
 }));
 app.post('/api/cashbook/expense-allocations',auth,wrap(async(req,res)=>{
  const input=allocationSchema.parse(req.body),s=await scope(req,input.siteId);
  res.json(await mutate(s.org,s.actor,input,'allocation',async tx=>{
   const account=(await new CashbookStore(tx,storageZone).accounts(s.org,s.ids)).find(a=>a.id===String(input.accountId));
   const expense=(await tx.query(`SELECT e.id FROM expenditures e JOIN sites s ON s.id=e.site_id WHERE e.id=$1 AND e.site_id=$2 AND s.organisation_id=$3`,[input.expenseId,input.siteId,s.org])).rows[0];
   if(!account||!expense)throw new CashbookError('FORBIDDEN_EXPENSE_OR_ACCOUNT',403);
   if((await tx.query('SELECT expense_id FROM cashbook_development.cashbook_expense_allocations WHERE organisation_id=$1 AND expense_id=$2',[s.org,input.expenseId])).rows.length)throw new CashbookError('EXPENSE_ALREADY_ALLOCATED');
   await tx.query('INSERT INTO cashbook_development.cashbook_expense_allocations(organisation_id,site_id,expense_id,account_id,created_by) VALUES($1,$2,$3,$4,$5)',[s.org,input.siteId,input.expenseId,input.accountId,s.actor]);return {allocated:true};
  }));
 }));
 app.post('/api/cashbook/movements',auth,wrap(async(req,res)=>{
  const input=movementSchema.parse(req.body),s=await scope(req,input.siteId);
  if(Date.parse(input.at)>Date.now())throw new CashbookError('FUTURE_MOVEMENT',400);
  res.status(201).json(await mutate(s.org,s.actor,input,'movement',async tx=>{
   const accounts=await new CashbookStore(tx,storageZone).accounts(s.org,s.ids);
   const source=accounts.find(a=>a.id===String(input.accountId)),target=accounts.find(a=>a.id===String(input.targetAccountId));
   if(!source||Date.parse(input.at)<Date.parse(source.openedAt))throw new CashbookError('INVALID_ACCOUNT_OR_DATE',400);
   if(input.kind==='transfer'&&(!target||source.currency!==target.currency||Date.parse(input.at)<Date.parse(target.openedAt)))throw new CashbookError('INVALID_TRANSFER',400);
   const legs=input.kind==='transfer'?[{account:source.id,kind:'transfer_out'},{account:target!.id,kind:'transfer_in'}]:[{account:source.id,kind:input.kind}];
   for(const leg of legs)await tx.query(`INSERT INTO cashbook_development.cashbook_manual_movements(organisation_id,site_id,account_id,kind,amount,occurred_at,reason,transfer_key,idempotency_key,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[s.org,input.siteId,leg.account,leg.kind,input.amount,input.at,input.reason,input.kind==='transfer'?input.idempotencyKey:null,input.idempotencyKey,s.actor]);
   return {recorded:true,legs:legs.length};
  }));
 }));
 app.post('/api/cashbook/close-preview',auth,wrap(async(req,res)=>{
  const input=z.object({siteId:id.optional(),currency,month:period,counted:z.record(z.string(),opening),reason}).strict().parse(req.body);const s=await scope(req,input.siteId);
  const client=await db.connect();
  try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const result=await new CashbookStore(client,storageZone).closePreview(s.org,s.ids,input,s.actor);const fingerprint=balanceFingerprint(JSON.parse(result.snapshot));await client.query('COMMIT');res.json({...result,fingerprint});}catch(e){await client.query('ROLLBACK');if(e instanceof Error&&['RECONCILIATION_REQUIRED','COUNT_REQUIRED'].includes(e.message))throw new CashbookError(e.message);throw e;}finally{client.release();}
 }));

 app.get('/api/cashbook/reconciliations',auth,wrap(async(req,res)=>{
  const input=z.object({siteId:id.optional(),month:period,currency}).strict().parse(req.query);const s=await scope(req,input.siteId);
  const ids=[...s.ids].sort((a,b)=>a-b),client=await db.connect();
  try{
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const current=await new CashbookStore(client,storageZone).summary(s.org,ids,input.currency,input.month);
   const records=(await client.query(`SELECT id,actor,reason,created_at AS "createdAt",fingerprint,reconciliation FROM cashbook_development.cashbook_reconciliations WHERE organisation_id=$1 AND site_ids=$2::int[] AND month=$3 AND currency=$4 ORDER BY created_at DESC,id DESC LIMIT 20`,[s.org,ids,input.month,input.currency])).rows;
   await client.query('COMMIT');const fingerprint=balanceFingerprint(current);
   res.json(records.map(r=>({...r,balancesChanged:r.fingerprint!==fingerprint})));
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }));
 app.post('/api/cashbook/reconciliations',auth,wrap(async(req,res)=>{
  const input=reconciliationSchema.parse(req.body),s=await scope(req,input.siteId);
  res.status(201).json(await mutate(s.org,s.actor,input,'reconciliation',async tx=>{
   const ids=[...s.ids].sort((a,b)=>a-b);
   const reconciliation=await new CashbookStore(tx,storageZone).closePreview(s.org,ids,input,s.actor);
   const report=JSON.parse(reconciliation.snapshot),fingerprint=balanceFingerprint(report);
   if(fingerprint!==input.fingerprint)throw new CashbookError('BALANCES_CHANGED_REFRESH_PREVIEW');
   const saved={...reconciliation,status:'reconciled_not_locked'};
   delete (saved as any).snapshot;
   return (await tx.query(`INSERT INTO cashbook_development.cashbook_reconciliations(organisation_id,site_ids,month,currency,actor,reason,fingerprint,report,reconciliation) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb) RETURNING id,created_at AS "createdAt"`,[s.org,ids,input.month,input.currency,s.actor,input.reason,fingerprint,JSON.stringify(report),JSON.stringify(saved)])).rows[0];
  }));
 }));

 app.get('/api/cashbook/closures',auth,wrap(async(req,res)=>{
  const input=z.object({siteId:id.optional(),month:period,currency}).strict().parse(req.query),s=await scope(req,input.siteId);
  res.json((await db.query(`SELECT id,site_id AS "siteId",month,actor,created_at AS "createdAt",reconciliation_id AS "reconciliationId" FROM cashbook_development.cashbook_closures WHERE organisation_id=$1 AND site_id=ANY($2::int[]) AND month=$3 AND currency=$4 ORDER BY site_id`,[s.org,s.ids,input.month,input.currency])).rows);
 }));
 app.post('/api/cashbook/closures',auth,wrap(async(req,res)=>{
  const input=z.object({siteId:id,reconciliationId:id,idempotencyKey:z.string().uuid()}).strict().parse(req.body),s=await scope(req,input.siteId,true);
  if(storageZone!=='UTC')throw new CashbookError('CLOSING_REQUIRES_UTC_LEGACY_STORAGE');
  res.status(201).json(await mutate(s.org,s.actor,input,'closure',async tx=>{
   await tx.query('INSERT INTO cashbook_development.cashbook_period_locks(site_id,revision) VALUES($1,1) ON CONFLICT(site_id) DO UPDATE SET revision=cashbook_development.cashbook_period_locks.revision+1',[input.siteId]);
   const saved=(await tx.query('SELECT * FROM cashbook_development.cashbook_reconciliations WHERE id=$1 AND organisation_id=$2 AND site_ids=$3::int[]',[input.reconciliationId,s.org,[input.siteId]])).rows[0];
   if(!saved)throw new CashbookError('SELECT_SINGLE_SITE_RECONCILIATION',400);
   const current=await new CashbookStore(tx,storageZone).summary(s.org,[input.siteId],saved.currency,saved.month);
   if(!current.canClose||balanceFingerprint(current)!==saved.fingerprint)throw new CashbookError('BALANCES_CHANGED_REFRESH_RECONCILIATION');
   if(saved.reconciliation.rows.some((r:any)=>r.variance!=='0'))throw new CashbookError('RESOLVE_VARIANCE_BEFORE_CLOSING');
   const boundaries=(await tx.query(`SELECT (($1||'-01')::date+interval '1 month') AT TIME ZONE $2 AS "periodEnd",to_char(($1||'-01')::date-interval '1 month','YYYY-MM') AS previous`,[saved.month,current.timeZone])).rows[0];
   if(new Date(boundaries.periodEnd).getTime()>Date.now())throw new CashbookError('ONLY_COMPLETED_MONTH_CAN_CLOSE');
   const previous=(await tx.query('SELECT month FROM cashbook_development.cashbook_closures WHERE organisation_id=$1 AND site_id=$2 ORDER BY month DESC LIMIT 1',[s.org,input.siteId])).rows[0];
   const firstMonth=current.rows.map((a:any)=>new Intl.DateTimeFormat('sv-SE',{timeZone:a.timeZone,year:'numeric',month:'2-digit'}).format(new Date(a.openedAt))).sort()[0];
   if(previous?saved.month<=previous.month:saved.month!==firstMonth)throw new CashbookError(previous?'PERIOD_ALREADY_CLOSED':'CLOSE_OPENING_MONTH_FIRST');
   if(previous&&previous.month!==boundaries.previous)throw new CashbookError('CLOSE_PREVIOUS_MONTH_FIRST');
   return (await tx.query(`INSERT INTO cashbook_development.cashbook_closures(organisation_id,site_id,month,currency,period_end,reconciliation_id,actor,report) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id,month,site_id AS "siteId",created_at AS "createdAt"`,[s.org,input.siteId,saved.month,saved.currency,boundaries.periodEnd,saved.id,s.actor,JSON.stringify(current)])).rows[0];
  }));
 }));
 const correctionSchema=z.object({siteId:id,accountId:id,closureId:id,direction:z.enum(['increase','decrease']),amount,reason,reference:z.string().trim().min(3).max(200)}).strict();
 async function correctionPreview(tx:CashDb,s:any,input:any){
  const account=(await new CashbookStore(tx,storageZone).accounts(s.org,s.ids)).find(a=>a.id===String(input.accountId));
  const closed=(await tx.query('SELECT id,month,currency,period_end FROM cashbook_development.cashbook_closures WHERE id=$1 AND organisation_id=$2 AND site_id=$3',[input.closureId,s.org,input.siteId])).rows[0];
  if(!account||!closed||closed.currency!==account.currency)throw new CashbookError('INVALID_CORRECTION_ACCOUNT_OR_CLOSURE',403);
  const now=new Date((await tx.query('SELECT CURRENT_TIMESTAMP AS at')).rows[0].at),month=new Intl.DateTimeFormat('sv-SE',{timeZone:account.timeZone,year:'numeric',month:'2-digit'}).format(now);
  if(now.getTime()<Date.parse(account.openedAt))throw new CashbookError('INVALID_ACCOUNT_OR_DATE',400);
  const report=await new CashbookStore(tx,storageZone).summary(s.org,s.ids,account.currency,month);
  if(!report.canClose)throw new CashbookError('RECONCILIATION_REQUIRED');
  const row=report.rows.find((r:any)=>r.id===account.id);
  const fingerprint=createHash('sha256').update(JSON.stringify({input,balance:balanceFingerprint(report)})).digest('hex');
  return {month,currency:account.currency,closedMonth:closed.month,accountLabel:account.label,before:row.closing,after:decimal(money(row.closing)+(input.direction==='increase'?1n:-1n)*money(input.amount)),fingerprint};
 }
 app.get('/api/cashbook/corrections',auth,wrap(async(req,res)=>{
  const input=z.object({siteId:id.optional(),month:period,currency}).strict().parse(req.query),s=await scope(req,input.siteId);
  const records=(await db.query(`SELECT c.id,c.account_id AS "accountId",a.label,c.direction,c.amount::text,c.reason,c.reference,c.created_by AS actor,c.occurred_at AS "occurredAt",cl.month AS "closedMonth" FROM cashbook_development.cashbook_corrections c JOIN cashbook_development.cashbook_accounts a ON a.id=c.account_id JOIN cashbook_development.cashbook_closures cl ON cl.id=c.closure_id WHERE c.organisation_id=$1 AND c.site_id=ANY($2::int[]) AND a.currency=$3 AND to_char(c.occurred_at AT TIME ZONE a.reporting_timezone,'YYYY-MM')=$4 ORDER BY c.id DESC LIMIT 100`,[s.org,s.ids,input.currency,input.month])).rows;
  const closed=(await db.query('SELECT id,site_id AS "siteId",month FROM cashbook_development.cashbook_closures WHERE organisation_id=$1 AND site_id=ANY($2::int[]) AND currency=$3 ORDER BY month DESC',[s.org,s.ids,input.currency])).rows;
  res.json({records,closed});
 }));
 app.post('/api/cashbook/corrections/preview',auth,wrap(async(req,res)=>{
  const input=correctionSchema.parse(req.body),s=await scope(req,input.siteId,true),tx=await db.connect();
  try{await tx.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const preview=await correctionPreview(tx,s,input);await tx.query('COMMIT');res.json(preview);}catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
 }));
 app.post('/api/cashbook/corrections',auth,wrap(async(req,res)=>{
  const parsed=correctionSchema.extend({fingerprint:z.string().regex(/^[a-f0-9]{64}$/),idempotencyKey:z.string().uuid()}).parse(req.body),{fingerprint,idempotencyKey,...input}=parsed,s=await scope(req,input.siteId,true);
  res.status(201).json(await mutate(s.org,s.actor,parsed,'correction',async tx=>{
   const preview=await correctionPreview(tx,s,input);
   if(preview.fingerprint!==fingerprint)throw new CashbookError('BALANCES_CHANGED_REFRESH_PREVIEW');
   const saved=(await tx.query(`INSERT INTO cashbook_development.cashbook_corrections(organisation_id,site_id,account_id,closure_id,direction,amount,reason,reference,created_by,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,occurred_at AS "occurredAt"`,[s.org,input.siteId,input.accountId,input.closureId,input.direction,input.amount,input.reason,input.reference,s.actor,idempotencyKey])).rows[0];
   return {...saved,...preview};
  }));
 }));

}
