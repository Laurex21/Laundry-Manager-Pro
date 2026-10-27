import crypto from "node:crypto";
import type { Express, RequestHandler } from "express";
import { pool } from "../db";
import { acquisitionSchema, ACQUISITION_SESSION_MS, type AcquisitionInput } from "../../shared/acquisition";
import { rateLimit } from "./rate-limit";

type Journey = AcquisitionInput & { receivedAt:number; environment:"production"|"test" };
function environment(req:any):"production"|"test" { return req.hostname === "app.xpressclean.cm" ? "production" : "test"; }
const allowedHost = (req:any) => req.hostname === "app.xpressclean.cm" || req.hostname === "laundry-manager-pro.replit.app" || req.hostname === "localhost";
function sameOrigin(req:any):boolean {
  try { return req.get("sec-fetch-site") !== "cross-site" && new URL(req.get("origin")).origin === `${req.protocol}://${req.get("host")}`; }
  catch { return false; }
}
export async function insertAcquisition(value:Journey, event:string = value.event, eventId = value.eventId):Promise<void> {
  await pool.query(`INSERT INTO marketing_acquisition_events
    (event_id,journey_id,event,page,source,evidence,campaign,content,environment)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
    [eventId,value.journeyId,event,value.page,value.source,value.evidence,value.campaign,value.content,value.environment]);
}
export function registrationJourney(req:any):Journey|null {
  const saved = req.session?.marketingJourney;
  if (req.body?.marketingConsent !== true || req.body?.marketingJourneyId !== saved?.journeyId || !saved || saved.receivedAt < Date.now() - ACQUISITION_SESSION_MS || saved.environment !== environment(req)) return null;
  return saved;
}
export async function recordAcquisitionRegistration(journey:Journey|null):Promise<void> {
  if (!journey) return;
  await insertAcquisition({...journey,page:"/auth"}, "signup_completed", crypto.randomUUID());
}
let lastRetention = 0;
const limit = rateLimit({name:"marketing-acquisition",windowMs:60_000,max:120});
export function registerAcquisitionRoutes(app:Express, admin:RequestHandler):void {
  app.post("/api/marketing/events", limit, async (req:any,res) => {
    res.setHeader("Cache-Control","no-store");
    if (!allowedHost(req) || !sameOrigin(req)) return res.status(403).json({message:"Origin not allowed"});
    if (req.session?.userId) return res.sendStatus(204);
    const parsed = acquisitionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({message:"Invalid measurement"});
    try {
      let value:Journey = {...parsed.data,receivedAt:Date.now(),environment:environment(req)};
      const prior = req.session.marketingJourney;
      if (prior?.journeyId === value.journeyId && value.receivedAt-prior.receivedAt <= ACQUISITION_SESSION_MS) {
        value = {...value,source:prior.source,evidence:prior.evidence,campaign:prior.campaign,content:prior.content};
      }
      await insertAcquisition(value);
      if (Date.now()-lastRetention>3600000) {
        await pool.query("DELETE FROM marketing_acquisition_events WHERE occurred_at < now()-interval '90 days'");
        lastRetention = Date.now();
      }
      const previous = req.session.marketingJourney;
      if (!previous || value.receivedAt - previous.receivedAt > ACQUISITION_SESSION_MS || previous.journeyId !== value.journeyId) {
        req.session.marketingJourney = value;
      } else {
        // Attribution is fixed within a journey, not overwritten by later client claims.
        req.session.marketingJourney = {...previous,receivedAt:value.receivedAt};
      }
      req.session.save((error:any) => error ? res.sendStatus(503) : res.sendStatus(204));
    } catch { res.status(503).json({message:"Measurement unavailable"}); }
  });
  app.post("/api/marketing/withdraw", async(req:any,res) => {
    if (!sameOrigin(req)) return res.sendStatus(403);
    if (req.session) delete req.session.marketingJourney;
    res.sendStatus(204);
  });
  app.get("/api/platform-admin/acquisition", admin, async(req,res) => {
    res.setHeader("Cache-Control","no-store");
    const date = /^\d{4}-\d{2}-\d{2}$/;
    const today = new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Douala"});
    const start = String(req.query.start || today), end = String(req.query.end || today);
    if (!date.test(start) || !date.test(end) || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || end < start || Date.parse(end)-Date.parse(start)>90*86400000) return res.status(400).json({message:"Choose a period of up to 90 days"});
    try {
      const result = await pool.query(`SELECT source,evidence,campaign,content,
        count(DISTINCT journey_id) FILTER (WHERE event='marketing_visit')::int AS visits,
        count(*) FILTER (WHERE event='marketing_visit')::int AS pageviews,
        count(*) FILTER (WHERE event='whatsapp_clicked')::int AS whatsapp,
        count(*) FILTER (WHERE event='signup_started')::int AS starts,
        count(*) FILTER (WHERE event='signup_completed')::int AS registrations
        FROM marketing_acquisition_events WHERE environment='production'
        AND occurred_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Douala')
        AND occurred_at < (($2::date+1)::timestamp AT TIME ZONE 'Africa/Douala')
        AND occurred_at >= now()-interval '90 days'
        GROUP BY source,evidence,campaign,content ORDER BY source,campaign,content`,[start,end]);
      res.json({start,end,timeZone:"Africa/Douala",rows:result.rows});
    } catch { res.status(503).json({message:"Acquisition report unavailable"}); }
  });
}
