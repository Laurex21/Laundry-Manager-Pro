// PostgreSQL decimals are strings: display useful precision without trailing zeros.
export function receiptQuantity(value: unknown, lang: string): string {
  const quantity = Number(value ?? 0);
  return Number.isFinite(quantity)
    ? quantity.toLocaleString(lang.startsWith("fr") ? "fr-FR" : lang.startsWith("pt") ? "pt-PT" : "en-GB", { maximumFractionDigits: 6, useGrouping: false })
    : "0";
}

