import assert from "node:assert/strict";
import { z } from "zod";
import i18n from "./i18n";
import { localizedZodResolver } from "./validation";
import { translateValidationMessage, validationTranslations, validationLanguage } from "./validation-translations";
import { insertCustomerSchema } from "../../../shared/schema";
import { orderFormTranslations } from "./order-form-translations";
import { createOrderWithItemsSchema } from "../../../shared/routes";

const options = { criteriaMode: "firstError" as const, fields: {}, shouldUseNativeValidation: false };
const resolver = localizedZodResolver(createOrderWithItemsSchema);
const valid = { customerId: 1, discountPct: "12.5", items: [{ serviceId: 2, quantity: "2" }] };
const baseline = z.number().safeParse(undefined);
assert.equal(baseline.success, false);

for (const language of ["fr-FR", "en-GB", "pt-PT"]) {
  await i18n.changeLanguage(language);
  const lang = validationLanguage(language);
  const messages = validationTranslations[lang];
  assert.equal(i18n.t("subtotal"), messages.subtotal);
  const missingCustomer = await resolver({ ...valid, customerId: undefined! }, undefined, options);
  assert.equal(missingCustomer.errors.customerId?.message, messages.validation_customer);
  for (const discountPct of [-1, 101, "not a number"]) {
    const result = await resolver({ ...valid, discountPct }, undefined, options);
    assert.equal(result.errors.discountPct?.message, messages.validation_discount);
    assert.deepEqual(result.values, {});
  }
  const badService = await resolver({ ...valid, items: [{ serviceId: 0, quantity: "2" }] }, undefined, options);
  assert.equal(translateValidationMessage(String(badService.errors.items?.[0]?.serviceId?.message), language), messages.validation_service);
  const badQuantity = await resolver({ ...valid, items: [{ serviceId: 2, quantity: "bad" }] }, undefined, options);
  assert.equal(translateValidationMessage(String(badQuantity.errors.items?.[0]?.quantity?.message), language), messages.validation_quantity);
  const badAdvance = await resolver({ ...valid, advancePayment: "negative" }, undefined, options);
  assert.equal(translateValidationMessage(String(badAdvance.errors.advancePayment?.message), language), messages.validation_advance);
  const missingItems = await resolver({ customerId: 1, items: undefined! }, undefined, options);
  assert.equal(missingItems.errors.items?.message, messages.validation_required);
  const good = await resolver(valid, undefined, options);
  assert.deepEqual(good.errors, {});
  assert.deepEqual(good.values, createOrderWithItemsSchema.parse(valid), "Messages never change the validated values");
}

// Existing errors and manual piece-quantity errors follow a language change.
assert.equal(translateValidationMessage(validationTranslations.fr.validation_discount, "en"), validationTranslations.en.validation_discount);
assert.equal(translateValidationMessage(validationTranslations.fr.whole_quantity_required, "en"), validationTranslations.en.whole_quantity_required);
assert.equal(translateValidationMessage("Specific domain message", "fr"), "Specific domain message");
const unchanged = z.number().safeParse(undefined);
assert.equal(unchanged.success, false);
if (!baseline.success && !unchanged.success) assert.equal(unchanged.error.issues[0].message, baseline.error.issues[0].message, "No global or server error-map change");
console.log("PASS validation FR/EN/PT: missing selection, percentage bounds, custom schema messages, defaults, unchanged values and live message translation");

for (const name of ["", " ", "\t\n"]) {
  assert.equal(insertCustomerSchema.safeParse({ name }).success, false);
  assert.equal(insertCustomerSchema.partial().safeParse({ name }).success, false);
}
assert.equal(insertCustomerSchema.parse({ name: "  Client QA  ", phone: "", address: "" }).name, "Client QA");
assert.equal(insertCustomerSchema.partial().safeParse({ address: "QA" }).success, true);
for (const lang of ["fr", "en", "pt"] as const) {
  await i18n.changeLanguage(lang);
  for (const [key, value] of Object.entries(orderFormTranslations[lang])) assert.equal(i18n.t(key), value);
  const result = await localizedZodResolver(insertCustomerSchema)({ name: "  ", phone: "", address: "" }, undefined, options);
  assert.equal(translateValidationMessage(String(result.errors.name?.message), lang), validationTranslations[lang].validation_customer_name);
}
console.log("PASS empty/whitespace customer rejected, optional phone retained, partial update preserved, wizard translations FR/EN/PT");
