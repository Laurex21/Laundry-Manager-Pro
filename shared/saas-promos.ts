import { z } from "zod";
export const promoCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/);
export const promoSchema = z.object({
 code: promoCode, kind: z.enum(["percent","fixed"]), value: z.number().int().positive().max(10000000),
 plans: z.array(z.enum(["pro","business"])).min(1).max(2),
 startsAt: z.string().datetime(), endsAt: z.string().datetime(),
 maxUses: z.number().int().positive().max(1000000), firstOnly: z.boolean().default(true),
 representativeId: z.number().int().positive().nullable().default(null),
}).strict().refine(v=>new Date(v.endsAt)>new Date(v.startsAt),"Invalid period")
.refine(v=>v.kind!=="percent" || v.value<100,"Percentage must be below 100");
export type PromoSnapshot={id:number;code:string;discountXaf:number;originalXaf:number;representativeId:number|null};
