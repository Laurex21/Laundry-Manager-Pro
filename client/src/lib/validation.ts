import { z } from "zod";
import { en, fr, pt } from "zod/locales";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues } from "react-hook-form";
import i18n from "./i18n";
import { validationLanguage, validationTranslations } from "./validation-translations";

const localeErrors = { en: en().localeError, fr: fr().localeError, pt: pt().localeError };

// Client-only, per validation. Never change Zod's global/server configuration.
export function localizedZodResolver<Input extends FieldValues, Output extends FieldValues>(schema: z.ZodType<Output, Input>) {
  return zodResolver<Input, unknown, Output>(schema, {
    error: issue => {
      const language = validationLanguage(i18n.resolvedLanguage || i18n.language);
      const messages = validationTranslations[language];
      const field = issue.path?.at(-1);
      if (field === "customerId" && issue.code === "invalid_type") return messages.validation_customer;
      if (field === "discountPct" && ["invalid_type", "too_small", "too_big"].includes(issue.code)) return messages.validation_discount;
      if (issue.code === "invalid_type" && issue.input === undefined) return messages.validation_required;
      if (issue.code === "invalid_type" && issue.expected === "number") return messages.validation_number;
      return localeErrors[language](issue);
    },
  });
}
