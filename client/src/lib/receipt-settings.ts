export interface ReceiptSettings {
  businessName: string;
  tagline?: string | null;
  logoBase64?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  phone2?: string | null;
  email?: string | null;
  website?: string | null;
  receiptHeaderColor: string;
  receiptLanguage: string;
  showLogo: boolean;
  showPickupDate: boolean;
  showGarmentList: boolean;
  showPaymentHistory: boolean;
  showTerms: boolean;
  termsOfService?: string | null;
  receiptFooterNote?: string | null;
}

export const DEFAULT_SETTINGS: ReceiptSettings = {
  businessName: "XpressPro",
  tagline: "Laundry Management",
  logoBase64: null,
  address: "",
  city: "",
  country: "",
  phone: "",
  phone2: "",
  email: "",
  website: "",
  receiptHeaderColor: "#1e3a5f",
  receiptLanguage: "en",
  showLogo: true,
  showPickupDate: true,
  showGarmentList: true,
  showPaymentHistory: true,
  showTerms: true,
  termsOfService: null,
  receiptFooterNote: "Thank you for your trust · Merci de votre confiance · Obrigado pela confiança",
};

export const DEFAULT_TERMS_EN = `Liability: Our liability for any lost or damaged garment shall not exceed 3x the cleaning cost of that item.
Pocket Policy: Customers are responsible for emptying all pockets. We are not liable for items left in pockets.
Unclaimed Items: Items not collected within 30 days may incur storage fees. Items left 90+ days will be donated.
Pre-existing Damage: We reserve the right to refuse service for items with significant pre-existing wear.
Stains: We cannot guarantee 100% stain removal. Some stains are permanent.
Claims: Any claims must be made within 24 hours of pickup with the original receipt.`;

export const DEFAULT_TERMS_FR = `Responsabilité : Notre responsabilité pour tout vêtement perdu ou endommagé ne dépassera pas 3 fois le coût de nettoyage de l'article concerné.
Poches : Les clients sont responsables de vider toutes les poches avant le dépôt. Nous ne sommes pas responsables des dommages causés par des objets laissés dans les poches.
Articles non réclamés : Les articles non récupérés dans les 30 jours suivant la date "Prêt" peuvent faire l'objet de frais de stockage. Après 90 jours, ils seront donnés ou jetés.
Dommages préexistants : Nous nous réservons le droit de refuser les articles présentant une usure importante.
Taches : Nous ne pouvons garantir l'élimination à 100% de toutes les taches. Certaines sont permanentes.
Réclamations : Toute réclamation doit être faite dans les 24h après la livraison/retrait, accompagnée du reçu original.`;

export const DEFAULT_TERMS_PT = `Responsabilidade: A nossa responsabilidade por qualquer peça perdida ou danificada não excederá 3 vezes o custo de limpeza dessa peça.
Bolsos: Os clientes são responsáveis por esvaziar todos os bolsos antes da entrega. Não nos responsabilizamos por itens deixados nos bolsos.
Itens não reclamados: Itens não recolhidos até 30 dias após a data de "Pronto" podem estar sujeitos a taxas de armazenamento. Após 90 dias, poderão ser doados ou descartados.
Danos pré-existentes: Reservamo-nos o direito de recusar peças com desgaste significativo pré-existente.
Manchas: Não garantimos a remoção de 100% das manchas. Algumas manchas são permanentes.
Reclamações: Qualquer reclamação deve ser feita até 24 horas após a entrega/recolha, com o recibo original.`;

export function getDefaultTerms(lang: string): string {
  if (lang === "fr") return DEFAULT_TERMS_FR;
  if (lang === "pt") return DEFAULT_TERMS_PT;
  if (lang === "both") return `${DEFAULT_TERMS_EN}\n\n---\n\n${DEFAULT_TERMS_FR}`;
  if (lang === "all") return `${DEFAULT_TERMS_EN}\n\n---\n\n${DEFAULT_TERMS_FR}\n\n---\n\n${DEFAULT_TERMS_PT}`;
  return DEFAULT_TERMS_EN;
}

const RECEIPT_PT_LABELS: Record<string, string> = {
  "Laundry Service": "Serviço de Lavandaria",
  "Thank you for your trust": "Obrigado pela confiança",
  "Receipt generated on": "Recibo gerado em",
  "Deposit Receipt": "Recibo de Depósito",
  "Payment Receipt": "Recibo de Pagamento",
  "Order No.": "Nº do Pedido",
  "Customer": "Cliente",
  "Order Date": "Data do Pedido",
  "Receipt Date": "Data do Recibo",
  "Phone": "Telefone",
  "Expected Pickup": "Recolha Prevista",
  "Order Pipeline Tracker": "Acompanhamento do Pedido",
  "Service Summary": "Resumo dos Serviços",
  "Service Name": "Serviço",
  "Service": "Serviço",
  "Qty": "Qtd",
  "Price": "Preço",
  "Garment Checklist": "Lista de Peças",
  "For inventory verification only.": "Apenas para verificação de inventário.",
  "Totals": "Totais",
  "Subtotal": "Subtotal",
  "Discount": "Desconto",
  "Total Amount": "Valor Total",
  "Total Paid": "Total Pago",
  "Balance Due": "Saldo em Aberto",
  "Payment Records": "Registros de Pagamento",
  "Payment History": "Histórico de Pagamentos",
  "Terms & Conditions": "Termos e Condições",
  "This Payment": "Este Pagamento",
  "Method": "Método",
  "Order Total": "Total do Pedido",
};

export function label(en: string, fr: string, lang: string): string {
  if (lang === "fr") return fr;
  if (lang === "both") return `${fr} / ${en}`;
  if (lang === "pt") return RECEIPT_PT_LABELS[en] || en;
  if (lang === "all") return `${fr} / ${en} / ${RECEIPT_PT_LABELS[en] || en}`;
  return en;
}
