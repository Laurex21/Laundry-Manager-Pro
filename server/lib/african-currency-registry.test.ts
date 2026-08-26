import assert from "node:assert/strict";
import {
  CURRENCIES,
  currencyByCode,
  currencyName,
  currencyPrefix,
  normalizeCurrency,
} from "../../client/src/lib/currency-registry";

const africanCodes = CURRENCIES.filter(({ code }) => !["USD", "EUR"].includes(code));

assert.equal(africanCodes.length, 42, "all 42 principal African currencies must be available");
assert.equal(new Set(CURRENCIES.map(({ code }) => code)).size, CURRENCIES.length, "currency codes must be unique");
assert.equal(currencyByCode("XAF").symbol, "FCFA");
assert.equal(currencyByCode("XOF").symbol, "FCFA");
assert.equal(currencyName("XAF", "fr"), "Franc CFA — Afrique centrale");
assert.equal(currencyName("XOF", "fr"), "Franc CFA — Afrique de l’Ouest");
assert.equal(currencyPrefix("KES"), "KSh ");
assert.equal(currencyPrefix("NAD"), "N$ ");
assert.equal(currencyPrefix("ZWG"), "ZiG ");
assert.equal(normalizeCurrency("FCFA"), "XAF", "legacy FCFA preferences must migrate safely");
assert.equal(normalizeCurrency("KES"), "KES");
assert.equal(normalizeCurrency("invalid"), "XAF");

for (const currency of CURRENCIES) {
  assert.ok(currency.symbol.trim(), `${currency.code} needs a familiar display symbol`);
  assert.ok(currency.names.en && currency.names.fr && currency.names.pt, `${currency.code} needs all UI languages`);
}

console.log("African currency registry regression tests passed");
