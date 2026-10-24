export const validationTranslations = {
  fr: {
    validation_customer_name: "Saisissez le nom du client.",
    validation_required: "Ce champ est obligatoire.",
    validation_customer: "Sélectionnez un client.",
    validation_service: "Sélectionnez un service.",
    validation_quantity: "Saisissez une quantité supérieure à zéro.",
    validation_advance: "Saisissez un acompte valide, supérieur ou égal à zéro.",
    validation_discount: "La remise doit être comprise entre 0 et 100 %.",
    validation_number: "Saisissez un nombre valide.",
    whole_quantity_required: "Une quantité entière est requise pour un service à la pièce.",
    invalid_quantity: "Quantité invalide",
    subtotal: "Sous-total",
  },
  en: {
    validation_customer_name: "Enter the customer’s name.",
    validation_required: "This field is required.",
    validation_customer: "Select a customer.",
    validation_service: "Select a service.",
    validation_quantity: "Enter a quantity greater than zero.",
    validation_advance: "Enter a valid advance payment of zero or more.",
    validation_discount: "The discount must be between 0 and 100%.",
    validation_number: "Enter a valid number.",
    whole_quantity_required: "A whole quantity is required for a service charged per item.",
    invalid_quantity: "Invalid quantity",
    subtotal: "Subtotal",
  },
  pt: {
    validation_customer_name: "Introduza o nome do cliente.",
    validation_required: "Este campo é obrigatório.",
    validation_customer: "Selecione um cliente.",
    validation_service: "Selecione um serviço.",
    validation_quantity: "Introduza uma quantidade superior a zero.",
    validation_advance: "Introduza um adiantamento válido, igual ou superior a zero.",
    validation_discount: "O desconto deve estar entre 0 e 100%.",
    validation_number: "Introduza um número válido.",
    whole_quantity_required: "É necessária uma quantidade inteira para um serviço cobrado por peça.",
    invalid_quantity: "Quantidade inválida",
    subtotal: "Subtotal",
  },
};

export function validationLanguage(language?: string) {
  const code = language?.toLowerCase().split("-")[0];
  return code === "fr" || code === "pt" ? code : "en";
}

type MessageKey = keyof typeof validationTranslations.en;
const schemaMessages: Record<string, MessageKey> = {
  "Customer name is required": "validation_customer_name",
  "Please select a service": "validation_service",
  "Quantity must be greater than 0": "validation_quantity",
  "Advance payment must be a non-negative amount": "validation_advance",
};

// These schema-level messages have priority over Zod's per-parse error map.
// Also recognise translated messages so existing visible errors follow FR / EN.
export function translateValidationMessage(message: string, language?: string) {
  let key: MessageKey | undefined = schemaMessages[message];
  if (!key) {
    for (const translation of Object.values(validationTranslations)) {
      key = (Object.keys(translation) as MessageKey[]).find(k => translation[k] === message);
      if (key) break;
    }
  }
  return key ? validationTranslations[validationLanguage(language)][key] : message;
}
