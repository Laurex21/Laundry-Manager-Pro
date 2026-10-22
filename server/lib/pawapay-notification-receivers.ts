import type { Express } from "express";
import { z } from "zod";
import { productionOrigin } from "./saas-environment";
import { pawapayPublicKeys, verifyPawapaySandboxCallback } from "./pawapay-sandbox-callback";

const MAX_BODY_BYTES = 64 * 1024;
const details = z.object({
  status: z.enum(["COMPLETED", "FAILED", "PROCESSING"]),
  amount: z.string().max(23).regex(/^(0|[1-9]\d{0,17})(\.\d{0,3}[1-9])?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  country: z.string().regex(/^[A-Z]{3}$/),
});

/** Acknowledgement only. No database, payment API, jobs or billing activation. */
export function registerPawapayNotificationReceivers(app: Express, options: {
  origin?: () => string | undefined;
  keys?: typeof pawapayPublicKeys;
} = {}) {
  for (const kind of ["payout", "refund"] as const) {
    const path = `/api/saas/live/${kind}-callback`;
    app.post(path, async (req, res) => {
      const rawBody = req.rawBody;
      if (!Buffer.isBuffer(rawBody) || !req.is("application/json")) return res.sendStatus(400);
      if (rawBody.length > MAX_BODY_BYTES) return res.sendStatus(413);
      const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, typeof v === "string" ? v : undefined]));
      if (!headers.signature || !headers["signature-input"] || !headers["content-digest"] || !headers["signature-date"]) return res.sendStatus(401);
      let authority: string;
      try {
        authority = new URL(productionOrigin((options.origin ?? (() => process.env.SAAS_PRODUCTION_ORIGIN))())).host;
      } catch { return res.sendStatus(503); }
      if ((req.get("host") || "").toLowerCase() !== authority || req.path !== path) return res.sendStatus(400);
      try {
        const valid = verifyPawapaySandboxCallback({ method: req.method, authority, path,
          headers, rawBody, keys: await (options.keys ?? pawapayPublicKeys)("live") });
        if (!valid) return res.sendStatus(401);
        const body = JSON.parse(rawBody.toString("utf8"));
        const event = details.extend({ [kind + "Id"]: z.string().uuid() }).safeParse(body);
        if (!event.success || ["checkoutId", "depositId", kind === "payout" ? "refundId" : "payoutId"].some(key => key in body)) return res.sendStatus(400);
        // These operations are not supported business flows. Never settle an
        // invoice, activate access, initiate a refund, or persist payer details.
        return res.status(200).json({ received: true, handled: false });
      } catch (error) {
        return res.sendStatus(error instanceof SyntaxError ? 400 : 503);
      }
    });
  }
}
