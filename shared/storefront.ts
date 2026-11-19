import { z } from "zod";

export const SIZE_LABELS = { child: "Enfant", teen: "Adolescent", adult: "Adulte" } as const;
export const GARMENT_LABELS = { tshirt: "T-shirt", shirt: "Chemise", dress: "Robe simple", jeans: "Jean", trousers: "Pantalon en tissu", shorts: "Short", sweater: "Sweat / pull", pyjamas: "Pyjama complet", evening_dress: "Robe de soirée" } as const;
export type SizeGroup = keyof typeof SIZE_LABELS;
export type Garment = keyof typeof GARMENT_LABELS;
export type WeightReference = { garment: Garment; child: number | null; teen: number | null; adult: number | null };
// Pilot assumptions, not measured averages by age. Publication requires explicit acknowledgement.
export const PILOT_WEIGHTS: WeightReference[] = [
  { garment: "tshirt", child: 100, teen: 150, adult: 180 },
  { garment: "shirt", child: 120, teen: 200, adult: 250 },
  { garment: "dress", child: 150, teen: 250, adult: 300 },
  { garment: "jeans", child: 300, teen: 500, adult: 700 },
  { garment: "trousers", child: 200, teen: 350, adult: 500 },
  { garment: "shorts", child: 100, teen: 150, adult: 200 },
  { garment: "sweater", child: 250, teen: 400, adult: 600 },
  { garment: "pyjamas", child: 100, teen: 180, adult: 250 },
  { garment: "evening_dress", child: null, teen: null, adult: null },
];
const garment = z.enum(Object.keys(GARMENT_LABELS) as [Garment, ...Garment[]]);
const grams = z.number().int().min(1).max(50_000).nullable();
const money = z.string().regex(/^\d{1,9}(?:[.,]\d{1,2})?$/, "Montant invalide");
export const cartLineSchema = z.object({ serviceId: z.number().int().positive(), garment, size: z.enum(["child", "teen", "adult"]), count: z.number().int().min(1).max(100) });
export const quoteInputSchema = z.object({ lines: z.array(cartLineSchema).min(1).max(40) });
export const shopInputSchema = z.object({
  siteId: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(),
  slug: z.string().trim().min(3).max(70).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000),
  address: z.string().trim().min(2).max(400), hours: z.string().trim().max(250),
  whatsapp: z.string().regex(/^\+[1-9]\d{7,14}$/, "Utilisez le format international, par exemple +237…"),
  currency: z.enum(["XAF", "XOF", "EUR", "USD", "CDF", "NGN", "GHS", "KES", "MAD", "DZD", "TND", "AOA", "MZN", "ZAR", "RWF", "UGX", "TZS", "GNF", "MGA"]),
  published: z.boolean(), weightsAcknowledged: z.boolean(),
  weights: z.array(z.object({ garment, child: grams, teen: grams, adult: grams })).length(PILOT_WEIGHTS.length)
    .refine(rows => new Set(rows.map(row => row.garment)).size === PILOT_WEIGHTS.length, "Chaque type doit avoir une référence unique"),
  services: z.array(z.object({ serviceId: z.number().int().positive(), mode: z.enum(["piece", "kg", "quote"]) })).max(100)
    .refine(rows => new Set(rows.map(row => row.serviceId)).size === rows.length, "Service dupliqué"),
}).refine(v => !v.published || (v.weightsAcknowledged && v.services.length > 0), "Validez le barème et sélectionnez au moins un service avant publication");
export const requestInputSchema = quoteInputSchema.extend({
  requestKey: z.string().uuid(), trackingSecret: z.string().regex(/^[a-f0-9]{64}$/),
  quoteFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  customerName: z.string().trim().min(2).max(120), phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  note: z.string().trim().max(600).default(""),
});
export const reviewInputSchema = z.object({
  expectedVersion: z.number().int().positive(), received: z.literal(true),
  basis: z.enum(["measured", "conventional"]),
  measuredGrams: z.record(z.string().regex(/^\d+$/), z.number().int().min(1).max(500_000)).default({}),
  customRates: z.record(z.string().regex(/^\d+$/), money).default({}),
  note: z.string().trim().min(2).max(600),
});
export type CartLine = z.infer<typeof cartLineSchema>;
export type ShopInput = z.infer<typeof shopInputSchema>;
export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type PublicService = { id: number; name: string; description: string | null; price: string; minimumCharge: string | null; mode: "piece" | "kg" | "quote" };
export type QuoteLot = { serviceId: number; name: string; mode: PublicService["mode"]; rate: string | null; quantity: string | null; estimatedGrams: number | null; measuredGrams: number | null; subtotal: string | null; minimumCharge: string; adjustment: string; total: string | null };
export type StorefrontQuote = { currency: string; catalogVersion: number; basis: "estimate" | "measured" | "conventional"; lines: CartLine[]; lots: QuoteLot[]; total: string | null; knownTotal: string; estimatedGrams: number | null; fingerprint: string };
export const REQUEST_LABELS: Record<string, string> = { submitted: "Nouvelle demande", awaiting_dropoff: "Dépôt accepté", awaiting_customer_approval: "Montant à confirmer", ready_to_convert: "Prête à convertir", converted: "Commande créée", rejected: "Refusée", cancelled: "Annulée" };
