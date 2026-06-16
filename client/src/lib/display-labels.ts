import type { TFunction } from "i18next";

const CATEGORY_KEYS: Record<string, string> = {
  supplies: "cat_supplies",
  water: "cat_water",
  electricity: "cat_electricity",
  detergent: "cat_detergent",
  rent: "cat_rent",
  salary: "cat_salary",
  utilities: "cat_utilities",
  maintenance: "cat_maintenance",
  transportation: "cat_transportation",
  other: "cat_other",
  "dry clean": "service_category_dry_clean",
  dry_clean: "service_category_dry_clean",
  "dry cleaning": "service_category_dry_clean",
  dry_cleaning: "service_category_dry_clean",
  laundry: "service_category_laundry",
  pressing: "service_category_pressing",
  ironing: "service_category_ironing",
  washing: "service_category_washing",
};

const STATUS_KEYS: Record<string, string> = {
  received: "stage_received",
  pending: "stage_received",
  sorting: "stage_sorting",
  washing: "stage_washing",
  processing: "stage_washing",
  stain_treatment: "stage_stain_treatment",
  drying: "stage_drying",
  ironing: "stage_ironing",
  packaging: "stage_packaging",
  ready: "stage_ready",
  delivered: "stage_delivered",
  cancelled: "cancelled",
  paid: "paid",
  unpaid: "unpaid",
  partial: "partial",
};

export function labelForCategory(value: string | null | undefined, t: TFunction): string {
  if (!value) return t("uncategorized");
  const key = CATEGORY_KEYS[value.trim().toLowerCase()];
  return key ? t(key) : value;
}

export function labelForStatus(value: string | null | undefined, t: TFunction): string {
  if (!value) return t("unknown");
  const key = STATUS_KEYS[value.trim().toLowerCase()];
  return key ? t(key) : value;
}
