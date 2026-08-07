import { canonicalMoney } from "@shared/order-money";
import Decimal from "decimal.js-light";
import { fingerprintRequest, persistPaymentInTransaction, withMoneyTransaction, type MoneyTransactionSource } from "./order-money";
import {
  stainTreatmentPricingInputSchema,
  stainTreatmentDraftInputSchema,
  type StainTreatmentLevel,
  type StainTreatmentRateInput,
  type StainTreatmentUnit,
} from "@shared/stain-treatment";

export interface QueryResult<Row = any> { rows: Row[]; rowCount: number }
export interface PricingClient {
  query<Row = any>(text: string, values?: readonly unknown[]): Promise<QueryResult<Row>>;
  release?: () => void;
}
export interface PricingDatabase extends PricingClient {
  connect?: () => Promise<PricingClient>;
}

export class StainTreatmentPricingError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "invalid_pricing") { super(message); }
}

export class StainTreatmentPostingError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "invalid_treatment", public readonly details?: unknown) { super(message); }
}

type PostingService = { serviceId: number; unit: string; quantity: string; price: string };
type PostingRate = { id: number; level: StainTreatmentLevel; unit: StainTreatmentUnit; price: string; currency: string; setVersion: number };
type PostingDraft = { orderItemIndex: number; level: StainTreatmentLevel; quantity: string; idempotencyKey: string; acknowledgement?: { affirmed: true; textVersion: string } };

export function pricingSetToken(pricingSetId: number, version: number) {
  return Buffer.from(JSON.stringify({ pricingSetId, version }), "utf8").toString("base64url");
}

function parsePricingSetToken(token: string) {
  try {
    const value = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (!Number.isInteger(value.pricingSetId) || !Number.isInteger(value.version) || value.pricingSetId < 1 || value.version < 1) throw new Error();
    return value as { pricingSetId: number; version: number };
  } catch { throw new StainTreatmentPostingError("Invalid pricing-set version", 409, "pricing_conflict"); }
}

export function buildOrderPostingFingerprint(payload: any) {
  return fingerprintRequest(payload, {
    moneyPaths: ["discount", "pickupCost", "advancePayment", "items[].quantity", "treatments[].quantity"],
  });
}

export function prepareTreatmentPosting(services: readonly PostingService[], rates: readonly PostingRate[], drafts: readonly PostingDraft[]) {
  const quantities = new Map<number, Decimal>();
  const lines = drafts.map((draft) => {
    const service = services[draft.orderItemIndex];
    if (!service) throw new StainTreatmentPostingError("Treatment references an unknown order item");
    if (service.unit !== "piece" && service.unit !== "kg") throw new StainTreatmentPostingError("Unsupported service unit for stain treatment", 400, "unsupported_unit");
    const parsed = stainTreatmentDraftInputSchema.safeParse(draft);
    if (!parsed.success) throw new StainTreatmentPostingError(parsed.error.issues[0]?.message ?? "Invalid treatment draft");
    const quantity = new Decimal(draft.quantity);
    if (service.unit === "piece" && !quantity.isInteger()) throw new StainTreatmentPostingError("Piece treatment quantity must be an integer");
    const aggregate = (quantities.get(draft.orderItemIndex) ?? new Decimal(0)).plus(quantity);
    if (aggregate.greaterThan(new Decimal(service.quantity))) throw new StainTreatmentPostingError("Treatment quantity exceeds service quantity", 400, "quantity_overflow");
    quantities.set(draft.orderItemIndex, aggregate);
    const rate = rates.find((candidate) => candidate.level === draft.level && candidate.unit === service.unit);
    if (!rate) throw new StainTreatmentPostingError("No active stain treatment price is configured", 409, "pricing_missing");
    return { ...draft, unit: service.unit, pricingVersionId: rate.id, pricingSetVersion: rate.setVersion, currency: rate.currency, capturedRate: canonicalMoney(rate.price), lineTotal: canonicalMoney(new Decimal(rate.price).times(quantity)) };
  });
  return { lines, treatmentSubtotal: canonicalMoney(lines.reduce((sum, line) => sum.plus(line.lineTotal), new Decimal(0))) };
}

export interface PostOrderWithTreatmentsInput {
  organisationId: number; siteId: number; customerId: number; actorId: string; createdByEmployeeId?: number | null;
  idempotencyKey: string; expectedPricingSetVersion?: string;
  status?: string; entryDate?: Date; pickupDate?: Date | null; discount?: string; discountPct?: string; pickupCost?: string;
  advancePayment?: string; advancePaymentMethod?: string;
  items: Array<{ serviceId: number; quantity: string }>;
  treatments: PostingDraft[];
  garments?: Array<{ itemName: string; quantity: number; color?: string | null }>;
}

function orderPostingSemanticInput(input: PostOrderWithTreatmentsInput) {
  return {
    organisationId: input.organisationId, siteId: input.siteId, customerId: input.customerId,
    status: input.status ?? "received", entryDate: input.entryDate?.toISOString() ?? null, pickupDate: input.pickupDate?.toISOString() ?? null,
    discount: input.discount ?? "0", discountPct: input.discountPct ?? "0", pickupCost: input.pickupCost ?? "0",
    advancePayment: input.advancePayment ?? "0", advancePaymentMethod: input.advancePaymentMethod ?? "Cash",
    items: input.items, treatments: input.treatments, garments: input.garments ?? [], expectedPricingSetVersion: input.expectedPricingSetVersion,
  };
}

async function postedOrderResult(client: any, orderId: number) {
  const result = await client.query(`SELECT id, customer_id, status, payment_status, original_price::text AS cleaning_subtotal,
      discount_amount::text AS discount, '0.00'::text AS membership_coverage,
      coalesce((SELECT sum(line_total) FROM order_stain_treatments WHERE order_id=o.id),0)::text AS treatment_subtotal,
      pickup_cost::text AS other_charges, total_amount::text AS final_total
    FROM orders o WHERE id=$1`, [orderId]);
  const treatments = await client.query(`SELECT id, order_id, order_item_id, level, unit, quantity::text, captured_rate::text,
      line_total::text, currency, acknowledgement_text_version, created_at
    FROM order_stain_treatments WHERE order_id=$1 ORDER BY id`, [orderId]);
  const order = result.rows[0];
  return { ...order, cleaningSubtotal: canonicalMoney(order.cleaning_subtotal), discount: canonicalMoney(order.discount), membershipCoverage: "0.00", treatmentSubtotal: canonicalMoney(order.treatment_subtotal), otherCharges: canonicalMoney(order.other_charges), finalTotal: canonicalMoney(order.final_total), treatments: treatments.rows.map((line: any) => ({ ...line, quantity: new Decimal(line.quantity).toFixed(2), capturedRate: canonicalMoney(line.captured_rate), lineTotal: canonicalMoney(line.line_total), createdAt: new Date(line.created_at).toISOString() })) };
}

export async function postOrderWithTreatments(source: MoneyTransactionSource, input: PostOrderWithTreatmentsInput) {
  const fingerprint = buildOrderPostingFingerprint(orderPostingSemanticInput(input));
  return withMoneyTransaction(source, async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`order:${input.organisationId}:${input.siteId}:${input.idempotencyKey}`]);
    const replay = await client.query(`SELECT id, request_fingerprint FROM orders WHERE organisation_id=$1 AND site_id=$2 AND idempotency_key=$3 FOR UPDATE`, [input.organisationId, input.siteId, input.idempotencyKey]);
    if (replay.rowCount) {
      if (replay.rows[0].request_fingerprint !== fingerprint) throw new StainTreatmentPostingError("Idempotency key was already used with a different order request", 409, "idempotency_conflict");
      return { ...(await postedOrderResult(client, replay.rows[0].id)), replayed: true };
    }
    let rates: PostingRate[] = [];
    let pricingConflict: { expected: { pricingSetId: number; version: number }; currentSetId: number; currentVersion: number } | null = null;
    if (input.treatments.length > 0) {
      const expected = parsePricingSetToken(input.expectedPricingSetVersion!);
      const parent = await client.query(`SELECT id, current_version FROM stain_treatment_pricing_sets WHERE organisation_id=$1 AND site_id=$2 FOR UPDATE`, [input.organisationId, input.siteId]);
      if (!parent.rowCount) throw new StainTreatmentPostingError("No active stain treatment prices are configured", 409, "pricing_missing");
      const rateResult = await client.query(`SELECT id, level, unit, price::text, currency, set_version FROM stain_treatment_price_versions WHERE pricing_set_id=$1 AND active=true ORDER BY unit,level`, [parent.rows[0].id]);
      rates = rateResult.rows.map((rate: any) => ({ id: Number(rate.id), level: rate.level, unit: rate.unit, price: canonicalMoney(rate.price), currency: rate.currency, setVersion: Number(rate.set_version) }));
      if (Number(parent.rows[0].id) !== expected.pricingSetId || Number(parent.rows[0].current_version) !== expected.version) {
        pricingConflict = { expected, currentSetId: Number(parent.rows[0].id), currentVersion: Number(parent.rows[0].current_version) };
      }
    }
    const serviceLines: PostingService[] = [];
    for (const item of input.items) {
      const service = await client.query(`SELECT s.id, s.unit, s.price::text FROM services s JOIN sites st ON st.id=s.site_id AND st.organisation_id=$2 WHERE s.id=$1 AND s.site_id=$3 AND s.active=true`, [item.serviceId, input.organisationId, input.siteId]);
      if (!service.rowCount) throw new StainTreatmentPostingError(`Service ${item.serviceId} not found`, 404, "service_not_found");
      serviceLines.push({ serviceId: item.serviceId, unit: service.rows[0].unit, quantity: item.quantity, price: canonicalMoney(service.rows[0].price) });
    }
    if (pricingConflict) {
      const oldRateResult = await client.query(`SELECT id, level, unit, price::text, currency, set_version FROM stain_treatment_price_versions WHERE pricing_set_id=$1 AND set_version=$2 ORDER BY unit,level`, [pricingConflict.expected.pricingSetId, pricingConflict.expected.version]);
      const oldRates: PostingRate[] = oldRateResult.rows.map((rate: any) => ({ id: Number(rate.id), level: rate.level, unit: rate.unit, price: canonicalMoney(rate.price), currency: rate.currency, setVersion: Number(rate.set_version) }));
      const newPreview = prepareTreatmentPosting(serviceLines, rates, input.treatments);
      let oldTreatmentTotal: string | null = null;
      try { oldTreatmentTotal = prepareTreatmentPosting(serviceLines, oldRates, input.treatments).treatmentSubtotal; } catch { /* stale/tampered token has no authoritative old preview */ }
      const cleaning = serviceLines.reduce((sum, line) => sum.plus(new Decimal(line.price).times(line.quantity)), new Decimal(0));
      const pct = new Decimal(input.discountPct ?? "0");
      const previewDiscount = pct.greaterThan(0) ? cleaning.times(pct).dividedBy(100) : new Decimal(input.discount ?? "0");
      const base = cleaning.minus(previewDiscount).plus(new Decimal(input.pickupCost ?? "0"));
      throw new StainTreatmentPostingError("Stain treatment prices changed", 409, "pricing_conflict", {
        oldRates: oldRates.map(({ level, unit, price }) => ({ level, unit, price })), newRates: rates.map(({ level, unit, price }) => ({ level, unit, price })),
        oldTreatmentTotal, newTreatmentTotal: newPreview.treatmentSubtotal,
        oldTotal: oldTreatmentTotal == null ? null : canonicalMoney(base.plus(oldTreatmentTotal)), newTotal: canonicalMoney(base.plus(newPreview.treatmentSubtotal)),
        expectedPricingSetVersion: pricingSetToken(pricingConflict.currentSetId, pricingConflict.currentVersion),
      });
    }
    const prepared = prepareTreatmentPosting(serviceLines, rates, input.treatments);
    const cleaningSubtotal = canonicalMoney(serviceLines.reduce((sum, line) => sum.plus(new Decimal(line.price).times(line.quantity)), new Decimal(0)));
    const pctDiscount = new Decimal(input.discountPct ?? "0");
    if (pctDiscount.isNegative() || pctDiscount.greaterThan(100)) throw new StainTreatmentPostingError("Discount percentage is outside bounds");
    const discount = pctDiscount.greaterThan(0) ? canonicalMoney(new Decimal(cleaningSubtotal).times(pctDiscount).dividedBy(100)) : canonicalMoney(input.discount ?? "0");
    if (new Decimal(discount).greaterThan(cleaningSubtotal)) throw new StainTreatmentPostingError("Discount cannot exceed the cleaning subtotal");
    const pickupCost = canonicalMoney(input.pickupCost ?? "0");
    const finalTotal = canonicalMoney(new Decimal(cleaningSubtotal).minus(discount).plus(prepared.treatmentSubtotal).plus(pickupCost));
    const advance = canonicalMoney(input.advancePayment ?? "0");
    if (new Decimal(advance).greaterThan(finalTotal)) throw new StainTreatmentPostingError("Advance payment cannot exceed the order total");
    const paymentStatus = advance === "0.00" ? "unpaid" : advance === finalTotal ? "paid" : "partial";
    const insertedOrder = await client.query(`INSERT INTO orders (customer_id,created_by_employee_id,status,total_amount,payment_status,entry_date,pickup_date,discount,discount_pct,discount_amount,original_price,pickup_cost,idempotency_key,request_fingerprint,site_id,organisation_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$8,$10,$11,$12,$13,$14,$15) RETURNING id`, [input.customerId,input.createdByEmployeeId ?? null,input.status ?? "received",finalTotal,paymentStatus,input.entryDate ?? new Date(),input.pickupDate ?? null,discount,canonicalMoney(input.discountPct ?? "0"),cleaningSubtotal,pickupCost,input.idempotencyKey,fingerprint,input.siteId,input.organisationId]);
    const orderId = Number(insertedOrder.rows[0].id);
    const orderItemIds: number[] = [];
    for (const line of serviceLines) {
      const inserted = await client.query(`INSERT INTO order_items(order_id,service_id,quantity,price_at_order) VALUES($1,$2,$3,$4) RETURNING id`, [orderId,line.serviceId,line.quantity,line.price]);
      orderItemIds.push(Number(inserted.rows[0].id));
    }
    for (const line of prepared.lines) {
      await client.query(`INSERT INTO order_stain_treatments (organisation_id,site_id,order_id,order_item_id,level,unit,quantity,captured_rate,line_total,currency,pricing_version_id,pricing_set_version,idempotency_key,acknowledgement_affirmed,acknowledgement_text_version,acknowledged_by,acknowledged_at,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$16)`, [input.organisationId,input.siteId,orderId,orderItemIds[line.orderItemIndex],line.level,line.unit,line.quantity,line.capturedRate,line.lineTotal,line.currency,line.pricingVersionId,line.pricingSetVersion,line.idempotencyKey,line.acknowledgement?.affirmed ?? null,line.acknowledgement?.textVersion ?? null,line.acknowledgement ? input.actorId : null,line.acknowledgement ? new Date() : null,input.actorId]);
    }
    await client.query(`INSERT INTO order_status_history(order_id,status,notes) VALUES($1,$2,'Order created')`, [orderId,input.status ?? "received"]);
    for (const garment of input.garments ?? []) await client.query(`INSERT INTO garment_items(order_id,item_name,quantity,color) VALUES($1,$2,$3,$4)`, [orderId,garment.itemName,garment.quantity,garment.color ?? null]);
    if (advance !== "0.00") await persistPaymentInTransaction(client, { organisationId: input.organisationId, siteId: input.siteId, orderId, amount: advance, method: input.advancePaymentMethod ?? "Cash", collectedByEmployeeId: input.createdByEmployeeId ?? null, paymentDate: input.entryDate, isAdvance: true, idempotencyKey: `${input.idempotencyKey}:advance`, fingerprintContext: { orderId } });
    return { ...(await postedOrderResult(client, orderId)), replayed: false };
  });
}

export interface PricingScope { organisationId: number; siteId: number }
export interface ReplacePricingInput extends PricingScope {
  actorId: string;
  rates: StainTreatmentRateInput[];
}
export interface ResolvePricingInput extends PricingScope {
  level: StainTreatmentLevel;
  unit: StainTreatmentUnit;
}
export interface ActiveTreatmentPrices {
  pricingSetId: number;
  version: number;
  currency: string;
  rates: Array<StainTreatmentRateInput & { id: number }>;
  expectedPricingSetVersion: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

function mapRates(rows: any[]): ActiveTreatmentPrices | null {
  if (rows.length === 0) return null;
  if (rows.length !== 6) throw new StainTreatmentPricingError("The active stain treatment price set is incomplete", 409, "incomplete_pricing");
  const currencies = new Set(rows.map((row) => row.currency));
  const versions = new Set(rows.map((row) => Number(row.set_version)));
  const sets = new Set(rows.map((row) => Number(row.pricing_set_id ?? row.pricingSetId ?? 0)));
  if (currencies.size !== 1 || versions.size !== 1 || sets.size !== 1) {
    throw new StainTreatmentPricingError("The active stain treatment price set is inconsistent", 409, "inconsistent_pricing");
  }
  return {
    pricingSetId: Number(rows[0].pricing_set_id ?? rows[0].pricingSetId ?? 0),
    version: Number(rows[0].set_version),
    currency: rows[0].currency,
    expectedPricingSetVersion: pricingSetToken(Number(rows[0].pricing_set_id ?? rows[0].pricingSetId ?? 0), Number(rows[0].set_version)),
    updatedAt: rows[0].created_at ?? rows[0].createdAt ? new Date(rows[0].created_at ?? rows[0].createdAt).toISOString() : null,
    updatedBy: rows[0].created_by ?? rows[0].createdBy ?? null,
    rates: rows.map((row) => ({ id: Number(row.id), level: row.level, unit: row.unit, price: canonicalMoney(row.price) })),
  };
}

export async function getActiveTreatmentPrices(database: PricingDatabase, scope: PricingScope): Promise<ActiveTreatmentPrices | null> {
  const result = await database.query(`
    SELECT id, pricing_set_id, set_version, level, unit, currency, price, created_at, created_by
    FROM stain_treatment_price_versions
    WHERE organisation_id = $1 AND site_id = $2 AND active = true
    ORDER BY unit, level
  `, [scope.organisationId, scope.siteId]);
  return mapRates(result.rows);
}

export async function replaceTreatmentPrices(database: PricingDatabase, input: ReplacePricingInput): Promise<ActiveTreatmentPrices> {
  const parsed = stainTreatmentPricingInputSchema.safeParse({ rates: input.rates });
  if (!parsed.success) throw new StainTreatmentPricingError(parsed.error.issues[0]?.message ?? "Invalid rates");
  const client = database.connect ? await database.connect() : database;
  try {
    await client.query("BEGIN");
    const org = await client.query<{ currency: string }>("SELECT currency FROM organisations WHERE id = $1", [input.organisationId]);
    if (!org.rows[0]) throw new StainTreatmentPricingError("Organisation not found", 404, "not_found");
    const site = await client.query<{ id: number }>("SELECT id FROM sites WHERE id = $1 AND organisation_id = $2 AND is_active = true", [input.siteId, input.organisationId]);
    if (!site.rows[0]) throw new StainTreatmentPricingError("Site not found", 404, "not_found");
    await client.query(`
      INSERT INTO stain_treatment_pricing_sets (organisation_id, site_id, current_version)
      VALUES ($1, $2, 0)
      ON CONFLICT (organisation_id, site_id) DO NOTHING
    `, [input.organisationId, input.siteId]);
    const parent = await client.query<{ id: number; current_version: number }>(`
      SELECT id, current_version FROM stain_treatment_pricing_sets
      WHERE organisation_id = $1 AND site_id = $2
      FOR UPDATE
    `, [input.organisationId, input.siteId]);
    if (!parent.rows[0]) throw new StainTreatmentPricingError("Pricing set could not be created", 500, "pricing_set_missing");
    const version = Number(parent.rows[0].current_version) + 1;
    await client.query("UPDATE stain_treatment_price_versions SET active = false WHERE pricing_set_id = $1 AND active = true", [parent.rows[0].id]);
    await client.query("UPDATE stain_treatment_pricing_sets SET current_version = $2, updated_at = now() WHERE id = $1 RETURNING current_version", [parent.rows[0].id, version]);
    const inserted: any[] = [];
    for (const rate of parsed.data.rates) {
      const result = await client.query(`
        INSERT INTO stain_treatment_price_versions
          (pricing_set_id, organisation_id, site_id, set_version, level, unit, currency, price, active, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
        RETURNING id, pricing_set_id, set_version, level, unit, currency, price, created_at, created_by
      `, [parent.rows[0].id, input.organisationId, input.siteId, version, rate.level, rate.unit, org.rows[0].currency, canonicalMoney(rate.price), input.actorId]);
      inserted.push(result.rows[0]);
    }
    await client.query("COMMIT");
    return mapRates(inserted)!;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* retain the original error */ }
    throw error;
  } finally {
    client.release?.();
  }
}

export async function resolveTreatmentPrice(database: PricingDatabase, input: ResolvePricingInput) {
  const result = await database.query(`
    SELECT id, pricing_set_id, set_version, currency, price
    FROM stain_treatment_price_versions
    WHERE organisation_id = $1 AND site_id = $2 AND level = $3 AND unit = $4 AND active = true
  `, [input.organisationId, input.siteId, input.level, input.unit]);
  if (!result.rows[0]) throw new StainTreatmentPricingError("No active stain treatment price is configured", 409, "pricing_missing");
  return { ...result.rows[0], price: canonicalMoney(result.rows[0].price), version: Number(result.rows[0].set_version) };
}

export type TreatmentReportMode = "booked" | "collected";
export interface TreatmentReportInput {
  organisationId: number;
  siteIds: number[];
  mode: TreatmentReportMode;
  from: string;
  to: string;
  asOf?: string;
  page: number;
  pageSize: number;
}

export function validateTreatmentReportInput(input: TreatmentReportInput) {
  if (!input.siteIds.length) throw new StainTreatmentPricingError("No authorized sites", 403, "forbidden");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to) || input.from > input.to) {
    throw new StainTreatmentPricingError("Invalid report date range", 400, "invalid_date_range");
  }
  if (input.asOf && !/^\d{4}-\d{2}-\d{2}$/.test(input.asOf)) throw new StainTreatmentPricingError("Invalid as-of date", 400, "invalid_as_of");
  const days = (Date.parse(`${input.to}T00:00:00Z`) - Date.parse(`${input.from}T00:00:00Z`)) / 86400000;
  if (days > 366) throw new StainTreatmentPricingError("Report date range cannot exceed 366 days", 400, "date_range_too_large");
  if (!Number.isInteger(input.page) || input.page < 1 || !Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) {
    throw new StainTreatmentPricingError("Invalid report pagination", 400, "invalid_pagination");
  }
  return input;
}

/** Audited aggregates: SQL keeps currencies and units separate and returns numeric values as text. */
export async function getStainTreatmentReport(database: PricingDatabase, raw: TreatmentReportInput) {
  const input = validateTreatmentReportInput(raw);
  const values: unknown[] = [input.organisationId, input.siteIds, input.from, input.to, input.asOf ?? input.to, input.pageSize, (input.page - 1) * input.pageSize];
  const booked = input.mode === "booked";
  const result = await database.query(`
    WITH effective AS (
      SELECT t.id, t.order_id, t.site_id, s.name AS site_name, t.level, t.unit, t.currency,
        (t.quantity + coalesce(sum(a.quantity_effect) FILTER (WHERE a.created_at < ($5::date + interval '1 day')), 0))::numeric AS net_quantity,
        (t.line_total + coalesce(sum(a.amount_effect) FILTER (WHERE a.created_at < ($5::date + interval '1 day')), 0))::numeric AS net_booked,
        t.acknowledgement_affirmed, t.acknowledgement_text_version, t.acknowledged_at,
        o.entry_date::date AS booked_date
      FROM order_stain_treatments t
      JOIN orders o ON o.id=t.order_id AND o.organisation_id=t.organisation_id AND o.site_id=t.site_id
      JOIN sites s ON s.id=t.site_id AND s.organisation_id=t.organisation_id
      LEFT JOIN order_stain_treatment_adjustments a ON a.treatment_id=t.id AND a.organisation_id=t.organisation_id AND a.site_id=t.site_id
      WHERE t.organisation_id=$1 AND t.site_id=ANY($2::int[]) AND o.status NOT IN ('draft','cancelled','canceled')
      GROUP BY t.id,o.entry_date,s.name
    ), paid AS (
      SELECT pa.treatment_id AS id, sum(pa.treatment_amount) AS amount FROM order_payment_allocations pa
      JOIN payments p ON p.id=pa.payment_id AND p.organisation_id=$1 AND p.site_id=ANY($2::int[])
      WHERE p.payment_date >= $3::date AND p.payment_date < ($4::date + interval '1 day') GROUP BY pa.treatment_id
    ), refunded AS (
      SELECT ra.treatment_id AS id, sum(ra.treatment_amount) AS amount FROM order_refund_allocations ra
      JOIN order_refunds r ON r.id=ra.refund_id AND r.organisation_id=$1 AND r.site_id=ANY($2::int[])
      WHERE r.created_at >= $3::date AND r.created_at < ($4::date + interval '1 day') GROUP BY ra.treatment_id
    ), collected AS (
      SELECT e.id, coalesce(p.amount,0)-coalesce(r.amount,0) AS net_collected FROM effective e
      LEFT JOIN paid p ON p.id=e.id LEFT JOIN refunded r ON r.id=e.id
    ), grouped AS (
      SELECT e.site_id,e.site_name,e.level,e.unit,e.currency,
        sum(e.net_quantity)::text AS quantity,
        sum(CASE WHEN ${booked ? "e.booked_date BETWEEN $3::date AND $4::date" : "true"} THEN e.net_booked ELSE 0 END)::text AS booked_revenue,
        sum(c.net_collected)::text AS collected_revenue,
        count(DISTINCT e.order_id) FILTER (WHERE e.net_quantity > 0)::int AS treated_orders,
        count(*) FILTER (WHERE e.level='very_intensive' AND (e.acknowledgement_affirmed IS NOT TRUE OR e.acknowledgement_text_version IS NULL OR e.acknowledged_at IS NULL))::int AS acknowledgement_exceptions
      FROM effective e JOIN collected c ON c.id=e.id
      WHERE ${booked ? "e.booked_date BETWEEN $3::date AND $4::date" : "c.net_collected <> 0"}
      GROUP BY e.site_id,e.site_name,e.level,e.unit,e.currency
    )
    SELECT *, CASE WHEN treated_orders=0 THEN '0.00' ELSE round(booked_revenue::numeric/treated_orders,2)::text END AS average_booked_revenue,
      count(*) OVER()::int AS total_groups
    FROM grouped ORDER BY currency,unit,site_name,level LIMIT $6 OFFSET $7
  `, values);
  return {
    mode: input.mode, from: input.from, to: input.to, asOf: input.asOf ?? input.to,
    page: input.page, pageSize: input.pageSize, total: Number(result.rows[0]?.total_groups ?? 0),
    groups: result.rows.map((row: any) => ({ ...row, quantity: new Decimal(row.quantity).toFixed(2), bookedRevenue: canonicalMoney(row.booked_revenue), collectedRevenue: canonicalMoney(row.collected_revenue), averageBookedRevenue: canonicalMoney(row.average_booked_revenue), treatedOrders: Number(row.treated_orders), acknowledgementExceptions: Number(row.acknowledgement_exceptions) })),
  };
}
