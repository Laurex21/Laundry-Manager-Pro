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
  businessName: "CleanEase",
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
  receiptFooterNote: "Thank you for your trust · Merci de votre confiance",
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

export function getDefaultTerms(lang: string): string {
  if (lang === "fr") return DEFAULT_TERMS_FR;
  if (lang === "both") return `${DEFAULT_TERMS_EN}\n\n---\n\n${DEFAULT_TERMS_FR}`;
  return DEFAULT_TERMS_EN;
}

export function label(en: string, fr: string, lang: string): string {
  if (lang === "fr") return fr;
  if (lang === "both") return `${fr} / ${en}`;
  return en;
}
