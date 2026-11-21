import { createHash, createHmac, createPrivateKey, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Express, RequestHandler } from "express";
import type { StorefrontService } from "./storefront-service";
import { StorefrontFlowAdapter, type FlowBinding } from "./storefront-flows";
import { processEncryptedStorefrontFlow } from "./storefront-flow-transport";

const metaId = z.string().regex(/^\d{1,30}$/);
const configuration = z.object({
  connectionId: z.string().regex(/^[a-z0-9-]{3,60}$/),
  organisationId: z.number().int().positive(), siteId: z.number().int().positive(),
  actorUserId: z.string().min(1).max(100), wabaId: metaId, phoneNumberId: metaId, flowId: metaId,
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  endpoint: z.string().url().refine(s => new URL(s).protocol === "https:" && !new URL(s).search && !new URL(s).hash),
  recipients: z.array(z.string().regex(/^\+[1-9]\d{7,14}$/)).min(1).max(10),
  mode: z.enum(["draft", "published"]).default("draft"),
});
export type FlowPilotConfig = z.infer<typeof configuration> & {
  accessToken: string; appSecret: string; verifyToken: string; sessionKey: Buffer;
  privateKey: ReturnType<typeof createPrivateKey>; graphVersion: string;
};
export function readFlowPilotConfiguration(env: NodeJS.ProcessEnv): FlowPilotConfig | null {
  if (env.XPRESSPRO_WHATSAPP_FLOWS_ENABLED !== "true") return null;
  try {
    const values = configuration.parse(JSON.parse(env.XPRESSPRO_WHATSAPP_FLOWS_PILOT ?? ""));
    const accessToken = z.string().min(20).parse(env.XPRESSPRO_FLOWS_ACCESS_TOKEN);
    const appSecret = z.string().min(16).parse(env.XPRESSPRO_FLOWS_APP_SECRET);
    const verifyToken = z.string().min(32).parse(env.XPRESSPRO_FLOWS_VERIFY_TOKEN);
    const graphVersion = z.string().regex(/^v\d+\.0$/).parse(env.XPRESSPRO_FLOWS_GRAPH_VERSION);
    const sessionKey = Buffer.from(z.string().regex(/^[a-f0-9]{64}$/).parse(env.XPRESSPRO_FLOWS_SESSION_KEY), "hex");
    const privateKey = createPrivateKey(env.XPRESSPRO_FLOWS_PRIVATE_KEY ?? "");
    if (privateKey.asymmetricKeyType !== "rsa" || (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw Error();
    return { ...values, accessToken, appSecret, verifyToken, sessionKey, privateKey, graphVersion };
  } catch { throw Error("FLOWS_PILOT_CONFIGURATION_INVALID"); }
}
function signatureValid(raw: Buffer, signature: string | undefined, secret: string) {
  return !!signature && /^sha256=[a-f0-9]{64}$/.test(signature)
    && timingSafeEqual(createHmac("sha256", secret).update(raw).digest(), Buffer.from(signature.slice(7), "hex"));
}
export type PilotLedger = {
  // Durable claim must commit before sending. An uncertain send is never retried automatically.
  claim(key: string): Promise<boolean>;
  finish(key: string, outcome: "accepted" | "failed" | "unknown"): Promise<void>;
};
export function postgresFlowPilotLedger(db: { query: (sql: string, values: any[]) => Promise<any> }): PilotLedger {
  return {
    async claim(key) {
      const result = await db.query("INSERT INTO xpresspro_flow_pilot.inbound_claims (message_hash) VALUES ($1) ON CONFLICT DO NOTHING RETURNING message_hash", [key]);
      return result.rows.length === 1;
    },
    async finish(key, outcome) { await db.query("UPDATE xpresspro_flow_pilot.inbound_claims SET outcome=$2 WHERE message_hash=$1", [key, outcome]); },
  };
}
export class StorefrontFlowPilot {
  readonly adapter: StorefrontFlowAdapter;
  constructor(readonly config: FlowPilotConfig, private service: StorefrontService, private ledger: PilotLedger,
    private request: typeof fetch = fetch, private now = () => Date.now()) {
    this.adapter = new StorefrontFlowAdapter(service, config.sessionKey, id => this.resolveBinding(id), now);
  }
  private async graph(path: string) {
    const response = await this.request(`https://graph.facebook.com/${this.config.graphVersion}/${path}`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` }, signal: AbortSignal.timeout(8_000), redirect: "error",
    });
    if (!response.ok) throw Error("FLOWS_META_VERIFICATION_UNAVAILABLE");
    return response.json();
  }
  private async member(edge: string, id: string, fields: string) {
    let after = "";
    for (let page = 0; page < 10; page++) {
      const params = new URLSearchParams({ fields, limit: "100", ...(after ? { after } : {}) });
      const body = await this.graph(`${this.config.wabaId}/${edge}?${params}`);
      if (!Array.isArray(body.data)) throw Error("FLOWS_META_VERIFICATION_UNAVAILABLE");
      const item = body.data.find((value: any) => value.id === id);
      if (item) return item;
      if (!body.paging?.next || typeof body.paging?.cursors?.after !== "string") return null;
      after = body.paging.cursors.after;
    }
    return null;
  }
  async resolveBinding(id: string): Promise<FlowBinding | null> {
    const c = this.config;
    if (id !== c.connectionId) return null;
    const [phone, flow] = await Promise.all([
      this.member("phone_numbers", c.phoneNumberId, "id,display_phone_number,status"),
      this.member("flows", c.flowId, "id,status,endpoint_uri,validation_errors,data_api_version"),
    ]);
    const number = typeof phone?.display_phone_number === "string" ? "+" + phone.display_phone_number.replace(/\D/g, "") : "";
    if (!phone || phone.status !== "CONNECTED" || number !== c.phone || !flow
      || flow.status !== c.mode.toUpperCase() || flow.endpoint_uri !== c.endpoint
      || flow.data_api_version !== "4.0" || !Array.isArray(flow.validation_errors) || flow.validation_errors.length) return null;
    const actor = { siteId: c.siteId, organisationId: c.organisationId, userId: c.actorUserId };
    const shop = await this.service.admin(actor);
    // Mapping is owner-provisioned on the server. Never accept a client-supplied site or sender.
    if (!shop.shop?.published) return null;
    return { id, actor, phoneNumberId: c.phoneNumberId, flowId: c.flowId, enabled: true };
  }
  async webhook(raw: Buffer, signature: string | undefined) {
    if (raw.length > 128_000) return 413;
    if (!signatureValid(raw, signature, this.config.appSecret)) return 403;
    let body: any;
    try { body = JSON.parse(raw.toString("utf8")); } catch { return 400; }
    if (body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) return 400;
    // Only an explicit incoming command starts the pilot, never a status or completion callback.
    for (const entry of body.entry.slice(0, 20)) {
      if (entry.id !== this.config.wabaId || !Array.isArray(entry.changes)) continue;
      for (const change of entry.changes.slice(0, 20)) {
        const value = change.value;
        if (change.field !== "messages" || value?.metadata?.phone_number_id !== this.config.phoneNumberId || !Array.isArray(value.messages)) continue;
        for (const message of value.messages.slice(0, 20)) {
          if (message.type !== "text" || typeof message.text?.body !== "string" || !/^(commander|commande|boutique)$/i.test(message.text.body.trim())
            || typeof message.from !== "string" || !/^[1-9]\d{7,14}$/.test(message.from)
            || typeof message.id !== "string" || !message.id.startsWith("wamid.") || message.id.length > 500) continue;
          const recipient = `+${message.from}`, timestamp = Number(message.timestamp) * 1000;
          if (!this.config.recipients.includes(recipient) || !Number.isFinite(timestamp) || timestamp > this.now() + 60_000 || timestamp < this.now() - 5 * 60_000) continue;
          const launch = await this.adapter.launch(this.config.connectionId, recipient);
          const key = createHash("sha256").update(`${this.config.wabaId}:${this.config.phoneNumberId}:${message.id}`).digest("hex");
          if (!await this.ledger.claim(key)) continue;
          launch.message.interactive.action.parameters.mode = this.config.mode;
          let outcome: "accepted" | "failed" | "unknown" = "unknown";
          try {
            const response = await this.request(`https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`, {
              method: "POST", headers: { Authorization: `Bearer ${this.config.accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(launch.message), redirect: "error", signal: AbortSignal.timeout(10_000),
            });
            const result = await response.json().catch(() => null);
            if (response.ok && typeof result?.messages?.[0]?.id === "string" && result.messages[0].id.startsWith("wamid.")) outcome = "accepted";
            else if (response.status >= 400 && response.status < 500) outcome = "failed";
          } catch { /* Never log the token, recipient, request body or provider response. */ }
          await this.ledger.finish(key, outcome);
        }
      }
    }
    return 200;
  }
}
export function registerStorefrontFlowPilotRoutes(app: Express, deps: {
  pilot: () => StorefrontFlowPilot | null; limit: RequestHandler;
}) {
  const base = "/api/integrations/whatsapp-flows";
  const gate: RequestHandler = (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    try { if (!deps.pilot()) { res.sendStatus(404); return; } } catch { res.sendStatus(503); return; }
    next();
  };
  app.get(`${base}/webhook`, gate, deps.limit, (req, res) => {
    const c = deps.pilot()!.config;
    const token = req.query["hub.verify_token"], challenge = req.query["hub.challenge"];
    if (req.query["hub.mode"] !== "subscribe" || typeof token !== "string" || typeof challenge !== "string" || challenge.length > 512
      || !timingSafeEqual(createHash("sha256").update(token).digest(), createHash("sha256").update(c.verifyToken).digest())) { res.sendStatus(403); return; }
    res.type("text/plain").send(challenge);
  });
  app.post(`${base}/webhook`, gate, deps.limit, async (req, res) => {
    if (!Buffer.isBuffer(req.rawBody)) { res.sendStatus(400); return; }
    try { res.sendStatus(await deps.pilot()!.webhook(req.rawBody, req.get("x-hub-signature-256"))); }
    catch { res.sendStatus(503); }
  });
  app.post(`${base}/data`, gate, deps.limit, async (req, res) => {
    if (!Buffer.isBuffer(req.rawBody)) { res.sendStatus(400); return; }
    const pilot = deps.pilot()!;
    const response = await processEncryptedStorefrontFlow(req.rawBody, req.get("x-hub-signature-256"), pilot.config,
      input => pilot.adapter.handle(input));
    res.status(response.status).type(response.contentType).send(response.body);
  });
}
