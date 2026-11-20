import sharp from "sharp";
import { brandingSchema, type StorefrontBranding } from "../../shared/storefront-branding";
import { StorefrontError } from "./storefront-pricing";

export async function sanitizeBranding(raw: unknown, allowedServices: number[], previous?: StorefrontBranding): Promise<StorefrontBranding> {
  const value = brandingSchema.parse(raw);
  if (Object.keys(value.serviceImages).some(id => !allowedServices.includes(Number(id)))) {
    throw new StorefrontError(400, "Les photos doivent correspondre aux services sélectionnés de cette agence.");
  }
  async function raster(data: string, width: number, maxBytes: number, trusted?: string) {
    if (!data) return "";
    // Preserve an unchanged, previously sanitized image without lossy recompression.
    if (trusted && data === trusted) return trusted;
    try {
      const bytes = Buffer.from(data.slice(data.indexOf(",") + 1), "base64");
      const source = sharp(bytes, { limitInputPixels: 16_000_000, animated: false });
      const meta = await source.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format || "") || (meta.pages ?? 1) > 1) throw new Error("invalid raster");
      const clean = await source.rotate().resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 }).toBuffer();
      if (clean.length > maxBytes) throw new Error("image too large");
      return `data:image/webp;base64,${clean.toString("base64")}`;
    } catch {
      throw new StorefrontError(400, "Image invalide ou trop volumineuse. Choisissez une photo JPG, PNG ou WebP plus petite.");
    }
  }
  // Sequential decoding bounds peak memory even for an authenticated large batch.
  const logo = await raster(value.logo, 320, 40_000, previous?.logo);
  const cover = await raster(value.cover, 1200, 125_000, previous?.cover);
  const serviceImages: Record<string, string> = {};
  for (const [id, image] of Object.entries(value.serviceImages)) if (image) serviceImages[id] = await raster(image, 480, 45_000, previous?.serviceImages[id]);
  return brandingSchema.parse({ ...value, logo, cover, serviceImages });
}
