import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { themes } from "./consulting-course-catalogue";
import { coursePrice, latestAttempt, refreshAttempt, startAttempt } from "./consulting-course-sandbox";

const modules = themes.flatMap(theme => theme.lessons);
const api = "/api/consulting-pilot";

export function registerConsultingPilot(app: Express, auth: RequestHandler, db: Pick<Pool, "query">) {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) return;
  app.use(api, (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });
  app.get(api, auth, async (req, res) => {
    try {
      let attempt = await latestAttempt(db, (req.session as { userId?: string }).userId!);
      let verificationDelayed = false;
      if (attempt?.status === "PENDING") {
        try { attempt = await refreshAttempt(db, attempt); } catch { verificationDelayed = true; }
      }
      res.json({title:"Formation complète aux métiers du pressing", amount:coursePrice, themes, modules,
        status:attempt?.status ?? "UNPAID", lastAttemptFailed:attempt?.lastAttemptFailed === true, verificationDelayed});
    } catch { res.sendStatus(503); }
  });
  app.post(api + "/checkout", auth, async (req, res) => {
    try {
      const attempt = await startAttempt(db,(req.session as { userId?: string }).userId!);
      res.json({status:attempt.status, redirectUrl:attempt.status === "PENDING" ? attempt.redirect_url : null});
    } catch { res.sendStatus(503); }
  });
  app.get(api + "/modules/:id", auth, async (req, res) => {
    const item = modules.find(({ id }) => id === req.params.id);
    if (!item) return res.sendStatus(404);
    try {
      const result = await db.query("SELECT 1 FROM consulting_course_sandbox_attempts WHERE learner_id=$1 AND status='COMPLETED'", [(req.session as { userId?: string }).userId!]);
      if (!result.rowCount) return res.sendStatus(403);
      const { rows } = await db.query("SELECT youtube_id FROM consulting_pilot_videos WHERE module_id = $1", [item.id]);
      if (!rows[0]) return res.sendStatus(503);
      res.redirect(303, "https://www.youtube.com/watch?v=" + rows[0].youtube_id);
    } catch { res.sendStatus(503); }
  });
}
