import { useState, useMemo } from "react";
import { useExpenditures, useCreateExpenditure } from "@/hooks/use-expenditures";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExpenditureSchema, type Expenditure } from "@shared/schema";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, TrendingDown, Calendar, Filter, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subDays, isWithinInterval, startOfYear } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { labelForCategory } from "@/lib/display-labels";

function dateLocaleFor(language: string) {
  if (language.startsWith("fr")) return fr;
  if (language.startsWith("pt")) return pt;
  return enUS;
}

const COLORS = ["#3b82f6", "#f97316", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

const EXPENSE_TYPE_KEYS = [
  { key: "water", labelKey: "cat_water", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { key: "electricity", labelKey: "cat_electricity", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  { key: "detergent", labelKey: "cat_detergent", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  { key: "rent", labelKey: "cat_rent", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  { key: "salary", labelKey: "cat_salary", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { key: "other", labelKey: "cat_other", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
];

const CUSTOM_CATEGORY_COLOR = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

const DEFAULT_EXPENSE_CATEGORIES = [
  "supplies",
  "water",
  "electricity",
  "detergent",
  "rent",
  "salary",
  "utilities",
  "maintenance",
  "transportation",
  "other",
] as const;

function categorySelectValue(category?: string | null) {
  const value = category?.trim();
  if (!value) return "supplies";

  const normalized = value.toLowerCase();
  if (DEFAULT_EXPENSE_CATEGORIES.includes(normalized as typeof DEFAULT_EXPENSE_CATEGORIES[number])) {
    return normalized;
  }

  return value;
}

function normalizedCategory(category?: string | null) {
  return category?.trim().toLowerCase() || "uncategorized";
}

function getCategoryDisplay(category: string, t: ReturnType<typeof useTranslation>["t"]) {
  const key = normalizedCategory(category);
  const typeInfo = EXPENSE_TYPE_KEYS.find((et) => et.key === key);

  return {
    key,
    label: typeInfo ? t(typeInfo.labelKey) : labelForCategory(category, t),
    color: typeInfo?.color || CUSTOM_CATEGORY_COLOR,
  };
}

export default function Expenses() {
  const { data: expenditures, isLoading } = useExpenditures();
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expenditure | null>(null);
  const [dateFilter, setDateFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const { t, i18n } = useTranslation();
  const { getSymbol } = useCurrency();
  const symbol = getSymbol();

  const filteredExpenditures = useMemo(() => {
    if (!expenditures) return [];
    const now = new Date();
    return expenditures.filter((exp) => {
      const expDate = new Date(exp.date!);
      if (dateFilter === "7days" && !isWithinInterval(expDate, { start: subDays(now, 7), end: now })) return false;
      if (dateFilter === "30days" && !isWithinInterval(expDate, { start: subDays(now, 30), end: now })) return false;
      if (dateFilter === "thisYear" && !isWithinInterval(expDate, { start: startOfYear(now), end: now })) return false;
      if (typeFilter !== "all" && exp.category.toLowerCase() !== typeFilter) return false;
      return true;
    });
  }, [expenditures, dateFilter, typeFilter]);

  const typeBreakdown = useMemo(() => {
    if (!expenditures) return [];
    const map: Record<string, { category: string; total: number }> = {};
    expenditures.forEach((exp) => {
      const category = exp.category?.trim() || t("uncategorized");
      const key = normalizedCategory(category);
      map[key] = {
        category: map[key]?.category || category,
        total: (map[key]?.total || 0) + Number(exp.amount),
      };
    });
    return Object.entries(map)
      .map(([key, value]) => ({ key, category: value.category, total: value.total }))
      .sort((a, b) => b.total - a.total);
  }, [expenditures, t]);

  const chartData = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredExpenditures.forEach((exp) => {
      categories[exp.category] = (categories[exp.category] || 0) + Number(exp.amount);
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0);
  }, [filteredExpenditures]);

  const totalFilteredExpenses = filteredExpenditures.reduce((sum, item) => sum + Number(item.amount), 0);

  const expenseCategoryOptions = useMemo(() => {
    const categories = new Map<string, string>();

    DEFAULT_EXPENSE_CATEGORIES.forEach((category) => {
      categories.set(category.toLowerCase(), category);
    });

    expenditures?.forEach((expense) => {
      const category = expense.category?.trim();
      if (category) {
        const key = category.toLowerCase();
        if (!categories.has(key)) {
          categories.set(key, category);
        }
      }
    });

    return Array.from(categories.values());
  }, [expenditures]);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="text-expenses-title">{t("expenses")}</h1>
          <p className="text-muted-foreground mt-1">{t("expenses_subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingExpense(null); }}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all" data-testid="button-log-expense">
              <Plus className="w-4 h-4 mr-2" /> {t("log_expense")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingExpense ? t("edit_expense") : t("log_new_expense")}</DialogTitle>
            </DialogHeader>
            <ExpenseForm
              onSuccess={() => { setOpen(false); setEditingExpense(null); }}
              expense={editingExpense}
              categoryOptions={expenseCategoryOptions}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[150px] h-8 text-sm" data-testid="select-date-filter">
            <SelectValue placeholder={t("filter_by_date")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_time")}</SelectItem>
            <SelectItem value="7days">{t("last_7_days")}</SelectItem>
            <SelectItem value="30days">{t("last_30_days")}</SelectItem>
            <SelectItem value="thisYear">{t("this_year")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 flex-wrap" data-testid="expense-filter-tabs">
          <button
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${typeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            onClick={() => setTypeFilter("all")}
            data-testid="filter-tab-all"
          >
            {t("all")}
          </button>
          {EXPENSE_TYPE_KEYS.map((et) => (
            <button
              key={et.key}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${typeFilter === et.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              onClick={() => setTypeFilter(typeFilter === et.key ? "all" : et.key)}
              data-testid={`filter-tab-${et.key}`}
            >
              {t(et.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {typeBreakdown.length > 0 && (
        <div className="flex gap-2 flex-wrap" data-testid="expense-type-breakdown">
          {typeBreakdown.map(({ key, category, total }) => {
            const categoryDisplay = getCategoryDisplay(category, t);
            const active = typeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setTypeFilter(active ? "all" : key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${active ? "ring-2 ring-primary ring-offset-1" : "hover:opacity-80"} ${categoryDisplay.color}`}
                data-testid={`card-type-${key}`}
              >
                <span>{categoryDisplay.label}</span>
                <span className="font-mono">{symbol}{total.toFixed(0)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{t("expense_history")}</span>
            {filteredExpenditures.length > 0 && (
              <span className="text-xs text-muted-foreground">{filteredExpenditures.length} {t("entries")}</span>
            )}
          </div>
          {isLoading ? (
            <div className="text-muted-foreground text-sm">{t("loading")}</div>
          ) : filteredExpenditures.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl text-sm">
              {t("no_data_for_period")}
            </div>
          ) : (
            <div className="divide-y divide-border border rounded-lg overflow-hidden">
              {filteredExpenditures.map((item) => {
                const categoryDisplay = getCategoryDisplay(item.category, t);
                return (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors" data-testid={`row-expense-${item.id}`}>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${categoryDisplay.color}`}>
                      {categoryDisplay.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(item.date!), "MMM d", { locale: dateLocaleFor(i18n.language) })}</span>
                    </div>
                    <span className="font-mono text-sm font-semibold text-orange-600 dark:text-orange-400 shrink-0">
                      -{symbol}{Number(item.amount).toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => { setEditingExpense(item); setOpen(true); }}
                      data-testid={`button-edit-expense-${item.id}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("period_spending")}</span>
              <TrendingDown className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-mono font-bold text-orange-600 dark:text-orange-400">
              {symbol}{totalFilteredExpenses.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t("based_on_filter")}</p>
          </div>

          <Card className="shadow-sm border-border/50 overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t("spending_breakdown")}</CardTitle></CardHeader>
            <CardContent className="h-[260px] flex items-center justify-center p-0">
              {totalFilteredExpenses === 0 ? (
                <div className="text-center p-6 text-muted-foreground text-sm">{t("no_data_for_period")}</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="45%" innerRadius={50} outerRadius={72} paddingAngle={5} dataKey="value">
                      {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${symbol}${value.toFixed(2)}`, t("amount")]}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    />
                    <Legend verticalAlign="bottom" align="center" layout="horizontal" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const expenseFormSchema = insertExpenditureSchema.extend({
  date: z.string().optional(),
});
type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

function ExpenseForm({
  onSuccess,
  expense,
  categoryOptions,
}: {
  onSuccess: () => void;
  expense?: Expenditure | null;
  categoryOptions: string[];
}) {
  const { t } = useTranslation();
  const { mutate: createMutate, isPending: createPending } = useCreateExpenditure();
  const queryClient = useQueryClient();
  const [customCategory, setCustomCategory] = useState(false);
  const isEdit = !!expense;

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: expense ? expense.amount : "0",
      category: expense ? categorySelectValue(expense.category) : "supplies",
      description: expense ? expense.description : "",
      date: expense?.date ? format(new Date(expense.date as any), "yyyy-MM-dd") : todayStr,
    },
    values: expense ? {
      amount: expense.amount,
      category: categorySelectValue(expense.category),
      description: expense.description,
      date: expense.date ? format(new Date(expense.date as any), "yyyy-MM-dd") : todayStr,
    } : undefined,
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/expenditures/${expense!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenditures"] });
      form.reset();
      onSuccess();
    },
  });

  function onSubmit(data: ExpenseFormValues) {
    if (isEdit) {
      editMutation.mutate(data);
    } else {
      createMutate(data as any, {
        onSuccess: () => {
          form.reset({ amount: "0", category: "supplies", description: "", date: todayStr });
          setCustomCategory(false);
          onSuccess();
        },
      });
    }
  }

  const isPending = isEdit ? editMutation.isPending : createPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("amount")}</FormLabel>
              <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value.toString()} data-testid="input-expense-amount" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="date" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("date")}</FormLabel>
              <FormControl><Input type="date" {...field} data-testid="input-expense-date" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("category")}</FormLabel>
              {customCategory ? (
                <div className="flex gap-2">
                  <FormControl><Input placeholder={t("enter_category")} {...field} autoFocus data-testid="input-expense-category-custom" /></FormControl>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomCategory(false); field.onChange("supplies"); }}>{t("cancel")}</Button>
                </div>
              ) : (
                <Select value={field.value} onValueChange={(value) => { if (value === "custom") { setCustomCategory(true); field.onChange(""); } else { field.onChange(value); } }}>
                  <FormControl><SelectTrigger data-testid="select-expense-category"><SelectValue placeholder={t("select_category_placeholder")} /></SelectTrigger></FormControl>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.toLowerCase()} value={category}>
                        {labelForCategory(category, t)}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">{t("add_new_category")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>{t("description")}</FormLabel>
            <FormControl><Textarea placeholder={t("expenses_subtitle")} className="resize-none" {...field} data-testid="input-expense-description" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full mt-2" disabled={isPending} data-testid="button-save-expense">
          {isPending ? t("saving") : isEdit ? t("update_expense") : t("record_expense")}
        </Button>
      </form>
    </Form>
  );
}
