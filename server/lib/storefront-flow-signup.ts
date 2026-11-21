import { createCipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { StorefrontActor, StorefrontService } from "./storefront-service";
import { StorefrontError } from "./storefront-pricing";

export const FLOW_SIGNUP_PAGE = "/boutique/connexion-whatsapp";
const id = z.string().regex(/^\d{1,30}$/);
const phone = z.string().regex(/^\+[1-9]\d{7,14}$/);
const configuration = z.object({
  appId: id,
  configurationId: id,
  version: z.string().regex(/^v\d+\.0$/),
  appSecret: z.string().min(16),
  encryptionKey: z.string().regex(/^[a-f0-9]{64}$/),
});

export function flowSignupConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.XPRESSPRO_STOREFRONT_ENABLED !== "true" || env.XPRESSPRO_FLOW_SIGNUP_ENABLED !== "true") return null;
  const parsed = configuration.safeParse({
    appId: env.XPRESSPRO_FLOW_SIGNUP_APP_ID,
    configurationId: env.XPRESSPRO_FLOW_SIGNUP_CONFIG_ID,
    version: env.XPRESSPRO_FLOWS_GRAPH_VERSION,
    appSecret: env.XPRESSPRO_FLOWS_APP_SECRET,
    encryptionKey: env.XPRESSPRO_FLOW_SIGNUP_ENCRYPTION_KEY,
  });
  return parsed.success ? parsed.data : null;
}

type Config = NonNullable<ReturnType<typeof flowSignupConfig>>;
const finishInput = z.object({
  authorization: z.string().min(1).max(4096),
  wabaId: id,
  phoneNumberId: id,
  attempt: z.string().max(160),
}).strict();
const unavailable = () => new StorefrontError(503, "La connexion à Meta est temporairement indisponible.");
const changed = () => new StorefrontError(409, "Les informations de cette boutique ont changé. Rechargez la page et recommencez.");

type Target = StorefrontActor & { shopId: number; phone: string };
type Connection = { phone: string; status: "pending" };
type ConnectionStore = {
  get(actor: StorefrontActor): Promise<Connection | null>;
  insert(target: Target, binding: { wabaId: string; phoneNumberId: string; encryptedToken: string }): Promise<boolean>;
};

export function postgresSignupStore(pool: { query: (sql: string, values: any[]) => Promise<{ rows: any[] }> }): ConnectionStore {
  return {
    async get(actor) {
      const result = await pool.query(
        "SELECT phone, status FROM xpresspro_flow_signup.connections WHERE site_id=$1 AND organisation_id=$2",
        [actor.siteId, actor.organisationId],
      );
      return result.rows[0] ?? null;
    },
    async insert(target, binding) {
      // Recheck the active agency and saved number at the point of writing. Both the site
      // and the Meta phone are unique. A second signup never replaces another connection.
      const result = await pool.query(
        `INSERT INTO xpresspro_flow_signup.connections
           (site_id, organisation_id, phone, waba_id, phone_number_id, encrypted_token)
         SELECT s.site_id,s.organisation_id,s.whatsapp,$5,$6,$7
         FROM public.storefronts s JOIN public.sites a ON a.id=s.site_id
         WHERE s.id=$1 AND s.site_id=$2 AND s.organisation_id=$3 AND s.whatsapp=$4
           AND a.organisation_id=s.organisation_id AND a.is_active
         ON CONFLICT DO NOTHING RETURNING site_id`,
        [target.shopId, target.siteId, target.organisationId, target.phone, binding.wabaId, binding.phoneNumberId, binding.encryptedToken],
      );
      return result.rows.length === 1;
    },
  };
}

export class StorefrontFlowSignup {
  constructor(private service: StorefrontService, private store: ConnectionStore,
    private getConfig = flowSignupConfig, private request = fetch, private now = Date.now) {}

  private async target(actor: StorefrontActor): Promise<Target | null> {
    const { shop } = await this.service.admin(actor);
    return shop && phone.safeParse(shop.whatsapp).success
      ? { ...actor, shopId: shop.id, phone: shop.whatsapp }
      : null;
  }

  private sign(config: Config, sessionId: string, target: Target, attempt: string) {
    const context = JSON.stringify([sessionId, target.userId, target.organisationId, target.siteId, target.shopId, target.phone, attempt]);
    return createHmac("sha256", Buffer.from(config.encryptionKey, "hex")).update("signup-v1:").update(context).digest("hex");
  }

  async status(actor: StorefrontActor) {
    if (!this.getConfig()) return { state: "unavailable" as const };
    const target = await this.target(actor);
    if (!target) return { state: "needs_shop" as const };
    const existing = await this.store.get(actor);
    if (existing) return { state: "pending" as const, phone: existing.phone };
    return { state: "ready" as const, phone: target.phone };
  }

  async start(actor: StorefrontActor, sessionId: string) {
    const config = this.getConfig();
    if (!config || !sessionId) throw unavailable();
    const target = await this.target(actor);
    if (!target) throw new StorefrontError(409, "Enregistrez votre boutique et son numéro WhatsApp avant de les connecter.");
    if (await this.store.get(actor)) throw new StorefrontError(409, "Un numéro est déjà en attente de mise en service pour cette agence.");
    const attempt = `${this.now() + 15 * 60_000}.${randomBytes(16).toString("hex")}`;
    return { appId: config.appId, configurationId: config.configurationId, version: config.version,
      phone: target.phone, attempt: `${attempt}.${this.sign(config, sessionId, target, attempt)}` };
  }

  private async graph(config: Config, path: string, accessToken?: string) {
    try {
      const response = await this.request(`https://graph.facebook.com/${config.version}/${path}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        signal: AbortSignal.timeout(8000), redirect: "error",
      });
      if (!response.ok) throw Error();
      return await response.json();
    } catch { throw unavailable(); }
  }

  async finish(actor: StorefrontActor, sessionId: string, body: unknown): Promise<Connection> {
    const config = this.getConfig();
    if (!config || !sessionId) throw unavailable();
    const input = finishInput.parse(body);
    const target = await this.target(actor);
    const match = /^(\d{13}\.([a-f0-9]{32}))\.([a-f0-9]{64})$/.exec(input.attempt);
    if (!target || !match || Number(match[1].split(".")[0]) <= this.now()
      || !timingSafeEqual(Buffer.from(match[3], "hex"), Buffer.from(this.sign(config, sessionId, target, match[1]), "hex"))) throw changed();
    if (await this.store.get(actor)) throw new StorefrontError(409, "Un numéro est déjà en attente de mise en service pour cette agence.");

    const params = new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret, code: input.authorization });
    const exchange = await this.graph(config, `oauth/access_token?${params}`);
    const token = z.string().min(16).max(8192).safeParse(exchange?.access_token);
    if (!token.success) throw unavailable();
    let cursor = "";
    let verified = false;
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({ fields: "id,display_phone_number", limit: "100", ...(cursor ? { after: cursor } : {}) });
      const list = await this.graph(config, `${input.wabaId}/phone_numbers?${query}`, token.data);
      if (!Array.isArray(list?.data)) throw unavailable();
      const found = list.data.find((entry: any) => entry?.id === input.phoneNumberId);
      if (found) {
        verified = typeof found.display_phone_number === "string"
          && `+${found.display_phone_number.replace(/\D/g, "")}` === target.phone;
        break;
      }
      if (!list.paging?.next || typeof list.paging?.cursors?.after !== "string") break;
      cursor = list.paging.cursors.after;
    }
    if (!verified) throw new StorefrontError(409, "Le numéro autorisé dans Meta ne correspond pas au numéro enregistré pour cette agence.");

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(config.encryptionKey, "hex"), iv);
    cipher.setAAD(Buffer.from(JSON.stringify(["wa-signup-v1", target.organisationId, target.siteId, input.wabaId, input.phoneNumberId])));
    const encryptedToken = Buffer.concat([iv, cipher.update(token.data, "utf8"), cipher.final(), cipher.getAuthTag()]).toString("base64url");
    const recorded = await this.store.insert(target, { wabaId: input.wabaId, phoneNumberId: input.phoneNumberId, encryptedToken });
    if (!recorded) throw new StorefrontError(409, "Ce numéro ou cette agence est déjà rattaché, ou la boutique a changé. Vérifiez sa configuration.");
    return { status: "pending", phone: target.phone };
  }
}
