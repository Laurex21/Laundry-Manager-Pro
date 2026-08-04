export const GARMENT_COLORS = [
  { value: "black", swatch: "#111827" }, { value: "white", swatch: "#ffffff" },
  { value: "grey", swatch: "#6b7280" }, { value: "blue", swatch: "#2563eb" },
  { value: "navy", swatch: "#172554" }, { value: "red", swatch: "#dc2626" },
  { value: "green", swatch: "#16a34a" }, { value: "yellow", swatch: "#eab308" },
  { value: "brown", swatch: "#92400e" }, { value: "beige", swatch: "#d6c7a1" },
  { value: "pink", swatch: "#ec4899" }, { value: "purple", swatch: "#9333ea" },
  { value: "orange", swatch: "#ea580c" },
  { value: "multicolour", swatch: "linear-gradient(135deg,#dc2626 0 25%,#eab308 25% 50%,#16a34a 50% 75%,#2563eb 75%)" },
] as const;

export const GARMENT_COLOR_VALUES = new Set<string>(GARMENT_COLORS.map((color) => color.value));
export function garmentColorSwatch(color?: string | null): string | undefined {
  return GARMENT_COLORS.find((entry) => entry.value === color)?.swatch;
}
