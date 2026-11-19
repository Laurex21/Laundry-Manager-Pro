import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCurrency } from "../hooks/use-currency";

Object.assign(globalThis, { React });
globalThis.fetch = async () => { throw new Error("NETWORK_FORBIDDEN"); };
function ReceiptCurrency() {
  const currency = useCurrency();
  assert.equal(useCurrency(state => state.currency), currency.currency);
  return <span>{currency.currency}|{currency.getSymbol()}|{String(currency.locked)}</span>;
}
const cache = new QueryClient();
const render = () => renderToStaticMarkup(<QueryClientProvider client={cache}><ReceiptCurrency /></QueryClientProvider>);
for (const role of ["owner", "manager", "operator"]) {
  cache.setQueryData(["/api/auth/user"], { role, storefrontCurrency: "EUR" });
  assert.match(render(), /EUR\|€ \|true/);
}
cache.setQueryData(["/api/auth/user"], { role: "owner", currentSite: null, storefrontCurrency: "XOF" });
assert.match(render(), /XOF\|FCFA \|true/);
cache.setQueryData(["/api/auth/user"], { storefrontCurrency: null });
assert.match(render(), /XAF\|FCFA \|false/);
cache.setQueryData(["/api/auth/user"], null);
assert.match(render(), /XAF\|FCFA \|false/);
cache.clear();
console.log("PASS storefront currency: staff, owner, consolidated view, organisation change and logout.");
