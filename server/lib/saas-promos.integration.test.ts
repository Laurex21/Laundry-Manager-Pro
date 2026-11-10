import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {SaasStore,type SaasDatabase} from './saas-store';
import {createPromo,listPromos} from './saas-promos';
import {promoSchema} from '../../shared/saas-promos';
import {saasSelection} from '../../shared/saas-plans';
// In-memory PostgreSQL only: no application DB, credentials, provider or email.
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
process.env.SALES_EMAIL_ENABLED='false';
process.env.SAAS_DEFERRED_ORGANISATION_IDS='3,100,112,193';
const pg=new PGlite(),now=new Date('2026-11-10T12:00:00Z');
const db:SaasDatabase={query:async(s,p)=>{const r=await pg.query<any>(s,p);return {rows:r.rows};},transaction:fn=>pg.transaction(t=>fn({query:async(s,p)=>{const r=await t.query<any>(s,p);return {rows:r.rows};}}))};
const store=new SaasStore(db,()=>now);
let assertions=0;
async function rejects(fn:()=>Promise<unknown>,code:string){await assert.rejects(fn,new RegExp(code));assertions++;}
async function seed(id:number){await db.query('INSERT INTO users(id,organisation_id) VALUES($1,$2)',[`owner-${id}`,id]);await db.query("INSERT INTO organisations VALUES($1,$2,'2025-01-01')",[id,`owner-${id}`]);await db.query("INSERT INTO sites(organisation_id,name) VALUES($1,'Fictif')",[id]);await store.ensure(id);}
const input=(code:string,over:Record<string,unknown>={})=>({code,kind:'percent',value:10,plans:['pro','business'],startsAt:'2026-11-01T00:00:00Z',endsAt:'2027-01-01T00:00:00Z',maxUses:100,firstOnly:true,representativeId:null,...over});
const create=(code:string,over:Record<string,unknown>={})=>db.transaction(tx=>createPromo(tx,input(code,over),'admin','sandbox'));
function event(i:any,status='COMPLETED'){return {checkoutId:i.checkout_id,checkoutCode:'fake',status,deposit:{status:'COMPLETED',amount:String(i.total_xaf),currency:'XAF',country:'CMR'}};}
async function reserve(org:number,code:string){const q=await store.createQuote(org,saasSelection('pro'),code);const i=await store.reserveCheckout(org,q.id);await store.recordCheckout(org,q.id,'fake','https://checkout.sandbox.pawapay.io/fake');return i;}
try{
 await pg.exec(`CREATE TABLE users(id varchar PRIMARY KEY,organisation_id integer,first_name text,last_name text,email text);
 CREATE TABLE organisations(id integer PRIMARY KEY,owner_id varchar NOT NULL,created_at timestamptz NOT NULL);
 CREATE TABLE sites(id serial PRIMARY KEY,organisation_id integer,name text,is_active boolean DEFAULT true);
 CREATE TABLE site_members(id serial PRIMARY KEY,site_id integer,user_id varchar);
 CREATE TABLE subscriptions(id serial PRIMARY KEY,user_id varchar,status text);
 CREATE TABLE orders(id integer PRIMARY KEY); INSERT INTO users(id) VALUES('admin'),('ambassador');`);
 for(const file of ['20261021_saas_billing_v5.sql','20261101_sales_referrals.sql','20261104_ambassador_user_access.sql','20261110_saas_promos.sql'])await pg.exec(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 await pg.exec(await readFile(new URL('../../migrations/20261110_saas_promos.sql',import.meta.url),'utf8'));
 for(const id of [1,2,5,6,7,8,9,10,11,12,13,14,15,16])await seed(id);
 const rep=(await db.query("INSERT INTO sales_representatives(name,country,code,environment,created_by) VALUES('Fictif','CM','CM-AAAAAAAAAAAAAAAAAAAA','test','admin') RETURNING id")).rows[0].id;
 await db.query("INSERT INTO sales_user_access(representative_id,user_id,environment,created_by) VALUES($1,'ambassador','test','admin')",[rep]);
 await db.query("UPDATE users SET organisation_id=999 WHERE id='ambassador'");
 await create('LAURE10',{representativeId:rep});
 const before=await store.current(1);const q=await store.createQuote(1,saasSelection('pro'),' laure10 ');
 assert.equal(q.total_xaf,9900);assert.equal(q.quote.promo?.discountXaf,1099);assert.deepEqual(await store.current(1),before);
 assert.equal((await store.createQuote(1,saasSelection('pro'),'LAURE10')).id,q.id);
 const i=await reserve(1,'LAURE10');assert.equal((await store.reserveCheckout(1,i.id)).checkout_id,i.checkout_id);
 await rejects(()=>store.applyProviderResult(i.checkout_id!,{...event(i),deposit:{...event(i).deposit,amount:'1'}}),'PAYMENT_MISMATCH');
 await store.applyProviderResult(i.checkout_id!,event(i));await store.applyProviderResult(i.checkout_id!,event(i));
 assert.equal((await listPromos(db,'sandbox'))[0].uses,1);assert.equal((await store.current(1)).paidBaseXaf,9900);
 assert.equal((await db.query('SELECT representative_id FROM sales_registrations WHERE organisation_id=1')).rows[0].representative_id,rep);
 await rejects(()=>store.createQuote(1,saasSelection('pro'),'LAURE10'),'PROMO_LIMIT_REACHED');
 await create('NEW10');await rejects(()=>store.createQuote(1,saasSelection('pro'),'NEW10'),'PROMO_FIRST_PAYMENT_ONLY');
 await create('LAST',{maxUses:1});const a=await reserve(2,'LAST');await rejects(()=>reserve(5,'LAST'),'PROMO_LIMIT_REACHED');
 await store.applyProviderResult(a.checkout_id!,event(a,'FAILED'));const b=await reserve(5,'LAST');await store.applyProviderResult(b.checkout_id!,event(b));
 await rejects(()=>reserve(6,'LAST'),'PROMO_LIMIT_REACHED');
 await create('EXPIRED',{endsAt:'2026-11-02T00:00:00Z'});await rejects(()=>reserve(6,'EXPIRED'),'PROMO_UNAVAILABLE');
 await create('FUTURE',{startsAt:'2026-12-01T00:00:00Z'});await rejects(()=>reserve(6,'FUTURE'),'PROMO_UNAVAILABLE');
 await create('BUSINESS',{plans:['business']});await rejects(()=>reserve(6,'BUSINESS'),'PROMO_NOT_ELIGIBLE');
 await create('TOOMUCH',{kind:'fixed',value:10999});await rejects(()=>reserve(6,'TOOMUCH'),'PROMO_AMOUNT_INVALID');
 await create('OFF');const off=await store.createQuote(6,saasSelection('pro'),'OFF');await db.query("UPDATE saas_promos SET active=false WHERE code='OFF'");await rejects(()=>store.reserveCheckout(6,off.id),'PROMO_UNAVAILABLE');
 await create('FIXED',{kind:'fixed',value:500});const fixed=await store.createQuote(7,saasSelection('business',1,1),'FIXED');assert.equal(fixed.total_xaf,fixed.quote.promo!.originalXaf-500);
 await rejects(()=>new SaasStore(db,()=>now,'live').createQuote(8,saasSelection('pro'),'LAURE10'),'PROMO_UNAVAILABLE');
 await rejects(()=>store.createQuote(3,saasSelection('pro'),'LAURE10'),'SAAS_ORGANISATION_DEFERRED');
 await db.query("UPDATE users SET organisation_id=100 WHERE id='ambassador'");await rejects(()=>reserve(8,'LAURE10'),'PROMO_UNAVAILABLE');await rejects(()=>create('EXCLUDED',{representativeId:rep}),'PROMO_AMBASSADOR_UNAVAILABLE');
 await db.query("UPDATE users SET organisation_id=999 WHERE id='ambassador'");
 const rep2=(await db.query("INSERT INTO sales_representatives(name,country,code,environment,created_by) VALUES('Other','CM','CM-BBBBBBBBBBBBBBBBBBBB','test','admin') RETURNING id")).rows[0].id;
 await db.query("INSERT INTO sales_registrations(user_id,representative_id,organisation_id,country,environment) VALUES('owner-8',$1,8,'CM','test')",[rep2]);
 const existing=await reserve(8,'LAURE10');await store.applyProviderResult(existing.checkout_id!,event(existing));assert.equal((await db.query('SELECT representative_id FROM sales_registrations WHERE organisation_id=8')).rows[0].representative_id,rep2);
 await create('RENEW',{firstOnly:false});const r=await reserve(8,'RENEW');const state=await store.current(8);await store.applyProviderResult(r.checkout_id!,event(r));const after=await store.current(8);assert.equal(after.cycleEnd,state.cycleEnd);assert.equal(after.renewal!.start,state.cycleEnd);
 const changed=await store.createQuote(9,saasSelection('pro'),'NEW10');const noCode=await store.createQuote(9,saasSelection('pro'));assert.equal(noCode.total_xaf,10999);assert.equal((await store.invoice(db,9,changed.id)).status,'expired');
 await create('HONORED');const honored=await reserve(10,'HONORED');await db.query("UPDATE saas_promos SET active=false WHERE code='HONORED'");await store.applyProviderResult(honored.checkout_id!,event(honored));assert.equal((await store.invoice(db,10,honored.id)).status,'paid');
 await create('RACE',{maxUses:1});const q1=await store.createQuote(11,saasSelection('pro'),'RACE'),q2=await store.createQuote(12,saasSelection('pro'),'RACE');
 const race=await Promise.allSettled([store.reserveCheckout(11,q1.id),store.reserveCheckout(12,q2.id)]);assert.equal(race.filter(x=>x.status==='fulfilled').length,1);assert.equal(race.filter(x=>x.status==='rejected').length,1);
 assert.equal(promoSchema.safeParse(input('FREE',{value:100})).success,false);
 assert.equal(promoSchema.safeParse({...input('TEST'),totalXaf:1}).success,false);
 assert.equal((await listPromos(db,'sandbox',rep2)).length,0);
 console.log(`PASS promo integration: ${assertions} refusal scenarios; confirmed-only usage, reservation/failure, duplicate callbacks, price tampering, credits, renewal days, ambassador attribution, exclusions, environments, migration idempotence. No external services.`);
}finally{await pg.close();}
