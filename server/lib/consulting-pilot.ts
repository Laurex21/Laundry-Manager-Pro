import { randomUUID } from "node:crypto";
import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";

const modules = [
  ["diagnostic-robe", "Diagnostic avant lavage de la robe de soirée"],
  ["prelavage", "Prélavage et détachage de la robe de soirée"],
  ["lavage-robe", "Lavage de la robe de soirée · Partie 1"],
  ["lavage-robe-suite", "Lavage de la robe de soirée · Partie 2"],
  ["diagnostic-veste", "Diagnostic avant lavage de la veste"],
  ["lavage-veste", "Lavage de la veste"],
] as const;
const api = "/api/consulting-pilot";
const price = 100;

export function registerConsultingPilot(app: Express, auth: RequestHandler, db: Pick<Pool, "query">) {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) return;
  app.use(api, (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });
  app.get(api, auth, async (req, res) => {
    const { rows } = await db.query("SELECT status, checkout_id FROM consulting_pilot_purchases WHERE learner_id = $1", [(req.session as { userId?: string }).userId]);
    res.json({
      title: "Lavage de robe de soirée et de veste", amount: price,
      status: rows[0]?.status ?? "UNPAID",
      checkoutId: rows[0]?.status === "ACCEPTED" ? rows[0].checkout_id : undefined,
      modules: modules.map(([id, title]) => ({ id, title })),
    });
  });
  app.post(api + "/checkout", auth, async (req, res) => {
    await db.query(`INSERT INTO consulting_pilot_purchases (learner_id, checkout_id, amount_xaf, status)
      VALUES ($1,$2,$3,'ACCEPTED') ON CONFLICT (learner_id) DO NOTHING`, [(req.session as { userId?: string }).userId, randomUUID(), price]);
    res.sendStatus(204);
  });
  // Stand-in for a successful pawaPay sandbox deposit. No provider credentials or external calls.
  app.post(api + "/checkout/:id/simulate", auth, async (req, res) => {
    const result = await db.query(`UPDATE consulting_pilot_purchases
      SET status = 'COMPLETED', confirmed_at = COALESCE(confirmed_at, now())
      WHERE learner_id = $1 AND checkout_id::text = $2 AND amount_xaf = $3 RETURNING checkout_id`,
      [(req.session as { userId?: string }).userId, req.params.id, price]);
    res.sendStatus(result.rowCount ? 204 : 404);
  });
  app.get(api + "/modules/:id", auth, async (req, res) => {
    const item = modules.find(([id]) => id === req.params.id);
    if (!item) return res.sendStatus(404);
    const result = await db.query("SELECT 1 FROM consulting_pilot_purchases WHERE learner_id=$1 AND status='COMPLETED' AND amount_xaf=$2", [(req.session as { userId?: string }).userId, price]);
    if (!result.rowCount) return res.sendStatus(403);
    const { rows } = await db.query("SELECT youtube_id FROM consulting_pilot_videos WHERE module_id = $1", [item[0]]);
    if (!rows[0]) return res.sendStatus(503);
    res.redirect(303, "https://www.youtube.com/watch?v=" + rows[0].youtube_id);
  });
}
