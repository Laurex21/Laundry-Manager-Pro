import { strict as assert } from "node:assert";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { themes } from "./consulting-course-catalogue";
import { registerConsultingPilot } from "./consulting-pilot";
import { courseMode } from "./consulting-course-payments";

test("live course uses its own verified purchases, links and single-use access grant", async () => {
  const originalEnv = { ...process.env };
  const realFetch = globalThis.fetch;
  const pg = new PGlite();
  const app = express();
  const db = { query: async (sql: string, values?: unknown[]) => {
    const r = await pg.query(sql, values);
    return { rows: r.rows, rowCount: r.rows.length };
  } } as unknown as Pick<Pool, "query">;
  const http = app.listen(0, "127.0.0.1");
  try {
    assert.equal(courseMode({NODE_ENV:"development", REPLIT_DEPLOYMENT:"1"}), null);
    Object.assign(process.env, { NODE_ENV:"production", REPLIT_DEPLOYMENT:"1", SAAS_BILLING_MODE:"live",
      SAAS_LIVE_ENABLED:"true", SAAS_DATABASE_ENVIRONMENT:"production", SAAS_DEFERRED_ORGANISATION_IDS:"3,100,112,193",
      PAWAPAY_PRODUCTION_API_TOKEN:"fixture-live-only", PAWAPAY_SANDBOX_API_TOKEN:"fixture-sandbox-only",
      SAAS_PRODUCTION_ORIGIN:"https://app.xpressclean.cm" });
    await pg.exec("CREATE TABLE users(id varchar PRIMARY KEY); CREATE TABLE organisations(id integer PRIMARY KEY,owner_id varchar); INSERT INTO users VALUES ('alice'),('bob'),('former'); INSERT INTO organisations VALUES (100,'former');");
    const ddl = readFileSync("migrations/20261128_consulting_course_sales.sql","utf8");
    await pg.exec(ddl);
    await pg.exec(ddl);
    await pg.exec("CREATE TABLE consulting_course_sandbox_attempts(learner_id text,status text); INSERT INTO consulting_course_sandbox_attempts VALUES ('bob','COMPLETED');");
    registerConsultingPilot(app, (req,res,next) => {
      if (!req.headers.user) { res.sendStatus(401); return; }
      Object.assign(req,{session:{userId:req.headers.user},organisationId:Number(req.headers.org || 1)});
      next();
    }, db);
    if (!http.listening) await once(http,"listening");
    const addr = http.address();
    assert.ok(addr && typeof addr !== "string");
    const api = 'http://127.0.0.1:' + addr.port + '/api/consulting-pilot';
    const get = (user: string, path="", method="GET", org="1") =>
      realFetch(api + path,{method,headers:{user,org},redirect:"manual"});
    let creates = 0;
    let checkout = "";
    let expectedAmount = "100000";
    globalThis.fetch = async (input,init) => {
      const url = String(input);
      assert.equal(new URL(url).origin,"https://api.pawapay.io");
      assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer fixture-live-only");
      const amount = {country:"CMR",currency:"XAF",amount:expectedAmount};
      if (init?.method === "POST") {
        creates++;
        const request = JSON.parse(String(init.body));
        checkout = request.checkoutId;
        assert.deepEqual(request.amounts,[amount]);
        assert.equal(request.returnUrl,"https://app.xpressclean.cm/mes-formations");
        return Response.json({status:"ACCEPTED",checkoutId:checkout,checkoutCode:"test",redirectUrl:"https://checkout.pawapay.io/test"});
      }
      assert.ok(url.endsWith("/" + checkout));
      return Response.json({status:"FOUND",data:{checkoutId:checkout,clientReferenceId:checkout,checkoutCode:"test",status:"COMPLETED",amounts:[amount],deposit:{...amount,status:"COMPLETED"}}});
    };
    assert.equal((await realFetch(api)).status,401);
    const list = await (await get("alice")).json();
    const lessons = themes.flatMap(t=>t.lessons);
    assert.equal(list.amount,100000);
    assert.equal(list.mode,"live");
    assert.equal(list.themes.length,7);
    assert.equal(lessons.length,57);
    const first = "/modules/" + lessons[0].id;
    assert.equal((await get("bob",first)).status,403);
    for (const org of ["3","100","112","193"]) assert.equal((await get("alice","/checkout","POST",org)).status,403);
    assert.equal((await get("former","/checkout","POST")).status,403);
    assert.equal((await get("alice","/checkout","POST")).status,503);
    assert.equal(creates,0);
    for (const lesson of lessons) await pg.query("INSERT INTO consulting_course_live_videos VALUES ($1,'example0001')",[lesson.id]);
    const result = await (await get("alice","/checkout","POST")).json();
    assert.equal(result.redirectUrl,"https://checkout.pawapay.io/test");
    expectedAmount = "100";
    assert.equal((await (await get("alice")).json()).status,"PENDING");
    assert.equal((await get("alice",first)).status,403);
    expectedAmount = "100000";
    assert.equal((await (await get("alice")).json()).status,"COMPLETED");
    for (const lesson of lessons) assert.equal((await get("alice","/modules/" + lesson.id)).status,303);
    assert.equal((await get("bob",first)).status,403);
    assert.equal((await (await get("alice","/checkout","POST")).json()).status,"COMPLETED");
    assert.equal(creates,1);
  } finally {
    globalThis.fetch = realFetch;
    process.env = originalEnv;
    http.closeAllConnections();
    await new Promise<void>(resolve=>http.close(()=>resolve()));
    await pg.close();
  }
});
