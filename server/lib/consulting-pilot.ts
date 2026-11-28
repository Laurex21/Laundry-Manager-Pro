import { coachingPrice, consultingWhatsApp } from "../../shared/consulting-offers";
import { configuredCourseDocument } from "./consulting-course-document";
import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { themes } from "./consulting-course-catalogue";
import { attemptsTable, courseMode, coursePrice, latestAttempt, refreshAttempt, startAttempt } from "./consulting-course-payments";

import { deferredSaasOrganisations, saasIdentityDeferred } from "./saas-deferred";
import { collectionPilotConfigured, pilotOrganisationAllowed } from "./saas-pilot";

const modules = themes.flatMap(theme => theme.lessons);
const api = "/api/consulting-pilot";

export function registerConsultingPilot(app: Express, auth: RequestHandler, db: Pick<Pool, "query">, document = configuredCourseDocument()) {
  const mode = courseMode();
  if (!mode) return;
  const videos = mode === "live" ? "consulting_course_live_videos" : "consulting_pilot_videos";
  app.use(api, (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(api, auth);
  app.use(api, async (req, res, next) => {
    if (mode === "sandbox") return next();
    try {
      const org = (req as typeof req & { organisationId?: number }).organisationId;
      const excluded = deferredSaasOrganisations();
      if (![3,100,112,193].every(id => excluded.includes(id))) { res.sendStatus(503); return; }
      if (!org || excluded.includes(org) || collectionPilotConfigured() || !pilotOrganisationAllowed(org) ||
          await saasIdentityDeferred(db, (req.session as { userId?: string }).userId)) {
        res.sendStatus(403); return;
      }
      next();
    } catch { res.sendStatus(503); }
  });
  for (const product of ["course", "coaching"] as const) {
    const coaching = product === "coaching";
    const route = coaching ? api + "/coaching" : api;
    const amount = coaching ? coachingPrice : coursePrice;
    app.get(route, async (req, res) => {
      try {
        const user = (req.session as { userId?: string }).userId!;
        let attempt = await latestAttempt(db, user, mode, product);
        let verificationDelayed = false;
        if (attempt?.status === "PENDING") {
          try { attempt = await refreshAttempt(db, attempt, mode, product); }
          catch { verificationDelayed = true; }
        }
        const paid = attempt?.status === "COMPLETED";
        const details = coaching
          ? { title:"Accompagnement standard", contact:paid ? consultingWhatsApp : null }
          : { title:"Formation complète aux métiers du pressing", materialAvailable:!!document && paid, themes, modules };
        res.json({ ...details, mode, amount, checkoutAmount:attempt?.status === "PENDING" ? attempt.amount_xaf : amount,
          status:attempt?.status ?? "UNPAID", lastAttemptFailed:attempt?.lastAttemptFailed === true, verificationDelayed });
      } catch { res.sendStatus(503); }
    });
    app.post(route + "/checkout", async (req, res) => {
      try {
        if (!coaching && mode === "live") {
          const available = await db.query("SELECT count(*)::int AS total FROM consulting_course_live_videos WHERE module_id=ANY($1::text[])", [modules.map(item => item.id)]);
          if (available.rows[0]?.total !== modules.length) { res.sendStatus(503); return; }
        }
        const attempt = await startAttempt(db, (req.session as { userId?: string }).userId!, mode, product);
        res.json({status:attempt.status, redirectUrl:attempt.status === "PENDING" ? attempt.redirect_url : null});
      } catch { res.sendStatus(503); }
    });
  }
  const purchaseTable = attemptsTable(mode);
  async function ownsCourse(user?: string) {
    if (!user) return false;
    const purchase = await db.query(`SELECT 1 FROM ${purchaseTable} WHERE learner_id=$1 AND status='COMPLETED'`, [user]);
    return !!purchase.rowCount;
  }
  app.get(api + "/document", async (req, res) => {
    try {
      if (!await ownsCourse((req.session as { userId?: string }).userId)) { res.sendStatus(403); return; }
      if (!document) { res.sendStatus(404); return; }
      const stream = document.open();
      const mime = document.filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
      res.attachment(document.filename).type(mime).set("X-Content-Type-Options", "nosniff");
      res.once("close", () => stream.destroy());
      stream.once("error", () => {
        if (res.headersSent) { res.destroy(); return; }
        res.removeHeader("Content-Disposition");
        res.sendStatus(503);
      });
      stream.pipe(res);
    } catch { res.sendStatus(503); }
  });
  app.get(api + "/modules/:id", async (req, res) => {
    const item = modules.find(({ id }) => id === req.params.id);
    if (!item) return res.sendStatus(404);
    try {
      if (!await ownsCourse((req.session as { userId?: string }).userId)) return res.sendStatus(403);
      const { rows } = await db.query(`SELECT youtube_id FROM ${videos} WHERE module_id = $1`, [item.id]);
      if (!rows[0]) return res.sendStatus(503);
      res.redirect(303, "https://www.youtube.com/watch?v=" + rows[0].youtube_id);
    } catch { res.sendStatus(503); }
  });
}
