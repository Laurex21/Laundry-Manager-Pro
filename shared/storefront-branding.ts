import { z } from "zod";

// Raster images only. Re-encoded on the server before persistence; no remote URLs.
const image = z.string().max(180_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).or(z.literal(""));
export const brandingSchema = z.object({
  template: z.enum(["classic", "soft", "editorial"]).default("classic"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#125d4e"),
  welcome: z.string().trim().max(100).default("Du linge frais. Du temps pour vous."),
  logo: image.default(""), cover: image.default(""),
  serviceImages: z.record(z.string().regex(/^[1-9]\d*$/), image).default({})
    .refine(v => Object.keys(v).length <= 12, "12 photos de services maximum"),
}).refine(v => JSON.stringify(v).length <= 650_000, "Les images sont trop volumineuses. Réduisez leur nombre ou leur taille.");
export type StorefrontBranding = z.infer<typeof brandingSchema>;
export const DEFAULT_BRANDING: StorefrontBranding = brandingSchema.parse({});
export const BRAND_PRESETS = [
  { name: "Nature", template: "classic", accent: "#125d4e" },
  { name: "Douceur", template: "soft", accent: "#92513c" },
  { name: "Élégance", template: "editorial", accent: "#34365f" },
] as const;
export function accentForeground(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  return luminance > .179 ? "#101820" : "#ffffff";
}
