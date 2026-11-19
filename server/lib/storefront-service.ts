import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { db } from "../db";
import { customers, orders, organisations, services, sites, storefronts as shops, storefrontServices as offerings, storefrontRequests as requests, storefrontEvents as events } from "../../shared/schema";
import { GARMENT_LABELS, SIZE_LABELS, requestInputSchema, reviewInputSchema, shopInputSchema, type PublicService, type ShopInput } from "../../shared/storefront";
import { addDecimals } from "../../shared/exact-decimal";
import { calculateStorefrontQuote, digest, StorefrontError } from "./storefront-pricing";
import { insertOrderRecords } from "./order-creation";

type Database = typeof db;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type StorefrontActor = { siteId: number; organisationId: number; userId: string };
export class StorefrontService {
  constructor(private database: Database, private refreshAnalytics?: (id: number, tx: Tx) => Promise<void>) {}
  async organisationCurrency(organisationId: number, executor: Database | Tx = this.database) {
    const [shop] = await executor.select({ currency: shops.currency }).from(shops).where(eq(shops.organisationId, organisationId)).orderBy(shops.id).limit(1);
    return shop?.currency ?? null;
  }
  private async site(actor: StorefrontActor, executor: Database | Tx = this.database) {
    const [site] = await executor.select().from(sites).where(and(eq(sites.id, actor.siteId), eq(sites.organisationId, actor.organisationId), eq(sites.isActive, true)));
    if (!site) throw new StorefrontError(403, "Agence indisponible");
    return site;
  }
  async admin(actor: StorefrontActor) {
    const site = await this.site(actor);
    const [shop] = await this.database.select().from(shops).where(eq(shops.siteId, site.id));
    const available = await this.database.select().from(services).where(and(eq(services.siteId, site.id), eq(services.active, true)));
    const selected = shop ? await this.database.select({ serviceId: offerings.serviceId, mode: offerings.mode }).from(offerings).where(eq(offerings.storefrontId, shop.id)) : [];
    return { site, currency: await this.organisationCurrency(actor.organisationId), shop: shop ? { ...shop, services: selected } : null, availableServices: available };
  }
  async save(actor: StorefrontActor, raw: unknown) {
    const input = shopInputSchema.parse(raw);
    if (input.siteId !== actor.siteId) throw new StorefrontError(409, "L’agence sélectionnée a changé. Rechargez la configuration.");
    return this.database.transaction(async tx => {
      // Lock the agency too, including first publication (no storefront row yet).
      await this.site(actor, tx);
      // One accounting currency per organisation, including its consolidated view.
      // Serialise first shops on different sites so two currencies cannot win a race.
      await tx.select({ id: organisations.id }).from(organisations).where(eq(organisations.id, actor.organisationId)).for("update");
      const currency = await this.organisationCurrency(actor.organisationId, tx);
      if (currency && currency !== input.currency) throw new StorefrontError(409, `Les boutiques et la caisse de cette organisation utilisent ${currency}.`);
      await tx.select().from(sites).where(eq(sites.id, actor.siteId)).for("update");
      const [previous] = await tx.select().from(shops).where(eq(shops.siteId, actor.siteId)).for("update");
      if ((previous?.version ?? 0) !== input.expectedVersion) throw new StorefrontError(409, "La boutique a changé. Rechargez avant d’enregistrer.");
      if (previous && previous.slug !== input.slug) throw new StorefrontError(400, "Le lien de la boutique ne peut plus être modifié dans cette version.");
      if (previous && previous.currency !== input.currency) throw new StorefrontError(400, "La devise de cette boutique est figée pour préserver les devis existants.");
      const available = input.services.length ? await tx.select().from(services).where(and(eq(services.siteId, actor.siteId), eq(services.active, true), inArray(services.id, input.services.map(s => s.serviceId)))) : [];
      for (const item of input.services) {
        const service = available.find(s => s.id === item.serviceId);
        if (!service || (item.mode === "kg" ? service.unit !== "kg" : service.unit !== "piece")) throw new StorefrontError(400, "Choisissez un service actif de cette agence avec l’unité correspondante.");
      }
      const { expectedVersion, services: selected, ...values } = input;
      const [shop] = previous
        ? await tx.update(shops).set({ ...values, version: previous.version + 1, updatedAt: new Date() }).where(eq(shops.id, previous.id)).returning()
        : await tx.insert(shops).values({ ...values, organisationId: actor.organisationId, siteId: actor.siteId }).returning();
      await tx.delete(offerings).where(eq(offerings.storefrontId, shop.id));
      if (selected.length) await tx.insert(offerings).values(selected.map(s => ({ ...s, storefrontId: shop.id })));
      return { ...shop, services: selected };
    });
  }
  private async catalogue(slug: string, executor: Database | Tx = this.database, lock = false) {
    const query = executor.select().from(shops).where(and(eq(shops.slug, slug), eq(shops.published, true)));
    const [shop] = await (lock ? query.for("share") : query);
    if (!shop) throw new StorefrontError(404, "Cette boutique n’est pas disponible");
    await this.site({ siteId: shop.siteId, organisationId: shop.organisationId, userId: "" }, executor);
    const rows = await executor.select({ service: services, mode: offerings.mode }).from(offerings)
      .innerJoin(services, eq(services.id, offerings.serviceId))
      .where(and(eq(offerings.storefrontId, shop.id), eq(services.siteId, shop.siteId), eq(services.active, true)));
    const catalogue: PublicService[] = rows.filter(r => r.mode === "kg" ? r.service.unit === "kg" : r.service.unit === "piece")
      .map(({ service, mode }) => ({ id: service.id, name: service.name, description: service.description, price: service.price, minimumCharge: service.minimumCharge, mode }));
    return { shop, catalogue };
  }
  async publicShop(slug: string) {
    const { shop, catalogue } = await this.catalogue(slug);
    return { slug, name: shop.name, description: shop.description, address: shop.address, hours: shop.hours, whatsapp: shop.whatsapp, currency: shop.currency, weights: shop.weights, services: catalogue, version: shop.version };
  }
  async quote(slug: string, input: unknown) {
    const { shop, catalogue } = await this.catalogue(slug);
    return calculateStorefrontQuote(input, catalogue, shop.weights, shop.currency, shop.version);
  }
  async submit(slug: string, raw: unknown) {
    const input = requestInputSchema.parse(raw);
    const trackingHash = digest(input.trackingSecret);
    const bodyFingerprint = digest(JSON.stringify({ ...input, trackingSecret: trackingHash }));
    return this.database.transaction(async tx => {
      const { shop, catalogue } = await this.catalogue(slug, tx, true);
      const [previous] = await tx.select().from(requests).where(and(eq(requests.storefrontId, shop.id), eq(requests.requestKey, input.requestKey)));
      if (previous) {
        if (previous.bodyFingerprint !== bodyFingerprint) throw new StorefrontError(409, "Cette demande a déjà été envoyée avec un autre contenu");
        return { reference: previous.reference };
      }
      const estimate = calculateStorefrontQuote(input, catalogue, shop.weights, shop.currency, shop.version);
      if (input.quoteFingerprint !== estimate.fingerprint) throw new StorefrontError(409, "Le tarif a changé. Recalculez votre estimation avant de confirmer.");
      const id = randomUUID();
      const [created] = await tx.insert(requests).values({
        id, reference: `WEB-${id.replaceAll("-", "").slice(0, 16).toUpperCase()}`, storefrontId: shop.id, siteId: shop.siteId, organisationId: shop.organisationId,
        requestKey: input.requestKey, trackingHash, bodyFingerprint, customerName: input.customerName, phone: input.phone, note: input.note,
        lines: input.lines, serviceSnapshot: catalogue.filter(s => input.lines.some(l => l.serviceId === s.id)), weightSnapshot: shop.weights, estimate,
      }).onConflictDoNothing().returning();
      if (!created) {
        const [duplicate] = await tx.select().from(requests).where(and(eq(requests.storefrontId, shop.id), eq(requests.requestKey, input.requestKey)));
        if (duplicate?.bodyFingerprint === bodyFingerprint) return { reference: duplicate.reference };
        throw new StorefrontError(409, "Une demande existe déjà. Ouvrez votre suivi.");
      }
      await tx.insert(events).values({ requestId: id, action: "submitted", version: 1, quote: estimate });
      return { reference: created.reference };
    });
  }
  private async tracked(secret: string, executor: Database | Tx = this.database, lock = false) {
    if (!/^[a-f0-9]{64}$/.test(secret)) throw new StorefrontError(404, "Lien de suivi invalide");
    const query = executor.select().from(requests).where(eq(requests.trackingHash, digest(secret)));
    const [request] = await (lock ? query.for("update") : query);
    if (!request) throw new StorefrontError(404, "Lien de suivi invalide");
    return request;
  }
  async tracking(secret: string) {
    const request = await this.tracked(secret);
    const [shop] = await this.database.select().from(shops).where(eq(shops.id, request.storefrontId));
    const [order] = request.convertedOrderId ? await this.database.select({ reference: orders.orderReference, status: orders.status, paymentStatus: orders.paymentStatus }).from(orders).where(and(eq(orders.id, request.convertedOrderId), eq(orders.siteId, request.siteId))) : [];
    const history = await this.database.select({ action: events.action, note: events.note, createdAt: events.createdAt }).from(events).where(eq(events.requestId, request.id)).orderBy(events.id);
    return { reference: request.reference, status: request.status, version: request.version, estimate: request.estimate, finalQuote: request.finalQuote, shop: { name: shop.name, whatsapp: shop.whatsapp, address: shop.address }, history, order: order ?? null };
  }
  async decision(secret: string, version: number, accept: boolean) {
    return this.database.transaction(async tx => {
      const request = await this.tracked(secret, tx, true);
      if (request.version !== version || request.status !== "awaiting_customer_approval") throw new StorefrontError(409, "Ce devis a changé ou a déjà été traité. Actualisez le suivi.");
      await tx.update(requests).set({ status: accept ? "ready_to_convert" : "cancelled", acceptedVersion: accept ? version : null }).where(eq(requests.id, request.id));
      await tx.insert(events).values({ requestId: request.id, action: accept ? "customer_accepted" : "customer_declined", version });
      return { ok: true };
    });
  }
  async inbox(actor: StorefrontActor) {
    await this.site(actor);
    return this.database.select({ id: requests.id, reference: requests.reference, customerName: requests.customerName, status: requests.status, version: requests.version, estimate: requests.estimate, createdAt: requests.createdAt }).from(requests)
      .where(and(eq(requests.siteId, actor.siteId), eq(requests.organisationId, actor.organisationId))).orderBy(desc(requests.createdAt)).limit(100);
  }
  private async owned(actor: StorefrontActor, id: string, tx: Database | Tx, lock = false) {
    await this.site(actor, tx);
    const query = tx.select().from(requests).where(and(eq(requests.id, id), eq(requests.siteId, actor.siteId), eq(requests.organisationId, actor.organisationId)));
    const [request] = await (lock ? query.for("update") : query);
    if (!request) throw new StorefrontError(404, "Demande introuvable");
    return request;
  }
  async detail(actor: StorefrontActor, id: string) {
    const request = await this.owned(actor, id, this.database);
    const matches = await this.database.select({ id: customers.id, name: customers.name, phone: customers.phone }).from(customers).where(and(eq(customers.siteId, actor.siteId), eq(customers.phone, request.phone))).limit(20);
    const history = await this.database.select().from(events).where(eq(events.requestId, id)).orderBy(events.id);
    const { trackingHash, bodyFingerprint, requestKey, ...safe } = request;
    return { ...safe, matches, history };
  }
  async disposition(actor: StorefrontActor, id: string, version: number, accept: boolean, note: string) {
    return this.database.transaction(async tx => {
      const request = await this.owned(actor, id, tx, true);
      if (request.version !== version || request.status !== "submitted") throw new StorefrontError(409, "Cette demande a déjà été traitée");
      await tx.update(requests).set({ status: accept ? "awaiting_dropoff" : "rejected", version: version + 1 }).where(eq(requests.id, id));
      await tx.insert(events).values({ requestId: id, actorId: actor.userId, action: accept ? "dropoff_accepted" : "rejected", version: version + 1, note });
      return { ok: true };
    });
  }
  async review(actor: StorefrontActor, id: string, raw: unknown) {
    const input = reviewInputSchema.parse(raw);
    return this.database.transaction(async tx => {
      const request = await this.owned(actor, id, tx, true);
      if (request.version !== input.expectedVersion || !["awaiting_dropoff", "awaiting_customer_approval", "ready_to_convert"].includes(request.status)) throw new StorefrontError(409, "Cette demande a changé. Actualisez-la.");
      const finalQuote = calculateStorefrontQuote({ lines: request.lines }, request.serviceSnapshot, request.weightSnapshot, request.estimate.currency, request.estimate.catalogVersion, input);
      const version = request.version + 1;
      await tx.update(requests).set({ finalQuote, version, acceptedVersion: null, receivedAt: new Date(), status: "awaiting_customer_approval" }).where(eq(requests.id, id));
      await tx.insert(events).values({ requestId: id, actorId: actor.userId, action: "quote_reviewed", version, note: input.note, quote: finalQuote });
      return { ok: true };
    });
  }
  async convert(actor: StorefrontActor, id: string, version: number, customerId?: number) {
    return this.database.transaction(async tx => {
      const request = await this.owned(actor, id, tx, true);
      if (request.convertedOrderId) return { orderId: request.convertedOrderId };
      if (request.version !== version || request.acceptedVersion !== version || request.status !== "ready_to_convert" || !request.receivedAt || request.finalQuote?.total == null) throw new StorefrontError(409, "Le dépôt et l’accord du client sur le devis actuel sont nécessaires");
      const quote = request.finalQuote;
      const serviceRows = await tx.select().from(services).where(inArray(services.id, quote.lots.map(l => l.serviceId))).for("share");
      if (quote.lots.some(l => !serviceRows.some(s => s.id === l.serviceId && s.siteId === actor.siteId && s.unit === (l.mode === "kg" ? "kg" : "piece")))) throw new StorefrontError(409, "Un service a changé d’agence ou d’unité. La conversion est bloquée.");
      let customer;
      if (customerId) {
        [customer] = await tx.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.siteId, actor.siteId), eq(customers.phone, request.phone)));
        if (!customer) throw new StorefrontError(400, "Client à vérifier dans cette agence");
      } else {
        [customer] = await tx.insert(customers).values({ name: request.customerName, phone: request.phone, address: "Non renseignée — dépôt boutique", siteId: actor.siteId }).returning();
      }
      const items = quote.lots.map(l => ({ serviceId: l.serviceId, quantity: l.quantity! }));
      const validatedPrices = Object.fromEntries(quote.lots.map(l => [l.serviceId, l.rate!]));
      const adjustment = addDecimals("0", ...quote.lots.map(l => l.adjustment));
      if (adjustment !== "0") {
        const [shop] = await tx.select().from(shops).where(eq(shops.id, request.storefrontId)).for("update");
        let adjustmentId = shop.minimumAdjustmentServiceId;
        if (!adjustmentId) {
          const [service] = await tx.insert(services).values({ siteId: actor.siteId, name: "Complément minimum (boutique)", unit: "piece", category: "storefront_adjustment", price: "0", active: false }).returning();
          adjustmentId = service.id;
          await tx.update(shops).set({ minimumAdjustmentServiceId: adjustmentId }).where(eq(shops.id, shop.id));
        }
        items.push({ serviceId: adjustmentId, quantity: "1" });
        validatedPrices[adjustmentId] = adjustment;
      }
      const order = await insertOrderRecords(tx, { customerId: customer.id, siteId: actor.siteId, totalAmount: quote.total!, originalPrice: quote.total!, status: "received" }, items,
        request.lines.map(l => ({ itemName: `${GARMENT_LABELS[l.garment]} — ${SIZE_LABELS[l.size]}`, quantity: l.count })), { actorUserId: actor.userId, validatedPrices });
      if (this.refreshAnalytics) await this.refreshAnalytics(customer.id, tx);
      await tx.update(requests).set({ convertedOrderId: order.id, status: "converted" }).where(eq(requests.id, id));
      await tx.insert(events).values({ requestId: id, actorId: actor.userId, action: "converted", version });
      return { orderId: order.id };
    });
  }
}
