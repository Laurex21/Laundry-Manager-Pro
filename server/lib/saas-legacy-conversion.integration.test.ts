import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {SaasStore,type SaasDatabase} from "./saas-store";
import {previewLegacy,legacyReviewFingerprint,type LegacySnapshot,type LegacyDecision} from "./saas-legacy-preview";
import {saasSelection,hasSaasFeature,saasQuotas,saasProrata} from "../../shared/saas-plans";
// No application DB import, network call or real credentials. A fresh in-memory copy only.
const memory=new PGlite();let now=new Date("2026-10-23T18:00:00Z");
const query=async(text:string,params?:any[])=>{const r=await memory.query<any>(text,params);return{rows:r.rows,rowCount:r.affectedRows};};
const database:SaasDatabase={query,transaction:fn=>memory.transaction(tx=>fn({query:async(text,params)=>{const r=await tx.query<any>(text,params);return{rows:r.rows,rowCount:r.affectedRows};}}))};
const store=new SaasStore(database,()=>new Date(now));
const decision:LegacyDecision={target:saasSelection("pro"),reviewer:"isolated-reviewer",reason:"Synthetic reviewed equivalent rights; no real account decision"};
function fixture(org:number,label:string):LegacySnapshot{return {organisationId:org,ownerId:`synthetic-owner-${org}`,label,subscriptions:[{id:org,status:"active",planName:"Legacy Pro",start:"2026-10-10T09:35:12.123Z",end:"2026-11-10T09:35:12.123Z"}],sites:[org*10],staff:[`synthetic-staff-${org}`],acquired:{sites:1,staff:2,features:["reports","machines","team"],reviewed:true},payment:{verified:true,reference:`synthetic-payment-${org}`,amountXaf:15000,baseXaf:15000,staffXaf:0,sitesXaf:0},hasSaasAccount:false,hasOpenInvoice:false};}
const a=fixture(101,"Compte fictif A · ancien Pro");
const b=fixture(102,"Compte fictif B · ancien Starter payant");b.subscriptions[0].planName="Legacy Starter";b.payment={verified:true,reference:"synthetic-starter-proof",amountXaf:6000,baseXaf:6000,staffXaf:0,sitesXaf:0};
const c=fixture(103,"Compte fictif C · ancien Business");c.subscriptions[0].planName="Legacy Business";c.sites.push(1031);c.acquired={sites:2,staff:9,features:["reports","machines","team","multiSite"],reviewed:true};c.payment={verified:true,reference:"synthetic-business-proof",amountXaf:30000,baseXaf:30000,staffXaf:0,sitesXaf:0};
const enterprise=fixture(104,"Compte fictif D · Enterprise illimité");enterprise.subscriptions[0].planName="Legacy Enterprise";enterprise.acquired.staff=null;enterprise.acquired.features.push("customApi");
const uncertain=fixture(105,"Compte fictif E · paiement non vérifié");uncertain.payment!.verified=false;
const overlap=fixture(106,"Compte fictif F · deux périodes actives");overlap.subscriptions.push({...overlap.subscriptions[0],id:999});
const ended=fixture(107,"Compte fictif G · période écoulée encore active");ended.subscriptions[0].end="2026-10-22T09:35:12.123Z";
const pending=fixture(108,"Compte fictif H · paiement en cours");pending.hasOpenInvoice=true;
const special=fixture(109,"Compte fictif I · droits sur mesure");special.acquired.features.push("customApi");
const fixtures=[a,b,c,enterprise,uncertain,overlap,ended,pending,special];
const choices=new Map(fixtures.map(s=>[s.organisationId,s.organisationId===103?{...decision,target:saasSelection("business",0,4)}:decision]));
try{
 await memory.exec(`CREATE TABLE users(id varchar PRIMARY KEY,organisation_id integer,first_name text,last_name text,email text);
 CREATE TABLE organisations(id integer PRIMARY KEY,owner_id varchar NOT NULL,created_at timestamptz NOT NULL);
 CREATE TABLE sites(id integer PRIMARY KEY,organisation_id integer NOT NULL,name text,is_active boolean DEFAULT true);
 CREATE TABLE site_members(id serial PRIMARY KEY,site_id integer,user_id varchar,role text);
 CREATE TABLE subscriptions(id integer PRIMARY KEY,user_id varchar,status text,plan_name text,start_date text,end_date text);
 CREATE TABLE orders(id integer PRIMARY KEY);
 CREATE TABLE isolated_review_inputs(organisation_id integer PRIMARY KEY,snapshot jsonb NOT NULL);
 CREATE TABLE isolated_conversion_audit(organisation_id integer PRIMARY KEY,fingerprint text NOT NULL,state jsonb NOT NULL,reviewer text NOT NULL);`);
 await memory.exec(await readFile(new URL('../../migrations/20261021_saas_billing_v5.sql',import.meta.url),'utf8'));
 for(const s of fixtures){
  await query("INSERT INTO users(id,organisation_id) VALUES($1,$2)",[s.ownerId,s.organisationId]);
  await query("INSERT INTO organisations VALUES($1,$2,'2026-01-01')",[s.organisationId,s.ownerId]);
  for(const site of s.sites)await query("INSERT INTO sites(id,organisation_id,name) VALUES($1,$2,'Synthetic')",[site,s.organisationId]);
  for(const staff of s.staff){await query("INSERT INTO users(id,organisation_id) VALUES($1,$2)",[staff,s.organisationId]);await query("INSERT INTO site_members(site_id,user_id,role) VALUES($1,$2,'operator')",[s.sites[0],staff]);}
  for(const p of s.subscriptions)await query("INSERT INTO subscriptions VALUES($1,$2,$3,$4,$5,$6)",[p.id,s.ownerId,p.status,p.planName,p.start,p.end]);
  await query("INSERT INTO isolated_review_inputs VALUES($1,$2::jsonb)",[s.organisationId,JSON.stringify(s)]);
 }
 async function load(tx:any,org:number):Promise<LegacySnapshot>{
  const s=structuredClone((await tx.query("SELECT snapshot FROM isolated_review_inputs WHERE organisation_id=$1",[org])).rows[0].snapshot) as LegacySnapshot;
  const owner=(await tx.query("SELECT owner_id FROM organisations WHERE id=$1",[org])).rows[0].owner_id;s.ownerId=owner;
  s.subscriptions=(await tx.query('SELECT id,status,plan_name AS "planName",start_date AS start,end_date AS "end" FROM subscriptions WHERE user_id=$1 ORDER BY id',[owner])).rows;
  s.sites=(await tx.query("SELECT id FROM sites WHERE organisation_id=$1 AND is_active=true ORDER BY id",[org])).rows.map((r:any)=>r.id);
  s.staff=(await tx.query("SELECT DISTINCT u.id FROM users u JOIN site_members sm ON sm.user_id=u.id JOIN sites st ON st.id=sm.site_id WHERE u.organisation_id=$1 AND st.organisation_id=$1 AND u.id<>$2 ORDER BY u.id",[org,owner])).rows.map((r:any)=>r.id);
  s.hasSaasAccount=!!(await tx.query("SELECT organisation_id FROM saas_accounts WHERE organisation_id=$1",[org])).rows.length;
  s.hasOpenInvoice=s.hasOpenInvoice||!!(await tx.query("SELECT id FROM saas_invoices WHERE organisation_id=$1 AND status IN ('quoted','pending','review')",[org])).rows.length;
  return s;
 }
 // This executor lives ONLY in this isolated test; there is no production endpoint/CLI.
 async function convert(org:number,fingerprint:string,choice:LegacyDecision,fail=false){return database.transaction(async tx=>{
  await tx.query("SELECT id FROM organisations WHERE id=$1 FOR UPDATE",[org]);
  const s=await load(tx,org);
  const done=(await tx.query("SELECT * FROM isolated_conversion_audit WHERE organisation_id=$1",[org])).rows[0];
  if(done){assert.equal(done.fingerprint,fingerprint,"REVIEW_DOES_NOT_MATCH");assert.equal(legacyReviewFingerprint({...s,hasSaasAccount:false},choice),fingerprint,"STALE_REVIEW");assert.ok(s.hasSaasAccount);return "already_converted";}
  assert.equal(legacyReviewFingerprint(s,choice),fingerprint,"STALE_REVIEW");
  const preview=previewLegacy(s,choice,now);assert.ok(preview.state,preview.blocked.join(","));
  await tx.query("INSERT INTO saas_accounts(organisation_id,state) VALUES($1,$2::jsonb)",[org,JSON.stringify(preview.state)]);
  if(fail)throw Error("SYNTHETIC_INTERRUPTION");
  await tx.query("INSERT INTO isolated_conversion_audit VALUES($1,$2,$3::jsonb,$4)",[org,fingerprint,JSON.stringify(preview.state),choice.reviewer]);
  await tx.query("INSERT INTO saas_events(organisation_id,action,details) VALUES($1,'isolated_legacy_conversion',$2::jsonb)",[org,JSON.stringify({legacySubscriptionId:s.subscriptions[0].id,fingerprint,reviewer:choice.reviewer})]);
  return "converted";
 });}
 const historyBefore=(await query("SELECT * FROM subscriptions ORDER BY id")).rows;
 const overview=[];
 for(const s of fixtures){const loaded=await load(database,s.organisationId);const p=previewLegacy(loaded,choices.get(s.organisationId)!,now);overview.push(p);}
 assert.equal((await query("SELECT count(*)::int n FROM saas_accounts")).rows[0].n,0,"Preview never enrolls accounts");
 assert.equal((await query("SELECT count(*)::int n FROM saas_events")).rows[0].n,0,"Preview has no writes");
 const aPreview=overview.find(p=>p.organisationId===101)!;
 await assert.rejects(convert(101,aPreview.fingerprint,{...decision,target:saasSelection("business")}),/STALE_REVIEW/);
 await assert.rejects(convert(101,aPreview.fingerprint,decision,true),/SYNTHETIC_INTERRUPTION/);
 assert.equal((await query("SELECT count(*)::int n FROM saas_accounts")).rows[0].n,0,"Interrupted conversion rolls back completely");
 for(const org of [101,102,103]){
  const p=overview.find(p=>p.organisationId===org)!;assert.equal(p.status,"ready_for_isolated_rehearsal");
  assert.equal(await convert(org,p.fingerprint,choices.get(org)!),"converted");
  const before=await store.current(org);
  assert.equal(before.cycleStart,p.start);assert.equal(before.cycleEnd,p.end);assert.equal(before.phase,"active");assert.equal(before.trialEndsAt,null);
  const source=fixtures.find(s=>s.organisationId===org)!;
  assert.deepEqual(before.activeSiteIds,source.sites);assert.deepEqual(before.activeStaffIds,source.staff);
  assert.ok(saasQuotas(before).staff>=source.acquired.staff!);assert.ok(saasQuotas(before).sites>=source.acquired.sites!);
  for(const feature of source.acquired.features)assert.equal(hasSaasFeature(before.plan,feature as any),true);
  assert.equal(await convert(org,p.fingerprint,choices.get(org)!),"already_converted");assert.deepEqual(await store.current(org),before);
 }
 for(const p of overview.filter(p=>p.status==="review_required")){await assert.rejects(convert(p.organisationId,p.fingerprint,choices.get(p.organisationId)!));assert.equal((await query("SELECT count(*)::int n FROM saas_accounts WHERE organisation_id=$1",[p.organisationId])).rows[0].n,0);}
 assert.ok(previewLegacy(b,{...decision,target:saasSelection("starter")},now).blocked.includes("FEATURES_NOT_REPRESENTABLE"),"Paid Starter must not silently lose machine/team rights");
 assert.ok(previewLegacy(c,{...decision,target:saasSelection("business")},now).blocked.includes("TARGET_WOULD_REDUCE_RIGHTS"),"Preserve unused acquired employee capacity as well as current staff");
 assert.ok(previewLegacy({...a,payment:{...a.payment!,amountXaf:1}},decision,now).blocked.includes("INCONSISTENT_PAID_ALLOCATION"));
 // A stale reviewed plan never authorizes changed live-looking fixture data.
 const p=overview.find(p=>p.organisationId===109)!;
 await query("UPDATE subscriptions SET end_date='2026-12-10T09:35:12.123Z' WHERE id=109");
 await assert.rejects(convert(109,p.fingerprint,decision),/STALE_REVIEW/);
 await query("UPDATE subscriptions SET end_date=$1 WHERE id=109",[special.subscriptions[0].end]);
 assert.deepEqual((await query("SELECT * FROM subscriptions ORDER BY id")).rows,historyBefore,"All historical rows remain byte-equivalent");
 assert.equal((await query("SELECT count(*)::int n FROM saas_invoices")).rows[0].n,0,"Conversion creates no invoice or payment");
 assert.equal((await query("SELECT count(*)::int n FROM isolated_conversion_audit")).rows[0].n,3);
 // Verify billing AFTER conversion, using the actual store and a synthetic provider result.
 async function settle(org:number,plan:"pro"|"business"){
  const q=await store.createQuote(org,saasSelection(plan));
  const p=await store.reserveCheckout(org,q.id);await store.recordCheckout(org,q.id,"synthetic-code","https://checkout.sandbox.pawapay.io/synthetic-code");
  const event={checkoutId:p.checkout_id,checkoutCode:"synthetic-code",clientReferenceId:p.id,status:"COMPLETED",deposit:{status:"COMPLETED",amount:String(p.total_xaf),currency:"XAF",country:"CMR"}};
  await store.applyProviderResult(p.checkout_id!,event);const state=await store.current(org);
  await store.applyProviderResult(p.checkout_id!,event);assert.deepEqual(await store.current(org),state);return q;
 }
 const oldEnd=(await store.current(101)).cycleEnd;
 const renew=await settle(101,"pro");assert.equal(renew.total_xaf,10999);
 assert.equal((await store.current(101)).cycleEnd,oldEnd);assert.equal((await store.current(101)).renewal!.start,oldEnd);
 assert.equal(await convert(101,aPreview.fingerprint,decision),"already_converted");assert.equal((await store.current(101)).renewal!.start,oldEnd,"Second conversion must not erase a paid renewal");
 const up=await settle(102,"business");
 assert.equal(up.quote.lines.find(l=>l.label==="creditPro")!.amountXaf,-saasProrata(6000,b.subscriptions[0].start!,b.subscriptions[0].end!,now),"Upgrade credit uses verified historical amount, never new list price");
 assert.equal((await store.current(102)).plan,"business");
 now=new Date("2026-11-10T09:35:12.122Z");assert.equal((await store.current(101)).phase,"active");
 now=new Date("2026-11-10T09:35:12.123Z");const renewed=await store.current(101);assert.equal(renewed.plan,"pro");assert.equal(renewed.cycleStart,oldEnd);
 now=new Date("2026-12-10T09:35:12.123Z");const expired=await store.current(101);assert.equal(expired.plan,"starter");assert.deepEqual(expired.activeStaffIds,[]);
 assert.equal(process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED,"true");
 const output=new URL("../../../saas-implementation-checks/legacy-conversion-rehearsal/",import.meta.url);await mkdir(output,{recursive:true});
 await writeFile(new URL("overview.json",output),JSON.stringify({syntheticOnly:true,productionRead:false,productionModified:false,published:false,maintenanceSuspended:true,results:{converted:3,blocked:6,idempotency:true,rollback:true,staleReview:true,historicalRowsPreserved:true,noInvoiceCreatedByConversion:true,postConversionRenewalAndCredit:true,exactExpiry:true},accounts:overview},null,2));
 console.log("PASS legacy copy: read-only per-account previews; 3 conversions preserve exact dates, acquired quotas and features; 6 ambiguous cases blocked; idempotency, rollback, stale review, no invoice, renewal and verified historical upgrade credit, expiry with maintenance suspended");
}finally{await memory.close();}
