import { quoteInputSchema, type CartLine } from "@shared/storefront";
export function updateCart(lines: CartLine[], item: Omit<CartLine, "count">, delta: number): CartLine[] {
  const index = lines.findIndex(l => l.serviceId === item.serviceId && l.garment === item.garment && l.size === item.size);
  const count = (index < 0 ? 0 : lines[index].count) + delta;
  if (!Number.isInteger(delta) || lines.reduce((n, l) => n + l.count, 0) + delta > 500) return lines;
  if (count < 0 || count > 100 || (index < 0 && lines.length >= 40)) return lines;
  if (!count) return lines.filter((_, i) => i !== index);
  return index < 0 ? [...lines, { ...item, count }] : lines.map((l, i) => i === index ? { ...l, count } : l);
}
export function loadCart(key: string): CartLine[] {
  try { const parsed = quoteInputSchema.safeParse({ lines: JSON.parse(sessionStorage.getItem(key) || "[]") }); return parsed.success ? parsed.data.lines : []; }
  catch { return []; }
}
