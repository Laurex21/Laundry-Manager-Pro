/** Estimates from recorded movements, never a guarantee of future demand. */
export function stockForecast(stock: number, consumed: number, historyDays: number, leadDays = 7, coverDays = 14) {
  const days = Math.min(30, Math.max(0, historyDays));
  if (days < 14 || consumed <= 0 || ![stock, consumed, days, leadDays, coverDays].every(Number.isFinite)) {
    return { dailyUse: null, daysRemaining: null, suggestedQuantity: null, orderNow: false };
  }
  const dailyUse = consumed / days;
  const daysRemaining = Math.max(0, stock) / dailyUse;
  return { dailyUse, daysRemaining, suggestedQuantity: Math.max(0, dailyUse * (leadDays + coverDays) - stock), orderNow: daysRemaining <= leadDays };
}

/** Product purchases already entered as expenses must never be subtracted twice. */
export function cashResult(revenue: number, expenses: number, productCost: number, costBasis: "included" | "separate") {
  return revenue - expenses - (costBasis === "separate" ? productCost : 0);
}
