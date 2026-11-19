import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useQuery } from "@tanstack/react-query";
import type { AuthUser } from "./use-auth";
import { currencyPrefix, DEFAULT_CURRENCY, normalizeCurrency, type Currency } from "@/lib/currency-registry";

export type { Currency } from "@/lib/currency-registry";

interface CurrencyStore {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  getSymbol: () => string;
}

const useCurrencyPreference = create<CurrencyStore>()(
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

type EffectiveCurrency = CurrencyStore & { locked: boolean };
export function useCurrency<T = EffectiveCurrency>(selector?: (state: EffectiveCurrency) => T): T {
  const preference = useCurrencyPreference();
  // Read the shared authentication cache; the app owns loading and invalidation.
  const { data: user } = useQuery<AuthUser | null>({ queryKey: ["/api/auth/user"], enabled: false });
  const locked = !!user?.storefrontCurrency;
  const currency = locked ? normalizeCurrency(user?.storefrontCurrency) : preference.currency;
  const state: EffectiveCurrency = { currency, locked, getSymbol: () => currencyPrefix(currency), setCurrency: (next: Currency) => { if (!locked) preference.setCurrency(next); } };
  return selector ? selector(state) : state as T;
}
