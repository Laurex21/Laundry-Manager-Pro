import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../shared/schema";
import { saasSelection } from "../../shared/saas-plans";

// No configured database or provider credentials are used by this rehearsal.
process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/isolated_launch";
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED = "true";
const mode = process.argv.includes("--live") ? "live" : "sandbox";
const pilot = process.argv.includes("--pilot");
if (pilot) process.env.SAAS_LIVE_PILOT_ORGANISATION_ID = "1";
const callbackPath = `/api/saas/${mode}/callback`;
process.env.NODE_ENV = mode === "live" ? "production" : "test";
process.env.SAAS_BILLING_MODE = mode;
if (mode === "live") {
  process.env.SAAS_LIVE_ENABLED = "true";
  process.env.SAAS_DATABASE_ENVIRONMENT = "production";
  process.env.PAWAPAY_PRODUCTION_API_TOKEN = "synthetic-key-never-sent";
  process.env.SAAS_PRODUCTION_ORIGIN = "https://isolated-launch.example";
}
delete process.env.PAWAPAY_SANDBOX_API_TOKEN;
delete process.env.SAAS_SANDBOX_CALLBACK_ORIGIN;
const pg = new PGlite();
const testDb = drizzle(pg, { schema });
const { db, pool } = await import("../db");
for (const method of ["select", "insert", "update", "delete", "execute", "transaction"] as const) {
  (db as any)[method] = testDb[method].bind(testDb);
}
const query = async (text: string, params?: any[]) => {
  const result = await pg.query(text, params);
  return { rows: result.rows, rowCount: result.affectedRows };
};
(pool as any).query = query;
(pool as any).connect = async () => ({ query, release() {} });
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
let keyRequests = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: any) => {
  assert.equal(String(input), `https://api.${mode === "live" ? "" : "sandbox."}pawapay.io/v2/public-key/http`, "No payment/status API call is allowed during callback-only tests");
  keyRequests++;
  return new Response(JSON.stringify([{ id: "isolated-launch-key", key: publicKey.export({ type: "spki", format: "pem" }).toString() }]));
};
try {
  for (const statement of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))) await pg.exec(statement);
  await testDb.insert(schema.users).values([{ id: "launch-owner", organisationId: 1 }, { id: "foreign-owner", organisationId: 2 }]);
  await testDb.insert(schema.organisations).values([{ id: 1, name: "Synthetic launch", ownerId: "launch-owner" }, { id: 2, name: "Synthetic foreign", ownerId: "foreign-owner" }]);
  await testDb.insert(schema.sites).values([{ id: 10, name: "Synthetic site", organisationId: 1 }, { id: 20, name: "Foreign", organisationId: 2 }]);
  const baseline = await query("SELECT * FROM organisations ORDER BY id");
  const migration = await readFile(new URL("../../migrations/20261021_saas_billing_v5.sql", import.meta.url), "utf8");
  // Rehearse the exact deployment SQL, including its repeatability.
  await pg.exec(migration);
  await pg.exec(migration);
  const environmentMigration = await readFile(new URL("../../migrations/20261021_saas_provider_environment.sql", import.meta.url), "utf8");
  await pg.exec(environmentMigration);
  await pg.exec(environmentMigration);
  assert.deepEqual((await query("SELECT * FROM organisations ORDER BY id")).rows, baseline.rows);
  assert.equal((await query("SELECT count(*)::int AS n FROM saas_accounts")).rows[0].n, 0, "Migration never enrols existing organisations");
  const { saasStore } = await import("./saas-runtime");
  let rehearsalNow = new Date("2026-01-31T12:00:00Z");
  Object.defineProperty(saasStore, "clock", { value: () => new Date(rehearsalNow) });
  const { registerSaasRoutes } = await import("./saas-routes");
  const handlers = new Map<string, Function>();
  const app: any = { get: (path: string, ...fn: Function[]) => handlers.set("GET " + path, fn.at(-1)!), post: (path: string, ...fn: Function[]) => handlers.set("POST " + path, fn.at(-1)!) };
  registerSaasRoutes(app, { backgroundJobs: false });
  async function pilotRequest(method: string, path: string, req: any) {
    let status=200; let body:any; const headers:Record<string,string>={};
    const res:any={set:(k:string,v:string)=>{headers[k]=v;return res;},status:(c:number)=>{status=c;return res;},json:(b:any)=>{body=b;return res;},sendStatus:(c:number)=>{status=c;return res;}};
    await handlers.get(method+" "+path)!(req,res);
    return {status,body,headers};
  }
  if(pilot) {
    const runtime=await import("./saas-runtime");
    assert.equal(await runtime.saasForOrganisation(2),null);
    const {applySaasAccess}=await import("./saas-access");
    assert.equal(await applySaasAccess({organisationId:2},{status:()=>{throw Error("FOREIGN_ACCESS_CHANGED");}}),true);
    for(const session of [undefined,{userId:"foreign-owner"}]) {
      const config=await pilotRequest("GET","/api/saas/config",{session});
      assert.equal(config.body.enabled,false);assert.equal(config.headers["Cache-Control"],"private, no-store");
    }
    assert.equal((await pilotRequest("GET","/api/saas/config",{session:{userId:"launch-owner"}})).body.enabled,true);
    const foreign={organisationId:2,userId:"foreign-owner",body:{plan:"pro"}};
    assert.equal((await pilotRequest("POST","/api/saas/quote",foreign)).status,404);
    for(const body of [{plan:"business"},{plan:"pro",extraSites:1},{plan:"pro",extraStaff:1}]) {
      assert.equal((await pilotRequest("POST","/api/saas/quote",{organisationId:1,userId:"launch-owner",body})).status,403);
    }
    for(const path of ["/api/saas/schedule","/api/saas/access"])assert.equal((await pilotRequest("POST",path,{organisationId:1,userId:"launch-owner",body:{}})).status,403);
    assert.equal((await pilotRequest("POST","/api/receipt-snapshots",{...foreign,saas:{}})).status,404);
    assert.equal((await query("SELECT count(*)::int n FROM saas_accounts")).rows[0].n,0,"Denied requests and config must never enrol accounts");
    assert.equal((await query("SELECT count(*)::int n FROM saas_events")).rows[0].n,0);
    const {storage}=await import("../storage");
    await storage.createSite(2,{name:"Legacy organisation retains site creation"});
    assert.equal((await query("SELECT count(*)::int n FROM saas_accounts WHERE organisation_id=2")).rows[0].n,0);
    const validQuote=await pilotRequest("POST","/api/saas/quote",{organisationId:1,userId:"launch-owner",body:{plan:"pro"}});
    assert.equal(validQuote.status,201);assert.equal(Number(validQuote.body.total_xaf),10999);
    await query("UPDATE saas_invoices SET total_xaf=0 WHERE id=$1",[validQuote.body.id]);
    const wrongAmount=await pilotRequest("POST","/api/saas/invoices/:id/checkout",{organisationId:1,userId:"launch-owner",params:{id:validQuote.body.id}});
    assert.equal(wrongAmount.body.code,"PILOT_AMOUNT_REQUIRES_REVIEW");
    await query("UPDATE saas_invoices SET total_xaf=10999 WHERE id=$1",[validQuote.body.id]);
  }
  async function pending() {
    const quote = await saasStore.createQuote(1, saasSelection("pro"));
    const invoice = await saasStore.reserveCheckout(1, quote.id);
    await saasStore.recordCheckout(1, quote.id, "launch-code", `https://checkout.${mode === "live" ? "" : "sandbox."}pawapay.io/launch-code`);
    return invoice;
  }
  function event(invoice: any, status = "COMPLETED") {
    return { checkoutId: invoice.checkout_id, checkoutCode: "launch-code", clientReferenceId: invoice.id, status, ...(status === "COMPLETED" ? { deposit: { depositId: crypto.randomUUID(), status, amount: String(invoice.total_xaf), currency: "XAF", country: "CMR" } } : {}) };
  }
  async function callback(body: any, validSignature = true) {
    const rawBody = Buffer.from(JSON.stringify(body));
    const created = Math.floor(Date.now() / 1000);
    const params = `("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="isolated-launch-key";created=${created};expires=${created + 60}`;
    const headers: any = { "content-type": "application/json", "signature-date": new Date().toISOString(), "content-digest": `sha-512=:${crypto.createHash("sha512").update(rawBody).digest("base64")}:`, "signature-input": `sig-pp=${params}` };
    const base = `"@method": POST\n"@authority": isolated-launch.example\n"@path": ${callbackPath}\n"signature-date": ${headers["signature-date"]}\n"content-digest": ${headers["content-digest"]}\n"content-type": application/json\n"@signature-params": ${params}`;
    headers.signature = validSignature ? `sig-pp=:${crypto.sign("sha256", Buffer.from(base), privateKey).toString("base64")}:` : "invalid";
    let status = 200;
    const res: any = { status: (code: number) => { status = code; return res; }, sendStatus: (code: number) => { status = code; return res; }, json: () => res };
    await handlers.get("POST " + callbackPath)!({ method: "POST", path: callbackPath, headers, rawBody, body, is: () => true, get: () => "isolated-launch.example" }, res);
    return status;
  }
  const first = await pending();
  const before = await saasStore.current(1);
  for (const status of ["FAILED", "EXPIRED", "CANCELLED"]) {
    const invoice = status === "FAILED" ? first : await pending();
    assert.equal(await callback(event(invoice, status)), 200);
    assert.equal((await saasStore.invoice(saasStore.db, 1, invoice.id)).status, "failed");
    assert.deepEqual(await saasStore.current(1), before, `${status} must never activate access`);
  }
  const invoice = await pending();
  const completed = event(invoice);
  assert.equal(await callback(completed, false), 401);
  assert.equal(await callback({ ...completed, clientReferenceId: crypto.randomUUID() }), 409);
  assert.equal(await callback({ ...completed, amount: "1" }), 409);
  assert.equal(await callback({ ...completed, deposit: { ...completed.deposit, amount: "1" } }), 409);
  assert.equal(await callback({ ...completed, deposit: undefined }), 409);
  assert.deepEqual(await saasStore.current(1), before);
  assert.equal(await callback(completed), 200, "First signed checkout callback must activate without polling");
  const active = await saasStore.current(1);
  assert.equal(active.phase, "active");
  assert.equal(active.plan, "pro");
  if(pilot) {
    const request={organisationId:1,userId:"launch-owner",body:{plan:"pro"},params:{id:invoice.id}};
    assert.equal((await pilotRequest("POST","/api/saas/quote",request)).body.code,"PILOT_ALREADY_PAID");
    assert.equal((await pilotRequest("POST","/api/saas/invoices/:id/checkout",request)).body.code,"PILOT_ALREADY_PAID");
  }
  assert.equal((await saasStore.invoice(saasStore.db, 1, invoice.id)).status, "paid");
  assert.equal(await callback(completed), 200);
  assert.deepEqual(await saasStore.current(1), active, "Duplicate notification cannot add another cycle");
  assert.equal(await callback(event(invoice, "FAILED")), 409);
  assert.equal((await query("SELECT count(*)::int AS n FROM saas_accounts WHERE organisation_id=2")).rows[0].n, 0);
  assert.equal((await query("SELECT count(*)::int AS n FROM saas_events WHERE action='payment_applied'")).rows[0].n, 1);
  await pg.exec(migration);
  assert.deepEqual(await saasStore.current(1), active, "Reapplying additive migration preserves paid state");
  // A live adapter cannot read or apply a Sandbox invoice, even with its UUID.
  const { SaasStore } = await import("./saas-store");
  const otherMode = mode === "live" ? "sandbox" : "live";
  const oppositeSource = mode === "live" ? "pawapay_sandbox" : "pawapay_live";
  const liveStore = new SaasStore(saasStore.db, undefined, otherMode);
  await assert.rejects(liveStore.invoice(liveStore.db, 1, invoice.id), /INVOICE_NOT_FOUND/);
  await assert.rejects(liveStore.applyProviderResult(invoice.checkout_id!, completed, oppositeSource), /CHECKOUT_NOT_FOUND/);
  await assert.rejects(saasStore.applyProviderResult(invoice.checkout_id!, completed, oppositeSource), /PROVIDER_ENVIRONMENT_MISMATCH/);
  assert.ok(keyRequests > 0);
  // The same signed-callback flow now drives actual access middleware with jobs paused.
  const { applySaasAccess } = await import("./saas-access");
  const { startSaasJobs } = await import("./saas-runtime");
  let scheduled = 0;
  const nativeInterval = globalThis.setInterval;
  globalThis.setInterval = ((..._args: any[]) => { scheduled++; return { unref() {} }; }) as any;
  startSaasJobs();
  globalThis.setInterval = nativeInterval;
  assert.equal(scheduled, 0, "Maintenance stays paused even with billing enabled");
  await testDb.insert(schema.users).values([{id:"worker-a",organisationId:1,userType:"staff"},{id:"worker-b",organisationId:1,userType:"staff"},{id:"worker-c",organisationId:1,userType:"staff"}]);
  await testDb.insert(schema.sites).values({id:11,name:"Historical synthetic site",organisationId:1});
  await testDb.insert(schema.siteMembers).values(["worker-a","worker-b","worker-c"].map(userId=>({siteId:10,userId,role:"operator"})));
  await saasStore.selectAccess(1,[10],["worker-a","worker-b"]);
  async function access(path:string,method="GET",userId="launch-owner",siteId=10) {
    const req:any={userId,organisationId:1,method,path,siteId,authorizedSiteIds:[10,11],organisationSiteIds:[10,11],siteScope:[siteId],organisationSiteScope:[10,11]};
    let code=200;let body:any;
    const res:any={status:(c:number)=>{code=c;return res;},json:(b:any)=>{body=b;return res;}};
    const passed=await applySaasAccess(req,res);return {code,body,passed};
  }
  async function purchase(org:number,selection:ReturnType<typeof saasSelection>) {
    const q=await saasStore.createQuote(org,selection);
    const p=await saasStore.reserveCheckout(org,q.id);
    await saasStore.recordCheckout(org,q.id,"launch-code","https://checkout.pawapay.io/launch-code");
    const e=event(p);assert.equal(await callback(e),200);
    const state=await saasStore.current(org);
    assert.equal(await callback(e),200);
    assert.deepEqual(await saasStore.current(org),state,"Repeated callback never grants twice");
    return {quote:q,state};
  }
  assert.equal((await access("/api/reports")).passed,true,"Paid Pro unlocks reports");
  assert.equal((await access("/api/machines")).passed,true);
  assert.equal((await access("/api/orders","GET","worker-a")).passed,true);
  assert.equal((await access("/api/orders","GET","worker-c")).code,403,"Unallocated third employee denied");
  assert.equal((await access("/api/orders","POST","launch-owner",11)).code,403,"Pro cannot operate a second shop");
  await assert.rejects(saasStore.db.transaction(tx=>saasStore.allocateSite(tx,1,async()=>99)),/BUSINESS_REQUIRED/);
  const businessBefore=(await query("SELECT * FROM organisations ORDER BY id")).rows;
  const option=await purchase(1,saasSelection("pro",0,1));
  assert.equal(option.quote.total_xaf,2000);
  await saasStore.selectAccess(1,[10],["worker-a","worker-b","worker-c"]);
  assert.equal((await access("/api/orders","GET","worker-c")).passed,true,"Paid extra employee enabled");
  rehearsalNow=new Date("2026-02-14T12:00:00Z");
  const upgrade=await purchase(1,saasSelection("business"));
  assert.equal(upgrade.quote.quote.lines.find(l=>l.label==="creditPro")?.amountXaf,-5500);
  assert.equal(upgrade.quote.quote.lines.find(l=>l.label==="creditStaff")?.amountXaf,-1000);
  assert.equal(upgrade.quote.total_xaf,12499);
  assert.equal(upgrade.state.plan,"business");
  await saasStore.selectAccess(1,[10,11],["worker-a","worker-b","worker-c"]);
  assert.equal((await access("/api/orders","POST","launch-owner",11)).passed,true,"Business immediately enables second site");
  await saasStore.schedule(1,saasSelection("pro"));
  const downgrade=await purchase(1,saasSelection("pro"));
  assert.equal(downgrade.state.plan,"business","Downgrade preserves paid Business period");
  const oldEnd=downgrade.state.cycleEnd!;
  assert.equal(downgrade.state.renewal?.start,oldEnd);
  rehearsalNow=new Date(oldEnd);
  assert.equal((await access("/api/orders","POST","launch-owner",11)).code,403,"Downgrade restricts extra shop at expiry without any background job");
  assert.equal((await access("/api/orders","GET","launch-owner",11)).passed,true,"Historical shop data remains readable");
  assert.equal((await saasStore.current(1)).plan,"pro");
  const cycleBeforeRenewal=await saasStore.current(1);
  const renewal=await purchase(1,saasSelection("pro"));
  assert.equal(renewal.state.cycleEnd,cycleBeforeRenewal.cycleEnd,"Early renewal preserves current days");
  assert.equal(renewal.state.renewal?.start,cycleBeforeRenewal.cycleEnd);
  rehearsalNow=new Date(renewal.state.renewal!.start);
  const renewed=await saasStore.current(1);
  assert.equal(renewed.cycleEnd,renewal.state.renewal!.end,"Next period starts at the previous end");
  rehearsalNow=new Date(renewed.cycleEnd!);
  assert.equal((await access("/api/reports")).code,403,"Expiry revokes premium feature on request while jobs paused");
  assert.equal((await access("/api/orders","GET","worker-a")).code,403,"Expiry revokes staff sessions");
  assert.equal((await access("/api/orders")).passed,true,"Starter retains owner order access");
  assert.equal((await access("/api/payments/ledger")).passed,true);
  assert.equal((await saasStore.current(1)).plan,"starter");
  assert.deepEqual((await query("SELECT * FROM organisations ORDER BY id")).rows,businessBefore,"No organisation data changed by paid transitions");
  assert.equal(process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED,"true");
  // Legacy protections are rehearsed only against synthetic rows in this memory database.
  await testDb.insert(schema.plans).values({id:901,name:"Legacy Starter",slug:"legacy-starter",price:"6000.00"});
  await testDb.insert(schema.users).values({id:"legacy-owner",organisationId:3});
  await testDb.insert(schema.organisations).values({id:3,name:"Synthetic legacy",ownerId:"legacy-owner"});
  await testDb.insert(schema.sites).values({id:30,name:"Legacy site",organisationId:3});
  await testDb.insert(schema.subscriptions).values({id:901,userId:"legacy-owner",planId:901,status:"active",endDate:new Date(rehearsalNow.getTime()+10*86400000)});
  async function legacySnapshot(){return (await query("SELECT to_jsonb(s) AS row FROM subscriptions s WHERE user_id='legacy-owner' ORDER BY id")).rows;}
  const legacyBefore=await legacySnapshot();
  await assert.rejects(saasStore.current(3),/LEGACY_SUBSCRIPTION_REQUIRES_REVIEW/);
  const legacyQuote=await pilotRequest("POST","/api/saas/quote",{organisationId:3,userId:"legacy-owner",body:{plan:"pro"}});
  assert.equal(legacyQuote.body.code,"LEGACY_SUBSCRIPTION_REQUIRES_REVIEW");
  assert.deepEqual(await legacySnapshot(),legacyBefore,"Legacy paid dates are never shortened");
  assert.equal((await query("SELECT count(*)::int n FROM saas_accounts WHERE organisation_id=3")).rows[0].n,0);
  assert.equal((await query("SELECT count(*)::int n FROM saas_invoices WHERE organisation_id=3")).rows[0].n,0,"No double invoice while legacy paid period needs review");
  // Even an elapsed row still marked active requires review: background suspension cannot silently migrate it.
  await query("UPDATE subscriptions SET end_date=$1 WHERE id=901",[new Date(rehearsalNow.getTime()-86400000).toISOString()]);
  const elapsedBefore=await legacySnapshot();
  await assert.rejects(saasStore.current(3),/LEGACY_SUBSCRIPTION_REQUIRES_REVIEW/);
  assert.deepEqual(await legacySnapshot(),elapsedBefore);
  console.log("PASS legacy protection: active period preserved, quote blocked without invoice, expired-but-active rows require explicit review");
  console.log("PASS full chain: signed payment -> Pro and staff access -> Business with base and employee credit -> scheduled Pro downgrade -> early renewal preserving days -> request-time expiry with jobs suspended; history and foreign tenant preserved");
  console.log(`PASS isolated ${mode} launch: migration rehearsal, first signed callback without reconciliation, duplicate, failure, expiry, cancellation, tampering and tenant isolation`);
} finally {
  globalThis.fetch = originalFetch;
  await pg.close();
  await pool.end();
}
