import Decimal from "decimal.js-light";
import { z } from "zod";
import { canonicalMoney, MONEY_MAX, type MoneyString } from "./order-money";

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export const STAIN_TREATMENT_LEVELS = ["standard", "intensive", "very_intensive"] as const;
export const STAIN_TREATMENT_UNITS = ["piece", "kg"] as const;

export type StainTreatmentLevel = typeof STAIN_TREATMENT_LEVELS[number];
export type StainTreatmentUnit = typeof STAIN_TREATMENT_UNITS[number];

const levelSchema = z.enum(STAIN_TREATMENT_LEVELS);
const unitSchema = z.enum(STAIN_TREATMENT_UNITS);
const idempotencyKeySchema = z.string().trim().min(1).max(120);
const decimalQuantitySchema = z.string().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => {
  const quantity = validDecimal(value);
  return Boolean(quantity?.greaterThan(0));
}, "Treatment quantity must be positive");
const positiveQuantitySchema = decimalQuantitySchema.refine((value) => new Decimal(value).greaterThan(0), "Quantity must be positive");
const positiveMoneySchema = z.string().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => {
  try {
    const amount = new Decimal(value);
    return amount.greaterThan(0) && amount.lessThanOrEqualTo(MONEY_MAX);
  } catch {
    return false;
  }
}, "Price must be a positive two-decimal money value");

export const stainTreatmentAcknowledgementInputSchema = z.object({
  affirmed: z.literal(true),
  textVersion: z.string().trim().min(1).max(120),
}).strict();

export const stainTreatmentDraftInputSchema = z.object({
  orderItemIndex: z.number().int().nonnegative(),
  level: levelSchema,
  quantity: positiveQuantitySchema,
  idempotencyKey: idempotencyKeySchema,
  acknowledgement: stainTreatmentAcknowledgementInputSchema.optional(),
}).strict().superRefine((input, context) => {
  if (input.level === "very_intensive" && !input.acknowledgement) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["acknowledgement"], message: "Very intensive treatment requires acknowledgement" });
  }
  if (input.level !== "very_intensive" && input.acknowledgement) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["acknowledgement"], message: "Acknowledgement applies only to very intensive treatment" });
  }
});

export type StainTreatmentDraftInput = z.infer<typeof stainTreatmentDraftInputSchema>;

export const stainTreatmentRateInputSchema = z.object({
  level: levelSchema,
  unit: unitSchema,
  price: positiveMoneySchema,
}).strict();

export type StainTreatmentRateInput = z.infer<typeof stainTreatmentRateInputSchema>;

type ValidationResult = { success: true } | { success: false; error: string };

function validDecimal(value: string): Decimal | undefined {
  try {
    return new Decimal(value);
  } catch {
    return undefined;
  }
}

export function validateTreatmentQuantity(unit: StainTreatmentUnit, quantity: string): ValidationResult {
  if (!/^\d+(?:\.\d{1,2})?$/.test(quantity)) return { success: false, error: "Quantity must have at most two decimal places" };
  const parsed = validDecimal(quantity);
  if (!parsed || !parsed.greaterThan(0)) return { success: false, error: "Quantity must be positive" };
  if (unit === "piece" && !parsed.isInteger()) return { success: false, error: "Piece quantity must be an integer" };
  return { success: true };
}

export function validateAscendingRates(rates: readonly StainTreatmentRateInput[]): ValidationResult {
  const expected = new Set(STAIN_TREATMENT_UNITS.flatMap((unit) => STAIN_TREATMENT_LEVELS.map((level) => `${unit}:${level}`)));
  if (rates.length !== expected.size) return { success: false, error: "Exactly six rates are required" };
  const indexed = new Map<string, Decimal>();
  for (const rate of rates) {
    const key = `${rate.unit}:${rate.level}`;
    if (!expected.has(key) || indexed.has(key)) return { success: false, error: "Each level and unit pair must appear exactly once" };
    if (!/^\d+(?:\.\d{1,2})?$/.test(rate.price)) return { success: false, error: "Rates must use at most two decimal places" };
    const price = validDecimal(rate.price);
    if (!price || !price.greaterThan(0) || price.greaterThan(MONEY_MAX)) return { success: false, error: "Rates must be positive money values" };
    indexed.set(key, price);
  }
  for (const unit of STAIN_TREATMENT_UNITS) {
    const standard = indexed.get(`${unit}:standard`)!;
    const intensive = indexed.get(`${unit}:intensive`)!;
    const veryIntensive = indexed.get(`${unit}:very_intensive`)!;
    if (!standard.lessThan(intensive) || !intensive.lessThan(veryIntensive)) {
      return { success: false, error: `Rates for ${unit} must be strictly ascending` };
    }
  }
  return { success: true };
}

export const stainTreatmentPricingInputSchema = z.object({
  rates: z.array(stainTreatmentRateInputSchema),
}).strict().superRefine((input, context) => {
  const result = validateAscendingRates(input.rates);
  if (!result.success) context.addIssue({ code: z.ZodIssueCode.custom, path: ["rates"], message: result.error });
});

export type StainTreatmentPricingInput = z.infer<typeof stainTreatmentPricingInputSchema>;

export function multiplyTreatmentAmount(rate: string, quantity: string): MoneyString {
  const parsedRate = positiveMoneySchema.safeParse(rate);
  if (!parsedRate.success || !/^\d+(?:\.\d{1,2})?$/.test(quantity)) throw new Error("Invalid treatment rate or quantity");
  const parsedQuantity = validDecimal(quantity);
  if (!parsedQuantity || !parsedQuantity.greaterThan(0)) throw new Error("Invalid treatment rate or quantity");
  return canonicalMoney(new Decimal(rate).times(parsedQuantity));
}

export function validateNetEffectiveQuantity(serviceQuantity: string, currentEffectiveQuantity: string, quantityEffect: string): ValidationResult {
  const service = validDecimal(serviceQuantity);
  const current = validDecimal(currentEffectiveQuantity);
  const effect = validDecimal(quantityEffect);
  if (!service || !current || !effect || service.isNegative() || current.isNegative()) return { success: false, error: "Invalid quantity" };
  const next = current.plus(effect);
  if (next.isNegative() || next.greaterThan(service)) return { success: false, error: "Net treatment quantity must remain within the service quantity" };
  return { success: true };
}

export interface StainTreatmentRateDto {
  level: StainTreatmentLevel;
  unit: StainTreatmentUnit;
  price: MoneyString;
}

export interface PostedStainTreatmentDto extends StainTreatmentRateDto {
  id: number;
  orderId: number;
  orderItemId: number;
  quantity: string;
  lineTotal: MoneyString;
  currency: string;
  acknowledgementTextVersion: string | null;
  createdAt: string;
}
