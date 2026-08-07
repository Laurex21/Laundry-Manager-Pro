import { canonicalMoney } from "@shared/order-money";
import {
  stainTreatmentPricingInputSchema,
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
    rates: rows.map((row) => ({ id: Number(row.id), level: row.level, unit: row.unit, price: canonicalMoney(row.price) })),
  };
}

export async function getActiveTreatmentPrices(database: PricingDatabase, scope: PricingScope): Promise<ActiveTreatmentPrices | null> {
  const result = await database.query(`
    SELECT id, pricing_set_id, set_version, level, unit, currency, price
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
        RETURNING id, pricing_set_id, set_version, level, unit, currency, price
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
