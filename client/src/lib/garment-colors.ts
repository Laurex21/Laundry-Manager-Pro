export const GARMENT_COLORS = [
  { value: "black", swatch: "#111827", family: "neutral", popular: true },
  { value: "white", swatch: "#ffffff", family: "neutral", popular: true },
  { value: "grey", swatch: "#6b7280", family: "neutral", popular: true },
  { value: "light_grey", swatch: "#d1d5db", family: "neutral" },
  { value: "charcoal", swatch: "#374151", family: "neutral" },
  { value: "cream", swatch: "#fff4d6", family: "neutral" },
  { value: "beige", swatch: "#d6c7a1", family: "neutral", popular: true },
  { value: "camel", swatch: "#c19a6b", family: "neutral" },
  { value: "blue", swatch: "#2563eb", family: "blue", popular: true },
  { value: "navy", swatch: "#172554", family: "blue", popular: true },
  { value: "sky_blue", swatch: "#7dd3fc", family: "blue" },
  { value: "royal_blue", swatch: "#1d4ed8", family: "blue" },
  { value: "turquoise", swatch: "#14b8a6", family: "blue" },
  { value: "teal", swatch: "#0f766e", family: "blue" },
  { value: "red", swatch: "#dc2626", family: "warm", popular: true },
  { value: "burgundy", swatch: "#7f1d1d", family: "warm" },
  { value: "coral", swatch: "#fb7185", family: "warm" },
  { value: "orange", swatch: "#ea580c", family: "warm", popular: true },
  { value: "yellow", swatch: "#eab308", family: "warm", popular: true },
  { value: "mustard", swatch: "#ca8a04", family: "warm" },
  { value: "green", swatch: "#16a34a", family: "green", popular: true },
  { value: "dark_green", swatch: "#14532d", family: "green" },
  { value: "olive", swatch: "#78716c", family: "green" },
  { value: "khaki", swatch: "#8a8f52", family: "green" },
  { value: "mint", swatch: "#86efac", family: "green" },
  { value: "lime", swatch: "#84cc16", family: "green" },
  { value: "pink", swatch: "#ec4899", family: "purple", popular: true },
  { value: "light_pink", swatch: "#f9a8d4", family: "purple" },
  { value: "fuchsia", swatch: "#c026d3", family: "purple" },
  { value: "purple", swatch: "#9333ea", family: "purple", popular: true },
  { value: "lavender", swatch: "#c4b5fd", family: "purple" },
  { value: "lilac", swatch: "#d8b4fe", family: "purple" },
  { value: "brown", swatch: "#92400e", family: "brown", popular: true },
  { value: "dark_brown", swatch: "#451a03", family: "brown" },
  { value: "chocolate", swatch: "#713f12", family: "brown" },
  { value: "tan", swatch: "#b45309", family: "brown" },
  { value: "gold", swatch: "#d4a017", family: "brown" },
  { value: "silver", swatch: "#b8c1cc", family: "neutral" },
  { value: "multicolour", swatch: "linear-gradient(135deg,#dc2626 0 25%,#eab308 25% 50%,#16a34a 50% 75%,#2563eb 75%)", family: "special", popular: true },
] as const;

export const GARMENT_COLOR_VALUES = new Set<string>(GARMENT_COLORS.map((color) => color.value));
export const POPULAR_GARMENT_COLORS = GARMENT_COLORS.filter((color) => "popular" in color && color.popular);
export const GARMENT_COLOR_FAMILIES = ["neutral", "blue", "warm", "green", "purple", "brown", "special"] as const;
export function garmentColorSwatch(color?: string | null): string | undefined {
  return GARMENT_COLORS.find((entry) => entry.value === color)?.swatch;
}
