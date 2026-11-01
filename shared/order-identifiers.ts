export type OrderIdentifierSource = {
  legacyOrderNumber?: number | string | null;
  orderNumber?: number | string | null;
  orderReference?: string | null;
  id?: number | string | null;
} | number | string | null | undefined;

function numeric(value: unknown): string {
  const text = String(value ?? '');
  return /^[1-9]\d*$/.test(text) ? text : '';
}

/** The classic number is the historical sequence within a site, not the global database ID. */
export function classicOrderNumber(source: OrderIdentifierSource): string {
  if (source == null) return '';
  if (typeof source !== 'object') return numeric(source);
  const known = numeric(source.legacyOrderNumber) || numeric(source.orderNumber);
  if (known) return known;
  // Older payloads without an assigned reference used their numeric ID as a fallback.
  return !source.orderReference && !source.orderNumber ? numeric(source.id) : '';
}

export function appendClassicOrderNumber(primary: number | string, source: OrderIdentifierSource): string {
  const code = String(primary ?? '');
  const classic = classicOrderNumber(source);
  return classic && classic !== code ? `${code} · N° ${classic}` : code;
}
