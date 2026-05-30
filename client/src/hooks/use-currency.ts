import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Currency = "XAF" | "USD" | "NGN" | "XOF" | "EUR";

interface CurrencyStore {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  getSymbol: () => string;
}

const symbols: Record<Currency, string> = {
  XAF: "XAF ",
  USD: "$",
  NGN: "₦",
  XOF: "XOF ",
  EUR: "€",
};

export const useCurrency = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      currency: "XAF",
      setCurrency: (currency: Currency) => set({ currency }),
      getSymbol: () => symbols[get().currency],
    }),
    {
      name: "currency-storage",
    }
  )
);
