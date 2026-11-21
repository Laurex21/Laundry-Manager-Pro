// Shared adapter; mounted only behind the explicit, recipient-restricted Flows pilot.
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { cartLineSchema, quoteInputSchema, requestInputSchema, GARMENT_LABELS, SIZE_LABELS, type CartLine, type StorefrontQuote } from "../../shared/storefront";
import { StorefrontService, type StorefrontActor } from "./storefront-service";
import { StorefrontError } from "./storefront-pricing";

export type FlowBinding = { id: string; actor: StorefrontActor; phoneNumberId: string; flowId: string; enabled: boolean };
const launchSchema = z.object({
  kind: z.literal("launch"), id: z.string().uuid(), connectionId: z.string(), siteId: z.number().int(), organisationId: z.number().int(),
  phoneNumberId: z.string(), flowId: z.string(), slug: z.string(), recipient: requestInputSchema.shape.phone, trackingSecret: requestInputSchema.shape.trackingSecret,
  expires: z.number().int(),
});
type Launch = z.infer<typeof launchSchema>;
const stateSchema = z.object({ kind: z.literal("cart"), launchId: z.string().uuid(), expires: z.number().int(), lines: z.array(cartLineSchema).max(40), fingerprint: z.string().optional() });
type State = z.infer<typeof stateSchema>;
export type FlowResponse = { screen?: string; data: Record<string, unknown> };
const incomingSchema = z.object({ version: z.literal("4.0"), action: z.enum(["INIT", "data_exchange", "ping", "BACK"]), flow_token: z.string().max(8000).optional(), screen: z.string().optional(), data: z.record(z.string(), z.unknown()).default({}) });
const amount = (q: StorefrontQuote) => q.total == null ? `Sous-total connu : ${q.knownTotal} ${q.currency}. Certains articles restent à chiffrer.` : `Estimation : ${q.total} ${q.currency}`;

export class StorefrontFlowAdapter {
  constructor(private service: StorefrontService, private key: Buffer,
    // Must resolve a verified, active Meta connection from trusted server storage.
    private resolveBinding: (id: string) => Promise<FlowBinding | null>, private now = () => Date.now()) {
    if (key.length !== 32) throw new Error("A dedicated 32-byte Flow session encryption key is required");
  }
  private seal(value: Launch | State) {
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from("xpresspro-storefront-flow-v1"));
    return Buffer.concat([iv, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]).toString("base64url");
  }
  private open(token: unknown): unknown {
    try {
      if (typeof token !== "string" || token.length > 16000 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error();
      const value = Buffer.from(token, "base64url");
      if (value.length < 29) throw new Error();
      const decipher = createDecipheriv("aes-256-gcm", this.key, value.subarray(0, 12));
      decipher.setAAD(Buffer.from("xpresspro-storefront-flow-v1")); decipher.setAuthTag(value.subarray(-16));
      return JSON.parse(Buffer.concat([decipher.update(value.subarray(12, -16)), decipher.final()]).toString());
    } catch { throw new StorefrontError(427, "Cette session n’est plus disponible. Relancez la commande dans WhatsApp."); }
  }
  private async binding(id: string) {
    const binding = await this.resolveBinding(id);
    if (!binding?.enabled || !binding.phoneNumberId || !binding.flowId) throw new StorefrontError(427, "Connexion WhatsApp indisponible.");
    return binding;
  }
  // Caller must obtain recipient from a verified inbound webhook / authorized conversation.
  // No sending is performed by this method. It prepares a draft message payload.
  async launch(connectionId: string, verifiedRecipient: string) {
    const binding = await this.binding(connectionId), config = await this.service.admin(binding.actor);
    if (!config.shop?.published) throw new StorefrontError(404, "Cette boutique n’est pas disponible");
    const launch: Launch = launchSchema.parse({ kind: "launch", id: randomUUID(), connectionId,
      siteId: binding.actor.siteId, organisationId: binding.actor.organisationId, phoneNumberId: binding.phoneNumberId, flowId: binding.flowId,
      slug: config.shop.slug, recipient: verifiedRecipient, trackingSecret: randomBytes(32).toString("hex"), expires: this.now() + 30 * 60_000 });
    const token = this.seal(launch);
    return { flow_token: token, message: { messaging_product: "whatsapp", to: verifiedRecipient.replace(/^\+/, ""), type: "interactive",
      interactive: { type: "flow", body: { text: `Préparez votre dépôt chez ${config.shop.name}. Le prix sera confirmé au pressing.` }, action: { name: "flow", parameters: { mode: "draft", flow_message_version: "3", flow_id: binding.flowId, flow_token: token, flow_cta: "Passer commande", flow_action: "data_exchange" } } } } };
  }
  private cart(launch: Launch, raw: unknown): State {
    const parsed = stateSchema.safeParse(this.open(raw));
    if (!parsed.success || parsed.data.launchId !== launch.id || parsed.data.expires !== launch.expires || parsed.data.expires <= this.now()) throw new StorefrontError(427, "Ce panier n’appartient pas à cette session.");
    return parsed.data;
  }
  private async items(launch: Launch, state: State): Promise<FlowResponse> {
    const shop = await this.service.publicShop(launch.slug);
    if (!shop.services.length) throw new StorefrontError(409, "Aucun service disponible.");
    return { screen: "ITEMS", data: { shop_name: shop.name, cart_token: this.seal(state),
      services: shop.services.map(s => ({ id: String(s.id), title: s.name.slice(0, 30), description: s.mode === "quote" ? "Sur devis" : `${s.price} ${shop.currency} / ${s.mode === "kg" ? "kg" : "pièce"}` })),
      garments: Object.entries(GARMENT_LABELS).map(([id, title]) => ({ id, title })), sizes: Object.entries(SIZE_LABELS).map(([id, title]) => ({ id, title })),
    } };
  }
  private async summary(launch: Launch, state: State, screen = "CART"): Promise<FlowResponse> {
    const quote = await this.service.quote(launch.slug, { lines: state.lines });
    const shop = await this.service.publicShop(launch.slug);
    return { screen, data: { cart_token: this.seal({ ...state, fingerprint: quote.fingerprint }),
      summary: state.lines.map(l => `${l.count} × ${GARMENT_LABELS[l.garment]} · ${SIZE_LABELS[l.size]} · ${shop.services.find(s => s.id === l.serviceId)?.name ?? ""}`).join("\n"),
      estimate: amount(quote), recipient: launch.recipient,
      explanation: quote.lots.map(l => `${l.name} : ${l.total == null ? "à confirmer" : `${l.total} ${quote.currency}`}${l.adjustment !== "0" ? ` (minimum appliqué : +${l.adjustment})` : ""}`).join("\n"),
    } };
  }
  async handle(raw: unknown): Promise<FlowResponse> {
    const input = incomingSchema.parse(raw);
    if (input.action === "ping") return { data: { status: "active" } };
    const parsed = launchSchema.safeParse(this.open(input.flow_token));
    if (!parsed.success || parsed.data.expires <= this.now()) throw new StorefrontError(427, "Session expirée. Relancez la commande.");
    const launch = parsed.data, binding = await this.binding(launch.connectionId);
    if (binding.actor.siteId !== launch.siteId || binding.actor.organisationId !== launch.organisationId || binding.phoneNumberId !== launch.phoneNumberId || binding.flowId !== launch.flowId) throw new StorefrontError(427, "La connexion de cette boutique a changé.");
    const config = await this.service.admin(binding.actor);
    if (!config.shop?.published || config.shop.slug !== launch.slug) throw new StorefrontError(427, "La boutique est fermée.");
    if (input.data.error) return { data: { acknowledged: true } };
    if (input.action === "INIT") return this.items(launch, { kind: "cart", launchId: launch.id, expires: launch.expires, lines: [] });
    const state = this.cart(launch, input.data.cart_token), operation = input.data.operation;
    if (input.action === "BACK" || operation === "more") return this.items(launch, state);
    if (operation === "reset") return this.items(launch, { ...state, lines: [], fingerprint: undefined });
    if (operation === "add" && input.screen === "ITEMS") {
      const value = z.object({ service_id: z.string().regex(/^[1-9]\d*$/), garment: cartLineSchema.shape.garment, size: cartLineSchema.shape.size, count: z.string().regex(/^[1-9]\d{0,2}$/) }).parse(input.data);
      const line = cartLineSchema.parse({ serviceId: Number(value.service_id), garment: value.garment, size: value.size, count: Number(value.count) });
      const same = state.lines.findIndex(l => l.serviceId === line.serviceId && l.garment === line.garment && l.size === line.size);
      const lines = same < 0 ? [...state.lines, line] : state.lines.map((l, i) => i === same ? { ...l, count: l.count + line.count } : l);
      quoteInputSchema.parse({ lines });
      return this.summary(launch, { ...state, lines });
    }
    if (operation === "checkout" && input.screen === "CART") return this.summary(launch, state, "CONTACT");
    if (operation === "confirm" && input.screen === "CONTACT") {
      z.literal(true).parse(input.data.accepted);
      if (!state.fingerprint) throw new StorefrontError(400, "Consultez le devis avant de confirmer.");
      const body = requestInputSchema.parse({ lines: state.lines, requestKey: launch.id, trackingSecret: launch.trackingSecret,
        quoteFingerprint: state.fingerprint, customerName: input.data.customer_name, phone: launch.recipient, note: input.data.note ?? "" });
      try {
        const result = await this.service.submit(launch.slug, body);
        return { screen: "SUCCESS", data: { extension_message_response: { params: { flow_token: input.flow_token, reference: result.reference } } } };
      } catch (e) {
        if (e instanceof StorefrontError && e.status === 409 && e.message.startsWith("Le tarif a changé")) {
          const revised = await this.summary(launch, state);
          revised.data.explanation = `Le tarif a changé. Vérifiez cette nouvelle estimation avant de confirmer.\n${revised.data.explanation}`;
          return revised;
        }
        throw e;
      }
    }
    throw new StorefrontError(400, "Étape de commande invalide.");
  }
}
