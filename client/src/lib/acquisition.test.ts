import assert from "node:assert/strict";
import vm from "node:vm";
import {buildSync} from "esbuild";
import {randomUUID} from "node:crypto";
const js=buildSync({entryPoints:["client/src/lib/marketing.ts"],bundle:true,write:false,format:"iife",platform:"browser",globalName:"Marketing",define:{"import.meta.env":'{"VITE_TIKTOK_PIXEL_ENABLED":"true"}'}}).outputFiles[0].text;
const local=new Map(),session=new Map(),requests:any[]=[];
const store=(m:Map<any,any>)=>({getItem:(k:string)=>m.get(k)||null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)});
let now=Date.now();const location={hostname:"app.xpressclean.cm",pathname:"/xpresspro",search:"?utm_source=tiktok&utm_campaign=xpresspro&utm_content=profil",hash:"",reload(){}};
const ctx:any={URL,URLSearchParams,crypto:{randomUUID},Date:{now:()=>now},sessionStorage:store(session),localStorage:store(local),setTimeout,
 document:{referrer:"",createElement:()=>({dataset:{}}),head:{appendChild(){}}},
 window:{location,localStorage:store(local),sessionStorage:store(session)},
 fetch:async(url:string,options:any)=>{requests.push({url,...options,body:options.body?JSON.parse(options.body):null});return {ok:true};}};
vm.runInNewContext(js,ctx);
const api=ctx.Marketing;api.setMarketingScope(true);api.trackMarketingEvent("marketing_visit");
await new Promise(r=>setImmediate(r));assert.equal(requests.length,0);
api.saveMarketingConsent("accepted");api.trackMarketingPage();await new Promise(r=>setImmediate(r));
assert.equal(requests.length,1);assert.equal(requests[0].body.source,"tiktok");assert.equal(requests[0].body.evidence,"utm");
const journey=requests[0].body.journeyId;location.pathname="/auth";location.search="?tab=register";api.trackMarketingEvent("signup_started");await new Promise(r=>setImmediate(r));
assert.equal(requests[1].body.journeyId,journey);assert.equal(requests[1].body.source,"tiktok");
api.trackMarketingEvent("signup_completed");await new Promise(r=>setImmediate(r));assert.equal(requests.length,2,"browser cannot count successful signups");
location.pathname="/xpresspro";location.search="";now+=31*60000;api.trackMarketingEvent("whatsapp_clicked");await new Promise(r=>setImmediate(r));
assert.notEqual(requests[2].body.journeyId,journey);assert.equal(requests[2].body.source,"direct_unknown");
api.saveMarketingConsent("rejected");await new Promise(r=>setImmediate(r));assert.equal(requests.at(-1).url,"/api/marketing/withdraw");assert.equal(session.size,0);
const n=requests.length;api.trackMarketingEvent("marketing_visit");await new Promise(r=>setImmediate(r));assert.equal(requests.length,n);
console.log("Browser attribution continuity, expiry, refusal, withdrawal and server-only signup tests passed");
