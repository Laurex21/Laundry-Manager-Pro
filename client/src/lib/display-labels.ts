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

const PLAN_FEATURE_KEYS: Record<string, string> = {
  "Client management": "plan_feature_0",
  "Order tracking": "plan_feature_1",
  "Basic dashboard": "plan_feature_2",
  "Basic Employee Module": "plan_feature_3",
  "Basic Machine Module": "plan_feature_4",
  "Everything in Starter": "plan_feature_5",
  "Employee Analytics": "plan_feature_6",
  "Machine Analytics": "plan_feature_7",
  "Reports": "plan_feature_8",
  "Everything in Pro": "plan_feature_9",
  "Advanced Analytics": "plan_feature_10",
  "Smart Recommendations": "plan_feature_11",
  "Performance Scores": "plan_feature_12",
  "Waste detection": "plan_feature_13",
  "Everything in Business": "plan_feature_14",
  "Full Analytics": "plan_feature_15",
  "Predictive Maintenance": "plan_feature_16",
  "Multi-Site Benchmarking": "plan_feature_17",
  "Advanced Intelligence": "plan_feature_18",
  "Custom API access": "plan_feature_19"
};

export function labelForPlanFeature(value: string, t: TFunction): string {
  const key = PLAN_FEATURE_KEYS[value];
  return key ? t(key) : value;
}
