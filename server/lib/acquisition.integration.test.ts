import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {acquisitionSchema,referralSource} from "../../shared/acquisition";
process.env.DATABASE_URL="postgresql://test:unused@127.0.0.1:1/test_only";
const pg=new PGlite();
await pg.exec(await readFile("migrations/20261027-marketing-attribution.sql","utf8"));
await pg.exec(`CREATE TABLE security_rate_limits(bucket_key text primary key,count int,reset_at timestamptz)`);
const {pool}=await import("../db");
(pool as any).query=(sql:string,params?:unknown[])=>pg.query(sql,params);
const {registerAcquisitionRoutes,registrationJourney,recordAcquisitionRegistration}=await import("./acquisition");
const routes=new Map<string,any[]>();
const app:any={post:(path:string,...f:any[])=>routes.set("POST "+path,f),get:(path:string,...f:any[])=>routes.set("GET "+path,f)};
const guard:any=(_q:any,r:any)=>r.status(403).json({message:"denied"});
registerAcquisitionRoutes(app,guard);
function req(body:any={},host="app.xpressclean.cm",origin="https://app.xpressclean.cm"){
 const session:any={save:(f:any)=>f()};return {protocol:"https",body,hostname:host,session,query:{},get:(n:string)=>({host,origin,"sec-fetch-site":"same-origin"}[n]),ip:"synthetic"};
}
async function call(method:string,path:string,q:any,skipGuard=false){
 const r:any={code:200,data:null,setHeader(){},status(c:number){this.code=c;return this;},json(d:any){this.data=d;return this;},sendStatus(c:number){this.code=c;return this;}};
 const f=routes.get(method+" "+path)!;
 if(method==="GET"&&!skipGuard){await f[0](q,r,()=>{});return r;}
 if(method==="POST"&&f.length>1)await f[0](q,r,()=>{});
 if(r.code===200)await f.at(-1)(q,r);
 return r;
}
const base={eventId:crypto.randomUUID(),journeyId:crypto.randomUUID(),consent:true,event:"marketing_visit",page:"/xpresspro",source:"tiktok",evidence:"utm",campaign:"xpresspro",content:"profil"};
assert.equal(referralSource("https://www.tiktok.com/@x"),"tiktok");
assert.equal(referralSource("https://tiktok.com.evil.example"),null);
for(const patch of [{consent:false},{email:"private"},{page:"/orders"},{source:"private"},{campaign:"someone@example.com"},{event:"signup_completed"}])assert.equal(acquisitionSchema.safeParse({...base,...patch}).success,false);
assert.equal((await call("POST","/api/marketing/events",req(base,"app.xpressclean.cm","https://evil.example"))).code,403);
const q=req(base);
assert.equal((await call("POST","/api/marketing/events",q)).code,204);
await call("POST","/api/marketing/events",q);
assert.equal((await pg.query<any>("SELECT count(*)::int n FROM marketing_acquisition_events")).rows[0].n,1,"replayed event deduplicated");
assert.equal(registrationJourney(q),null,"consent must still be present at signup");
q.body={marketingConsent:true,marketingJourneyId:base.journeyId};
await recordAcquisitionRegistration(registrationJourney(q));
await recordAcquisitionRegistration(registrationJourney(q));
assert.equal((await pg.query<any>("SELECT count(*)::int n FROM marketing_acquisition_events WHERE event='signup_completed'")).rows[0].n,1,"server registration counted once");
q.session.marketingJourney.receivedAt-=31*60000;
assert.equal(registrationJourney(q),null,"expired attribution excluded");
await call("POST","/api/marketing/events",req({...base,eventId:crypto.randomUUID(),journeyId:crypto.randomUUID(),event:"whatsapp_clicked"}));
await call("POST","/api/marketing/events",req({...base,eventId:crypto.randomUUID(),journeyId:crypto.randomUUID()},"laundry-manager-pro.replit.app","https://laundry-manager-pro.replit.app"));
const reportReq:any=req();reportReq.query={start:"2026-01-01",end:"2026-12-31"};
assert.equal((await call("GET","/api/platform-admin/acquisition",reportReq)).code,403,"admin guard protects totals");
assert.equal((await call("GET","/api/platform-admin/acquisition",reportReq,true)).code,400,"unbounded report refused");
const today=new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Douala"});reportReq.query={start:today,end:today};
const report=await call("GET","/api/platform-admin/acquisition",reportReq,true);
assert.equal(report.code,200);assert.equal(report.data.rows.length,1);
assert.deepEqual({...report.data.rows[0]},{source:"tiktok",evidence:"utm",campaign:"xpresspro",content:"profil",visits:1,pageviews:1,whatsapp:1,starts:0,registrations:1},"Replit excluded and visits counted by session");
await call("POST","/api/marketing/withdraw",q);assert.equal(q.session.marketingJourney,undefined);
await pg.close();await pool.end();console.log("Acquisition PostgreSQL, consent, deduplication, attribution, origin, retention-window and admin-boundary tests passed");
