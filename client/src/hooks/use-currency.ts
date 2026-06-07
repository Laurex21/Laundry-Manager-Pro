import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Currency = "FCFA" | "USD" | "NGN" | "EUR" | "ZAR" | "MRU";

interface CurrencyStore {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  getSymbol: () => string;
}

const symbols: Record<Currency, string> = {
  FCFA: "FCFA ",
  USD: "$",
  NGN: "₦",
  EUR: "€",
  ZAR: "R",
  MRU: "UM ",
};
const SUPPORTED_CURRENCIES = new Set<Currency>(["FCFA", "USD", "NGN", "EUR", "ZAR", "MRU"]);

function normalizeCurrency(value: unknown): Currency {
  return typeof value === "string" && SUPPORTED_CURRENCIES.has(value as Currency)
    ? (value as Currency)
    : "FCFA";
}

export const useCurrency = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      currency: "FCFA",
      setCurrency: (currency: Currency) => set({ currency: normalizeCurrency(currency) }),
      getSymbol: () => symbols[normalizeCurrency(get().currency)],
    }),
    {
      name: "currency-storage",
      version: 1,
      migrate: (persisted: any) => ({
        ...persisted,
        currency: normalizeCurrency(persisted?.currency),
      }),
    }
  )
);
