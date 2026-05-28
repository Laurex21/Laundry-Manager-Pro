import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Currency = "USD" | "NGN" | "XOF" | "EUR";

interface CurrencyStore {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  getSymbol: () => string;
}

const symbols: Record<Currency, string> = {
  USD: "$",
  NGN: "₦",
  XOF: "FCFA",
  EUR: "€",
};

export const useCurrency = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      currency: "USD",
      setCurrency: (currency: Currency) => set({ currency }),
      getSymbol: () => symbols[get().currency],
    }),
    {
      name: "currency-storage",
    }
  )
);
