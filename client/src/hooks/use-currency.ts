import { create } from "zustand";
import { persist } from "zustand/middleware";
import { currencyPrefix, DEFAULT_CURRENCY, normalizeCurrency, type Currency } from "@/lib/currency-registry";

export type { Currency } from "@/lib/currency-registry";

interface CurrencyStore {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  getSymbol: () => string;
}

export const useCurrency = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      currency: DEFAULT_CURRENCY,
      setCurrency: (currency: Currency) => set({ currency: normalizeCurrency(currency) }),
      getSymbol: () => currencyPrefix(normalizeCurrency(get().currency)),
    }),
    {
      name: "currency-storage",
      version: 2,
      migrate: (persisted: any) => ({
        ...persisted,
        currency: normalizeCurrency(persisted?.currency),
      }),
    }
  )
);
