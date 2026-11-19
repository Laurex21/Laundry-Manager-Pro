import { createHash } from "node:crypto";
import { addDecimals, compareDecimals, multiplyDecimal, normalizeDecimalInput } from "../../shared/exact-decimal";
import { quoteInputSchema, type PublicService, type ReviewInput, type StorefrontQuote, type WeightReference } from "../../shared/storefront";

export class StorefrontError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function money(value: string) {
  const normalized = normalizeDecimalInput(value);
  if ((normalized.split(".")[1]?.length ?? 0) > 2 || compareDecimals(normalized, "0") < 0) throw new StorefrontError(400, "Les tarifs boutique doivent être positifs avec au maximum deux décimales");
  return normalized;
}
export function calculateStorefrontQuote(input: unknown, services: PublicService[], weights: WeightReference[], currency: string, catalogVersion: number, review?: ReviewInput): StorefrontQuote {
  const { lines } = quoteInputSchema.parse(input);
  if (lines.reduce((n, line) => n + line.count, 0) > 500) throw new StorefrontError(400, "Maximum 500 pièces par demande");
  const groups = new Map<number, typeof lines>();
  for (const line of lines) {
    if (!services.some(s => s.id === line.serviceId)) throw new StorefrontError(409, "Ce service n’est plus disponible. Actualisez le catalogue.");
    groups.set(line.serviceId, [...(groups.get(line.serviceId) ?? []), line]);
  }
  const lots = [...groups.entries()].map(([serviceId, items]) => {
    const service = services.find(s => s.id === serviceId)!;
    const count = items.reduce((n, line) => n + line.count, 0);
    const masses = items.map(line => {
      const ref = weights.find(w => w.garment === line.garment)?.[line.size];
      return ref == null ? null : ref * line.count;
    });
    const estimatedGrams = service.mode !== "kg" ? null : masses.includes(null) ? null : masses.reduce<number>((n, v) => n + v!, 0);
    let measuredGrams: number | null = null;
    let mass = estimatedGrams;
    if (service.mode === "kg" && review?.basis === "measured") {
      measuredGrams = review.measuredGrams[String(serviceId)] ?? null;
      if (measuredGrams == null) throw new StorefrontError(400, `Saisissez le poids net sec pour ${service.name}`);
      mass = measuredGrams;
    }
    const quantity = service.mode === "kg" ? mass == null ? null : normalizeDecimalInput(mass / 1000, 3) : String(count);
    const rawRate = service.mode === "quote" ? review?.customRates[String(serviceId)] : service.price;
    const rate = rawRate == null ? null : money(rawRate);
    if (rate != null && compareDecimals(rate, "0") < 0) throw new StorefrontError(400, "Le tarif ne peut pas être négatif");
    const subtotal = rate == null || quantity == null ? null : multiplyDecimal(rate, quantity);
    const minimumCharge = service.mode === "kg" ? money(service.minimumCharge || "0") : "0";
    const adjustment = subtotal != null && compareDecimals(subtotal, minimumCharge) < 0 ? addDecimals(minimumCharge, multiplyDecimal(subtotal, "-1")) : "0";
    return { serviceId, name: service.name, mode: service.mode, rate, quantity, estimatedGrams, measuredGrams, minimumCharge, subtotal, adjustment, total: subtotal == null ? null : addDecimals(subtotal, adjustment) };
  });
  if (review && lots.some(lot => lot.total == null)) throw new StorefrontError(400, "Pesée ou prix sur devis manquant. Tous les lots doivent être chiffrés.");
  const kgLots = lots.filter(lot => lot.mode === "kg");
  const knownTotal = addDecimals("0", ...lots.map(lot => lot.total ?? "0"));
  const value = { currency, catalogVersion, basis: review?.basis ?? "estimate" as const, lines, lots, knownTotal, total: lots.some(lot => lot.total == null) ? null : knownTotal, estimatedGrams: kgLots.some(lot => lot.estimatedGrams == null) ? null : kgLots.reduce((n, lot) => n + lot.estimatedGrams!, 0) };
  return { ...value, fingerprint: digest(JSON.stringify(value)) };
}
