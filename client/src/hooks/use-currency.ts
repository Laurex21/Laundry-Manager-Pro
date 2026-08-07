import { useAuth } from "./use-auth";

export type Currency = string;

const symbols: Record<string, string> = { FCFA: "FCFA", XAF: "FCFA", EUR: "€", USD: "$", GBP: "£", ZAR: "R" };

export function formatCurrency(value: number | string, currency = "FCFA") {
  const normalized = String(currency || "FCFA").toUpperCase();
  const amount = typeof value === "number" ? value : Number(value);
  return `${Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"} ${symbols[normalized] ?? normalized}`;
}

/** Formatter/cache only: the authenticated organisation is authoritative. */
export function useCurrency() {
  const { user } = useAuth() as { user?: { currency?: string } | null };
  const currency = String(user?.currency || "FCFA").toUpperCase();
  return { currency, getSymbol: () => symbols[currency] ?? currency, format: (value: number | string) => formatCurrency(value, currency) };
}
