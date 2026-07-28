export const EXPENSE_CATEGORIES = [
  { value: "rent", labelKey: "cat_rent", color: "#F97316", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  { value: "salary", labelKey: "cat_salary", color: "#22C55E", badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  { value: "electricity", labelKey: "cat_electricity", color: "#EAB308", badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  { value: "water", labelKey: "cat_water", color: "#3B82F6", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "detergent", labelKey: "cat_detergent", color: "#8B5CF6", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "transportation", labelKey: "cat_transportation", color: "#14B8A6", badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
  { value: "maintenance", labelKey: "cat_maintenance", color: "#EF4444", badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { value: "supplies", labelKey: "cat_supplies", color: "#6366F1", badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  { value: "utilities", labelKey: "cat_utilities", color: "#64748B", badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { value: "other", labelKey: "cat_other", color: "#9CA3AF", badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];

const CATEGORY_ALIASES: Record<string, ExpenseCategory> = {
  loyer: "rent",
  salaire: "salary",
  salaires: "salary",
  electricite: "electricity",
  "électricité": "electricity",
  elec: "electricity",
  eau: "water",
  detergent: "detergent",
  "détergent": "detergent",
  transport: "transportation",
  fournitures: "supplies",
  fourniture: "supplies",
  "services publics": "utilities",
  services_pub: "utilities",
  services_publics: "utilities",
  autre: "other",
};

export function normalizeExpenseCategory(value?: string | null): ExpenseCategory {
  const normalized = value?.trim().toLocaleLowerCase() || "other";
  const exact = EXPENSE_CATEGORIES.find((category) => category.value === normalized);
  return exact?.value ?? CATEGORY_ALIASES[normalized] ?? "other";
}

export function expenseCategoryConfig(value?: string | null) {
  const normalized = normalizeExpenseCategory(value);
  return EXPENSE_CATEGORIES.find((category) => category.value === normalized)!;
}
